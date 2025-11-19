# Data Model: 修復時間基準切換功能

**Feature**: 019-fix-time-basis-switching
**Date**: 2025-01-19
**Status**: Complete

## Overview

此功能是錯誤修復，**不涉及新的資料模型**。所有必要的資料結構已經存在於現有程式碼中。本文件記錄相關的資料結構定義和修改點。

## Existing Data Structures

### 1. TimeBasis Type（時間基準型別）

**定義位置**: `src/lib/validation/fundingRateSchemas.ts`

**TypeScript 定義**:
```typescript
export type TimeBasis = 1 | 4 | 8 | 24;
```

**描述**: 聯合型別，表示支援的時間基準（小時數）

**修改**: 無（型別定義已包含 4，只是 runtime 驗證邏輯未同步）

**驗證規則**:
- 必須是以下值之一：1, 4, 8, 24
- 用於前端選擇器和後端驗證

---

### 2. ExchangeRateData（交易所費率資料）

**定義位置**: `src/models/FundingRate.ts`

**TypeScript 定義**:
```typescript
export interface ExchangeRateData {
  rate: FundingRateRecord;
  price?: number | null;
  normalized?: {
    '1h'?: number;   // 標準化為 1 小時基準的費率
    '4h'?: number;   // 標準化為 4 小時基準的費率
    '8h'?: number;   // 標準化為 8 小時基準的費率
    '24h'?: number;  // 標準化為 24 小時基準的費率
  };
  originalFundingInterval?: number; // 原始資金費率週期（小時數）
}
```

**描述**: 儲存單一交易所的費率資訊，包含原始費率和所有標準化版本

**字段說明**:
- `rate`: FundingRateRecord 物件，包含原始費率和時間戳
- `price`: 當前標記價格（可選）
- `normalized`: 標準化費率物件（可選）
  - 包含四個時間基準的標準化版本
  - CLI 監控服務負責計算並填充
- `originalFundingInterval`: 交易所原始結算週期（可選）
  - 用於判斷是否需要標準化
  - 例如：Binance 為 8, OKX 某些合約為 4

**修改**: 無（結構已定義，只是 WebSocket/REST API 未完整回傳）

**資料來源**:
- CLI 監控服務（FundingRateMonitor）計算並寫入 RatesCache
- WebSocket 和 REST API 從 RatesCache 讀取

---

### 3. BestArbitragePair（最佳套利對）

**定義位置**: `src/models/FundingRate.ts`

**TypeScript 定義**:
```typescript
export interface BestArbitragePair {
  longExchange: ExchangeName;
  shortExchange: ExchangeName;
  spreadPercent: number;
  spreadAnnualized: number;
  priceDiffPercent?: number | null;
  netReturn?: number; // 已棄用，Feature 014 移除
}
```

**描述**: 儲存最佳套利組合的資訊

**字段說明**:
- `spreadPercent`: 費率差異百分比（例如 0.5 表示 0.5%）
- `spreadAnnualized`: 年化收益百分比

**修改內容**:
- **計算邏輯變更**：`spreadPercent` 和 `spreadAnnualized` 將基於標準化費率計算
- **資料結構**：不變

**影響**:
- 切換時間基準時，此物件的值會動態變化
- 前端顯示的費率差和年化收益會正確反映時間基準

---

### 4. FundingRatePair（資金費率配對）

**定義位置**: `src/models/FundingRate.ts`

**TypeScript 定義**:
```typescript
export interface FundingRatePair {
  symbol: string;
  exchanges: Map<ExchangeName, ExchangeRateData>;
  bestPair: BestArbitragePair | undefined;
  recordedAt: Date;
  // 向後相容屬性
  binance?: FundingRateRecord;
  okx?: FundingRateRecord;
  binancePrice?: number;
  okxPrice?: number;
  spreadPercent?: number;
  spreadAnnualized?: number;
  priceDiffPercent?: number;
}
```

**描述**: 多交易所費率配對資料結構

**字段說明**:
- `exchanges`: Map 結構，鍵為交易所名稱，值為 ExchangeRateData
- `bestPair`: 最佳套利對資訊

**修改**: 無（結構完整，只需修改填充邏輯）

---

## Data Flow（資料流）

### Current State（修復前）

