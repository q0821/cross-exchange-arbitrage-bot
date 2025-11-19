# Quick Start Guide: 修復時間基準切換功能

**Feature**: 019-fix-time-basis-switching
**Date**: 2025-01-19
**Audience**: Developers implementing this fix

## Overview

這是一個錯誤修復功能，解決 Web 應用中時間基準切換的三個關鍵問題。本指南將幫助開發者快速理解問題、解決方案和實作步驟。

## 5 分鐘快速理解

### 問題摘要

1. **問題 1**: WebSocket handler 拒絕 4 小時時間基準
   - 前端已支援 1h, 4h, 8h, 24h
   - 後端只接受 1h, 8h, 24h
   - 用戶選擇 4h 會收到錯誤

2. **問題 2**: REST API 缺少標準化費率資料
   - CLI 已計算所有標準化版本
   - REST API 未回傳 `normalized` 和 `originalInterval` 欄位
   - 頁面刷新後無法顯示標準化資訊

3. **問題 3**: 費率差計算錯誤（核心問題）
   - 直接比較原始費率（不同交易所週期可能不同）
   - 應該使用標準化費率計算
   - 導致錯誤的套利機會判斷

### 解決方案摘要

| 問題 | 修改位置 | 解決方法 |
|------|----------|----------|
| 問題 1 | `src/websocket/handlers/MarketRatesHandler.ts:78` | 驗證陣列加入 `4` |
| 問題 2 | `app/api/market-rates/route.ts:64-72` | 回傳 `normalized` 和 `originalInterval` |
| 問題 3 | `src/models/FundingRate.ts:191-193` | 使用標準化費率計算差異 |

### 影響範圍

- ✅ 向後相容（現有功能不受影響）
- ✅ 不需要資料庫 migration
- ✅ 不需要新的依賴套件
- ✅ 約 5 個檔案需要修改

---

## Prerequisites（前置條件）

### 開發環境

- Node.js 20.x LTS
- pnpm (or npm/yarn)
- TypeScript 5.6+

### 專案熟悉度

建議先閱讀以下文件：
1. `src/services/monitor/FundingRateNormalizer.ts` - 標準化計算邏輯
2. `src/services/monitor/RatesCache.ts` - 資料快取結構
3. `app/(dashboard)/market-monitor/components/TimeBasisSelector.tsx` - 前端選擇器

### 相關 Features

- Feature 012: 4 小時時間基準切換選項（前端已實作）
- Feature 017: 資金費率間隔動態偵測（CLI 已實作）

---

## Step-by-Step Implementation（實作步驟）

### Step 1: 修復 WebSocket Handler（5 分鐘）

**檔案**: `src/websocket/handlers/MarketRatesHandler.ts`

**定位**: Line 78-90

**修改前**:
```typescript
if (![1, 8, 24].includes(timeBasis)) {
  socket.emit('error', {
    message: 'Invalid time basis',
    code: 'INVALID_INPUT',
    details: { received: timeBasis, expected: [1, 8, 24] }
  });
  return;
}
```

**修改後**:
```typescript
if (![1, 4, 8, 24].includes(timeBasis)) {  // ✅ 加入 4
  socket.emit('error', {
    message: 'Invalid time basis',
    code: 'INVALID_INPUT',
    details: { received: timeBasis, expected: [1, 4, 8, 24] }  // ✅ 更新錯誤訊息
  });
  return;
}
```

**驗證**:
```bash
# 執行測試
pnpm test src/websocket/handlers/MarketRatesHandler.test.ts

# 預期結果：測試通過
```

---

### Step 2: 擴展 REST API 回傳資料（10 分鐘）

**檔案**: `app/api/market-rates/route.ts`

**定位**: Line 64-72

**修改前**:
```typescript
const exchanges: Record<string, any> = {};
for (const [exchangeName, exchangeData] of rate.exchanges) {
  exchanges[exchangeName] = {
    rate: exchangeData.rate.fundingRate,
    ratePercent: (exchangeData.rate.fundingRate * 100).toFixed(4),
    price: exchangeData.price || exchangeData.rate.markPrice,
    nextFundingTime: exchangeData.rate.nextFundingTime.toISOString(),
  };
}
```

**修改後**:
```typescript
const exchanges: Record<string, any> = {};
for (const [exchangeName, exchangeData] of rate.exchanges) {
  exchanges[exchangeName] = {
    rate: exchangeData.rate.fundingRate,
    ratePercent: (exchangeData.rate.fundingRate * 100).toFixed(4),
    price: exchangeData.price || exchangeData.rate.markPrice,
    nextFundingTime: exchangeData.rate.nextFundingTime.toISOString(),
    // ✅ 新增欄位
    normalized: exchangeData.normalized || {},
    originalInterval: exchangeData.originalFundingInterval
  };
}
```

