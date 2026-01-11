# Backend Issues Log

Last Updated: 2026-01-09T14:54:52Z
Monitoring Duration: Continuous
Total Log Entries: Continuous monitoring active

## Critical Issues 🔴

- [ ] **Port 3000 已被佔用導致服務無法啟動** - [Priority: Critical]
  - **Discovered**: 2026-01-09 14:54:52
  - **Description**: 服務嘗試監聽 port 3000 但發生 EADDRINUSE 錯誤，導致整個服務啟動失敗
  - **Log Fragment**:
    ```
    {"level":"fatal","time":"2026-01-09T14:54:52.347Z","pid":85189,"hostname":"MacBookPro.home","message":"listen EADDRINUSE: address already in use :::3000","stack":"Error: listen EADDRINUSE: address already in use :::3000\n    at Server.setupListenHandle [as _listen2] (node:net:1940:16)\n    at listenInCluster (node:net:1997:12)\n    at Server.listen (node:net:2102:7)\n    at file:///Users/hd/WORK/case/cross-exchange-arbitrage-bot/server.ts:1:1200","msg":"Uncaught Exception"}
    Error: listen EADDRINUSE: address already in use :::3000
    ```
  - **Suggested Fix**:
    1. 檢查是否有其他 Next.js 或 Node.js 服務正在使用 port 3000: `lsof -i :3000`
    2. 終止佔用的進程: `kill -9 <PID>` 或變更服務 port（在 .env 設定 `PORT=3001`）
    3. 檢查是否有殭屍進程佔用端口
  - **Affected Component**: server.ts - HTTP Server 初始化
  - **Impact**: 阻擋服務啟動，所有功能無法使用

- [ ] **Node.js Heap Out of Memory** - [Priority: Critical]
  - **Discovered**: 2026-01-09
  - **Description**: 開發伺服器運行一段時間後因記憶體不足而崩潰，exit code 137 (SIGKILL by OOM killer)
  - **Log Fragment**:
    ```
    FATAL ERROR: Ineffective mark-compacts near heap limit
    Allocation failed - JavaScript heap out of memory
    ```
  - **Root Cause Analysis**:
    1. 大量 WebSocket 訂閱（100+ 交易對 x 5 交易所）
    2. 多交易所並行 REST API 請求
    3. 可能的記憶體洩漏（WebSocket 訂閱/取消訂閱）
  - **Suggested Fix**:
    1. **短期**: 增加 Node.js heap size
       ```bash
       NODE_OPTIONS="--max-old-space-size=4096" pnpm dev
       ```
    2. **長期**:
       - 優化 WebSocket 連接池管理
       - 檢查 WebSocket 訂閱是否正確釋放
       - 減少同時監控的交易對數量
       - 使用 `--inspect` 進行記憶體分析
  - **Affected Component**: PriceMonitor, WebSocket clients, DataSourceManager

## High Priority Issues 🟠

- [ ] **Binance API 回傳 404 錯誤** - [Priority: High]
  - **Discovered**: 2026-01-09 14:54:51
  - **Description**: 條件單監控服務呼叫 Binance futures API `/fapi/v1/positionRisk` 時收到 404 Not Found，導致無法查詢持倉條件單狀態
  - **Log Fragment**:
    ```
    {"level":"error","time":"2026-01-09T14:54:51.954Z","pid":85189,"hostname":"MacBookPro.home","positionId":"cmk6ahyty0001gp5j5j09m3ik","exchange":"binance","error":"binance GET https://fapi.binance.com/fapi/v1/positionRisk?timestamp=1767970491212&recvWindow=10000&signature=17432994c98af22879a0f2687761e8c486a86ef9a47d8fd51973b128b17bedd1 404 Not Found <!DOCTYPE html>..."}
    ```
  - **Suggested Fix**:
    1. 檢查 Binance API Key 權限是否包含合約交易 (Futures Trading)
    2. 確認 API endpoint 是否正確（可能需要使用 `/fapi/v2/positionRisk`）
    3. 驗證 API Key 的 IP 白名單設定（雖然 404 通常不是 IP 問題）
    4. 檢查 Binance testnet vs mainnet 配置
    5. 檢查該 API Key 是否啟用了 Futures 權限
  - **Affected Component**: ConditionalOrderMonitor - Binance 持倉查詢
  - **Impact**: 無法監控 Binance 持倉的停損停利觸發狀態

