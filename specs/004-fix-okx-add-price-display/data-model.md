# Data Model: 修正 OKX 資金費率與增強價格顯示

**Feature**: 004-fix-okx-add-price-display
**Date**: 2025-01-21
**Status**: Phase 1 Complete

本文件定義所有資料實體、欄位、關聯和驗證規則。

---

## Entity Relationship Diagram

```
┌─────────────────────────┐
│   FundingRateValidation │
├─────────────────────────┤
│ id (PK)                 │
│ timestamp               │
│ symbol                  │
│ exchange                │
│ okxRate                 │
│ okxNextRate             │
│ ccxtRate                │
│ discrepancyPercent      │
│ validationStatus        │
│ dataSource              │
│ errorMessage            │
└─────────────────────────┘
         │
         │ (1:N)
         ▼
┌─────────────────────────┐         ┌─────────────────────────┐
│      PriceData          │         │  ArbitrageAssessment    │
├─────────────────────────┤         ├─────────────────────────┤
│ id (PK)                 │         │ id (PK)                 │
│ timestamp               │◄───────┤│ timestamp               │
│ symbol                  │         │ symbol                  │
│ exchange                │         │ fundingRateSpread       │
│ lastPrice               │         │ priceSpread             │
│ bidPrice                │         │ totalFees               │
│ askPrice                │         │ netProfit               │
│ volume24h               │         │ direction               │
│ source (WS/REST)        │         │ feasibility             │
│ latencyMs               │         │ riskLevel               │
└─────────────────────────┘         │ extremeSpreadDetected   │
                                     └─────────────────────────┘
```

**關聯說明**:
- `FundingRateValidation` 與 `PriceData` 透過 `(timestamp, symbol)` 鬆散關聯（用於分析）
- `ArbitrageAssessment` 是運算結果，不持久化到資料庫（僅用於即時顯示）

---

## Entities

### 1. FundingRateValidation (資金費率驗證記錄)

**Purpose**: 記錄 OKX 資金費率的雙重驗證結果，供後續分析和異常檢測使用。

**Source**: 規格 FR-010, Key Entities

**Table Name**: `funding_rate_validations`

#### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | 自增主鍵 |
| `timestamp` | TIMESTAMPTZ | NOT NULL, INDEX | 驗證時間（UTC），用於時序查詢 |
| `symbol` | VARCHAR(20) | NOT NULL, INDEX | 交易對符號（例如: `BTC-USDT-SWAP`） |
| `exchange` | VARCHAR(10) | DEFAULT 'OKX' | 交易所名稱 |
| `okxRate` | DECIMAL(18,8) | NOT NULL | OKX Native API 返回的資金費率 |
| `okxNextRate` | DECIMAL(18,8) | NULL | OKX 預測的下期資金費率 |
| `okxFundingTime` | TIMESTAMPTZ | NULL | OKX 資金費率結算時間 |
| `ccxtRate` | DECIMAL(18,8) | NULL | CCXT 返回的資金費率（驗證來源） |
| `ccxtFundingTime` | TIMESTAMPTZ | NULL | CCXT 資金費率時間戳 |
| `discrepancyPercent` | DECIMAL(10,6) | NULL | 兩個來源的差異百分比 |
| `validationStatus` | VARCHAR(10) | CHECK IN ('PASS','FAIL','ERROR','N/A') | 驗證狀態 |
| `dataSource` | VARCHAR(20) | DEFAULT 'API' | 主要數據來源 ('API' or 'CCXT') |
| `errorMessage` | TEXT | NULL | 錯誤訊息（若有） |

#### Validation Rules

1. **資金費率範圍**: `okxRate` 和 `ccxtRate` 必須在 -1.0 到 1.0 之間（-100% 到 100%）
2. **差異計算**: `discrepancyPercent = ABS((okxRate - ccxtRate) / okxRate) * 100`
3. **驗證狀態**:
   - `PASS`: `discrepancyPercent < 0.0001`
   - `FAIL`: `discrepancyPercent >= 0.0001`
   - `ERROR`: API 調用失敗
   - `N/A`: 其中一個來源無數據

#### Indexes

```sql
-- 複合主鍵（時序資料）
PRIMARY KEY (timestamp, symbol)

-- 查詢優化索引
CREATE INDEX idx_validations_symbol ON funding_rate_validations(symbol, timestamp DESC);
CREATE INDEX idx_validations_status ON funding_rate_validations(validation_status, timestamp DESC);
```

#### TimescaleDB Hypertable

