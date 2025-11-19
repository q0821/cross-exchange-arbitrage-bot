# Quickstart Guide: 資金費率間隔動態獲取

**Feature**: 017-funding-rate-intervals | **Date**: 2025-11-19
**目標對象**: 開發者

本指南提供快速步驟，實作和驗證各交易所的資金費率間隔動態獲取功能。

---

## 快速總覽

**執行時間**: 2-4 小時（依 P1 MVP 範圍）
**風險等級**: 🟢 低風險（純邏輯修改，無資料庫變更）
**測試需求**: ✅ 必須（單元測試 + 整合測試）

**一句話摘要**:
修復各交易所 connector 的 `getFundingRate()` 方法，動態獲取並填充 `fundingInterval` 欄位，取代硬編碼的 8 小時預設值。

---

## 前置需求

### 1. 環境檢查

確認開發環境已設定：

```bash
# Node.js 版本 (需要 >= 20.0.0)
node --version
# 輸出範例: v20.11.0

# pnpm 版本 (需要 >= 8.0.0)
pnpm --version
# 輸出範例: 8.15.0

# TypeScript 版本
pnpm tsc --version
# 輸出範例: Version 5.6.0
```

### 2. 專案設定

確認當前目錄為專案根目錄：

```bash
pwd
# 輸出應為: /path/to/cross-exchange-arbitrage-bot

# 檢查分支
git branch
# 應在 017-funding-rate-intervals 分支
```

### 3. 依賴安裝

```bash
# 安裝所有依賴
pnpm install

# 確認 CCXT 版本
pnpm list ccxt
# 輸出: ccxt@4.x.x
```

### 4. API 金鑰設定（測試用）

```bash
# 檢查 .env 檔案
cat .env | grep -E "BINANCE_API_KEY|OKX_API_KEY"
# 應輸出: BINANCE_API_KEY=your_api_key (用於測試，非必須)
```

**注意**: 本功能使用公開 API 端點，不需要 API 金鑰即可測試。

---

## 執行步驟（P1 MVP: Binance）

### Step 1: 建立間隔快取類別

**檔案**: `src/lib/FundingIntervalCache.ts`

```typescript
export interface CachedInterval {
  interval: number;
  source: 'api' | 'calculated' | 'default';
  timestamp: number;
  ttl: number;
}

export class FundingIntervalCache {
  private cache = new Map<string, CachedInterval>();
  private defaultTTL: number;

  constructor(defaultTTL: number = 24 * 60 * 60 * 1000) {
    this.defaultTTL = defaultTTL;
  }

  set(exchange: string, symbol: string, interval: number, source: 'api' | 'calculated' | 'default'): void {
    const key = `${exchange}-${symbol}`;
    this.cache.set(key, {
      interval,
      source,
      timestamp: Date.now(),
      ttl: this.defaultTTL,
    });
  }

  get(exchange: string, symbol: string): number | null {
    const key = `${exchange}-${symbol}`;
    const cached = this.cache.get(key);

    if (!cached) return null;

    // 檢查是否過期
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.interval;
  }

  setAll(exchange: string, intervals: Map<string, number>, source: 'api' | 'calculated' | 'default'): void {
    for (const [symbol, interval] of intervals) {
      this.set(exchange, symbol, interval, source);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // TODO: 實作命中率追蹤
    };
  }
}
```

**驗證**:
```bash
# 建立測試檔案
touch tests/unit/lib/FundingIntervalCache.test.ts

# 執行測試（後續步驟會補充測試內容）
pnpm test FundingIntervalCache
```

---

### Step 2: 修改 Binance Connector

**檔案**: `src/connectors/binance.ts`

**2.1 新增間隔快取實例**:
```typescript
import { FundingIntervalCache } from '../lib/FundingIntervalCache';

export class BinanceConnector {
  private intervalCache: FundingIntervalCache;

  constructor(/* existing params */) {
    // existing code...
    this.intervalCache = new FundingIntervalCache();
  }
}
```

**2.2 新增 `getFundingInterval()` 方法**:
```typescript
/**
 * 獲取單一交易對的資金費率間隔（小時）
 * @param symbol 交易對符號 (如 'BTCUSDT')
 * @returns 間隔值（小時：4 或 8）
 */
async getFundingInterval(symbol: string): Promise<number> {
  try {
    // 1. 檢查快取
    const cached = this.intervalCache.get('binance', symbol);
    if (cached !== null) {
      this.logger.debug({ symbol, interval: cached }, 'Interval retrieved from cache');
      return cached;
    }

    // 2. 呼叫 Binance API /fapi/v1/fundingInfo
    const response = await this.client.futuresFundingInfo(symbol);

    // 3. 解析 fundingIntervalHours 欄位
    const interval = response.fundingIntervalHours || 8; // 預設 8h

    // 4. 驗證間隔值
    if (interval !== 4 && interval !== 8) {
      this.logger.warn({ symbol, interval }, 'Non-standard funding interval detected');
    }

    // 5. 快取並返回
    this.intervalCache.set('binance', symbol, interval, 'api');
    this.logger.info({ symbol, interval, source: 'api' }, 'Funding interval fetched from Binance API');

    return interval;
  } catch (error) {
    this.logger.warn({ symbol, error: error.message }, 'Failed to fetch funding interval, using default 8h');
    return 8; // 降級至預設值
  }
}
```