- [ ] **OKX API IP 白名單驗證失敗** - [Priority: High]
  - **Discovered**: 2026-01-09 14:54:52
  - **Description**: OKX API 拒絕來自 IP `36.228.12.229` 的請求，因為該 IP 不在 API Key 的白名單中
  - **Log Fragment**:
    ```
    {"level":"error","time":"2026-01-09T14:54:52.095Z","pid":85189,"hostname":"MacBookPro.home","positionId":"cmk6ahyty0001gp5j5j09m3ik","exchange":"okx","error":"okx {\"msg\":\"Your IP 36.228.12.229 is not included in your API key's 42b72d4c-fcf4-4abf-9c89-b0f8c7547e07 IP whitelist.\",\"code\":\"50110\"}","msg":"[條件單監控] 檢查空方條件單失敗"}
    ```
  - **Suggested Fix**:
    1. 前往 OKX API 管理頁面: https://www.okx.com/account/my-api
    2. 將當前 IP `36.228.12.229` 加入 API Key `42b72d4c-fcf4-4abf-9c89-b0f8c7547e07` 的白名單
    3. 如果 IP 經常變動，考慮使用固定 IP 或調整白名單策略
  - **Affected Component**: ConditionalOrderMonitor - OKX 持倉查詢
  - **Impact**: 無法監控 OKX 持倉的停損停利觸發狀態

- [ ] **BingX API IP 白名單驗證失敗** - [Priority: High]
  - **Discovered**: 2026-01-09 14:54:53
  - **Description**: BingX API 拒絕來自 IP `36.228.12.229` 的請求，錯誤碼 100419
  - **Log Fragment**:
    ```
    {"level":"error","time":"2026-01-09T14:54:53.028Z","pid":85189,"hostname":"MacBookPro.home","positionId":"cmk6bgk0x0005gp5ji8ig64gl","exchange":"bingx","error":"bingx {\"code\":100419,\"msg\":\"your current request IP is 36.228.12.229 does not match IP whitelist , please go to https://bingx.com/en/account/api/ to verify the ip you have set\",\"timestamp\":1767970493002}","msg":"[條件單監控] 檢查多方條件單失敗"}
    ```
  - **Suggested Fix**:
    1. 前往 BingX API 管理頁面: https://bingx.com/en/account/api/
    2. 將當前 IP `36.228.12.229` 加入 API Key 的白名單
    3. 驗證設定後重新啟動條件單監控服務
  - **Affected Component**: ConditionalOrderMonitor - BingX 持倉查詢
  - **Impact**: 無法監控 BingX 持倉的停損停利觸發狀態

- [ ] **BingX WebSocket 連線不穩定** - [Priority: High]
  - **Discovered**: 2026-01-02T02:29:08Z
  - **Description**: BingX WebSocket 連線自動斷開，但系統有自動重連機制且成功切換到 REST API fallback。重連後部分交易對訂閱失敗。
  - **Log Fragment**:
    ```json
    {"level":"info","time":"2026-01-02T02:29:08.095Z","msg":"BingX WebSocket disconnected"}
    {"level":"info","time":"2026-01-02T02:29:08.095Z","msg":"Data source mode switched","fromMode":"websocket","toMode":"rest"}
    {"level":"info","time":"2026-01-02T02:29:09.456Z","msg":"BingX WebSocket connected"}
    {"level":"warn","time":"2026-01-02T02:29:09.625Z","id":"sub-229","code":80015,"msg":"symbol:TRUMP-USDT is not supported in websocket"}
    ```
  - **Suggested Fix**:
    1. 監控 BingX WebSocket 斷線頻率，確認是否為系統性問題
    2. 檢查 BingX API 文件，確認哪些交易對不支援 WebSocket 訂閱
    3. 在初始化時過濾不支援的交易對，避免訂閱失敗警告
    4. 考慮對 BingX 調整重連策略（如增加重連延遲）
  - **Affected Component**: BingxFundingWs, DataSourceManager, PriceMonitor