```
CLI Monitor
    ↓ (計算標準化費率)
RatesCache {
  symbol: BTCUSDT,
  exchanges: {
    binance: {
      rate: 0.0001,
      normalized: { '1h': 0.0000125, '4h': 0.00005, '8h': 0.0001, '24h': 0.0003 },
      originalInterval: 8
    },
    okx: {
      rate: 0.00005,
      normalized: { '1h': 0.0000125, '4h': 0.00005, '8h': 0.0001, '24h': 0.0003 },
      originalInterval: 4
    }
  },
  bestPair: {
    spreadPercent: 0.005,  // ❌ 使用原始費率計算（0.0001 vs 0.00005）
    ...
  }
}
    ↓
WebSocket/REST API {
  exchanges: {
    binance: {
      rate: 0.0001,
      // ❌ 缺少 normalized 和 originalInterval
    },
    okx: {
      rate: 0.00005,
      // ❌ 缺少 normalized 和 originalInterval
    }
  },
  bestPair: {
    spreadPercent: 0.005  // ❌ 錯誤值
  }
}
    ↓
Frontend (顯示錯誤的費率差)
```

### Fixed State（修復後）

```
CLI Monitor
    ↓ (計算標準化費率)
RatesCache {
  symbol: BTCUSDT,
  exchanges: {
    binance: {
      rate: 0.0001,
      normalized: { '1h': 0.0000125, '4h': 0.00005, '8h': 0.0001, '24h': 0.0003 },
      originalInterval: 8
    },
    okx: {
      rate: 0.00005,
      normalized: { '1h': 0.0000125, '4h': 0.00005, '8h': 0.0001, '24h': 0.0003 },
      originalInterval: 4
    }
  },
  bestPair: {
    spreadPercent: 0.0,  // ✅ 使用標準化費率計算（8h: 0.0001 vs 0.0001）
    ...
  }
}
    ↓
WebSocket/REST API {
  exchanges: {
    binance: {
      rate: 0.0001,
      normalized: { '1h': 0.0000125, '4h': 0.00005, '8h': 0.0001, '24h': 0.0003 },  // ✅ 完整資料
      originalInterval: 8  // ✅ 原始週期
    },
    okx: {
      rate: 0.00005,
      normalized: { '1h': 0.0000125, '4h': 0.00005, '8h': 0.0001, '24h': 0.0003 },  // ✅ 完整資料
      originalInterval: 4  // ✅ 原始週期
    }
  },
  bestPair: {
    spreadPercent: 0.0  // ✅ 正確值（基於 8h 標準化）
  }
}
    ↓
Frontend
  ↓ (用戶選擇 4h 時間基準)
顯示：
  - Binance: 0.00005% (4h)  // 從 normalized['4h'] 取得
  - OKX: 0.00005% (4h)      // 從 normalized['4h'] 取得
  - 費率差: 0.0%            // 正確！
```

---

## Validation Rules（驗證規則）

### 1. TimeBasis Validation（時間基準驗證）

**位置**: `src/websocket/handlers/MarketRatesHandler.ts`

**規則**:
```typescript
// 修改前
if (![1, 8, 24].includes(timeBasis)) {
  // 拒絕請求
}

// 修改後
if (![1, 4, 8, 24].includes(timeBasis)) {
  // 拒絕請求
}
```

**錯誤訊息**:
```json
{
  "message": "Invalid time basis",
  "code": "INVALID_INPUT",
  "details": {
    "received": 4,
    "expected": [1, 4, 8, 24]
  }
}
```

### 2. Normalized Data Fallback（標準化資料降級）

**位置**: `src/models/FundingRate.ts` (新增輔助函數)

**規則**:
```typescript
function getNormalizedRate(data: ExchangeRateData, timeBasis: TimeBasis): number {
  const timeBasisKey = `${timeBasis}h` as '1h' | '4h' | '8h' | '24h';
  const normalized = data.normalized?.[timeBasisKey];

  // 規則 1: 如果有標準化費率且原始週期與目標不同，使用標準化值
  if (normalized !== undefined &&
      data.originalFundingInterval &&
      data.originalFundingInterval !== timeBasis) {
    return normalized;
  }

  // 規則 2: 否則使用原始費率
  return data.rate.fundingRate;
}
```