**驗證**:
```bash
# 啟動開發伺服器
pnpm dev

# 測試 API
curl -X GET http://localhost:3000/api/market-rates -H "Cookie: session=xxx" | jq '.data.rates[0].exchanges.binance.normalized'

# 預期結果：返回 normalized 物件
```

---

### Step 3: 重構費率差計算函數（20 分鐘）

**檔案**: `src/models/FundingRate.ts`

**定位**: Line 168-266 (createMultiExchangeFundingRatePair 函數)

#### 3.1 新增輔助函數

在檔案頂部新增：

```typescript
/**
 * 根據時間基準獲取標準化費率
 * 如果有標準化費率且原始週期與目標不同，使用標準化值
 * 否則使用原始費率
 */
function getNormalizedRate(data: ExchangeRateData, timeBasis: TimeBasis): number {
  const timeBasisKey = `${timeBasis}h` as '1h' | '4h' | '8h' | '24h';
  const normalized = data.normalized?.[timeBasisKey];

  // 如果有標準化費率且原始週期與目標不同，使用標準化值
  if (normalized !== undefined &&
      data.originalFundingInterval &&
      data.originalFundingInterval !== timeBasis) {
    return normalized;
  }

  // 否則使用原始費率（已經是目標時間基準或無標準化資料）
  return data.rate.fundingRate;
}
```

#### 3.2 更新函數簽名

**修改前**:
```typescript
export function createMultiExchangeFundingRatePair(
  symbol: string,
  exchangesData: Map<ExchangeName, ExchangeRateData>
): FundingRatePair {
```

**修改後**:
```typescript
export function createMultiExchangeFundingRatePair(
  symbol: string,
  exchangesData: Map<ExchangeName, ExchangeRateData>,
  timeBasis: TimeBasis = 8  // ✅ 新增參數，預設 8 小時
): FundingRatePair {
```

#### 3.3 更新費率提取邏輯

**定位**: Line 191-193

**修改前**:
```typescript
const rate1 = data1.rate.fundingRate;
const rate2 = data2.rate.fundingRate;
const spread = Math.abs(rate1 - rate2);
```

**修改後**:
```typescript
const rate1 = getNormalizedRate(data1, timeBasis);  // ✅ 使用標準化費率
const rate2 = getNormalizedRate(data2, timeBasis);  // ✅ 使用標準化費率
const spread = Math.abs(rate1 - rate2);
```

**驗證**:
```bash
# 執行單元測試
pnpm test src/models/FundingRate.test.ts

# 預期結果：測試通過，費率差計算正確
```

---

### Step 4: 更新 WebSocket formatRates 函數（5 分鐘）

**檔案**: `src/websocket/handlers/MarketRatesHandler.ts`

**定位**: Line 336-344

**修改前**:
```typescript
const exchanges: Record<string, any> = {};
for (const [exchangeName, exchangeData] of rate.exchanges) {
  exchanges[exchangeName] = {
    rate: exchangeData.rate.fundingRate,
    price: exchangeData.price || exchangeData.rate.markPrice || null,
  };
}
```

**修改後**:
```typescript
const exchanges: Record<string, any> = {};
for (const [exchangeName, exchangeData] of rate.exchanges) {
  exchanges[exchangeName] = {
    rate: exchangeData.rate.fundingRate,
    price: exchangeData.price || exchangeData.rate.markPrice || null,
    // ✅ 新增欄位（與 REST API 保持一致）
    normalized: exchangeData.normalized || {},
    originalInterval: exchangeData.originalFundingInterval
  };
}
```

---

### Step 5: 撰寫測試（15 分鐘）

#### 5.1 WebSocket Handler 測試

**新增檔案**: `tests/integration/websocket/MarketRatesHandler.test.ts`

```typescript
import { describe, it, expect } from '@jest/globals';
import { io, Socket } from 'socket.io-client';

describe('MarketRatesHandler - Time Basis Support', () => {
  let socket: Socket;

  beforeAll(() => {
    // 連接到 WebSocket 伺服器
    socket = io('http://localhost:3000', {
      auth: { /* ... */ }
    });
  });

  afterAll(() => {
    socket.close();
  });

  it('should accept timeBasis = 4', (done) => {
    socket.emit('set-time-basis', { timeBasis: 4 });

    socket.once('time-basis-updated', (data) => {
      expect(data.success).toBe(true);
      expect(data.timeBasis).toBe(4);
      done();
    });
  });

  it('should reject invalid timeBasis', (done) => {
    socket.emit('set-time-basis', { timeBasis: 6 });

    socket.once('error', (error) => {
      expect(error.code).toBe('INVALID_INPUT');
      expect(error.details.expected).toContain(4);
      done();
    });
  });

  it('should include normalized rates in rates:update', (done) => {
    socket.emit('subscribe:market-rates');

    socket.once('rates:update', (data) => {
      const firstRate = data.data.rates[0];
      expect(firstRate.exchanges.binance.normalized).toBeDefined();
      expect(firstRate.exchanges.binance.originalInterval).toBeDefined();
      done();
    });
  });
});
```