- [ ] **OKX WebSocket 數據停滯** - [Priority: High]
  - **Discovered**: 2026-01-02T02:28:52Z
  - **Description**: OKX WebSocket 最後收到資料的時間為 02:28:20，之後超過 30 秒沒有新資料，觸發數據過時警告。
  - **Log Fragment**:
    ```json
    {"level":"warn","time":"2026-01-02T02:28:52.590Z","staleCount":1,"states":[{"exchange":"okx","dataType":"fundingRate","mode":"websocket","lastDataReceivedAt":"2026-01-02T02:28:20.971Z"}],"msg":"Stale data sources detected"}
    ```
  - **Suggested Fix**:
    1. 檢查 OKX WebSocket 是否正常接收 ping/pong 心跳
    2. 確認 OKX 訂閱是否成功（可能靜默失敗）
    3. 實作 OKX 數據過時時的自動重新訂閱機制
    4. 考慮降低 stale 偵測門檻或調整為 REST fallback
  - **Affected Component**: OkxFundingWs, DataSourceManager, HealthChecker

- [ ] **多個用戶的 API Key 無效或過期** - [Priority: High]
  - **Discovered**: 2026-01-02T02:28:53Z
  - **Description**: 至少 4 個用戶的 OKX API Key 返回 401 錯誤（Invalid OK-ACCESS-KEY），導致資產快照失敗。
  - **Log Fragment**:
    ```json
    {"level":"warn","time":"2026-01-02T02:28:53.840Z","errorName":"AuthenticationError","errorMessage":"okx {\"msg\":\"Invalid OK-ACCESS-KEY\",\"code\":\"50111\"}","userId":"cmhm2y7di0001nerb2wjtkbz4","exchange":"okx","msg":"Failed to get balance - API key invalid or expired"}
    ```
  - **Suggested Fix**:
    1. 實作 API Key 健康檢查機制，定期驗證 Key 有效性
    2. 當檢測到無效 Key 時，通知用戶更新
    3. 在 UI 中顯示 API Key 狀態（有效/無效/過期）
    4. 考慮實作 API Key 自動測試功能
  - **Affected Component**: UserConnectorFactory, AssetSnapshotScheduler, API Key Management

- [ ] **Binance API 權限不足** - [Priority: High]
  - **Discovered**: 2026-01-02T02:28:53Z
  - **Description**: 至少 1 個用戶的 Binance Futures API Key 返回 -2015 錯誤（Invalid API-key, IP, or permissions），系統成功降級到 Portfolio Margin API。
  - **Log Fragment**:
    ```json
    {"level":"warn","time":"2026-01-02T02:28:53.217Z","error":"Binance API error: 401 - {\"code\":-2015,\"msg\":\"Invalid API-key, IP, or permissions for action\"}","apiKey":"snFanqqe...","msg":"Binance Futures API FAILED - falling back to Portfolio Margin API"}
    ```
  - **Suggested Fix**:
    1. 在用戶設定 API Key 時提供權限檢查清單
    2. 文件化所需的 Binance API 權限設定
    3. 實作 API Key 測試功能，顯示權限狀態
    4. 考慮在 UI 中提示用戶啟用必要權限
  - **Affected Component**: BinanceUserConnector, API Key Setup Flow

## Medium Priority Issues 🟡

