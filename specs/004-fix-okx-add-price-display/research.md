# Research: 修正 OKX 資金費率與增強價格顯示

**Feature**: 004-fix-okx-add-price-display
**Date**: 2025-01-21
**Status**: Phase 0 Complete

本文件記錄所有技術決策的研究過程、理由和替代方案評估。

---

## 1. WebSocket 價格訂閱機制

### Decision: Hybrid WebSocket-First Architecture with REST Polling Fallback

實作一個 **WebSocket-first** 的價格訂閱系統，當 WebSocket 連線失敗或斷線時，自動切換到 REST API polling 機制，並在 WebSocket 恢復後無縫切回。使用 **指數退避重連策略** 搭配 **有限狀態機 (FSM)** 管理連線狀態。

### Rationale

1. **低延遲需求達成**: WebSocket 推送機制可達到 <1 秒的價格更新延遲（規格要求 <5 秒），遠優於 REST 輪詢（通常 3-5 秒）
2. **可靠性保證**: REST 作為備援機制，確保即使 WebSocket 完全失效仍可持續運作（符合 Constitution Principle III: Defensive Programming）
3. **成本效益**: WebSocket 單一連線可訂閱多個交易對（Binance 最多 1024 個 streams），大幅降低 API 調用次數和速率限制風險
4. **交易所原生支援**: Binance 和 OKX 均提供成熟的 WebSocket ticker 推送服務
5. **憲法合規**: 符合 Principle III 的「graceful degradation」要求（單一交易所失敗時繼續監控另一個）

### Alternatives Considered

#### 1. 純 REST API Polling
- ❌ **延遲過高**: 輪詢間隔至少 1-3 秒，無法達到 <1 秒目標
- ❌ **API 配額消耗**: 每次輪詢消耗請求額度，容易觸發速率限制（Binance: 1200 requests/min）
- ❌ **伺服器負擔**: 高頻輪詢會對交易所 API 造成不必要壓力

#### 2. 純 WebSocket 無備援
- ❌ **單點失敗風險**: WebSocket 斷線時價格資料中斷，套利監控停擺
- ❌ **不符憲法要求**: 違反 Principle III 的「graceful degradation」原則

#### 3. 使用第三方庫 (ccxws)
- ⚠️ **過度抽象**: ccxws 雖支援 38 個交易所，但專案僅需 Binance/OKX，引入過多依賴
- ⚠️ **客製化受限**: 無法針對資金費率套利場景深度優化
- ✅ **可考慮參考**: 其狀態機設計和重連邏輯可作為實作參考

### Implementation Details

#### Binance WebSocket 實作

**端點選擇**:
- **Combined Streams**: `wss://stream.binance.com:9443/stream?streams=<stream1>/<stream2>/...`
- **測試網**: `wss://testnet.binance.vision/ws/<streamName>`

**Ticker Stream**:
```typescript
// Individual Symbol Ticker (推薦用於資金費率套利)
// 更新頻率: 即時更新（每筆交易後）
// 延遲: < 100ms
const tickerStream = 'btcusdt@ticker';
```

**訊息格式**:
```json
{
  "stream": "btcusdt@ticker",
  "data": {
    "e": "24hrTicker",
    "E": 1672515782136,
    "s": "BTCUSDT",
    "c": "25000.00",    // Last price
    "b": "24999.50",    // Best bid
    "a": "25000.50"     // Best ask
  }
}
```

**心跳機制**: Binance 由伺服器主動發送 ping（每 20 秒），客戶端必須在 60 秒內回應 pong（ws 庫自動處理）

#### OKX WebSocket 實作

**端點**:
- **公開頻道**: `wss://ws.okx.com:8443/ws/v5/public`
- **測試網**: `wss://wspap.okx.com:8443/ws/v5/public?brokerId=9999`

**訂閱格式**:
```json
{
  "op": "subscribe",
  "args": [{
    "channel": "tickers",
    "instId": "BTC-USDT-SWAP"
  }]
}
```

