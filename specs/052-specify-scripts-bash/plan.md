# Implementation Plan: 交易所 WebSocket 即時數據訂閱

**Branch**: `052-specify-scripts-bash` | **Date**: 2025-12-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/052-specify-scripts-bash/spec.md`

## Summary

實作各交易所的 WebSocket 即時數據訂閱功能，包括：
1. **資金費率即時訂閱** - 5 個交易所 (Binance, OKX, Gate.io, MEXC, BingX)
2. **持倉狀態即時監控** - 4 個交易所 (Binance, OKX, Gate.io, BingX)，MEXC 不支援 API 交易

技術方案採用混合策略：CCXT 可用時使用 CCXT watch* 方法（免費），否則自行實作。

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**: CCXT 4.x (WebSocket watch* methods), ws 8.x, @binance/connector 3.x (REST only)
**Storage**: PostgreSQL 15 + TimescaleDB (現有 Position 模型)
**Testing**: Vitest 2.1.2, vitest-mock-extended
**Target Platform**: Linux server (Docker)
**Project Type**: Web application (Next.js 14 + Backend services)
**Performance Goals**: 資金費率延遲 <1s, 觸發偵測延遲 <1s
**Constraints**: WebSocket 連線數限制, API 頻率限制
**Scale/Scope**: 5 交易所, ~100 個交易對, 多用戶同時監控

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Trading Safety First | ✅ PASS | 觸發偵測後自動平倉符合 Saga pattern |
| II. Complete Observability | ✅ PASS | 所有 WebSocket 事件將使用 Pino 結構化日誌 |
| III. Defensive Programming | ✅ PASS | 自動重連、REST 備援、Zod 驗證 |
| IV. Data Integrity | ✅ PASS | 持倉狀態變更即時同步到資料庫 |
| V. Incremental Delivery | ✅ PASS | 分 4 個 Phase 漸進實作 |
| VI. System Architecture | ✅ PASS | CLI/Web 分離，資料庫為單一資料源 |
| VII. TDD Discipline | ✅ PASS | 每個組件先寫測試再實作 |

## Project Structure

### Documentation (this feature)

```
specs/052-specify-scripts-bash/
├── spec.md              # 功能規格
├── plan.md              # 本檔案
├── research.md          # 技術研究
├── data-model.md        # 資料模型（無新增）
├── quickstart.md        # 快速入門
├── contracts/           # WebSocket 事件規格
│   └── websocket-events.md
└── tasks.md             # 任務清單 (/speckit.tasks 產生)
```

### Source Code (repository root)

```
src/
├── connectors/
│   ├── binance.ts       # 修改: 實作 subscribeWS/unsubscribeWS
│   ├── okx.ts           # 修改: 實作 subscribeWS/unsubscribeWS
│   ├── gateio.ts        # 修改: 實作 subscribeWS/unsubscribeWS
│   ├── mexc.ts          # 修改: 實作 subscribeWS (資金費率)
│   └── bingx.ts         # 修改: 實作 subscribeWS/unsubscribeWS
├── services/
│   ├── websocket/
│   │   ├── BinanceWsClient.ts      # 現有: ticker 訂閱
│   │   ├── BinanceFundingWs.ts     # 新增: 資金費率 WebSocket
│   │   ├── BinanceUserDataWs.ts    # 新增: 私有頻道 (listenKey)
│   │   ├── PrivateWsManager.ts     # 新增: 管理所有用戶私有連線
│   │   ├── PositionWsHandler.ts    # 新增: 處理持倉變更事件
│   │   └── TriggerProgressEmitter.ts # 現有: 觸發事件推送
│   └── monitor/
│       ├── PriceMonitor.ts         # 修改: 整合 WebSocket
│       ├── RatesCache.ts           # 現有: 費率快取
│       ├── ConditionalOrderMonitor.ts # 現有: REST 輪詢 (保留為備援)
│       └── TriggerDetector.ts      # 新增: WebSocket 觸發偵測
└── lib/
    └── websocket.ts                # 現有: WebSocketManager 基類

tests/
├── unit/
│   └── services/
│       ├── BinanceFundingWs.test.ts
│       ├── BinanceUserDataWs.test.ts
│       ├── PrivateWsManager.test.ts
│       └── TriggerDetector.test.ts
└── integration/
    └── websocket/
        ├── binance-funding-ws.test.ts
        ├── okx-funding-ws.test.ts
        └── position-ws.test.ts
```

**Structure Decision**: 延續現有 Web application 結構，新增 WebSocket 相關服務於 `src/services/websocket/`

## Implementation Phases

### Phase 1: 資金費率 WebSocket

| 交易所 | 實作方式 | 頻道 |
|--------|---------|------|
| Binance | 自行實作 | `@markPrice@1s` |
| OKX | CCXT `watchFundingRate` | `funding-rate` |
| Gate.io | CCXT `watchFundingRate` | `futures.tickers` |
| MEXC | CCXT `watchFundingRate` | `sub.funding.rate` |
| BingX | REST (維持) | N/A |

### Phase 2: 私有頻道基礎架構

- PrivateWsManager 框架
- Binance listenKey 管理
- 認證續期邏輯

### Phase 3: 持倉監控 WebSocket

| 交易所 | 實作方式 | 頻道 |
|--------|---------|------|
| Binance | 自行實作 | `ACCOUNT_UPDATE`, `ORDER_TRADE_UPDATE` |
| OKX | CCXT `watchPositions` | `positions`, `orders` |
| Gate.io | CCXT `watchPositions` | `futures.positions` |
| BingX | 自行實作 | `accountUpdate` |

### Phase 4: 觸發偵測整合

- TriggerDetector 從 WebSocket 事件偵測觸發
- 與現有 ConditionalOrderMonitor 並行運作
- 驗證穩定後逐步停用 REST 輪詢

## Key Technical Decisions

| 決策 | 選擇 | 理由 |
|------|------|------|
| Binance WebSocket | 自行實作 | `@binance/connector` 不支援 Futures WS |
| OKX/Gate.io/MEXC | CCXT | 完整支援且免費 |
| BingX 資金費率 | REST 輪詢 | 無 WebSocket 頻道 |
| BingX 持倉 | 自行實作 | CCXT `watchPositions` 不支援 |
| 備援機制 | REST 輪詢 | WebSocket 失敗時自動切換 |

## Complexity Tracking

*無違反 Constitution 的情況*

| 項目 | 說明 |
|------|------|
| 混合實作策略 | CCXT 不足時才自行實作，非過度工程 |
| 多個 WsAdapter | 各交易所 API 差異大，無法完全統一 |