- [ ] **大量交易對在某些交易所不存在** - [Priority: Medium]
  - **Discovered**: 2026-01-02T02:31:23Z
  - **Description**: REST API 輪詢時發現至少 37 個交易對在特定交易所不存在，每 30 秒產生大量警告日誌。這表示交易對配置與交易所實際支援的市場不匹配。
  - **Log Fragment**:
    ```json
    {"level":"warn","time":"2026-01-02T02:31:23.109Z","exchange":"okx","symbol":"PAXGUSDT","error":"okx does not have market symbol PAXG/USDT:USDT","msg":"Failed to fetch rate for exchange"}
    {"level":"warn","time":"2026-01-02T02:31:23.109Z","exchange":"mexc","symbol":"PUMPUSDT","error":"mexc does not have market symbol PUMP/USDT:USDT","msg":"Failed to fetch rate for exchange"}
    ```
  - **Suggested Fix**:
    1. **立即修正**: 實作交易所市場支援矩陣，在啟動時過濾不支援的交易對
    2. 建立腳本自動檢查各交易所支援的交易對
    3. 在配置檔案中為每個交易所定義支援的交易對白名單
    4. 降低此類警告的日誌等級或完全過濾（因為是配置問題非運行時錯誤）
  - **Affected Component**: RestPoller, FundingRateMonitor, Symbol Configuration
  - **影響交易對列表** (部分):
    - OKX 不支援: PAXG, XMR, ARC, ALCH, FET, KITE, TAKE, FF, BTCDOM, CAKE, ZEREBRO, FOLKS, UB, ICNT, FORM, XPIN, RIVER, VET
    - MEXC 不支援: PUMP, FIL, TRUMP, MON, TON, ARC, BTCDOM
    - BingX 不支援: MON, TON, ARC, ALCH, BTCDOM, LIGHT, ZEREBRO, OM, MET
    - Gate.io 不支援: BTCDOM, ZEN

- [ ] **MEXC WebSocket 不支援** - [Priority: Medium]
  - **Discovered**: 2026-01-02T02:28:06Z
  - **Description**: MEXC 交易所的 WebSocket 功能在 CCXT 中不支援，系統自動降級使用 REST API 輪詢。這可能導致資料更新延遲和 API 請求數增加。
  - **Log Fragment**:
    ```json
    {"level":"info","time":"2026-01-02T02:28:06.835Z","pid":20668,"hostname":"HDs-MBP-14.local","context":"exchange","type":"fundingRate","msg":"MEXC WebSocket not supported by CCXT, will use REST API polling instead"}
    ```
  - **Suggested Fix**:
    1. 評估是否需要為 MEXC 實作原生 WebSocket 客戶端（類似 Feature 054）
    2. 監控 MEXC REST API 輪詢的效能影響
    3. 考慮調整 MEXC 的輪詢間隔以平衡即時性和 API 限制
  - **Affected Component**: PriceMonitor, DataSourceManager, MEXC Connector

## Low Priority Issues 🟢

- [ ] **Cache 啟動時為空** - [Priority: Low]
  - **Discovered**: 2026-01-02T02:28:05Z
  - **Description**: 市場數據廣播服務啟動時，快取為空。這是正常的冷啟動行為，但可能影響首次連接的用戶體驗。
  - **Log Fragment**:
    ```json
    {"level":"warn","time":"2026-01-02T02:28:05.024Z","pid":20668,"hostname":"HDs-MBP-14.local","cacheSize":0,"lastUpdate":"never","uptime":0,"msg":"No rates to broadcast - cache may be stale or empty"}
    ```
  - **Suggested Fix**:
    1. 考慮在服務啟動時預先載入市場數據
    2. 或者在首次廣播前等待第一次資料更新完成
    3. 改進前端處理空快取的邏輯，顯示載入狀態
  - **Affected Component**: Socket.io broadcast service, RatesCache

- [ ] **BingX 部分交易對不支援 WebSocket** - [Priority: Low]
  - **Discovered**: 2026-01-02T02:29:09Z
  - **Description**: 10 個交易對在 BingX WebSocket 訂閱時返回不支援錯誤（code: 80015），包括 TRUMP、MON、TON、ARC、ALCH、BTCDOM、LIGHT、ZEREBRO、OM、MET。
  - **Log Fragment**:
    ```json
    {"level":"warn","time":"2026-01-02T02:29:09.625Z","service":"BingxFundingWs","id":"sub-229","code":80015,"msg":"symbol:TRUMP-USDT is not supported in websocket"}
    {"level":"warn","time":"2026-01-02T02:29:09.625Z","service":"BingxFundingWs","id":"sub-233","code":80015,"msg":"symbol:MON-USDT is not supported in websocket"}
    ```
  - **Suggested Fix**:
    1. 建立 BingX 不支援 WebSocket 的交易對白名單
    2. 在訂閱前過濾這些交易對
    3. 對這些交易對自動使用 REST API 輪詢
    4. 記錄到配置檔案以便維護
  - **Affected Component**: BingxFundingWs