**2.3 修改 `getFundingRate()` 填充 `fundingInterval`**:
```typescript
async getFundingRate(symbol: string): Promise<ExchangeRateData> {
  try {
    // 現有程式碼：獲取費率
    const premium = await this.client.futuresPremiumIndex(symbol);

    // 🆕 新增：獲取間隔
    const interval = await this.getFundingInterval(symbol);

    return {
      rate: parseFloat(premium.lastFundingRate),
      nextTime: new Date(parseInt(premium.nextFundingTime)).toISOString(),
      fundingInterval: interval,  // 🆕 填充欄位
      timestamp: Date.now(),
    };
  } catch (error) {
    this.logger.error({ symbol, error: error.message }, 'Failed to fetch funding rate');
    throw error;
  }
}
```

**驗證**:
```bash
# 編譯檢查
pnpm tsc --noEmit

# 執行單元測試（需先建立測試檔案）
pnpm test binance.test.ts
```

---

### Step 3: 建立單元測試

**檔案**: `tests/unit/connectors/binance.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BinanceConnector } from '../../../src/connectors/binance';

describe('BinanceConnector.getFundingInterval', () => {
  let connector: BinanceConnector;

  beforeEach(() => {
    connector = new BinanceConnector({ /* config */ });
  });

  it('should fetch 4h interval for BLZUSDT', async () => {
    // Mock API response
    vi.spyOn(connector['client'], 'futuresFundingInfo').mockResolvedValue({
      symbol: 'BLZUSDT',
      fundingIntervalHours: 4,
    });

    const interval = await connector.getFundingInterval('BLZUSDT');

    expect(interval).toBe(4);
  });

  it('should fetch 8h interval for BTCUSDT', async () => {
    vi.spyOn(connector['client'], 'futuresFundingInfo').mockResolvedValue({
      symbol: 'BTCUSDT',
      fundingIntervalHours: 8,
    });

    const interval = await connector.getFundingInterval('BTCUSDT');

    expect(interval).toBe(8);
  });

  it('should use default 8h when API fails', async () => {
    vi.spyOn(connector['client'], 'futuresFundingInfo').mockRejectedValue(
      new Error('Network error')
    );

    const interval = await connector.getFundingInterval('BTCUSDT');

    expect(interval).toBe(8);
  });

  it('should cache interval values', async () => {
    const spy = vi.spyOn(connector['client'], 'futuresFundingInfo').mockResolvedValue({
      symbol: 'BTCUSDT',
      fundingIntervalHours: 8,
    });

    // 第一次呼叫
    await connector.getFundingInterval('BTCUSDT');
    expect(spy).toHaveBeenCalledTimes(1);

    // 第二次呼叫（應從快取讀取）
    await connector.getFundingInterval('BTCUSDT');
    expect(spy).toHaveBeenCalledTimes(1); // 不應增加
  });
});
```

**執行測試**:
```bash
pnpm test binance.test.ts
# 預期輸出: ✓ All tests passed
```

---

### Step 4: 建立整合測試（實際 API）

**檔案**: `tests/integration/funding-intervals.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { BinanceConnector } from '../../src/connectors/binance';

describe('Binance Funding Interval Integration', () => {
  const connector = new BinanceConnector({ /* config */ });

  it('should fetch real interval for BLZUSDT (4h)', async () => {
    const interval = await connector.getFundingInterval('BLZUSDT');
    expect(interval).toBe(4);
  }, 10000); // 10秒超時

  it('should fetch real interval for BTCUSDT (8h)', async () => {
    const interval = await connector.getFundingInterval('BTCUSDT');
    expect(interval).toBe(8);
  }, 10000);
});
```

**執行整合測試**:
```bash
# 需要網路連線
pnpm test:integration
```

---

### Step 5: 移除硬編碼預設值

**檔案**: `src/services/monitor/FundingRateMonitor.ts`

**修改前** (line 369):
```typescript
const originalInterval = rateData.fundingInterval || 8; // 硬編碼預設值
```

**修改後**:
```typescript
const originalInterval = rateData.fundingInterval;

if (!originalInterval) {
  this.logger.warn({ exchange, symbol }, 'Funding interval missing in rate data');
  return; // 跳過此交易對或使用降級邏輯
}
```

**驗證**:
```bash
# 編譯檢查
pnpm tsc --noEmit

# 執行監控服務測試
pnpm test FundingRateMonitor
```

---

### Step 6: 驗證完整流程

**啟動監控服務**:
```bash
pnpm monitor:start
```