```sql
-- 轉換為 hypertable（時序優化）
SELECT create_hypertable('funding_rate_validations', 'timestamp');

-- 資料保留政策（90 天）
SELECT add_retention_policy('funding_rate_validations', INTERVAL '90 days');

-- 自動壓縮政策（7 天前）
SELECT add_compression_policy('funding_rate_validations', INTERVAL '7 days');
```

#### State Transitions

```
   [API 調用]
       │
       ▼
   [比較兩來源]
       │
       ├──► discrepancy < 0.0001% ──► PASS
       ├──► discrepancy >= 0.0001% ──► FAIL
       ├──► API 錯誤 ──────────────► ERROR
       └──► 缺少數據 ──────────────► N/A
```

---

### 2. PriceData (價格數據)

**Purpose**: 記錄各交易所的即時價格數據，支援 WebSocket 和 REST API 雙來源。

**Source**: 規格 Key Entities, FR-003

**Storage**: 不持久化（僅記憶體快取），或選擇性記錄到 TimescaleDB 供歷史分析

**In-Memory Model** (TypeScript):

#### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | string (UUID) | REQUIRED | 唯一識別碼 |
| `timestamp` | Date | REQUIRED | 價格更新時間（交易所時間戳） |
| `symbol` | string | REQUIRED | 交易對符號（例如: `BTCUSDT`） |
| `exchange` | string | REQUIRED | 交易所名稱 (`binance` or `okx`) |
| `lastPrice` | number | REQUIRED | 最新成交價 |
| `bidPrice` | number | REQUIRED | 最佳買入價 |
| `askPrice` | number | REQUIRED | 最佳賣出價 |
| `volume24h` | number | OPTIONAL | 24 小時成交量 |
| `source` | 'websocket' \| 'rest' | REQUIRED | 數據來源類型 |
| `latencyMs` | number | OPTIONAL | 數據延遲（毫秒） |

#### Validation Rules

1. **價格有效性**: `lastPrice`, `bidPrice`, `askPrice` 必須 > 0
2. **價格關係**: `bidPrice <= lastPrice <= askPrice`
3. **時效性**: 數據時間戳不得超過當前時間 10 秒（否則標記為 stale）
4. **中間價計算**: `midPrice = (bidPrice + askPrice) / 2`

#### TypeScript Interface

```typescript
export interface PriceData {
  id: string;
  timestamp: Date;
  symbol: string;
  exchange: 'binance' | 'okx';
  lastPrice: number;
  bidPrice: number;
  askPrice: number;
  volume24h?: number;
  source: 'websocket' | 'rest';
  latencyMs?: number;
}

export interface PriceDataPair {
  symbol: string;
  binance: PriceData;
  okx: PriceData;
  priceSpread: number;     // 計算屬性: ABS((binance - okx) / avg)
  priceSpreadPercent: number; // priceSpread * 100
  timestamp: Date;         // 最新的時間戳
}
```

#### Lifecycle

```
[WebSocket/REST 數據到達]
       │
       ▼
  [驗證價格有效性]
       │
       ├──► 無效 ──► 記錄錯誤日誌 ──► 丟棄
       │
       ▼
  [更新記憶體快取]
       │
       ▼
  [計算價格價差] ──► ArbitrageAssessment
       │
       ▼
  [UI 刷新]
```

---

### 3. ArbitrageAssessment (套利機會評估)

**Purpose**: 綜合資金費率和價格數據，計算套利淨收益並判斷可行性。

**Source**: 規格 Key Entities, FR-005, FR-006, FR-007

**Storage**: 不持久化（僅用於即時顯示和 UI 渲染）

**Computation**: 即時計算，基於最新的 `FundingRatePair` 和 `PriceDataPair`

#### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `symbol` | string | REQUIRED | 交易對符號 |
| `timestamp` | Date | REQUIRED | 評估時間 |
| `binanceFundingRate` | number | REQUIRED | Binance 資金費率 |
| `okxFundingRate` | number | REQUIRED | OKX 資金費率 |
| `binancePrice` | number | REQUIRED | Binance 中間價 |
| `okxPrice` | number | REQUIRED | OKX 中間價 |
| `fundingRateSpread` | number | COMPUTED | 資金費率差異（絕對值） |
| `priceSpread` | number | COMPUTED | 價格價差百分比（絕對值） |
| `totalFees` | number | CONFIGURABLE | 總手續費（預設 0.002 = 0.2%） |
| `netProfit` | number | COMPUTED | 淨收益 = fundingRateSpread - priceSpread - totalFees |
| `netProfitPercent` | number | COMPUTED | netProfit * 100 |
| `direction` | string | COMPUTED | 套利方向描述 |
| `feasibility` | 'VIABLE' \| 'NOT_VIABLE' \| 'HIGH_RISK' | COMPUTED | 套利可行性 |
| `riskLevel` | 'LOW' \| 'MEDIUM' \| 'HIGH' | COMPUTED | 風險等級 |
| `extremeSpreadDetected` | boolean | COMPUTED | 是否檢測到極端價差 (>5%) |
| `warningMessage` | string | OPTIONAL | 警告訊息 |