#### 5.2 費率差計算測試

**新增檔案**: `tests/unit/services/FundingRate.test.ts`

```typescript
import { describe, it, expect } from '@jest/globals';
import { createMultiExchangeFundingRatePair } from '@/src/models/FundingRate';
import { FundingRateRecord } from '@/src/models/FundingRate';

describe('createMultiExchangeFundingRatePair - Time Basis Support', () => {
  it('should calculate spread using normalized rates', () => {
    // 模擬資料：Binance 8h 週期 0.01%, OKX 4h 週期 0.005%
    const exchangesData = new Map([
      ['binance', {
        rate: new FundingRateRecord({
          exchange: 'binance',
          symbol: 'BTCUSDT',
          fundingRate: 0.0001,  // 0.01%
          nextFundingTime: new Date(),
          fundingInterval: 8
        }),
        price: 45000,
        normalized: {
          '1h': 0.0000125,
          '4h': 0.00005,
          '8h': 0.0001,
          '24h': 0.0003
        },
        originalFundingInterval: 8
      }],
      ['okx', {
        rate: new FundingRateRecord({
          exchange: 'okx',
          symbol: 'BTCUSDT',
          fundingRate: 0.00005,  // 0.005%
          nextFundingTime: new Date(),
          fundingInterval: 4
        }),
        price: 45001,
        normalized: {
          '1h': 0.0000125,
          '4h': 0.00005,
          '8h': 0.0001,
          '24h': 0.0003
        },
        originalFundingInterval: 4
      }]
    ]);

    // 測試 8h 時間基準
    const pair8h = createMultiExchangeFundingRatePair('BTCUSDT', exchangesData, 8);
    expect(pair8h.bestPair?.spreadPercent).toBeCloseTo(0.0, 2);  // 標準化後相同

    // 測試 4h 時間基準
    const pair4h = createMultiExchangeFundingRatePair('BTCUSDT', exchangesData, 4);
    expect(pair4h.bestPair?.spreadPercent).toBeCloseTo(0.0, 2);  // 標準化後相同

    // 測試 1h 時間基準
    const pair1h = createMultiExchangeFundingRatePair('BTCUSDT', exchangesData, 1);
    expect(pair1h.bestPair?.spreadPercent).toBeCloseTo(0.0, 2);  // 標準化後相同
  });

  it('should fallback to original rate when normalized data missing', () => {
    const exchangesData = new Map([
      ['binance', {
        rate: new FundingRateRecord({
          exchange: 'binance',
          symbol: 'BTCUSDT',
          fundingRate: 0.0001,
          nextFundingTime: new Date(),
          fundingInterval: 8
        }),
        price: 45000,
        // normalized missing
        originalFundingInterval: 8
      }],
      ['okx', {
        rate: new FundingRateRecord({
          exchange: 'okx',
          symbol: 'BTCUSDT',
          fundingRate: 0.00005,
          nextFundingTime: new Date(),
          fundingInterval: 4
        }),
        price: 45001,
        // normalized missing
        originalFundingInterval: 4
      }]
    ]);

    // 應該回退到原始費率
    const pair = createMultiExchangeFundingRatePair('BTCUSDT', exchangesData, 8);
    expect(pair.bestPair).toBeDefined();
    // 原始費率差：0.01% - 0.005% = 0.005%
    expect(pair.bestPair?.spreadPercent).toBeCloseTo(0.005, 4);
  });
});
```

---

## Verification Checklist（驗證清單）

完成實作後，請逐項檢查：

### 功能驗證

- [ ] **P1-1**: 用戶可以在前端選擇 4 小時時間基準
- [ ] **P1-2**: WebSocket 不會返回錯誤訊息
- [ ] **P2-1**: 頁面刷新後仍能看到標準化費率資訊
- [ ] **P2-2**: Tooltip 正確顯示原始週期和標準化說明
- [ ] **P1-3**: 切換時間基準時，費率差和年化收益正確更新

### 技術驗證

