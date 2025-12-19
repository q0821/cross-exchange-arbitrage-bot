# Research: 開倉停損停利設定

**Date**: 2025-12-20
**Feature**: 038-specify-scripts-bash

## 研究摘要

針對 Binance、OKX、Gate.io、MEXC 四個交易所的期貨/合約停損停利條件單 API 進行研究。

---

## 1. 各交易所 API 支援情況

### 1.1 Binance (USD-M Futures)

**Decision**: 使用 `STOP_MARKET` 和 `TAKE_PROFIT_MARKET` 訂單類型

**Rationale**: Binance 完整支援條件單，API 文件清晰，是最成熟的方案。

**API 端點**: `POST /fapi/v1/order`

**關鍵參數**:

| 參數 | 停損單 | 停利單 |
|------|--------|--------|
| `type` | STOP_MARKET | TAKE_PROFIT_MARKET |
| `side` | 平倉方向 (SELL for LONG, BUY for SHORT) | 平倉方向 |
| `stopPrice` | 觸發價格 | 觸發價格 |
| `positionSide` | LONG / SHORT (Hedge Mode) | LONG / SHORT |
| `quantity` | 倉位數量 | 倉位數量 |

**Hedge Mode vs One-way Mode**:
- Hedge Mode: 必須指定 `positionSide`
- One-way Mode: 不需要 `positionSide`，系統根據持倉自動判斷

**重要注意**: 2025-12-09 後條件單遷移至 Algo Service，可能出現 `-4120 STOP_ORDER_SWITCH_ALGO` 錯誤

---

### 1.2 OKX (Swap/Futures)

**Decision**: 使用 `ordType: conditional` 搭配 `slTriggerPx` 和 `tpTriggerPx`

**Rationale**: OKX 支援在單一請求中同時設定停損和停利。

**API 端點**: `POST /api/v5/trade/order-algo`

**關鍵參數**:

| 參數 | 說明 |
|------|------|
| `instId` | 合約名稱 (如 BTC-USDT-SWAP) |
| `tdMode` | cross / isolated |
| `ordType` | conditional |
| `posSide` | long / short / net |
| `slTriggerPx` | 停損觸發價 |
| `slOrdPx` | -1 (市價) |
| `tpTriggerPx` | 停利觸發價 |
| `tpOrdPx` | -1 (市價) |

**重要限制**:
- Net Mode 下同時發送 TP 和 SL 時，**僅 SL 執行，TP 被忽略**
- 解決方案：分開發送兩個訂單，或使用 OCO 訂單

---

### 1.3 Gate.io (Futures)

**Decision**: 使用價格觸發訂單 (Price Triggered Orders)

**Rationale**: Gate.io 需要分別創建停損和停利訂單。

**API 端點**: `POST /futures/{settle}/price_orders`

**關鍵參數**:

| 參數 | 說明 |
|------|------|
| `settle` | usdt |
| `contract` | BTC_USDT |
| `trigger.price` | 觸發價格 |
| `trigger.rule` | 1 (>=) 或 2 (<=) |
| `initial.size` | 正數=多頭，負數=空頭 |
| `initial.reduce_only` | true |

**注意**: Gate.io 不支援在單一請求中同時設定 TP/SL，需分開發送。

---

### 1.4 MEXC (Futures)

**Decision**: 使用 `STOP_MARKET` 和 `TAKE_PROFIT_MARKET`

**Rationale**: MEXC API 結構與 Binance 類似。

**API 端點**: `POST /fapi/v1/order`

**關鍵參數**:

| 參數 | 說明 |
|------|------|
| `type` | STOP_MARKET / TAKE_PROFIT_MARKET |
| `stopPrice` | 觸發價格 |
| `positionSide` | LONG / SHORT (Hedge Mode) |

**限制**: MEXC 的期貨 API 支援可能受限，需進一步測試。

---

## 2. 技術決策

### 2.1 停損停利設定時機

**Decision**: 開倉成功後立即設定

**Rationale**:
- 需要知道實際成交價格來計算觸發價
- 如果與開倉同時設定，可能因價格變動導致立即觸發

**Alternatives Considered**:
- 與開倉同時設定 (rejected: 無法知道實際成交價)
- 延遲設定 (rejected: 增加風險窗口)

### 2.2 觸發價格計算

**Decision**: 基於開倉均價 + 百分比偏移