**降級邏輯**:
1. 優先使用標準化費率（當原始週期 ≠ 目標週期）
2. 如果標準化資料缺失或原始週期 = 目標週期，使用原始費率
3. 如果原始週期資訊缺失，假設為 8 小時（行業標準）

---

## State Transitions（狀態轉換）

此功能不涉及狀態機，但有資料流轉：

### WebSocket 時間基準設定流程

```
User Action: 選擇時間基準
    ↓
Frontend: emit('set-time-basis', { timeBasis: 4 })
    ↓
WebSocket Handler:
  - 驗證 timeBasis ∈ [1, 4, 8, 24]  ✅
  - 儲存至 socket.data.timeBasis
    ↓
Frontend: 接收確認事件 'time-basis-updated'
    ↓
Frontend: 更新本地 state
    ↓
WebSocket Handler: 下次推送時使用新的時間基準（可選，目前不實作）
```

---

## Database Schema（資料庫結構）

**此功能不涉及資料庫變更**。所有資料都在記憶體中（RatesCache）處理。

### Related Prisma Models（相關模型）

雖然不修改，但與此功能相關的模型：

```prisma
// FundingRateValidation model（僅供參考，此功能不使用）
model FundingRateValidation {
  id                    String   @id @default(uuid())
  symbol                String
  fundingRate           Decimal  @db.Decimal(18, 10)
  // ... 其他欄位
}
```

**說明**: CLI 監控服務會將資料寫入資料庫，但 Web 層（本次修復範圍）只讀取記憶體快取。

---

## Relationships（關係）

### Entity Relationships

```
FundingRatePair (1) ────┬──── (N) ExchangeRateData
                        │
                        └──── (0..1) BestArbitragePair

ExchangeRateData (1) ──── (1) FundingRateRecord
                      └─── (0..1) Normalized Rates Object
```

**說明**:
- 一個 FundingRatePair 包含多個交易所的資料
- 每個交易所資料包含一個費率記錄和可選的標準化費率物件
- 最佳套利對是可選的（當費率差不足時為 null）

---

## Data Integrity Constraints（資料完整性約束）

### 1. TimeBasis 合法性
- 必須是 `1 | 4 | 8 | 24`
- 前端和後端雙重驗證

### 2. Normalized Rates 一致性
- 如果存在 `normalized` 物件，必須包含至少一個時間基準的費率
- 標準化費率與原始費率的關係：`normalized[Th] = rate × originalInterval / T`

### 3. 費率差計算邏輯
- 必須使用相同時間基準的標準化費率進行比較
- 不能直接比較不同週期的原始費率

---

## Performance Considerations（效能考量）

### Memory Usage（記憶體使用）
- **現狀**: RatesCache 儲存約 100 個交易對的費率資料
- **增加**: 每個交易對增加 ~200 bytes（normalized + originalInterval）
- **總增加**: ~20KB（可忽略）

### Computation Cost（計算成本）
- **標準化費率計算**: O(1) 查表（已預先計算）
- **費率差計算**: O(1) 額外的條件判斷
- **總影響**: <1% 效能影響

---

## Migration Strategy（遷移策略）

**不需要資料遷移**，因為：
1. 無資料庫 schema 變更
2. 所有修改都在應用層
3. 向後相容現有資料結構

### Backward Compatibility（向後相容性）

**舊版客戶端**（使用 1h/8h/24h）:
- ✅ 完全不受影響
- ✅ 可以繼續正常運作

**新版客戶端**（使用 4h）:
- ✅ 在後端修復後可以正常使用
- ❌ 在後端修復前會收到錯誤（預期行為）

---

## Summary

此功能的資料模型變更總結：

| 項目 | 變更類型 | 說明 |
|------|----------|------|
| TimeBasis 型別 | 無變更 | 已定義，只需同步 runtime 驗證 |
| ExchangeRateData | 無變更 | 結構完整，需修改填充邏輯 |
| BestArbitragePair | 邏輯變更 | 計算方式改為使用標準化費率 |
| FundingRatePair | 無變更 | 結構完整，不需要修改 |
| 資料庫 Schema | 無變更 | 不涉及持久化資料 |

**關鍵點**：所有必要的資料結構已經存在，此次修復只是修正邏輯錯誤和資料傳遞問題。