**預期日誌輸出**:
```
[INFO] Binance: Funding interval fetched from Binance API
  symbol: "BLZUSDT"
  interval: 4
  source: "api"

[INFO] Binance: Funding interval fetched from Binance API
  symbol: "BTCUSDT"
  interval: 8
  source: "api"

[DEBUG] Interval retrieved from cache
  symbol: "BLZUSDT"
  interval: 4
```

**檢查標準化是否正確**:
```bash
# 查看日誌中的標準化費率
tail -f logs/app.log | grep "normalized"

# 預期：BLZUSDT 的 4h 費率應被 ×2 標準化為 8h 等效費率
```

---

## 驗證 Checklist

**P1 MVP 完成標準** (Binance):

- [ ] `FundingIntervalCache` 類別已建立並通過單元測試
- [ ] `BinanceConnector.getFundingInterval()` 方法已實作
- [ ] `BinanceConnector.getFundingRate()` 正確填充 `fundingInterval` 欄位
- [ ] 單元測試覆蓋率 > 80%
- [ ] 整合測試驗證 BLZUSDT (4h) 和 BTCUSDT (8h)
- [ ] 硬編碼預設值已從 `FundingRateMonitor` 移除
- [ ] 監控服務啟動無錯誤
- [ ] 日誌記錄間隔來源（api/cache/default）
- [ ] 快取機制運作正常（第二次呼叫不觸發 API）

---

## 常見問題 (Troubleshooting)

### 問題 1: Binance API 返回 401 錯誤

**可能原因**: API 金鑰無效（但 `/fapi/v1/fundingInfo` 為公開端點，不應需要金鑰）

**解決方案**:
```bash
# 確認 Binance SDK 配置
# 檢查是否誤設 apiKey（應留空或移除）
```

### 問題 2: 測試超時

**可能原因**: 網路延遲或 Binance API 限制

**解決方案**:
```typescript
// 增加測試超時時間
it('should fetch interval', async () => {
  // ...
}, 30000); // 30 秒超時
```

### 問題 3: 快取未生效

**症狀**: 每次呼叫都觸發 API 請求

**檢查**:
```typescript
// 確認快取鍵格式正確
const key = `${exchange}-${symbol}`; // 應為 'binance-BTCUSDT'
```

### 問題 4: TypeScript 編譯錯誤

**症狀**: `fundingInterval` 欄位型別錯誤

**解決方案**:
```bash
# 確認型別定義已更新
cat src/connectors/types.ts | grep fundingInterval
# 應輸出: fundingInterval?: number;
```

---

## 下一步（P2: OKX）

完成 P1 MVP 後，可繼續實作 OKX 間隔計算：

**檔案**: `src/connectors/okx.ts`

```typescript
async getFundingInterval(symbol: string): Promise<number> {
  try {
    const rate = await this.fetchFundingRate(symbol);

    // 計算時間戳差值
    const fundingTime = parseInt(rate.fundingTime);
    const nextFundingTime = parseInt(rate.nextFundingTime);

    if (!fundingTime || !nextFundingTime || nextFundingTime <= fundingTime) {
      throw new Error('Invalid funding times');
    }

    const intervalMs = nextFundingTime - fundingTime;
    const intervalHours = intervalMs / 3600000;

    this.intervalCache.set('okx', symbol, intervalHours, 'calculated');
    this.logger.info({ symbol, interval: intervalHours, source: 'calculated' }, 'OKX interval calculated');

    return intervalHours;
  } catch (error) {
    this.logger.warn({ symbol, error: error.message }, 'Failed to calculate OKX interval, using default 8h');
    return 8;
  }
}
```

---

## 效能監控

**監控指標**:
```bash
# 快取命中率
tail -f logs/app.log | grep "cache" | grep "hit"

# API 呼叫次數
tail -f logs/app.log | grep "Funding interval fetched from.*API" | wc -l

# 預期快取命中率 > 90% (符合 SC-005)
```

---

## Rollback 步驟

如需回滾此功能：

```bash
# 1. 停止監控服務
pnpm monitor:stop

# 2. Git revert
git revert <commit-hash>

# 3. 重新啟動服務
pnpm monitor:start

# 4. 驗證（系統應恢復至硬編碼 8h 預設值）
tail -f logs/app.log | grep "Using default 8h interval"
```

---

## 相關資源

- **技術研究**: [research.md](./research.md) - 詳細的 API 調查和技術決策
- **資料模型**: [data-model.md](./data-model.md) - FundingIntervalCache 結構說明
- **API 合約**: [contracts/api-changes.md](./contracts/api-changes.md) - 無 API 變更說明
- **功能規格**: [spec.md](./spec.md) - 完整的功能需求和驗收標準
- **技術計劃**: [plan.md](./plan.md) - 實作計劃和 Constitution 檢查

---

**最後更新**: 2025-11-19
**版本**: 1.0.0
**狀態**: Ready for Implementation ✅