**Rationale**: 百分比方式對用戶更直觀，不需要手動計算價格。

**計算公式**:
- Long 停損價 = 開倉均價 × (1 - 停損百分比)
- Long 停利價 = 開倉均價 × (1 + 停利百分比)
- Short 停損價 = 開倉均價 × (1 + 停損百分比)
- Short 停利價 = 開倉均價 × (1 - 停利百分比)

### 2.3 訂單類型選擇

**Decision**: 使用市價條件單 (STOP_MARKET / TAKE_PROFIT_MARKET)

**Rationale**:
- 市價單確保成交
- 限價單可能因滑點無法成交，導致風險擴大

**Alternatives Considered**:
- 限價條件單 (rejected: 可能無法成交)

### 2.4 持倉模式處理

**Decision**: 動態偵測 Hedge Mode / One-way Mode，適配參數

**Rationale**: 現有程式碼已有偵測邏輯，復用相同模式。

**Implementation**:
- Binance: 使用現有 `detectBinanceAccountType` 方法
- OKX: 固定使用 Hedge Mode (`posSide: long/short`)
- Gate.io: 使用 `reduce_only: true`
- MEXC: 與 Binance 相同邏輯

### 2.5 失敗處理策略

**Decision**: 停損停利設定失敗不影響開倉成功狀態，但顯示警告

**Rationale**:
- 開倉已經成功執行，無法回滾
- 用戶可以手動在交易所設定停損停利

**Error Handling**:
1. 記錄失敗原因到日誌
2. 在 UI 顯示警告訊息
3. 更新 Position 記錄標註停損停利設定失敗

---

## 3. CCXT 支援分析

### 3.1 CCXT 條件單支援

**Decision**: 優先使用原生 SDK，CCXT 作為備援

**Rationale**:
- CCXT 對條件單的支援不完整
- 原生 SDK 可以使用最新功能
- 現有程式碼已使用 CCXT，可統一介面

**CCXT 調用方式**:
```typescript
const params = {
  stopLoss: {
    triggerPrice: slPrice,
  },
  takeProfit: {
    triggerPrice: tpPrice,
  },
};
await exchange.createOrder(symbol, 'market', side, amount, undefined, params);
```

### 3.2 CCXT 限制

- 不是所有交易所都完全支援
- `reduceOnly` 支援因交易所而異
- `positionSide` 在 Hedge Mode 下需要額外處理
- 可能需要降級到原生 API 調用

---

## 4. 實作建議

### 4.1 統一介面設計

```typescript
interface ConditionalOrderParams {
  positionId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  entryPrice: number;
  stopLossPercent?: number;  // 0.5 - 50
  takeProfitPercent?: number;  // 0.5 - 100
}

interface ConditionalOrderResult {
  stopLossOrderId?: string;
  stopLossPrice?: number;
  takeProfitOrderId?: string;
  takeProfitPrice?: number;
  errors?: string[];
}
```

### 4.2 交易所適配器

為每個交易所實作 `setConditionalOrders` 方法：

- `BinanceConditionalOrderAdapter`
- `OkxConditionalOrderAdapter`
- `GateioConditionalOrderAdapter`
- `MexcConditionalOrderAdapter`

### 4.3 錯誤處理

| 錯誤情境 | 處理方式 |
|----------|----------|
| 交易所不支援條件單 | 跳過設定，記錄警告 |
| 停損設定失敗 | 記錄錯誤，繼續設定停利 |
| 停利設定失敗 | 記錄錯誤，停損仍有效 |
| 雙邊都失敗 | 記錄錯誤，顯示警告 |

---

## 5. 風險評估

### 5.1 已識別風險

| 風險 | 影響 | 緩解措施 |
|------|------|----------|
| 網路延遲導致觸發價過近 | 立即觸發停損 | 設定最小百分比 (0.5%) |
| 交易所 API 變更 | 功能失效 | 監控 API 文件，定期更新 |
| Hedge/One-way 模式判斷錯誤 | 訂單失敗 | 使用現有偵測邏輯 + 重試 |
| OKX Net Mode 限制 | TP 被忽略 | 分開發送 TP 和 SL 訂單 |

### 5.2 測試建議

1. **單元測試**: 觸發價格計算邏輯
2. **整合測試**: 各交易所 API 調用（使用 Testnet）
3. **端對端測試**: 完整開倉 + 設定條件單流程