- [ ] **負收益套利機會產生過多警告** - [Priority: Low]
  - **Discovered**: 2026-01-02T02:28:51Z
  - **Description**: 系統正確計算出許多負收益的套利組合並發出警告，這些是預期的日誌，但數量過多可能影響日誌可讀性。
  - **Log Fragment**:
    ```json
    {"level":"warn","time":"2026-01-02T02:28:51.910Z","symbol":"ZROUSDT","longExchange":"okx","shortExchange":"binance","netProfit":"-0.0020935890442768","msg":"Negative net profit detected - arbitrage opportunity not profitable"}
    ```
  - **Suggested Fix**:
    1. 考慮降低警告等級為 debug
    2. 或者使用日誌採樣（如每 100 次只記錄 1 次）
    3. 或者只記錄接近盈利門檻的負收益情況
  - **Affected Component**: FundingRateMonitor, Arbitrage Assessment

- [ ] **條件單監控日誌輸出頻繁** - [Priority: Low]
  - **Discovered**: 2026-01-02T02:28:03Z
  - **Description**: 條件單監控服務每 30 秒執行一次檢查並記錄日誌，當持倉數量多時可能產生大量日誌。
  - **Log Fragment**:
    ```json
    {"level":"info","time":"2026-01-02T02:29:11.164Z","count":1,"parallelMode":false,"msg":"[條件單監控] 開始檢查持倉的條件單狀態"}
    {"level":"info","time":"2026-01-02T02:29:11.164Z","positionId":"cmjw6j4vi001w7fzu50k8nmj2","symbol":"FOLKSUSDT","msg":"[條件單監控] 檢查持倉"}
    ```
  - **Suggested Fix**:
    1. 只在發現異常或觸發時記錄
    2. 或者降低正常檢查的日誌等級為 debug
    3. 實作摘要日誌（如每 10 次檢查記錄一次統計）
  - **Affected Component**: ConditionalOrderMonitor

## Resolved Issues ✅

- [x] **Port 3000 被舊進程佔用** - Resolved on 2026-01-09 15:05
  - **Resolution**: 終止兩個殭屍 tsx 進程（PID 63865 和 85183），服務成功啟動在 port 3000
  - **Action Taken**: `kill -9 63865 85183 && pnpm dev`
  - **Current Status**: 服務正常運行在 http://localhost:3000

---

## 優先修復建議

### 立即處理（本週內）
1. **修正交易對配置不匹配問題**
   - 影響: 每 30 秒產生 37+ 條警告，佔總日誌量的 63%
   - 行動: 實作交易所支援矩陣過濾機制
   - 檔案: `/Users/hd/WORK/case/cross-exchange-arbitrage-bot/src/services/monitor/FundingRateMonitor.ts`

2. **改進 API Key 管理和驗證**
   - 影響: 4 個用戶無法獲取資產快照
   - 行動: 實作 API Key 健康檢查和狀態顯示
   - 檔案: `/Users/hd/WORK/case/cross-exchange-arbitrage-bot/src/services/assets/UserConnectorFactory.ts`

### 短期改善（兩週內）
3. **優化 OKX WebSocket 穩定性**
   - 影響: 間歇性數據停滯
   - 行動: 實作自動重新訂閱機制
   - 檔案: `/Users/hd/WORK/case/cross-exchange-arbitrage-bot/src/services/websocket/OkxFundingWs.ts`

4. **改善 BingX WebSocket 重連策略**
   - 影響: 偶爾斷線並重連
   - 行動: 過濾不支援的交易對，調整重連延遲
   - 檔案: `/Users/hd/WORK/case/cross-exchange-arbitrage-bot/src/services/websocket/BingxFundingWs.ts`

