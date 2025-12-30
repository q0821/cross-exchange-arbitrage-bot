# Data Model: 跨交易所資金費率套利平台

**Feature**: [spec.md](./spec.md)
**Created**: 2025-10-17
**Status**: Phase 1 Design (部分已廢棄)
**Version**: 1.0

> ⚠️ **廢棄通知 (2025-12-30)**
>
> 以下模型已從 Prisma schema 移除，由 Feature 006 的新模型取代：
> - `ArbitrageOpportunity` → 由 Market Monitor 即時計算取代
> - `OpportunityHistory` → 由 `OpportunityEndHistory` 取代
> - `HedgePosition` → 由 `Position` 取代
> - `TradeRecord` → 由 `Trade` 取代
> - `ArbitrageCycle` → 已移除
> - `NotificationLog` → 由 `NotificationWebhook` 取代
>
> 此文件保留作為歷史參考。

## 目錄

1. [概述](#概述)
2. [實體關係圖](#實體關係圖)
3. [詳細實體設計](#詳細實體設計)
4. [狀態轉換](#狀態轉換)
5. [資料驗證規則](#資料驗證規則)
6. [TimescaleDB 配置](#timescaledb-配置)
7. [Redis 快取設計](#redis-快取設計)
8. [Prisma Schema](#prisma-schema)
9. [查詢優化策略](#查詢優化策略)

---

## 概述

本資料模型設計支援跨交易所資金費率套利平台的核心功能,包括:

- **時序資料管理**: 使用 TimescaleDB 高效儲存和查詢資金費率歷史記錄
- **交易完整性**: 確保雙邊對沖交易的資料一致性和可追溯性
- **效能優化**: 透過 Redis 快取熱資料,減少資料庫查詢壓力
- **風險控制**: 記錄完整的風險參數和倉位狀態,支援即時風險監控

### 技術棧

- **資料庫**: PostgreSQL 15+ with TimescaleDB 2.13+ extension
- **ORM**: Prisma 5.x
- **快取**: Redis 7.x
- **資料驗證**: Prisma + Zod

---

## 實體關係圖

```
┌──────────────────────┐
│   FundingRate        │ 1      ∞ ┌──────────────────────┐
│   資金費率記錄        │────────────│  ArbitrageOpportunity │
│                      │            │  套利機會              │
└──────────────────────┘            └───────────┬──────────┘
                                                 │ 1
                                                 │
                                                 │ 0..1
                                    ┌────────────▼──────────┐
                                    │   ArbitrageCycle      │
                                    │   套利週期             │
                                    └────────────┬──────────┘
                                                 │ 1
                                                 │
                                                 │ 1
                                    ┌────────────▼──────────┐
                                    │   HedgePosition       │ 1      2 ┌──────────────────┐
                                    │   對沖部位             │────────────│   TradeRecord    │
                                    └───────────────────────┘            │   交易記錄        │
                                                                         └──────────────────┘

┌──────────────────────┐
│   RiskParameters     │
│   風險參數            │
└──────────────────────┘

┌──────────────────────┐
│   SystemEvent        │
│   系統事件            │
└──────────────────────┘
```

---

## 詳細實體設計

### 1. FundingRate (資金費率記錄)

儲存各交易所的資金費率時序資料,使用 TimescaleDB Hypertable 優化查詢效能。

#### 欄位定義

| 欄位名稱 | 資料類型 | 約束 | 預設值 | 說明 |
|---------|---------|------|--------|------|
| id | UUID | PRIMARY KEY | uuid_generate_v4() | 唯一識別碼 |
| exchange | VARCHAR(50) | NOT NULL | - | 交易所名稱 (binance, okx) |
| symbol | VARCHAR(20) | NOT NULL | - | 交易對代碼 (BTCUSDT, ETHUSDT, SOLUSDT) |
| funding_rate | DECIMAL(10, 8) | NOT NULL | - | 資金費率 (例: 0.0001 代表 0.01%) |
| next_funding_time | TIMESTAMP WITH TIME ZONE | NOT NULL | - | 下次結算時間 |
| mark_price | DECIMAL(20, 8) | NULL | - | 標記價格 (用於計算收益) |
| index_price | DECIMAL(20, 8) | NULL | - | 指數價格 |
| recorded_at | TIMESTAMP WITH TIME ZONE | NOT NULL | NOW() | 記錄時間戳 (分區鍵) |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL | NOW() | 建立時間 |

#### 索引設計

```sql
-- 主索引 (TimescaleDB 自動建立)
CREATE INDEX idx_funding_rate_recorded_at ON funding_rates (recorded_at DESC);

-- 複合索引 (用於查詢特定交易所和交易對的最新費率)
CREATE INDEX idx_funding_rate_exchange_symbol_recorded ON funding_rates (exchange, symbol, recorded_at DESC);

-- 複合索引 (用於查詢特定時間範圍內的費率)
CREATE INDEX idx_funding_rate_symbol_recorded ON funding_rates (symbol, recorded_at DESC);
```

#### 唯一約束

```sql
-- 確保同一時間點、同一交易所、同一交易對只有一筆記錄
CREATE UNIQUE INDEX idx_funding_rate_unique
ON funding_rates (exchange, symbol, recorded_at);
```

---

### 2. ArbitrageOpportunity (套利機會)

記錄偵測到的套利機會,包含費率差異和預期收益。

#### 欄位定義

| 欄位名稱 | 資料類型 | 約束 | 預設值 | 說明 |
|---------|---------|------|--------|------|
| id | UUID | PRIMARY KEY | uuid_generate_v4() | 唯一識別碼 |
| symbol | VARCHAR(20) | NOT NULL | - | 交易對代碼 |
| long_exchange | VARCHAR(50) | NOT NULL | - | 做多的交易所 (費率較低) |
| short_exchange | VARCHAR(50) | NOT NULL | - | 做空的交易所 (費率較高) |
| long_funding_rate | DECIMAL(10, 8) | NOT NULL | - | 做多方資金費率 |
| short_funding_rate | DECIMAL(10, 8) | NOT NULL | - | 做空方資金費率 |
| rate_difference | DECIMAL(10, 8) | NOT NULL | - | 費率差異 (絕對值) |
| expected_return_rate | DECIMAL(10, 8) | NOT NULL | - | 預期收益率 (扣除預估手續費) |
| estimated_profit_usdt | DECIMAL(20, 8) | NULL | - | 預估利潤 (USDT) |
| status | VARCHAR(20) | NOT NULL | 'pending' | 狀態 (pending/executing/completed/failed/expired) |
| detected_at | TIMESTAMP WITH TIME ZONE | NOT NULL | NOW() | 機會發現時間 |
| expires_at | TIMESTAMP WITH TIME ZONE | NOT NULL | - | 機會過期時間 |
| executed_at | TIMESTAMP WITH TIME ZONE | NULL | - | 執行時間 |
| completed_at | TIMESTAMP WITH TIME ZONE | NULL | - | 完成時間 |
| failure_reason | TEXT | NULL | - | 失敗原因 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL | NOW() | 建立時間 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL | NOW() | 更新時間 |

#### 索引設計

```sql
-- 狀態索引 (用於查詢待執行的機會)
CREATE INDEX idx_opportunity_status ON arbitrage_opportunities (status)
WHERE status IN ('pending', 'executing');

-- 時間索引 (用於查詢最新機會)
CREATE INDEX idx_opportunity_detected ON arbitrage_opportunities (detected_at DESC);

-- 複合索引 (用於查詢特定交易對的機會)
CREATE INDEX idx_opportunity_symbol_detected ON arbitrage_opportunities (symbol, detected_at DESC);

-- 過期機會清理索引
CREATE INDEX idx_opportunity_expires ON arbitrage_opportunities (expires_at)
WHERE status = 'pending';
```

---

### 3. HedgePosition (對沖部位)

記錄雙邊對沖部位的狀態,包含開倉和平倉資訊。

#### 欄位定義

| 欄位名稱 | 資料類型 | 約束 | 預設值 | 說明 |
|---------|---------|------|--------|------|
| id | UUID | PRIMARY KEY | uuid_generate_v4() | 唯一識別碼 |
| arbitrage_cycle_id | UUID | FOREIGN KEY | - | 關聯的套利週期 |
| symbol | VARCHAR(20) | NOT NULL | - | 交易對代碼 |
| long_exchange | VARCHAR(50) | NOT NULL | - | 做多的交易所 |
| short_exchange | VARCHAR(50) | NOT NULL | - | 做空的交易所 |
| position_size | DECIMAL(20, 8) | NOT NULL | - | 倉位數量 (幣數) |
| position_value_usdt | DECIMAL(20, 8) | NOT NULL | - | 倉位價值 (USDT) |
| leverage | INTEGER | NOT NULL | 1 | 槓桿倍數 |
| long_entry_price | DECIMAL(20, 8) | NOT NULL | - | 做多開倉價格 |
| short_entry_price | DECIMAL(20, 8) | NOT NULL | - | 做空開倉價格 |
| long_exit_price | DECIMAL(20, 8) | NULL | - | 做多平倉價格 |
| short_exit_price | DECIMAL(20, 8) | NULL | - | 做空平倉價格 |
| margin_used_usdt | DECIMAL(20, 8) | NOT NULL | - | 使用的保證金 (USDT) |
| margin_ratio | DECIMAL(10, 8) | NULL | - | 保證金使用率 |
| unrealized_pnl_usdt | DECIMAL(20, 8) | NULL | 0 | 未實現盈虧 (USDT) |
| realized_pnl_usdt | DECIMAL(20, 8) | NULL | - | 已實現盈虧 (USDT) |
| total_funding_received | DECIMAL(20, 8) | NULL | 0 | 累積收到的資金費率 |
| total_funding_paid | DECIMAL(20, 8) | NULL | 0 | 累積支付的資金費率 |
| status | VARCHAR(20) | NOT NULL | 'opening' | 狀態 (opening/active/closing/closed/failed) |
| opened_at | TIMESTAMP WITH TIME ZONE | NOT NULL | NOW() | 開倉時間 |
| closed_at | TIMESTAMP WITH TIME ZONE | NULL | - | 平倉時間 |
| failure_reason | TEXT | NULL | - | 失敗原因 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL | NOW() | 建立時間 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL | NOW() | 更新時間 |

#### 索引設計

```sql
-- 狀態索引 (用於查詢活躍部位)
CREATE INDEX idx_position_status ON hedge_positions (status)
WHERE status IN ('opening', 'active', 'closing');

-- 套利週期關聯索引
CREATE INDEX idx_position_cycle ON hedge_positions (arbitrage_cycle_id);

-- 時間索引 (用於查詢持倉時間)
CREATE INDEX idx_position_opened ON hedge_positions (opened_at DESC);

-- 交易對索引
CREATE INDEX idx_position_symbol ON hedge_positions (symbol, status);
```

---

### 4. TradeRecord (交易記錄)

記錄每一筆實際執行的訂單,用於對帳和分析。

#### 欄位定義

| 欄位名稱 | 資料類型 | 約束 | 預設值 | 說明 |
|---------|---------|------|--------|------|
| id | UUID | PRIMARY KEY | uuid_generate_v4() | 唯一識別碼 |
| hedge_position_id | UUID | FOREIGN KEY | - | 關聯的對沖部位 |
| exchange | VARCHAR(50) | NOT NULL | - | 交易所名稱 |
| symbol | VARCHAR(20) | NOT NULL | - | 交易對代碼 |
| order_id | VARCHAR(100) | NOT NULL | - | 交易所訂單 ID |
| client_order_id | VARCHAR(100) | NULL | - | 客戶端訂單 ID |
| side | VARCHAR(10) | NOT NULL | - | 方向 (LONG/SHORT) |
| type | VARCHAR(20) | NOT NULL | - | 訂單類型 (MARKET/LIMIT) |
| action | VARCHAR(10) | NOT NULL | - | 動作 (OPEN/CLOSE) |
| quantity | DECIMAL(20, 8) | NOT NULL | - | 下單數量 |
| filled_quantity | DECIMAL(20, 8) | NOT NULL | - | 成交數量 |
| price | DECIMAL(20, 8) | NULL | - | 訂單價格 (市價單為 NULL) |
| average_price | DECIMAL(20, 8) | NOT NULL | - | 平均成交價格 |
| fee | DECIMAL(20, 8) | NOT NULL | 0 | 手續費 (USDT) |
| fee_currency | VARCHAR(10) | NOT NULL | 'USDT' | 手續費幣種 |
| commission_rate | DECIMAL(10, 8) | NULL | - | 手續費費率 |
| order_status | VARCHAR(20) | NOT NULL | - | 訂單狀態 (FILLED/PARTIAL/CANCELED/FAILED) |
| slippage | DECIMAL(10, 8) | NULL | - | 滑價 (百分比) |
| executed_at | TIMESTAMP WITH TIME ZONE | NOT NULL | NOW() | 執行時間 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL | NOW() | 建立時間 |

#### 索引設計

```sql
-- 對沖部位關聯索引
CREATE INDEX idx_trade_position ON trade_records (hedge_position_id);

-- 交易所訂單 ID 索引 (用於防重複和對帳)
CREATE UNIQUE INDEX idx_trade_order_id ON trade_records (exchange, order_id);

-- 時間索引
CREATE INDEX idx_trade_executed ON trade_records (executed_at DESC);

-- 交易所和交易對索引
CREATE INDEX idx_trade_exchange_symbol ON trade_records (exchange, symbol, executed_at DESC);
```

---

### 5. ArbitrageCycle (套利週期)

記錄一個完整的套利週期,從機會偵測到平倉結算。

#### 欄位定義

| 欄位名稱 | 資料類型 | 約束 | 預設值 | 說明 |
|---------|---------|------|--------|------|
| id | UUID | PRIMARY KEY | uuid_generate_v4() | 唯一識別碼 |
| opportunity_id | UUID | FOREIGN KEY | - | 關聯的套利機會 |
| symbol | VARCHAR(20) | NOT NULL | - | 交易對代碼 |
| initial_capital_usdt | DECIMAL(20, 8) | NOT NULL | - | 初始投入資金 (USDT) |
| total_fees_usdt | DECIMAL(20, 8) | NOT NULL | 0 | 總手續費 (USDT) |
| total_funding_income | DECIMAL(20, 8) | NOT NULL | 0 | 總資金費率收入 (USDT) |
| price_pnl_usdt | DECIMAL(20, 8) | NULL | 0 | 價格變動損益 (USDT) |
| net_profit_usdt | DECIMAL(20, 8) | NULL | - | 淨利潤 (USDT) |
| net_profit_rate | DECIMAL(10, 8) | NULL | - | 淨利潤率 (%) |
| roi | DECIMAL(10, 8) | NULL | - | 投資回報率 (ROI) |
| funding_periods | INTEGER | NOT NULL | 0 | 經歷的資金費率結算次數 |
| duration_hours | DECIMAL(10, 2) | NULL | - | 持倉時長 (小時) |
| status | VARCHAR(20) | NOT NULL | 'active' | 狀態 (active/completed/failed) |
| started_at | TIMESTAMP WITH TIME ZONE | NOT NULL | NOW() | 開始時間 |
| completed_at | TIMESTAMP WITH TIME ZONE | NULL | - | 完成時間 |
| notes | TEXT | NULL | - | 備註 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL | NOW() | 建立時間 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL | NOW() | 更新時間 |

#### 索引設計

```sql
-- 機會關聯索引
CREATE INDEX idx_cycle_opportunity ON arbitrage_cycles (opportunity_id);

-- 狀態索引
CREATE INDEX idx_cycle_status ON arbitrage_cycles (status);

-- 時間索引
CREATE INDEX idx_cycle_started ON arbitrage_cycles (started_at DESC);

-- 交易對和狀態索引
CREATE INDEX idx_cycle_symbol_status ON arbitrage_cycles (symbol, status);
```

---

### 6. RiskParameters (風險參數)

儲存使用者設定的風險控制參數,支援動態調整。

#### 欄位定義

| 欄位名稱 | 資料類型 | 約束 | 預設值 | 說明 |
|---------|---------|------|--------|------|
| id | UUID | PRIMARY KEY | uuid_generate_v4() | 唯一識別碼 |
| name | VARCHAR(100) | NOT NULL | - | 參數名稱 |
| description | TEXT | NULL | - | 參數說明 |
| min_rate_difference | DECIMAL(10, 8) | NOT NULL | 0.0005 | 最小費率差異閾值 (0.05%) |
| max_position_size_usdt | DECIMAL(20, 8) | NOT NULL | 10000 | 單次交易最大金額 (USDT) |
| max_total_exposure_usdt | DECIMAL(20, 8) | NOT NULL | 50000 | 總倉位上限 (USDT) |
| max_leverage | INTEGER | NOT NULL | 5 | 最大槓桿倍數 |
| stop_loss_rate | DECIMAL(10, 8) | NOT NULL | 0.001 | 止損閾值 (0.1%) |
| max_holding_hours | INTEGER | NOT NULL | 24 | 最大持倉時間 (小時) |
| position_size_percentage | DECIMAL(10, 8) | NOT NULL | 0.03 | 倉位大小比例 (3%) |
| enable_auto_trading | BOOLEAN | NOT NULL | false | 是否啟用自動交易 |
| enable_auto_close | BOOLEAN | NOT NULL | true | 是否啟用自動平倉 |
| max_slippage_rate | DECIMAL(10, 8) | NOT NULL | 0.001 | 最大可接受滑價 (0.1%) |
| min_liquidity_usdt | DECIMAL(20, 8) | NOT NULL | 50000 | 最小流動性要求 (USDT) |
| is_active | BOOLEAN | NOT NULL | true | 是否啟用 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL | NOW() | 建立時間 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL | NOW() | 更新時間 |

#### 索引設計

```sql
-- 活躍參數索引
CREATE INDEX idx_risk_params_active ON risk_parameters (is_active)
WHERE is_active = true;

-- 名稱唯一索引
CREATE UNIQUE INDEX idx_risk_params_name ON risk_parameters (name);
```

---

### 7. SystemEvent (系統事件)

記錄系統運行中的重要事件,用於監控和故障排查。

#### 欄位定義

| 欄位名稱 | 資料類型 | 約束 | 預設值 | 說明 |
|---------|---------|------|--------|------|
| id | UUID | PRIMARY KEY | uuid_generate_v4() | 唯一識別碼 |
| event_type | VARCHAR(50) | NOT NULL | - | 事件類型 (API_ERROR/TRADE_FAILED/SLIPPAGE_HIGH 等) |
| severity | VARCHAR(20) | NOT NULL | - | 嚴重程度 (INFO/WARNING/ERROR/CRITICAL) |
| exchange | VARCHAR(50) | NULL | - | 相關交易所 |
| symbol | VARCHAR(20) | NULL | - | 相關交易對 |
| message | TEXT | NOT NULL | - | 事件訊息 |
| details | JSONB | NULL | - | 事件詳細資訊 (JSON 格式) |
| related_id | UUID | NULL | - | 相關實體 ID (可能是 opportunity_id, position_id 等) |
| is_notified | BOOLEAN | NOT NULL | false | 是否已通知使用者 |
| occurred_at | TIMESTAMP WITH TIME ZONE | NOT NULL | NOW() | 事件發生時間 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL | NOW() | 建立時間 |

#### 索引設計

```sql
-- 事件類型和時間索引
CREATE INDEX idx_event_type_occurred ON system_events (event_type, occurred_at DESC);

-- 嚴重程度索引
CREATE INDEX idx_event_severity ON system_events (severity, occurred_at DESC)
WHERE severity IN ('ERROR', 'CRITICAL');

-- 通知狀態索引
CREATE INDEX idx_event_notified ON system_events (is_notified)
WHERE is_notified = false;

-- JSONB 索引 (用於查詢 details 欄位)
CREATE INDEX idx_event_details ON system_events USING GIN (details);
```

---

## 狀態轉換

### ArbitrageOpportunity 狀態轉換圖

```
     ┌─────────┐
     │ pending │ (套利機會已偵測,待執行)
     └────┬────┘
          │
          │ 開始執行交易
          ▼
    ┌──────────┐
    │ executing │ (正在執行雙邊開倉)
    └─────┬────┘
          │
          ├────────────┐
          │            │
          │ 成功       │ 失敗
          ▼            ▼
    ┌──────────┐  ┌────────┐
    │ completed │  │ failed  │
    └──────────┘  └────────┘

          或

          ▼
    ┌─────────┐
    │ expired  │ (機會已過期,未執行)
    └─────────┘
```

#### 狀態說明

- **pending**: 套利機會已偵測,等待執行或自動交易觸發
- **executing**: 系統正在執行雙邊開倉,此時不可取消
- **completed**: 雙邊開倉成功,已建立對沖部位
- **failed**: 執行失敗 (可能是單邊失敗、餘額不足、市場條件改變等)
- **expired**: 機會已過期,未在有效時間內執行

#### 狀態轉換規則

```typescript
// 允許的狀態轉換
const ALLOWED_TRANSITIONS = {
  pending: ['executing', 'expired', 'failed'],
  executing: ['completed', 'failed'],
  completed: [], // 終止狀態
  failed: [],    // 終止狀態
  expired: []    // 終止狀態
};
```

---

### HedgePosition 狀態轉換圖

```
     ┌─────────┐
     │ opening │ (正在建立雙邊部位)
     └────┬────┘
          │
          ├────────────┐
          │            │
          │ 成功       │ 失敗
          ▼            ▼
    ┌────────┐    ┌────────┐
    │ active │    │ failed │
    └────┬───┘    └────────┘
          │
          │ 開始平倉
          ▼
    ┌─────────┐
    │ closing │ (正在平倉雙邊部位)
    └────┬────┘
          │
          ├────────────┐
          │            │
          │ 成功       │ 失敗
          ▼            ▼
    ┌────────┐    ┌────────┐
    │ closed │    │ failed │
    └────────┘    └────────┘
```

#### 狀態說明

- **opening**: 正在執行雙邊開倉,等待兩邊訂單都成交
- **active**: 雙邊部位已建立,正常持倉中,持續收取/支付資金費率
- **closing**: 正在執行雙邊平倉
- **closed**: 雙邊部位已平倉,套利週期結束
- **failed**: 開倉或平倉過程中發生錯誤,可能存在單邊部位風險

#### 狀態轉換規則

```typescript
// 允許的狀態轉換
const ALLOWED_TRANSITIONS = {
  opening: ['active', 'failed'],
  active: ['closing', 'failed'],
  closing: ['closed', 'failed'],
  closed: [],  // 終止狀態
  failed: []   // 終止狀態
};
```

---

## 資料驗證規則

### 欄位層級驗證

#### FundingRate 驗證規則

```typescript
const FundingRateValidation = {
  // 資金費率通常在 -0.75% 到 0.75% 之間
  funding_rate: z.number()
    .min(-0.0075, '資金費率不得低於 -0.75%')
    .max(0.0075, '資金費率不得高於 0.75%'),

  // 交易所白名單
  exchange: z.enum(['binance', 'okx'], {
    errorMap: () => ({ message: '僅支援 binance 和 okx 交易所' })
  }),

  // 交易對白名單
  symbol: z.enum(['BTCUSDT', 'ETHUSDT', 'SOLUSDT'], {
    errorMap: () => ({ message: '僅支援 BTC、ETH 和 SOL 交易對' })
  }),

  // 下次結算時間必須在未來
  next_funding_time: z.date().refine(
    (date) => date > new Date(),
    { message: '下次結算時間必須在未來' }
  )
};
```

#### ArbitrageOpportunity 驗證規則

```typescript
const ArbitrageOpportunityValidation = {
  // 費率差異必須為正值且合理
  rate_difference: z.number()
    .positive('費率差異必須為正值')
    .max(0.01, '費率差異超過 1% 可能是資料錯誤'),

  // 預期收益率應為正值
  expected_return_rate: z.number()
    .positive('預期收益率必須為正值'),

  // 做多和做空交易所不能相同
  exchanges: z.object({
    long_exchange: z.string(),
    short_exchange: z.string()
  }).refine(
    (data) => data.long_exchange !== data.short_exchange,
    { message: '做多和做空交易所不能相同' }
  ),

  // 過期時間必須在發現時間之後
  timing: z.object({
    detected_at: z.date(),
    expires_at: z.date()
  }).refine(
    (data) => data.expires_at > data.detected_at,
    { message: '過期時間必須在發現時間之後' }
  )
};
```

#### HedgePosition 驗證規則

```typescript
const HedgePositionValidation = {
  // 倉位數量必須為正值
  position_size: z.number()
    .positive('倉位數量必須為正值'),

  // 槓桿倍數限制 (1-20 倍)
  leverage: z.number()
    .int('槓桿倍數必須為整數')
    .min(1, '最小槓桿倍數為 1')
    .max(20, '最大槓桿倍數為 20'),

  // 開倉價格必須為正值
  entry_prices: z.object({
    long_entry_price: z.number().positive(),
    short_entry_price: z.number().positive()
  }),

  // 保證金使用率不得超過 100%
  margin_ratio: z.number()
    .min(0, '保證金使用率不得為負')
    .max(1, '保證金使用率不得超過 100%')
    .optional()
};
```

#### TradeRecord 驗證規則

```typescript
const TradeRecordValidation = {
  // 成交數量不得超過下單數量
  quantities: z.object({
    quantity: z.number().positive(),
    filled_quantity: z.number().nonnegative()
  }).refine(
    (data) => data.filled_quantity <= data.quantity,
    { message: '成交數量不得超過下單數量' }
  ),

  // 手續費不得為負
  fee: z.number().nonnegative('手續費不得為負'),

  // 方向必須為 LONG 或 SHORT
  side: z.enum(['LONG', 'SHORT'], {
    errorMap: () => ({ message: '方向必須為 LONG 或 SHORT' })
  }),

  // 動作必須為 OPEN 或 CLOSE
  action: z.enum(['OPEN', 'CLOSE'], {
    errorMap: () => ({ message: '動作必須為 OPEN 或 CLOSE' })
  })
};
```

### 業務層級驗證

#### 對沖部位數量一致性驗證

```typescript
async function validateHedgePositionConsistency(positionId: string) {
  // 取得該對沖部位的所有交易記錄
  const trades = await prisma.tradeRecord.findMany({
    where: {
      hedge_position_id: positionId,
      order_status: 'FILLED'
    }
  });

  // 計算多方和空方的總數量
  const longTrades = trades.filter(t => t.side === 'LONG' && t.action === 'OPEN');
  const shortTrades = trades.filter(t => t.side === 'SHORT' && t.action === 'OPEN');

  const longTotal = longTrades.reduce((sum, t) => sum + t.filled_quantity, 0);
  const shortTotal = shortTrades.reduce((sum, t) => sum + t.filled_quantity, 0);

  // 容許 0.01% 的誤差 (考慮到交易所的最小下單單位)
  const tolerance = Math.max(longTotal, shortTotal) * 0.0001;

  if (Math.abs(longTotal - shortTotal) > tolerance) {
    throw new Error(
      `對沖部位數量不一致: 多方 ${longTotal}, 空方 ${shortTotal}`
    );
  }

  return true;
}
```

#### 風險參數合理性驗證

```typescript
function validateRiskParameters(params: RiskParameters) {
  // 最小費率差異應大於預期手續費
  const estimatedFeeRate = 0.0004; // 0.04% (假設雙邊各 0.02%)

  if (params.min_rate_difference <= estimatedFeeRate) {
    throw new Error(
      `最小費率差異 (${params.min_rate_difference}) 應大於預期手續費 (${estimatedFeeRate})`
    );
  }

  // 止損閾值應小於最小費率差異
  if (params.stop_loss_rate >= params.min_rate_difference) {
    throw new Error(
      `止損閾值 (${params.stop_loss_rate}) 應小於最小費率差異 (${params.min_rate_difference})`
    );
  }

  // 單次交易金額不得超過總倉位上限
  if (params.max_position_size_usdt > params.max_total_exposure_usdt) {
    throw new Error(
      `單次交易最大金額不得超過總倉位上限`
    );
  }

  return true;
}
```

#### 套利週期完整性驗證

```typescript
async function validateArbitrageCycleCompleteness(cycleId: string) {
  const cycle = await prisma.arbitrageCycle.findUnique({
    where: { id: cycleId },
    include: {
      hedge_position: {
        include: {
          trades: true
        }
      }
    }
  });

  if (!cycle) {
    throw new Error('套利週期不存在');
  }

  // 已完成的週期必須有對沖部位
  if (cycle.status === 'completed' && !cycle.hedge_position) {
    throw new Error('已完成的套利週期必須有對沖部位');
  }

  // 已完成的週期必須有平倉交易
  if (cycle.status === 'completed') {
    const closeTrades = cycle.hedge_position.trades.filter(
      t => t.action === 'CLOSE'
    );

    if (closeTrades.length === 0) {
      throw new Error('已完成的套利週期必須有平倉交易');
    }
  }

  // 已完成的週期必須計算淨利潤
  if (cycle.status === 'completed' && cycle.net_profit_usdt === null) {
    throw new Error('已完成的套利週期必須計算淨利潤');
  }

  return true;
}
```

---

## TimescaleDB 配置

### Hypertable 配置

#### FundingRate 轉換為 Hypertable

```sql
-- 轉換 funding_rates 為 Hypertable,按 recorded_at 分區
SELECT create_hypertable(
  'funding_rates',
  'recorded_at',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- 設定壓縮策略 (壓縮 7 天前的資料)
ALTER TABLE funding_rates SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'exchange, symbol',
  timescaledb.compress_orderby = 'recorded_at DESC'
);

SELECT add_compression_policy('funding_rates', INTERVAL '7 days');

-- 設定資料保留策略 (保留 90 天)
SELECT add_retention_policy('funding_rates', INTERVAL '90 days');
```

#### SystemEvent 轉換為 Hypertable

```sql
-- 轉換 system_events 為 Hypertable
SELECT create_hypertable(
  'system_events',
  'occurred_at',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- 設定壓縮策略 (壓縮 3 天前的資料)
ALTER TABLE system_events SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'event_type, severity',
  timescaledb.compress_orderby = 'occurred_at DESC'
);

SELECT add_compression_policy('system_events', INTERVAL '3 days');

-- 設定資料保留策略 (保留 30 天)
SELECT add_retention_policy('system_events', INTERVAL '30 days');
```

### 連續聚合 (Continuous Aggregates)

#### 1. 每小時資金費率統計

```sql
CREATE MATERIALIZED VIEW funding_rate_hourly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', recorded_at) AS hour,
  exchange,
  symbol,
  AVG(funding_rate) AS avg_funding_rate,
  MAX(funding_rate) AS max_funding_rate,
  MIN(funding_rate) AS min_funding_rate,
  STDDEV(funding_rate) AS stddev_funding_rate,
  COUNT(*) AS sample_count
FROM funding_rates
GROUP BY hour, exchange, symbol
WITH NO DATA;

-- 設定自動刷新策略
SELECT add_continuous_aggregate_policy('funding_rate_hourly',
  start_offset => INTERVAL '3 hours',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour'
);
```

#### 2. 每日套利績效統計

```sql
CREATE MATERIALIZED VIEW arbitrage_daily_stats
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', completed_at) AS day,
  symbol,
  COUNT(*) AS total_cycles,
  SUM(net_profit_usdt) AS total_profit,
  AVG(net_profit_usdt) AS avg_profit,
  AVG(roi) AS avg_roi,
  AVG(duration_hours) AS avg_duration_hours,
  SUM(total_fees_usdt) AS total_fees
FROM arbitrage_cycles
WHERE status = 'completed' AND completed_at IS NOT NULL
GROUP BY day, symbol
WITH NO DATA;

-- 設定自動刷新策略
SELECT add_continuous_aggregate_policy('arbitrage_daily_stats',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 day'
);
```

### 分區策略

TimescaleDB 自動處理時序資料分區,每個 chunk 的時間間隔設定如下:

| 表格 | Chunk 時間間隔 | 理由 |
|------|---------------|------|
| funding_rates | 1 天 | 高頻寫入,每日約 1000+ 筆記錄 |
| system_events | 1 天 | 中頻寫入,便於日誌管理 |

### 查詢效能優化

#### 1. 最新資金費率查詢 (使用 DISTINCT ON)

```sql
-- 查詢每個交易對在每個交易所的最新資金費率
SELECT DISTINCT ON (exchange, symbol)
  exchange,
  symbol,
  funding_rate,
  next_funding_time,
  recorded_at
FROM funding_rates
ORDER BY exchange, symbol, recorded_at DESC;
```

#### 2. 費率差異查詢 (使用 JOIN)

```sql
-- 查詢兩個交易所之間的費率差異
WITH latest_rates AS (
  SELECT DISTINCT ON (exchange, symbol)
    exchange,
    symbol,
    funding_rate,
    recorded_at
  FROM funding_rates
  WHERE recorded_at > NOW() - INTERVAL '5 minutes'
  ORDER BY exchange, symbol, recorded_at DESC
)
SELECT
  b.symbol,
  b.funding_rate AS binance_rate,
  o.funding_rate AS okx_rate,
  ABS(b.funding_rate - o.funding_rate) AS rate_difference,
  CASE
    WHEN b.funding_rate < o.funding_rate THEN 'binance'
    ELSE 'okx'
  END AS long_exchange
FROM latest_rates b
JOIN latest_rates o ON b.symbol = o.symbol
WHERE b.exchange = 'binance' AND o.exchange = 'okx';
```

---

## Redis 快取設計

### Key 命名規則

採用層級化命名規則,使用冒號 `:` 分隔:

```
{namespace}:{entity}:{id}:{field}
```

### 快取資料結構

#### 1. 最新資金費率 (Hash)

```
Key: funding:latest:{exchange}:{symbol}
Type: Hash
TTL: 60 秒

Fields:
- funding_rate: string (資金費率)
- next_funding_time: string (ISO 8601 格式)
- mark_price: string (標記價格)
- recorded_at: string (記錄時間)

Example:
Key: funding:latest:binance:BTCUSDT
{
  "funding_rate": "0.0001",
  "next_funding_time": "2025-10-18T00:00:00Z",
  "mark_price": "65432.10",
  "recorded_at": "2025-10-17T23:59:55Z"
}
```

#### 2. 活躍套利機會 (Sorted Set)

```
Key: opportunities:active
Type: Sorted Set
TTL: 300 秒 (5 分鐘)

Score: expected_return_rate (預期收益率)
Member: opportunity_id (套利機會 ID)

Example:
ZADD opportunities:active 0.0008 "uuid-1234"
ZADD opportunities:active 0.0012 "uuid-5678"

# 查詢收益率最高的前 10 個機會
ZREVRANGE opportunities:active 0 9 WITHSCORES
```

#### 3. 活躍對沖部位 (Set)

```
Key: positions:active
Type: Set
TTL: 無 (持久化直到平倉)

Member: position_id (對沖部位 ID)

Example:
SADD positions:active "uuid-abcd"
SISMEMBER positions:active "uuid-abcd"
```

#### 4. 風險參數快取 (Hash)

```
Key: risk:params:active
Type: Hash
TTL: 300 秒 (5 分鐘)

Fields: 所有風險參數欄位

Example:
Key: risk:params:active
{
  "min_rate_difference": "0.0005",
  "max_position_size_usdt": "10000",
  "max_total_exposure_usdt": "50000",
  "enable_auto_trading": "true",
  ...
}
```

#### 5. 交易所連線狀態 (String)

```
Key: exchange:status:{exchange}
Type: String
TTL: 30 秒

Value: online | offline | degraded

Example:
SET exchange:status:binance "online"
GET exchange:status:binance
```

#### 6. API 限流計數器 (String with Expiry)

```
Key: ratelimit:{exchange}:{endpoint}
Type: String (計數器)
TTL: 60 秒 (依照交易所限流視窗)

Example:
# 記錄 Binance /api/v3/ticker 的請求次數
INCR ratelimit:binance:/api/v3/ticker
EXPIRE ratelimit:binance:/api/v3/ticker 60
```

#### 7. 系統指標 (Hash)

```
Key: metrics:system
Type: Hash
TTL: 60 秒

Fields:
- active_positions: string (活躍部位數)
- total_exposure_usdt: string (總倉位)
- today_profit_usdt: string (今日收益)
- api_error_count: string (API 錯誤次數)

Example:
HSET metrics:system active_positions "3"
HSET metrics:system total_exposure_usdt "25000"
```

### TTL 策略

| 資料類型 | TTL | 更新策略 | 理由 |
|---------|-----|---------|------|
| 最新資金費率 | 60 秒 | Write-Through | 高頻更新,短 TTL 保證即時性 |
| 套利機會 | 300 秒 | Write-Through | 機會可能快速消失,適中 TTL |
| 風險參數 | 300 秒 | Cache-Aside | 低頻變更,適中 TTL 降低資料庫壓力 |
| 連線狀態 | 30 秒 | Write-Through | 需要即時反映連線狀態 |
| 活躍部位 | 無 | Write-Through | 部位狀態需持久化 |
| 限流計數器 | 60 秒 | Write-Through | 依照交易所限流視窗 |

### 快取更新策略

#### Write-Through Pattern (用於關鍵資料)

```typescript
async function updateFundingRate(data: FundingRateData) {
  // 1. 寫入資料庫
  const record = await prisma.fundingRate.create({ data });

  // 2. 同步更新快取
  const key = `funding:latest:${data.exchange}:${data.symbol}`;
  await redis.hset(key, {
    funding_rate: data.funding_rate.toString(),
    next_funding_time: data.next_funding_time.toISOString(),
    mark_price: data.mark_price?.toString() || '',
    recorded_at: data.recorded_at.toISOString()
  });
  await redis.expire(key, 60);

  return record;
}
```

#### Cache-Aside Pattern (用於低頻變更資料)

```typescript
async function getRiskParameters() {
  const cacheKey = 'risk:params:active';

  // 1. 嘗試從快取讀取
  const cached = await redis.hgetall(cacheKey);
  if (Object.keys(cached).length > 0) {
    return parseRiskParams(cached);
  }

  // 2. 快取未命中,從資料庫讀取
  const params = await prisma.riskParameters.findFirst({
    where: { is_active: true }
  });

  // 3. 寫入快取
  if (params) {
    await redis.hset(cacheKey, serializeRiskParams(params));
    await redis.expire(cacheKey, 300);
  }

  return params;
}
```

#### Pub/Sub 模式 (用於事件通知)

```typescript
// Publisher: 當偵測到套利機會時發布事件
async function publishOpportunity(opportunity: ArbitrageOpportunity) {
  await redis.publish('events:opportunities', JSON.stringify({
    type: 'NEW_OPPORTUNITY',
    data: opportunity
  }));
}

// Subscriber: 監聽套利機會事件
redis.subscribe('events:opportunities', (message) => {
  const event = JSON.parse(message);
  if (event.type === 'NEW_OPPORTUNITY') {
    notifyUser(event.data); // 透過 Telegram 通知使用者
  }
});
```

### 快取失效策略

#### 1. 主動失效 (當資料變更時)

```typescript
// 當風險參數更新時,立即清除快取
async function updateRiskParameters(id: string, data: Partial<RiskParameters>) {
  // 1. 更新資料庫
  const updated = await prisma.riskParameters.update({
    where: { id },
    data
  });

  // 2. 清除快取
  await redis.del('risk:params:active');

  return updated;
}
```

#### 2. 被動失效 (依賴 TTL 自動過期)

適用於資金費率等高頻更新的資料,依賴 TTL 自動過期即可。

#### 3. 定期清理 (清理過期的套利機會)

```typescript
// 每分鐘執行一次,清理已過期的套利機會
setInterval(async () => {
  const now = Date.now();

  // 取得所有活躍機會
  const opportunityIds = await redis.smembers('opportunities:active');

  for (const id of opportunityIds) {
    const opportunity = await prisma.arbitrageOpportunity.findUnique({
      where: { id }
    });

    // 如果機會已過期或已完成,從 Set 中移除
    if (!opportunity ||
        opportunity.expires_at < new Date() ||
        opportunity.status !== 'pending') {
      await redis.srem('opportunities:active', id);
      await redis.zrem('opportunities:active', id);
    }
  }
}, 60000);
```

---

## Prisma Schema

```prisma
// This is your Prisma schema file
// Learn more: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [timescaledb]
}

// ===== 資金費率記錄 (TimescaleDB Hypertable) =====
model FundingRate {
  id                 String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  exchange           String   @db.VarChar(50)
  symbol             String   @db.VarChar(20)
  funding_rate       Decimal  @db.Decimal(10, 8)
  next_funding_time  DateTime @db.Timestamptz
  mark_price         Decimal? @db.Decimal(20, 8)
  index_price        Decimal? @db.Decimal(20, 8)
  recorded_at        DateTime @default(now()) @db.Timestamptz // 分區鍵
  created_at         DateTime @default(now()) @db.Timestamptz

  @@unique([exchange, symbol, recorded_at])
  @@index([recorded_at(sort: Desc)])
  @@index([exchange, symbol, recorded_at(sort: Desc)])
  @@index([symbol, recorded_at(sort: Desc)])
  @@map("funding_rates")
}

// ===== 套利機會 =====
model ArbitrageOpportunity {
  id                      String             @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  symbol                  String             @db.VarChar(20)
  long_exchange           String             @db.VarChar(50)
  short_exchange          String             @db.VarChar(50)
  long_funding_rate       Decimal            @db.Decimal(10, 8)
  short_funding_rate      Decimal            @db.Decimal(10, 8)
  rate_difference         Decimal            @db.Decimal(10, 8)
  expected_return_rate    Decimal            @db.Decimal(10, 8)
  estimated_profit_usdt   Decimal?           @db.Decimal(20, 8)
  status                  OpportunityStatus  @default(PENDING)
  detected_at             DateTime           @default(now()) @db.Timestamptz
  expires_at              DateTime           @db.Timestamptz
  executed_at             DateTime?          @db.Timestamptz
  completed_at            DateTime?          @db.Timestamptz
  failure_reason          String?            @db.Text
  created_at              DateTime           @default(now()) @db.Timestamptz
  updated_at              DateTime           @updatedAt @db.Timestamptz

  // Relations
  arbitrage_cycle         ArbitrageCycle?

  @@index([status], where: "status IN ('PENDING', 'EXECUTING')")
  @@index([detected_at(sort: Desc)])
  @@index([symbol, detected_at(sort: Desc)])
  @@index([expires_at], where: "status = 'PENDING'")
  @@map("arbitrage_opportunities")
}

enum OpportunityStatus {
  PENDING     // 待執行
  EXECUTING   // 執行中
  COMPLETED   // 已完成
  FAILED      // 失敗
  EXPIRED     // 已過期

  @@map("opportunity_status")
}

// ===== 對沖部位 =====
model HedgePosition {
  id                      String           @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  arbitrage_cycle_id      String           @unique @db.Uuid
  symbol                  String           @db.VarChar(20)
  long_exchange           String           @db.VarChar(50)
  short_exchange          String           @db.VarChar(50)
  position_size           Decimal          @db.Decimal(20, 8)
  position_value_usdt     Decimal          @db.Decimal(20, 8)
  leverage                Int              @default(1)
  long_entry_price        Decimal          @db.Decimal(20, 8)
  short_entry_price       Decimal          @db.Decimal(20, 8)
  long_exit_price         Decimal?         @db.Decimal(20, 8)
  short_exit_price        Decimal?         @db.Decimal(20, 8)
  margin_used_usdt        Decimal          @db.Decimal(20, 8)
  margin_ratio            Decimal?         @db.Decimal(10, 8)
  unrealized_pnl_usdt     Decimal?         @default(0) @db.Decimal(20, 8)
  realized_pnl_usdt       Decimal?         @db.Decimal(20, 8)
  total_funding_received  Decimal?         @default(0) @db.Decimal(20, 8)
  total_funding_paid      Decimal?         @default(0) @db.Decimal(20, 8)
  status                  PositionStatus   @default(OPENING)
  opened_at               DateTime         @default(now()) @db.Timestamptz
  closed_at               DateTime?        @db.Timestamptz
  failure_reason          String?          @db.Text
  created_at              DateTime         @default(now()) @db.Timestamptz
  updated_at              DateTime         @updatedAt @db.Timestamptz

  // Relations
  arbitrage_cycle         ArbitrageCycle   @relation(fields: [arbitrage_cycle_id], references: [id], onDelete: Cascade)
  trades                  TradeRecord[]

  @@index([status], where: "status IN ('OPENING', 'ACTIVE', 'CLOSING')")
  @@index([arbitrage_cycle_id])
  @@index([opened_at(sort: Desc)])
  @@index([symbol, status])
  @@map("hedge_positions")
}

enum PositionStatus {
  OPENING   // 開倉中
  ACTIVE    // 持倉中
  CLOSING   // 平倉中
  CLOSED    // 已平倉
  FAILED    // 失敗

  @@map("position_status")
}

// ===== 交易記錄 =====
model TradeRecord {
  id                  String        @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  hedge_position_id   String        @db.Uuid
  exchange            String        @db.VarChar(50)
  symbol              String        @db.VarChar(20)
  order_id            String        @db.VarChar(100)
  client_order_id     String?       @db.VarChar(100)
  side                TradeSide
  type                OrderType
  action              TradeAction
  quantity            Decimal       @db.Decimal(20, 8)
  filled_quantity     Decimal       @db.Decimal(20, 8)
  price               Decimal?      @db.Decimal(20, 8)
  average_price       Decimal       @db.Decimal(20, 8)
  fee                 Decimal       @default(0) @db.Decimal(20, 8)
  fee_currency        String        @default("USDT") @db.VarChar(10)
  commission_rate     Decimal?      @db.Decimal(10, 8)
  order_status        OrderStatus
  slippage            Decimal?      @db.Decimal(10, 8)
  executed_at         DateTime      @default(now()) @db.Timestamptz
  created_at          DateTime      @default(now()) @db.Timestamptz

  // Relations
  hedge_position      HedgePosition @relation(fields: [hedge_position_id], references: [id], onDelete: Cascade)

  @@unique([exchange, order_id])
  @@index([hedge_position_id])
  @@index([executed_at(sort: Desc)])
  @@index([exchange, symbol, executed_at(sort: Desc)])
  @@map("trade_records")
}

enum TradeSide {
  LONG    // 做多
  SHORT   // 做空

  @@map("trade_side")
}

enum OrderType {
  MARKET  // 市價單
  LIMIT   // 限價單

  @@map("order_type")
}

enum TradeAction {
  OPEN    // 開倉
  CLOSE   // 平倉

  @@map("trade_action")
}

enum OrderStatus {
  FILLED    // 完全成交
  PARTIAL   // 部分成交
  CANCELED  // 已取消
  FAILED    // 失敗

  @@map("order_status")
}

// ===== 套利週期 =====
model ArbitrageCycle {
  id                      String                 @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  opportunity_id          String                 @unique @db.Uuid
  symbol                  String                 @db.VarChar(20)
  initial_capital_usdt    Decimal                @db.Decimal(20, 8)
  total_fees_usdt         Decimal                @default(0) @db.Decimal(20, 8)
  total_funding_income    Decimal                @default(0) @db.Decimal(20, 8)
  price_pnl_usdt          Decimal?               @default(0) @db.Decimal(20, 8)
  net_profit_usdt         Decimal?               @db.Decimal(20, 8)
  net_profit_rate         Decimal?               @db.Decimal(10, 8)
  roi                     Decimal?               @db.Decimal(10, 8)
  funding_periods         Int                    @default(0)
  duration_hours          Decimal?               @db.Decimal(10, 2)
  status                  CycleStatus            @default(ACTIVE)
  started_at              DateTime               @default(now()) @db.Timestamptz
  completed_at            DateTime?              @db.Timestamptz
  notes                   String?                @db.Text
  created_at              DateTime               @default(now()) @db.Timestamptz
  updated_at              DateTime               @updatedAt @db.Timestamptz

  // Relations
  opportunity             ArbitrageOpportunity   @relation(fields: [opportunity_id], references: [id], onDelete: Cascade)
  hedge_position          HedgePosition?

  @@index([opportunity_id])
  @@index([status])
  @@index([started_at(sort: Desc)])
  @@index([symbol, status])
  @@map("arbitrage_cycles")
}

enum CycleStatus {
  ACTIVE      // 進行中
  COMPLETED   // 已完成
  FAILED      // 失敗

  @@map("cycle_status")
}

// ===== 風險參數 =====
model RiskParameters {
  id                        String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  name                      String   @unique @db.VarChar(100)
  description               String?  @db.Text
  min_rate_difference       Decimal  @default(0.0005) @db.Decimal(10, 8)
  max_position_size_usdt    Decimal  @default(10000) @db.Decimal(20, 8)
  max_total_exposure_usdt   Decimal  @default(50000) @db.Decimal(20, 8)
  max_leverage              Int      @default(5)
  stop_loss_rate            Decimal  @default(0.001) @db.Decimal(10, 8)
  max_holding_hours         Int      @default(24)
  position_size_percentage  Decimal  @default(0.03) @db.Decimal(10, 8)
  enable_auto_trading       Boolean  @default(false)
  enable_auto_close         Boolean  @default(true)
  max_slippage_rate         Decimal  @default(0.001) @db.Decimal(10, 8)
  min_liquidity_usdt        Decimal  @default(50000) @db.Decimal(20, 8)
  is_active                 Boolean  @default(true)
  created_at                DateTime @default(now()) @db.Timestamptz
  updated_at                DateTime @updatedAt @db.Timestamptz

  @@index([is_active], where: "is_active = true")
  @@map("risk_parameters")
}

// ===== 系統事件 (TimescaleDB Hypertable) =====
model SystemEvent {
  id           String        @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  event_type   String        @db.VarChar(50)
  severity     EventSeverity
  exchange     String?       @db.VarChar(50)
  symbol       String?       @db.VarChar(20)
  message      String        @db.Text
  details      Json?         @db.JsonB
  related_id   String?       @db.Uuid
  is_notified  Boolean       @default(false)
  occurred_at  DateTime      @default(now()) @db.Timestamptz
  created_at   DateTime      @default(now()) @db.Timestamptz

  @@index([event_type, occurred_at(sort: Desc)])
  @@index([severity, occurred_at(sort: Desc)], where: "severity IN ('ERROR', 'CRITICAL')")
  @@index([is_notified], where: "is_notified = false")
  @@map("system_events")
}

enum EventSeverity {
  INFO      // 資訊
  WARNING   // 警告
  ERROR     // 錯誤
  CRITICAL  // 嚴重

  @@map("event_severity")
}
```

---

## 查詢優化策略

### 1. 常用查詢模式

#### 查詢最新資金費率

```typescript
// 優化: 使用 Redis 快取
async function getLatestFundingRates(exchange: string, symbol: string) {
  const cacheKey = `funding:latest:${exchange}:${symbol}`;
  const cached = await redis.hgetall(cacheKey);

  if (Object.keys(cached).length > 0) {
    return cached; // 快取命中
  }

  // 快取未命中,從資料庫查詢
  const rate = await prisma.$queryRaw<FundingRate[]>`
    SELECT DISTINCT ON (exchange, symbol)
      exchange, symbol, funding_rate, next_funding_time, recorded_at
    FROM funding_rates
    WHERE exchange = ${exchange} AND symbol = ${symbol}
    ORDER BY exchange, symbol, recorded_at DESC
  `;

  // 寫入快取
  if (rate[0]) {
    await redis.hset(cacheKey, {
      funding_rate: rate[0].funding_rate.toString(),
      next_funding_time: rate[0].next_funding_time.toISOString(),
      recorded_at: rate[0].recorded_at.toISOString()
    });
    await redis.expire(cacheKey, 60);
  }

  return rate[0];
}
```

#### 查詢活躍套利機會

```typescript
// 優化: 使用索引和 WHERE 條件
async function getActiveopportunities() {
  return prisma.arbitrageOpportunity.findMany({
    where: {
      status: { in: ['PENDING', 'EXECUTING'] },
      expires_at: { gt: new Date() }
    },
    orderBy: {
      expected_return_rate: 'desc'
    },
    take: 10
  });
}
```

#### 查詢活躍對沖部位及其交易記錄

```typescript
// 優化: 使用 include 減少查詢次數
async function getActivePositionsWithTrades() {
  return prisma.hedgePosition.findMany({
    where: {
      status: { in: ['OPENING', 'ACTIVE', 'CLOSING'] }
    },
    include: {
      trades: {
        orderBy: { executed_at: 'desc' }
      },
      arbitrage_cycle: {
        include: {
          opportunity: true
        }
      }
    }
  });
}
```

### 2. 批次操作優化

#### 批次插入資金費率

```typescript
// 優化: 使用 createMany 批次插入
async function batchInsertFundingRates(rates: FundingRateData[]) {
  const result = await prisma.fundingRate.createMany({
    data: rates,
    skipDuplicates: true // 跳過重複記錄
  });

  // 批次更新 Redis 快取
  const pipeline = redis.pipeline();
  for (const rate of rates) {
    const key = `funding:latest:${rate.exchange}:${rate.symbol}`;
    pipeline.hset(key, {
      funding_rate: rate.funding_rate.toString(),
      next_funding_time: rate.next_funding_time.toISOString(),
      recorded_at: rate.recorded_at.toISOString()
    });
    pipeline.expire(key, 60);
  }
  await pipeline.exec();

  return result;
}
```

### 3. 統計查詢優化

#### 查詢今日套利績效

```typescript
// 優化: 使用連續聚合 (Continuous Aggregate)
async function getTodayArbitrageStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 如果有連續聚合,直接查詢
  const stats = await prisma.$queryRaw`
    SELECT
      symbol,
      total_cycles,
      total_profit,
      avg_profit,
      avg_roi
    FROM arbitrage_daily_stats
    WHERE day = ${today}
  `;

  return stats;
}
```

### 4. 連線池配置

```typescript
// prisma/schema.prisma 中的連線池配置
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // 連線池配置
  // DATABASE_URL="postgresql://user:password@localhost:5432/arbitrage?schema=public&connection_limit=20&pool_timeout=30"
}

// 建議配置:
// - connection_limit: 20 (根據應用並發需求調整)
// - pool_timeout: 30 秒
// - connect_timeout: 10 秒
```

### 5. 查詢效能監控

```typescript
// 使用 Prisma 的查詢事件監控
const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
  ],
});

prisma.$on('query', (e) => {
  // 記錄慢查詢 (超過 100ms)
  if (e.duration > 100) {
    logger.warn('Slow query detected', {
      query: e.query,
      duration: e.duration,
      params: e.params
    });

    // 上報到 Prometheus
    slowQueryCounter.inc({
      query_type: extractQueryType(e.query)
    });
  }
});
```

---

## 總結

本資料模型設計涵蓋了跨交易所資金費率套利平台的所有核心實體和關聯關係,並針對以下方面進行了優化:

### 設計亮點

1. **時序資料優化**: 使用 TimescaleDB 高效處理資金費率和系統事件的時序資料
2. **快取策略**: 透過 Redis 快取熱資料,大幅降低資料庫查詢壓力
3. **資料完整性**: 使用外鍵約束和業務層級驗證確保資料一致性
4. **查詢效能**: 精心設計的索引和查詢模式確保高效的資料存取
5. **可擴展性**: 模組化設計便於未來擴展更多交易所和幣別

### 後續步驟

1. 執行 Prisma 遷移建立資料庫 schema
2. 配置 TimescaleDB Hypertable 和連續聚合
3. 實作 Redis 快取層
4. 建立資料驗證中介層
5. 實作查詢優化和效能監控

**文件版本**: 1.0
**最後更新**: 2025-10-17
**相關文件**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md)