- [ ] **TypeScript**: 無型別錯誤 (`pnpm tsc --noEmit`)
- [ ] **Linting**: 無 ESLint 錯誤 (`pnpm lint`)
- [ ] **單元測試**: 所有測試通過 (`pnpm test`)
- [ ] **整合測試**: WebSocket 和 REST API 測試通過
- [ ] **建置**: 專案可以成功建置 (`pnpm build`)

### 向後相容性驗證

- [ ] **舊版客戶端**: 選擇 1h/8h/24h 仍正常運作
- [ ] **REST API**: 回應格式不破壞現有客戶端
- [ ] **WebSocket**: 事件名稱和結構未變更
- [ ] **效能**: API 回應時間 <520ms (P95)

---

## Common Issues（常見問題）

### Issue 1: TypeScript 型別錯誤

**錯誤訊息**:
```
Property 'normalized' does not exist on type 'ExchangeRateData'
```

**解決方法**:
檢查 `src/models/FundingRate.ts` 中的 `ExchangeRateData` 介面定義：
```typescript
export interface ExchangeRateData {
  rate: FundingRateRecord;
  price?: number | null;
  normalized?: {
    '1h'?: number;
    '4h'?: number;
    '8h'?: number;
    '24h'?: number;
  };
  originalFundingInterval?: number;
}
```

### Issue 2: 測試失敗 - WebSocket 連線失敗

**錯誤訊息**:
```
Error: WebSocket connection failed
```

**解決方法**:
1. 確保開發伺服器正在運行 (`pnpm dev`)
2. 檢查 WebSocket 伺服器是否啟動
3. 確認測試的 auth credentials 正確

### Issue 3: 費率差計算不正確

**症狀**: 切換時間基準後費率差沒有變化

**檢查點**:
1. `createMultiExchangeFundingRatePair` 是否接收 `timeBasis` 參數
2. `getNormalizedRate` 輔助函數是否正確實作
3. CLI 監控服務是否正在運行並填充標準化資料

**除錯方法**:
```typescript
// 在 getNormalizedRate 函數中加入日誌
function getNormalizedRate(data: ExchangeRateData, timeBasis: TimeBasis): number {
  console.log('Exchange:', data.rate.exchange);
  console.log('TimeBasis:', timeBasis);
  console.log('Normalized:', data.normalized);
  console.log('Original Interval:', data.originalFundingInterval);

  // ... rest of the function
}
```

---

## Deployment（部署）

### Pre-Deployment Checklist

- [ ] 所有測試通過
- [ ] Code review 完成
- [ ] 憲章合規性檢查通過
- [ ] 建置成功

### Deployment Steps

```bash
# 1. 確保在正確的分支
git checkout 019-fix-time-basis-switching

# 2. 執行完整測試套件
pnpm test

# 3. 建置專案
pnpm build

# 4. 提交變更
git add .
git commit -m "fix: 修復時間基準切換功能的三個關鍵問題"

# 5. 合併到 main 分支
git checkout main
git merge 019-fix-time-basis-switching

# 6. 部署
# (根據專案的部署流程)
```

### Post-Deployment Verification

1. **監控 WebSocket 錯誤率**: 應保持 <1%
2. **監控 API 延遲**: P95 應 <520ms
3. **使用者測試**: 確認 4h 時間基準可用
4. **日誌檢查**: 無異常錯誤

---

## Rollback Plan（回滾計畫）

如果部署後發現問題：

```bash
# 快速回滾到前一個版本
git revert HEAD

# 或回滾到特定 commit
git reset --hard <previous-commit-hash>

# 重新部署
pnpm build && [deploy command]
```

**影響範圍**: 用戶選擇 4h 會再次收到錯誤，但 1h/8h/24h 不受影響。

---

## Next Steps（後續步驟）

完成此修復後，建議：

1. **執行 `/speckit.tasks`**: 生成詳細的任務清單
2. **執行 `/speckit.implement`**: 開始實作修復
3. **監控使用者回饋**: 確認問題是否完全解決
4. **考慮效能優化**: 如果 API 延遲過高，可以考慮只回傳用戶選擇的時間基準

---

## Resources（資源）

### Documentation
- [Feature Spec](./spec.md) - 完整功能規格
- [Implementation Plan](./plan.md) - 技術計劃
- [Data Model](./data-model.md) - 資料結構定義
- [WebSocket Contract](./contracts/websocket.md) - WebSocket API 規範
- [REST API Contract](./contracts/rest-api.md) - REST API 規範

### Related Features
- Feature 012: 4 小時時間基準切換選項
- Feature 017: 資金費率間隔動態偵測

### Support
- 遇到問題請參考 [Common Issues](#common-issues常見問題)
- 或聯繫專案維護者

---

**Happy Coding! 🚀**