#### Validation Rules

1. **淨收益計算**:
   ```
   fundingRateSpread = ABS(binanceFundingRate - okxFundingRate)
   priceSpread = ABS((binancePrice - okxPrice) / ((binancePrice + okxPrice) / 2))
   netProfit = fundingRateSpread - priceSpread - totalFees
   ```

2. **可行性判斷**:
   ```
   IF priceSpread > 0.05 THEN
     feasibility = 'HIGH_RISK'
     riskLevel = 'HIGH'
   ELSE IF netProfit > 0 THEN
     feasibility = 'VIABLE'
     riskLevel = (netProfit > 0.001) ? 'LOW' : 'MEDIUM'
   ELSE
     feasibility = 'NOT_VIABLE'
     riskLevel = 'MEDIUM'
   END IF
   ```

3. **套利方向**:
   ```
   IF binanceFundingRate > okxFundingRate THEN
     direction = '在 Binance 做空 + 在 OKX 做多'
   ELSE
     direction = '在 Binance 做多 + 在 OKX 做空'
   END IF
   ```

#### TypeScript Interface

```typescript
export interface ArbitrageConfig {
  makerFee: number;              // 預設 0.001 (0.1%)
  takerFee: number;              // 預設 0.001 (0.1%)
  extremeSpreadThreshold: number; // 預設 0.05 (5%)
}

export interface ArbitrageAssessment {
  symbol: string;
  timestamp: Date;

  // 輸入數據
  binanceFundingRate: number;
  okxFundingRate: number;
  binancePrice: number;
  okxPrice: number;

  // 計算結果
  fundingRateSpread: number;
  priceSpread: number;
  totalFees: number;
  netProfit: number;
  netProfitPercent: number;

  // 判斷結果
  direction: string;
  feasibility: 'VIABLE' | 'NOT_VIABLE' | 'HIGH_RISK';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  extremeSpreadDetected: boolean;
  warningMessage?: string;
}
```

---

## Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

/// 資金費率驗證記錄（TimescaleDB hypertable）
model FundingRateValidation {
  id                  Int       @id @default(autoincrement())
  timestamp           DateTime  @default(now()) @db.Timestamptz(6)
  symbol              String    @db.VarChar(20)
  exchange            String    @default("OKX") @db.VarChar(10)

  // OKX Native API 數據
  okxRate             Decimal   @db.Decimal(18, 8)
  okxNextRate         Decimal?  @db.Decimal(18, 8)
  okxFundingTime      DateTime? @db.Timestamptz(6)

  // CCXT 數據
  ccxtRate            Decimal?  @db.Decimal(18, 8)
  ccxtFundingTime     DateTime? @db.Timestamptz(6)

  // 驗證結果
  discrepancyPercent  Decimal?  @db.Decimal(10, 6)
  validationStatus    String    @db.VarChar(10) // PASS, FAIL, ERROR, N/A

  // Metadata
  dataSource          String    @default("API") @db.VarChar(20)
  errorMessage        String?   @db.Text

  @@index([symbol, timestamp(sort: Desc)])
  @@index([validationStatus, timestamp(sort: Desc)])
  @@map("funding_rate_validations")
}

// 注意: PriceData 和 ArbitrageAssessment 不持久化，僅定義 TypeScript interfaces
```

---

## Migration Plan

### Step 1: Create Validation Table

```sql
-- 建立驗證記錄表
CREATE TABLE funding_rate_validations (
  id SERIAL,
  timestamp TIMESTAMPTZ NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  exchange VARCHAR(10) DEFAULT 'OKX',

  okx_rate DECIMAL(18, 8) NOT NULL,
  okx_next_rate DECIMAL(18, 8),
  okx_funding_time TIMESTAMPTZ,

  ccxt_rate DECIMAL(18, 8),
  ccxt_funding_time TIMESTAMPTZ,

  discrepancy_percent DECIMAL(10, 6),
  validation_status VARCHAR(10) CHECK (validation_status IN ('PASS', 'FAIL', 'ERROR', 'N/A')),

  data_source VARCHAR(20) DEFAULT 'API',
  error_message TEXT,

  PRIMARY KEY (timestamp, symbol)
);
```

### Step 2: Enable TimescaleDB Extension

```sql
-- 啟用 TimescaleDB 擴展（如果未啟用）
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- 轉換為 hypertable
SELECT create_hypertable(
  'funding_rate_validations',
  'timestamp',
  chunk_time_interval => INTERVAL '1 day'
);
```

### Step 3: Create Indexes

```sql
-- 建立查詢索引
CREATE INDEX idx_validations_symbol
  ON funding_rate_validations(symbol, timestamp DESC);