### 中期優化（一個月內）
5. **日誌等級優化**
   - 降低負收益套利警告等級
   - 減少條件單監控日誌頻率
   - 實作日誌採樣機制

6. **冷啟動體驗改善**
   - 預載入市場數據
   - 延遲廣播直到有數據

### 建議腳本
```bash
# 生成交易所支援矩陣
pnpm tsx src/scripts/generate-exchange-matrix.ts

# 驗證 API Key
pnpm tsx src/scripts/validate-api-keys.ts

# 清理無效配置
pnpm tsx src/scripts/cleanup-invalid-symbols.ts
```

---

## 監控摘要

### 服務狀態
- **狀態**: 運行中 ✅
- **PID**: 88805
- **啟動時間**: 2026-01-09T15:05:08Z
- **環境**: development
- **埠**: 3000
- **URL**: http://localhost:3000

### 已初始化服務
- ✅ RatesCache
- ✅ NotificationService
- ✅ SimulatedTrackingService
- ✅ ConditionalOrderMonitor (30s 間隔)
- ✅ Socket.io server
- ✅ PriceMonitor (5 個交易所)
- ✅ FundingRateMonitor (101 個交易對)

### WebSocket 連線狀態
- ✅ Binance Funding WebSocket: 已連線 (wss://fstream.binance.com/stream)
- ✅ OKX Funding WebSocket: 已連線 (wss://ws.okx.com:8443/ws/v5/public)
- ✅ Gate.io Funding WebSocket: 已連線 (wss://fx-ws.gateio.ws/v4/ws/usdt)
- ✅ BingX Funding WebSocket: 已連線 (wss://open-api-swap.bingx.com/swap-market)
- ⚠️ MEXC: 使用 REST API 輪詢 (WebSocket 不支援)

### REST API 輪詢
- Binance: 30s 間隔
- OKX: 30s 間隔
- MEXC: 30s 間隔
- Gate.io: 30s 間隔
- BingX: 30s 間隔

### 健康檢查
- 檢查間隔: 30s
- 逾時: 60s
- 所有交易所健康檢查已啟動 ✅

### 當前持倉
- 3 個活躍持倉 (PIPPINUSDT x2, RIVERUSDT x1)
- 條件單狀態檢查每 30 秒執行一次
- 檢測到多個交易所 API 白名單問題（見 High Priority Issues）

### 觀察到的日誌模式
- ✅ 正常的初始化序列
- ✅ WebSocket 連線穩定（除 BingX 偶爾斷線）
- ✅ REST API 輪詢正常運行
- ⚠️ MEXC 大量 WebSocket 降級訊息（預期行為）
- ⚠️ 冷啟動時快取為空（預期行為）
- ⚠️ BingX WebSocket 自動斷線並重連（1 次觀察到）
- ⚠️ OKX WebSocket 數據間歇性停滯（持續觀察）
- ❌ 大量交易對與交易所不匹配警告（每 30 秒 37+ 條）
- ⚠️ 負收益套利機會警告頻繁（預期行為但日誌過多）

### 效能指標
- 服務啟動時間: ~3 秒
- WebSocket 連線建立: 500-1000ms
- 首次資料更新: 啟動後 1-2 秒內完成
- 資產快照作業: 6 個用戶 10.6 秒（正常）
- 市場數據廣播: 每 2 秒（正常）
- REST API 輪詢: 每 30 秒（正常）

### 資料品質問題
- 101 個監控交易對中，至少 37 個在某些交易所不存在
- 這導致每 30 秒產生 37+ 條警告日誌
- 影響日誌可讀性和潛在的效能浪費

### 系統穩定性評估
- **整體穩定性**: 🟢 良好
- **WebSocket 連線**: 🟡 大部分穩定，BingX 和 OKX 需要關注
- **API Key 管理**: 🟠 多個用戶 Key 無效，需要改進
- **配置品質**: 🔴 交易對配置不匹配嚴重，需要立即修正
- **錯誤處理**: 🟢 良好（有 fallback 機制）
- **日誌品質**: 🟡 資訊完整但過於冗長