**訊息格式**:
```json
{
  "arg": {
    "channel": "tickers",
    "instId": "BTC-USDT-SWAP"
  },
  "data": [{
    "instId": "BTC-USDT-SWAP",
    "last": "25000.0",
    "bidPx": "24999.5",
    "askPx": "25000.5",
    "ts": "1672515782136"
  }]
}
```

**心跳機制**: OKX 由客戶端主動發送 ping（每 30 秒發送 `{"op": "ping"}`），伺服器回應 pong

#### 重連策略

**Exponential Backoff with Jitter**:
```
Attempt 1: 1s
Attempt 2: 2s
Attempt 3: 4s
Attempt 4: 8s
Attempt 5: 16s
Attempt 6-10: 30s (達上限)
```

**切換到 REST 的觸發條件**:
1. WebSocket 連線失敗或斷線
2. 重連次數超過 10 次
3. 60 秒內未收到任何訊息（健康檢查失敗）

**WebSocket 恢復機制**: 切換到 REST 後，每 30 秒嘗試恢復 WebSocket，成功後自動切回

#### TypeScript 類別結構

```typescript
// 抽象基類
abstract class PriceFeedClient extends EventEmitter {
  protected abstract connect(): Promise<void>;
  protected abstract disconnect(): void;
  abstract on(event: 'ticker', listener: (data: TickerData) => void): this;
}

// 具體實作
class BinancePriceFeed extends PriceFeedClient { /* ... */ }
class OKXPriceFeed extends PriceFeedClient { /* ... */ }

// 混合管理器
class PriceFeedManager extends EventEmitter {
  private currentSource: 'websocket' | 'rest';
  private wsClient: PriceFeedClient;
  private restPoller: RestPoller;
  // 自動切換邏輯
}
```

### Reference Links

