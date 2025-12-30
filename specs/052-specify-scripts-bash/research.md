# Research: 交易所 WebSocket 即時數據訂閱

**Feature**: 052-specify-scripts-bash
**Date**: 2025-12-31

## 1. 各交易所 WebSocket API 比較

### 1.1 Binance

**WebSocket Endpoints:**
- 公開頻道: `wss://fstream.binance.com/stream`
- 私有頻道: `wss://fstream.binance.com/ws/<listenKey>`

**資金費率頻道:**
- 頻道名稱: `<symbol>@markPrice` 或 `<symbol>@markPrice@1s`
- 更新頻率: 1 秒或 3 秒
- 訊息格式:
  ```json
  {
    "e": "markPriceUpdate",
    "s": "BTCUSDT",
    "p": "42500.00",
    "r": "0.00038167",
    "T": 1562306400000
  }
  ```

**私有頻道認證 (listenKey):**
- 建立: `POST /fapi/v1/listenKey`
- 續期: `PUT /fapi/v1/listenKey` (每 30-45 分鐘)
- 有效期: 60 分鐘

**私有頻道事件:**
- `ACCOUNT_UPDATE`: 餘額和持倉變更
- `ORDER_TRADE_UPDATE`: 訂單狀態和成交

**心跳機制:**
- Ping 頻率: 每 20 秒
- Pong 超時: 60 秒
- 連線時限: 24 小時

**決策**: `@binance/connector` 不支援 Futures WebSocket，需自行實作

---

### 1.2 OKX

**WebSocket Endpoints:**
- 公開頻道: `wss://ws.okx.com:8443/ws/v5/public`
- 私有頻道: `wss://ws.okx.com:8443/ws/v5/private`

**資金費率頻道:**
- 頻道名稱: `funding-rate`
- 訂閱格式:
  ```json
  {"op": "subscribe", "args": [{"channel": "funding-rate", "instId": "BTC-USDT-SWAP"}]}
  ```
- 訊息格式:
  ```json
  {
    "arg": {"channel": "funding-rate", "instId": "BTC-USDT-SWAP"},
    "data": [{
      "fundingRate": "-0.00003250",
      "fundingTime": "1699632000000",
      "nextFundingRate": "-0.00001200"
    }]
  }
  ```

**私有頻道認證:**
- 使用 HMAC-SHA256 簽名
- 簽名訊息: `timestamp + 'GET' + '/users/self/verify'`
- 登入格式:
  ```json
  {"op": "login", "args": [{"apiKey": "...", "passphrase": "...", "timestamp": "...", "sign": "..."}]}
  ```

**私有頻道:**
- `balance_and_position`: 餘額和持倉
- `orders`: 訂單更新
- `positions`: 持倉變更

**心跳機制:**
- 超時時間: 30 秒無活動自動斷線
- 需每 20 秒發送 `ping`

**決策**: 使用 CCXT `watchFundingRate` / `watchPositions` / `watchOrders`

---

### 1.3 Gate.io

**WebSocket Endpoints:**
- 公開頻道: `wss://fx-ws.gateio.ws/v4/ws/btc`
- 測試網: `wss://fx-ws-testnet.gateio.ws/v4/ws/btc`

**資金費率頻道:**
- 頻道名稱: `futures.tickers`
- 包含: `funding_rate`, `funding_rate_indicative`, `mark_price`
- 訂閱格式:
  ```json
  {"time": 123456, "channel": "futures.tickers", "event": "subscribe", "payload": ["BTC_USD"]}
  ```

**私有頻道認證:**
- 使用 HMAC-SHA512 簽名
- 簽名訊息: `channel=<channel>&event=<event>&time=<time>`

**私有頻道:**
- `futures.positions`: 持倉更新
- `futures.orders`: 訂單更新
- `futures.balances`: 餘額更新

**CCXT 支援:**
- ✅ `watchPositions()` - 完整支援
- ✅ `watchOrders()` - 完整支援
- ✅ `watchBalance()` - 完整支援

**決策**: 使用 CCXT Pro 實作，功能完整

---

### 1.4 BingX

**WebSocket Endpoints:**
- 公開頻道: `wss://open-api-ws.bingx.com/market`
- 私有頻道: `wss://open-api-ws.bingx.com/market?listenKey=<listen_key>`

**資金費率頻道:**
- ❌ 無專用 WebSocket 頻道
- 需繼續使用 REST API 輪詢

**私有頻道認證:**
- 使用 listenKey 機制（類似 Binance）
- 有效期: 24 小時
- 已知問題: CCXT 認證 1 小時後過期 (bug)

**私有頻道事件:**
- `accountUpdate`: 帳戶和持倉更新
- `orderTradeUpdate`: 訂單成交更新
- 資料格式: GZIP 壓縮，需解壓

**心跳機制:**
- 伺服器每 5 秒發送 ping
- 客戶端必須回應 pong

**CCXT 支援:**
- ✅ `watchOrders()` - 有 1 小時認證過期問題
- ✅ `watchBalance()` - 可用
- ❌ `watchPositions()` - 不支援

**決策**:
- 資金費率: 維持 REST 輪詢
- 持倉監控: 需自行實作 accountUpdate 頻道解析

---

### 1.5 MEXC

**備註**: MEXC 不支援 API 交易，僅需實作資金費率 WebSocket

**WebSocket Endpoints:**
- 公開頻道: `wss://contract.mexc.com/ws`