CREATE INDEX idx_validations_status
  ON funding_rate_validations(validation_status, timestamp DESC);
```

### Step 4: Apply Retention and Compression

```sql
-- 自動刪除 90 天前的數據
SELECT add_retention_policy('funding_rate_validations', INTERVAL '90 days');

-- 壓縮 7 天前的數據
SELECT add_compression_policy('funding_rate_validations', INTERVAL '7 days');
```

### Prisma Migration Command

```bash
# 生成 migration
npx prisma migrate dev --name add_funding_rate_validations

# 應用到生產環境
npx prisma migrate deploy
```

---

## Data Access Patterns

### 1. 記錄驗證結果

```typescript
import { prisma } from './lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

await prisma.fundingRateValidation.create({
  data: {
    timestamp: new Date(),
    symbol: 'BTC-USDT-SWAP',
    okxRate: new Decimal('0.0001'),
    okxNextRate: new Decimal('0.00015'),
    okxFundingTime: new Date('2025-01-21T16:00:00Z'),
    ccxtRate: new Decimal('0.00010005'),
    ccxtFundingTime: new Date('2025-01-21T16:00:00Z'),
    discrepancyPercent: new Decimal('0.005'),
    validationStatus: 'PASS'
  }
});
```

### 2. 查詢最近驗證失敗記錄

```typescript
const failures = await prisma.fundingRateValidation.findMany({
  where: {
    validationStatus: 'FAIL',
    timestamp: {
      gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 最近 24 小時
    }
  },
  orderBy: {
    discrepancyPercent: 'desc'
  },
  take: 10
});
```

### 3. 計算驗證通過率

```typescript
const stats = await prisma.$queryRaw`
  SELECT
    symbol,
    COUNT(*) as total,
    SUM(CASE WHEN validation_status = 'PASS' THEN 1 ELSE 0 END) as passed,
    ROUND(100.0 * SUM(CASE WHEN validation_status = 'PASS' THEN 1 ELSE 0 END) / COUNT(*), 2) as pass_rate
  FROM funding_rate_validations
  WHERE timestamp > NOW() - INTERVAL '7 days'
  GROUP BY symbol
`;
```

---

## Data Consistency Rules

### 1. 資金費率驗證

- **Atomicity**: 每次驗證必須同時記錄 OKX 和 CCXT 數據（即使其中一個失敗）
- **Immutability**: 驗證記錄一旦寫入不可修改（append-only）
- **Timestamp Precision**: 使用 UTC 時區，精度到微秒（符合 TimescaleDB 最佳實踐）

### 2. 價格數據

- **Freshness**: 超過 10 秒的價格數據標記為 stale，不用於套利評估
- **Source Priority**: WebSocket 數據優先於 REST 數據
- **Price Sanity Check**: 價格變化超過 5% 需觸發異常檢測

### 3. 套利評估

- **Real-time Only**: 評估結果不持久化，每次基於最新數據重新計算
- **Configuration Override**: 允許用戶透過 CLI 參數覆寫預設手續費率
- **Deterministic**: 相同輸入必須產生相同的評估結果（純函數）

---

## Performance Considerations

### 1. TimescaleDB Optimization

- **Chunk Size**: 1 天一個 chunk（適合高頻寫入場景）
- **Compression**: 7 天後自動壓縮（節省 90% 儲存空間）
- **Retention**: 90 天自動刪除（符合數據保留政策）

### 2. Memory Management

- **Price Cache**: 最多保留 100 個交易對的價格數據（LRU 淘汰）
- **Assessment Cache**: 不快取評估結果（即時計算延遲 <1ms）

### 3. Query Optimization

- **Index Usage**: 所有時間範圍查詢使用 `(symbol, timestamp DESC)` 索引
- **Prepared Statements**: 使用 Prisma 的 prepared statements 避免 SQL 注入

---

**Phase 1 - Data Model Complete** | **Next: API Contracts**