- [Binance WebSocket Streams](https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams)
- [OKX WebSocket API](https://www.okx.com/docs-v5/en/)
- [Exponential Backoff Pattern](https://dev.to/hexshift/robust-websocket-reconnection-strategies-in-javascript-with-exponential-backoff-40n1)
- [WebSocket State Machine](https://www.endpointdev.com/blog/2024/07/websocket-controlled-state-machine/)

---

## 2. OKX 資金費率驗證機制

### Decision: Dual-Source Validation with OKX Native API + CCXT Backup

使用 OKX 原生 API (`/api/v5/public/funding-rate`) 作為主要資料來源，CCXT 作為備援驗證機制，並將驗證結果記錄到 TimescaleDB 供後續分析。

### Rationale

1. **準確性優先**: OKX 原生 API 提供最新且最準確的資金費率數據（直接來源）
2. **雙重驗證**: CCXT 作為獨立資料來源進行交叉驗證，檢測潛在的 API 錯誤或數據異常
3. **差異追蹤**: 記錄兩個來源的差異百分比到資料庫，便於分析 API 穩定性和識別異常模式
4. **符合規格要求**: 滿足 SC-001（差異 <0.0001%）和 FR-010（記錄驗證結果）
5. **憲法合規**: 符合 Principle II（Complete Observability）的完整可追溯性要求

### Alternatives Considered

#### 1. 僅使用 OKX 原生 API
- ❌ **無驗證機制**: 無法檢測 API 錯誤或數據異常
- ❌ **不符規格**: FR-002 要求驗證數據一致性

#### 2. 僅使用 CCXT
- ❌ **間接資料**: CCXT 本身也是調用 OKX API，增加一層抽象可能引入延遲或錯誤
- ❌ **依賴第三方**: CCXT 更新滯後可能導致 API 變更時失效

#### 3. 爬蟲擷取官網數據
- ❌ **維護成本高**: 網頁結構變更需要更新爬蟲邏輯
- ❌ **不穩定**: 可能被反爬蟲機制阻擋
- ❌ **違反服務條款**: 可能違反 OKX 使用條款

### Implementation Details

#### OKX Native API

**端點**: `GET /api/v5/public/funding-rate`

**請求參數**:
```typescript
{
  instId: 'BTC-USDT-SWAP',  // 永續合約交易對
  limit: 1                   // 僅需最新一筆
}
```

**回應格式**:
```json
{
  "code": "0",
  "msg": "",
  "data": [{
    "instType": "SWAP",
    "instId": "BTC-USDT-SWAP",
    "fundingRate": "0.0001",      // 當前資金費率
    "nextFundingRate": "0.00015", // 預測下期費率
    "fundingTime": "1672531200000" // 結算時間
  }]
}
```

**速率限制**: 20 requests/2s (公開端點)

**測試網與正式網**:
- 測試網: `https://www.okx.com/api/v5/public/funding-rate` (使用 demo trading 模式)
- 正式網: 相同端點，但需切換 API 基礎 URL

#### CCXT Integration

**方法**: `exchange.fetchFundingRate(symbol)`

```typescript
import ccxt from 'ccxt';

const okx = new ccxt.okx({
  enableRateLimit: true,
  options: { defaultType: 'swap' } // 永續合約
});

const fundingRate = await okx.fetchFundingRate('BTC/USDT:USDT');
// 返回格式:
// {
//   symbol: 'BTC/USDT:USDT',
//   fundingRate: 0.0001,
//   fundingTimestamp: 1672531200000,
//   ...
// }
```

**資料正規化**: CCXT 已將不同交易所的回應格式標準化，直接比較 `fundingRate` 欄位即可

#### 驗證邏輯

```typescript
class FundingRateValidator {
  private readonly ACCEPTABLE_DISCREPANCY = 0.000001; // 0.0001%

  async validate(symbol: string): Promise<ValidationResult> {
    // 並行獲取兩個來源
    const [okxNative, ccxtData] = await Promise.all([
      this.fetchOKXNative(symbol),
      this.fetchCCXT(symbol)
    ]);

    // 計算差異百分比
    const discrepancy = Math.abs(
      (okxNative.fundingRate - ccxtData.fundingRate) / okxNative.fundingRate
    );

    // 判斷是否通過驗證
    const isValid = discrepancy < this.ACCEPTABLE_DISCREPANCY;

    // 記錄到資料庫
    await this.logValidation({
      symbol,
      okxRate: okxNative.fundingRate,
      ccxtRate: ccxtData.fundingRate,
      discrepancyPercent: discrepancy * 100,
      validationStatus: isValid ? 'PASS' : 'FAIL',
      timestamp: new Date()
    });

    return { isValid, discrepancy, okxNative, ccxtData };
  }
}
```

#### 錯誤處理

**API 錯誤場景**:
1. **速率限制 (429)**: 使用指數退避重試（最多 3 次）
2. **網路超時**: 5 秒 timeout，重試 3 次
3. **數據缺失**: 標記為 'N/A'，記錄警告日誌
4. **CCXT 失敗**: 僅記錄警告，不阻斷 OKX 原生數據使用

**數據不一致處理**:
- **差異 >0.0001%**: 記錄為 'FAIL'，觸發警告通知
- **差異 >1%**: 視為異常，發送緊急警報（可能是 API 錯誤）

### Database Schema (TimescaleDB)

#### Table: `funding_rate_validations`

```sql
CREATE TABLE funding_rate_validations (
  id SERIAL,
  timestamp TIMESTAMPTZ NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  exchange VARCHAR(10) DEFAULT 'OKX',

  -- OKX Native API 數據
  okx_rate DECIMAL(18, 8) NOT NULL,
  okx_next_rate DECIMAL(18, 8),
  okx_funding_time TIMESTAMPTZ,

  -- CCXT 數據
  ccxt_rate DECIMAL(18, 8),
  ccxt_funding_time TIMESTAMPTZ,

  -- 驗證結果
  discrepancy_percent DECIMAL(10, 6),
  validation_status VARCHAR(10) CHECK (validation_status IN ('PASS', 'FAIL', 'ERROR', 'N/A')),

  -- Metadata
  data_source VARCHAR(20) DEFAULT 'API', -- 'API' or 'CCXT'
  error_message TEXT,

  PRIMARY KEY (timestamp, symbol)
);

-- 建立 hypertable（時序資料優化）
SELECT create_hypertable('funding_rate_validations', 'timestamp');

-- 索引
CREATE INDEX idx_validations_symbol ON funding_rate_validations(symbol, timestamp DESC);
CREATE INDEX idx_validations_status ON funding_rate_validations(validation_status, timestamp DESC);

-- 保留政策（保留 90 天數據）
SELECT add_retention_policy('funding_rate_validations', INTERVAL '90 days');

-- 自動壓縮（7 天前的數據）
SELECT add_compression_policy('funding_rate_validations', INTERVAL '7 days');
```

#### 查詢範例

```sql
-- 查詢最近 24 小時的驗證失敗記錄
SELECT
  symbol,
  timestamp,
  okx_rate,
  ccxt_rate,
  discrepancy_percent
FROM funding_rate_validations
WHERE validation_status = 'FAIL'
  AND timestamp > NOW() - INTERVAL '24 hours'
ORDER BY discrepancy_percent DESC;

-- 計算 BTCUSDT 的驗證通過率
SELECT
  symbol,
  COUNT(*) as total_validations,
  SUM(CASE WHEN validation_status = 'PASS' THEN 1 ELSE 0 END) as passed,
  ROUND(100.0 * SUM(CASE WHEN validation_status = 'PASS' THEN 1 ELSE 0 END) / COUNT(*), 2) as pass_rate
FROM funding_rate_validations
WHERE symbol = 'BTC-USDT-SWAP'
  AND timestamp > NOW() - INTERVAL '7 days'
GROUP BY symbol;
```

### Prisma Schema

```prisma
model FundingRateValidation {
  id                  Int       @id @default(autoincrement())
  timestamp           DateTime  @default(now()) @db.Timestamptz
  symbol              String    @db.VarChar(20)
  exchange            String    @default("OKX") @db.VarChar(10)

  okxRate             Decimal   @db.Decimal(18, 8)
  okxNextRate         Decimal?  @db.Decimal(18, 8)
  okxFundingTime      DateTime? @db.Timestamptz

  ccxtRate            Decimal?  @db.Decimal(18, 8)
  ccxtFundingTime     DateTime? @db.Timestamptz

  discrepancyPercent  Decimal?  @db.Decimal(10, 6)
  validationStatus    String    @db.VarChar(10) // PASS, FAIL, ERROR, N/A

  dataSource          String    @default("API") @db.VarChar(20)
  errorMessage        String?   @db.Text

  @@index([symbol, timestamp(sort: Desc)])
  @@index([validationStatus, timestamp(sort: Desc)])
  @@map("funding_rate_validations")
}
```

### Reference Links

- [OKX Public Data API](https://www.okx.com/docs-v5/en/#public-data-rest-api-get-funding-rate)
- [CCXT OKX Integration](https://docs.ccxt.com/#/exchanges/okx)
- [TimescaleDB Hypertables](https://docs.timescale.com/use-timescale/latest/hypertables/)
- [Prisma Decimal Type](https://www.prisma.io/docs/concepts/components/prisma-schema/data-model#decimal)

---

## 3. 套利評估演算法

### Decision: Configurable Multi-Factor Arbitrage Assessment

實作可配置的多因子套利評估系統，綜合考慮資金費率差異、價格價差和交易手續費，並支援極端價差檢測（>5%）。

### Rationale

1. **符合規格需求**: FR-005（綜合考慮資金費率和價差）、FR-007（顯示預期淨收益）
2. **可配置性**: 手續費率可配置（預設 0.2%），適應不同 VIP 等級用戶
3. **風險控制**: 極端價差警報（>5%）防止基於異常數據執行交易
4. **清晰判斷**: 明確的可行/不可行/風險標示，符合 FR-006
5. **憲法合規**: 符合 Principle I（Trading Safety First）的風險提示要求

### Alternatives Considered

#### 1. 固定手續費率（0.1%）
- ❌ **不夠靈活**: 無法適應不同用戶的實際手續費率
- ❌ **估算不準**: VIP 用戶實際費率可能更低（0.02%-0.05%）

#### 2. 動態查詢用戶費率
- ⚠️ **超出 MVP 範圍**: 需要認證 API 並查詢帳戶資訊
- ⚠️ **複雜度高**: 需處理多個交易所的不同 API
- ✅ **未來擴展**: 可作為 Phase 2 功能

#### 3. 不考慮價差，僅比較資金費率
- ❌ **不符規格**: 用戶明確要求考慮價差（避免「賺了資金費率，卻賠了價差」）
- ❌ **誤導決策**: 可能標示不可行的機會為可行

### Implementation Details

#### 套利淨收益計算公式

```typescript
/**
 * 套利淨收益 = |資金費率差異| - |價格價差| - 交易手續費
 *
 * 其中：
 * - 資金費率差異 = binanceFundingRate - okxFundingRate
 * - 價格價差 = (binancePrice - okxPrice) / binancePrice
 * - 交易手續費 = makerFee + takerFee（預設 0.1% + 0.1% = 0.2%）
 */

interface ArbitrageConfig {
  makerFee: number;    // 預設 0.001 (0.1%)
  takerFee: number;    // 預設 0.001 (0.1%)
  extremeSpreadThreshold: number; // 預設 0.05 (5%)
}

class ArbitrageAssessor {
  constructor(private config: ArbitrageConfig) {}

  assess(
    symbol: string,
    binanceFundingRate: number,
    okxFundingRate: number,
    binancePrice: number,
    okxPrice: number
  ): ArbitrageAssessment {
    // 1. 計算資金費率差異（絕對值）
    const fundingRateSpread = Math.abs(binanceFundingRate - okxFundingRate);

    // 2. 計算價格價差（百分比，絕對值）
    const priceSpread = Math.abs(
      (binancePrice - okxPrice) / ((binancePrice + okxPrice) / 2)
    );

    // 3. 計算總手續費成本
    const totalFees = this.config.makerFee + this.config.takerFee;

    // 4. 計算淨收益
    const netProfit = fundingRateSpread - priceSpread - totalFees;

    // 5. 判斷套利方向
    const direction = binanceFundingRate > okxFundingRate
      ? '在 Binance 做空 + 在 OKX 做多'
      : '在 Binance 做多 + 在 OKX 做空';

    // 6. 判斷可行性
    let feasibility: 'VIABLE' | 'NOT_VIABLE' | 'HIGH_RISK';
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';

    if (priceSpread > this.config.extremeSpreadThreshold) {
      feasibility = 'HIGH_RISK';
      riskLevel = 'HIGH';
    } else if (netProfit > 0) {
      feasibility = 'VIABLE';
      riskLevel = netProfit > 0.001 ? 'LOW' : 'MEDIUM'; // >0.1% 為低風險
    } else {
      feasibility = 'NOT_VIABLE';
      riskLevel = 'MEDIUM';
    }

    return {
      symbol,
      fundingRateSpread,
      priceSpread,
      totalFees,
      netProfit,
      netProfitPercent: netProfit * 100,
      direction,
      feasibility,
      riskLevel,
      extremeSpreadDetected: priceSpread > this.config.extremeSpreadThreshold,
      timestamp: new Date()
    };
  }
}
```

#### 可配置機制

**環境變數配置**:
```bash
# .env
ARBITRAGE_MAKER_FEE=0.001  # 0.1%
ARBITRAGE_TAKER_FEE=0.001  # 0.1%
EXTREME_SPREAD_THRESHOLD=0.05  # 5%
```

**CLI 參數覆寫**:
```bash
node dist/cli/index.js monitor start \
  --maker-fee 0.0002 \    # VIP 用戶較低費率
  --taker-fee 0.0004 \
  --extreme-threshold 0.08
```

#### 極端價差檢測

**檢測邏輯**:
```typescript
if (priceSpread > 0.05) { // 5%
  logger.warn({
    symbol,
    priceSpread: `${(priceSpread * 100).toFixed(2)}%`,
    binancePrice,
    okxPrice,
    message: '⚠️ 極端價差檢測：價差超過 5%，可能是數據異常'
  });

  // 在 UI 顯示黃色警告標示
  return {
    feasibility: 'HIGH_RISK',
    warningMessage: '價差異常大，請謹慎評估風險！'
  };
}
```

**警告顯示範例**:
```
┌──────────┬────────────┬────────────┬──────────┬──────────┬────────────────┐
│ 交易對   │ 資金費率差 │ 價差       │ 淨收益   │ 可行性   │ 警告           │
├──────────┼────────────┼────────────┼──────────┼──────────┼────────────────┤
│ BTCUSDT  │ 0.15%      │ 6.50% ⚠️  │ -6.55%   │ 高風險   │ 價差異常大！   │
└──────────┴────────────┴────────────┴──────────┴──────────┴────────────────┘
```

### Data Model

```typescript
interface ArbitrageAssessment {
  symbol: string;

  // 輸入數據
  binanceFundingRate: number;
  okxFundingRate: number;
  binancePrice: number;
  okxPrice: number;

  // 計算結果
  fundingRateSpread: number;     // 資金費率差異（絕對值）
  priceSpread: number;            // 價格價差百分比（絕對值）
  totalFees: number;              // 總手續費
  netProfit: number;              // 淨收益（小數）
  netProfitPercent: number;       // 淨收益百分比

  // 判斷結果
  direction: string;              // 套利方向
  feasibility: 'VIABLE' | 'NOT_VIABLE' | 'HIGH_RISK';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  extremeSpreadDetected: boolean; // 是否檢測到極端價差
  warningMessage?: string;        // 警告訊息

  timestamp: Date;
}
```

### Reference Links

- [Funding Rate Arbitrage Explained](https://www.binance.com/en/support/faq/what-is-funding-rate-and-how-it-works-360033525031)
- [Trading Fee Structures](https://www.binance.com/en/fee/schedule)
- [Risk Management in Arbitrage](https://www.investopedia.com/terms/a/arbitrage.asp)

---

## 4. 監控界面增強設計

### Decision: Enhanced CLI Table with Price Display and Arbitrage Indicators

增強現有的 `MonitorOutputFormatter` 以顯示即時價格、價差、淨收益和套利可行性標示，使用顏色編碼和 emoji 提升可讀性。

### Rationale

1. **符合規格需求**: FR-003（顯示即時價格）、FR-006（明確標示可行性）、SC-005（3 秒內識別套利機會）
2. **使用者體驗**: 視覺化標示（顏色、emoji）讓用戶快速識別套利機會
3. **現有架構整合**: 在既有的 `MonitorOutputFormatter` 基礎上擴展，複用 TTY 檢測和輸出策略
4. **符合憲法**: 保持簡潔設計（Principle V: Incremental Delivery）

### Alternatives Considered

#### 1. 使用 Web Dashboard (React/Vue)
- ❌ **超出範圍**: 規格未要求 Web UI
- ❌ **複雜度高**: 需要前後端分離、WebSocket 伺服器
- ✅ **未來擴展**: 可作為 Phase 3 功能

#### 2. 使用 TUI 框架 (Blessed, Ink)
- ⚠️ **學習曲線**: 需要額外學習 TUI 框架
- ⚠️ **過度設計**: 當前需求用 cli-table3 + chalk 即可滿足
- ✅ **可考慮**: 若需要互動式 UI（如排序、篩選）可考慮

#### 3. 純文字輸出（無顏色）
- ❌ **可讀性差**: 無法快速識別套利機會
- ❌ **不符用戶期望**: 用戶要求「更明確的表示」

### Implementation Details

#### 表格欄位設計

**原有欄位**（保留）:
- 交易對 (Symbol)
- Binance 資金費率
- OKX 資金費率
- 費率差異

**新增欄位**:
- Binance 價格（Last Price）
- OKX 價格（Last Price）
- 價格價差百分比
- 淨收益百分比
- 套利可行性（✅ 可行 / ❌ 不可行 / ⚠️ 高風險）

#### 表格佈局範例

```
┌──────────┬──────────────┬──────────────┬──────────┬──────────────┬──────────────┬──────────┬──────────┬──────────────┐
│ 交易對   │ Binance 費率 │ OKX 費率     │ 費率差異 │ Binance 價格 │ OKX 價格     │ 價差     │ 淨收益   │ 套利可行性   │
├──────────┼──────────────┼──────────────┼──────────┼──────────────┼──────────────┼──────────┼──────────┼──────────────┤
│ BTCUSDT  │ 0.0100%      │ 0.0050%      │ 0.0050%  │ $43,250.50   │ $43,248.00   │ 0.006%   │ +0.099%  │ ✅ 可行      │
│ ETHUSDT  │ -0.0020%     │ 0.0030%      │ 0.0050%  │ $2,280.15    │ $2,281.00    │ 0.037%   │ -0.182%  │ ❌ 不可行    │
│ BNBUSDT  │ 0.0500%      │ -0.0200%     │ 0.0700%  │ $315.80      │ $335.50      │ 6.230%   │ -6.360%  │ ⚠️ 高風險    │
└──────────┴──────────────┴──────────────┴──────────┴──────────────┴──────────────┴──────────┴──────────┴──────────────┘
```

#### 顏色編碼策略

```typescript
class MonitorOutputFormatter {
  private formatFeasibility(assessment: ArbitrageAssessment): string {
    const useColor = this.supportsColor;

    switch (assessment.feasibility) {
      case 'VIABLE':
        return useColor
          ? chalk.bold.green(`✅ 可行 (+${assessment.netProfitPercent.toFixed(3)}%)`)
          : `>>> 可行 (+${assessment.netProfitPercent.toFixed(3)}%)`;

      case 'NOT_VIABLE':
        return useColor
          ? chalk.dim.red(`❌ 不可行 (${assessment.netProfitPercent.toFixed(3)}%)`)
          : `XXX 不可行 (${assessment.netProfitPercent.toFixed(3)}%)`;

      case 'HIGH_RISK':
        return useColor
          ? chalk.bold.yellow(`⚠️ 高風險 (價差 ${(assessment.priceSpread * 100).toFixed(2)}%)`)
          : `!!! 高風險 (價差 ${(assessment.priceSpread * 100).toFixed(2)}%)`;
    }
  }

  private formatPriceSpread(spread: number): string {
    const spreadPercent = (spread * 100).toFixed(3);
    const useColor = this.supportsColor;

    if (spread > 0.05) {
      // 極端價差：黃色警告
      return useColor
        ? chalk.yellow(`${spreadPercent}% ⚠️`)
        : `${spreadPercent}% !!!`;
    } else if (spread > 0.01) {
      // 中等價差：白色
      return useColor
        ? chalk.white(`${spreadPercent}%`)
        : `${spreadPercent}%`;
    } else {
      // 低價差：灰色
      return useColor
        ? chalk.dim(`${spreadPercent}%`)
        : `${spreadPercent}%`;
    }
  }
}
```

#### 更新頻率優化

**資料快取策略**:
```typescript
class PriceCache {
  private cache = new Map<string, CachedPrice>();
  private readonly UPDATE_THRESHOLD = 0.0001; // 0.01% 變化才更新

  shouldUpdate(symbol: string, newPrice: number): boolean {
    const cached = this.cache.get(symbol);
    if (!cached) return true;

    const priceChange = Math.abs(
      (newPrice - cached.price) / cached.price
    );

    return priceChange > this.UPDATE_THRESHOLD;
  }
}
```

**UI 刷新策略**:
- WebSocket 數據到達時立即更新（延遲 <1 秒）
- REST 輪詢模式每 5 秒刷新一次
- 使用 `log-update` 原地刷新（TTY 模式）
- 非 TTY 模式每次更新輸出新行

#### 數據延遲警告

```typescript
class PriceDataValidator {
  private readonly DELAY_WARNING_THRESHOLD = 10000; // 10 秒

  checkDelay(timestamp: Date): DelayStatus {
    const delay = Date.now() - timestamp.getTime();

    if (delay > this.DELAY_WARNING_THRESHOLD) {
      return {
        hasDelay: true,
        delaySeconds: Math.floor(delay / 1000),
        warning: `⏱️ 數據延遲 ${Math.floor(delay / 1000)} 秒`
      };
    }

    return { hasDelay: false };
  }
}
```

**延遲顯示範例**:
```
[10:30:45] Uptime: 5m 23s | Updates: 156 | Errors: 0 | Opportunities: 1
─────────────────────────────────────────────────────────────────────────

⏱️ 警告: OKX 價格數據延遲 12 秒

┌──────────┬──────────────┬──────────────┬──────────┐
│ 交易對   │ Binance 價格 │ OKX 價格     │ 狀態     │
├──────────┼──────────────┼──────────────┼──────────┤
│ BTCUSDT  │ $43,250.50   │ $43,248.00 ⏱│ 延遲     │
└──────────┴──────────────┴──────────────┴──────────┘
```

### Integration with Existing Code

**修改檔案**: `src/lib/formatters/MonitorOutputFormatter.ts`

**新增方法**:
```typescript
class MonitorOutputFormatter {
  // 現有方法（保留）
  renderStatusHeader(stats: MonitorStats): string { /* ... */ }
  renderTable(pairs: FundingRatePair[], threshold: number): string { /* ... */ }

  // 新增方法
  renderEnhancedTable(
    pairs: FundingRatePair[],
    prices: Map<string, PriceData>,
    assessments: Map<string, ArbitrageAssessment>,
    config: ArbitrageConfig
  ): string {
    const table = new Table({
      head: [
        '交易對',
        'Binance 費率',
        'OKX 費率',
        '費率差異',
        'Binance 價格',
        'OKX 價格',
        '價差',
        '淨收益',
        '套利可行性'
      ],
      colWidths: [12, 14, 14, 10, 14, 14, 10, 10, 16]
    });

    pairs.forEach(pair => {
      const price = prices.get(pair.symbol);
      const assessment = assessments.get(pair.symbol);

      if (!price || !assessment) return;

      table.push([
        pair.symbol,
        this.formatPercent(pair.binance.fundingRate),
        this.formatPercent(pair.okx.fundingRate),
        this.formatPercent(Math.abs(pair.binance.fundingRate - pair.okx.fundingRate)),
        this.formatPrice(price.binancePrice),
        this.formatPrice(price.okxPrice),
        this.formatPriceSpread(assessment.priceSpread),
        this.formatNetProfit(assessment.netProfit),
        this.formatFeasibility(assessment)
      ]);
    });

    return table.toString();
  }
}
```

### Reference Links

- [cli-table3 Documentation](https://www.npmjs.com/package/cli-table3)
- [chalk Color Codes](https://www.npmjs.com/package/chalk)
- [log-update Usage](https://www.npmjs.com/package/log-update)
- [Terminal UI Best Practices](https://clig.dev/#foreground-colors)

---

## Summary of Research Decisions

| Topic | Decision | Key Rationale |
|-------|----------|---------------|
| **價格訂閱** | WebSocket-first + REST fallback | 低延遲 (<1s) + 可靠性保證 |
| **資金費率驗證** | OKX Native API + CCXT backup | 雙重驗證 + TimescaleDB 記錄 |
| **套利評估** | 可配置多因子評估 | 綜合費率+價差+手續費，支援客製化 |
| **界面設計** | 增強 CLI 表格 + 顏色編碒 | 快速識別機會，符合現有架構 |

所有決策均符合專案憲法的五大原則，並滿足規格中的功能需求和成功標準。

---

**Research Phase Complete** | **Next: Phase 1 - Design & Contracts**