**資金費率頻道:**
- 頻道名稱: `sub.funding.rate`
- 訂閱格式:
  ```json
  {"method": "sub.funding.rate", "param": {"symbol": "BTC_USDT"}}
  ```

**決策**: 使用 CCXT `watchFundingRate` 或自行實作

---

## 2. 技術決策

### 2.1 實作方式選擇

| 交易所 | 資金費率 | 持倉監控 | 實作方式 |
|--------|---------|---------|---------|
| Binance | WebSocket | WebSocket | 自行實作 (ws 套件) |
| OKX | WebSocket | WebSocket | CCXT |
| Gate.io | WebSocket | WebSocket | CCXT |
| BingX | REST (維持) | WebSocket | 自行實作 + CCXT |
| MEXC | WebSocket | N/A | CCXT |

**理由**:
- Binance: `@binance/connector` 不支援 Futures WebSocket，需自行實作
- OKX/Gate.io/MEXC: CCXT 提供完整的 `watch*` 方法（免費）
- BingX: 混合策略，CCXT 部分功能有 bug，需自行補強

### 2.2 架構設計

```
┌──────────────────────────────────────────────────────────┐
│                   PrivateWsManager                       │
│  (管理所有用戶的私有 WebSocket 連線)                      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │  Binance    │  │    OKX      │  │  Gate.io    │      │
│  │  WsAdapter  │  │  WsAdapter  │  │  WsAdapter  │      │
│  │  (自行實作)  │  │   (CCXT)    │  │   (CCXT)    │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
│         │                │                │              │
│  ┌─────────────┐                                        │
│  │   BingX     │                                        │
│  │  WsAdapter  │                                        │
│  │ (自行+CCXT) │                                        │
│  └─────────────┘                                        │
│                                                          │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│              TriggerDetector                             │
│  (從 WebSocket 事件偵測停損/停利觸發)                     │
├──────────────────────────────────────────────────────────┤
│  • 監聽 ORDER_TRADE_UPDATE / orders 事件                 │
│  • 比對本地 Position 記錄                                │
│  • 偵測到觸發 → 發送通知 + 執行對沖腿平倉                 │
└──────────────────────────────────────────────────────────┘
```

### 2.3 資金費率 WebSocket 實作

| 交易所 | 頻道/Stream | 更新頻率 | 符號格式轉換 |
|--------|------------|---------|-------------|
| Binance | `@markPrice@1s` | 1 秒 | `BTCUSDT` → `btcusdt` |
| OKX | `funding-rate` | 即時 | `BTCUSDT` → `BTC-USDT-SWAP` |
| Gate.io | `futures.tickers` | 即時 | `BTCUSDT` → `BTC_USDT` |
| MEXC | `sub.funding.rate` | 即時 | `BTCUSDT` → `BTC_USDT` |
| BingX | N/A (REST) | 輪詢 | `BTCUSDT` → `BTC-USDT` |

### 2.4 listenKey 管理策略

**Binance:**
- 建立後 30 分鐘自動續期
- 60 分鐘過期前重新建立
- 錯誤時嘗試重新建立

**BingX:**
- 建立後 50 分鐘重新認證 (繞過 CCXT 1 小時 bug)
- 24 小時過期前重新建立
- 實作 session refresh 邏輯

---

## 3. 考慮的替代方案

### 3.1 全部使用 CCXT

**優點:**
- 統一介面
- 減少維護成本
- 免費使用

**缺點:**
- Binance Futures WebSocket 支援不完整
- BingX `watchPositions` 不支援
- 部分交易所有已知 bug

**結論:** 採用混合策略，CCXT 可用時使用，否則自行實作

### 3.2 全部自行實作

**優點:**
- 完全控制
- 可針對需求優化

**缺點:**
- 開發時間長
- 維護成本高
- 需處理各交易所差異

**結論:** 僅在 CCXT 不足時自行實作

---

## 4. 風險與緩解

| 風險 | 影響 | 緩解措施 |
|------|------|---------|
| WebSocket 連線不穩 | 資料延遲 | 自動重連 + REST 備援 |
| 認證過期 | 私有頻道斷線 | 定時續期 + 過期偵測 |
| 訊息格式變更 | 解析錯誤 | Zod schema 驗證 + 版本監控 |
| 頻率限制 | 被封鎖 | 連線池 + 批量訂閱 |
| CCXT bug | 功能異常 | 監控 + 自行實作備援 |

---

## 5. 實作優先級

### Phase 1: 資金費率 WebSocket (降低延遲)
1. Binance `@markPrice@1s` stream
2. OKX `funding-rate` channel (via CCXT)
3. Gate.io `futures.tickers` (via CCXT)
4. MEXC `sub.funding.rate` (via CCXT)

### Phase 2: 私有頻道基礎架構
1. PrivateWsManager 框架
2. Binance User Data Stream (listenKey)
3. 認證管理和續期邏輯

### Phase 3: 持倉監控整合
1. Binance ACCOUNT_UPDATE / ORDER_TRADE_UPDATE
2. OKX watchPositions / watchOrders (CCXT)
3. Gate.io watchPositions / watchOrders (CCXT)
4. BingX accountUpdate (自行實作)

### Phase 4: 觸發偵測整合
1. TriggerDetector 從 REST 輪詢遷移到 WebSocket
2. 與現有 ConditionalOrderMonitor 並行運作
3. 驗證穩定後逐步停用 REST 輪詢
