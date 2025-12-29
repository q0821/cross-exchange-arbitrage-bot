# Implementation Plan: 停損停利觸發偵測與自動平倉

**Branch**: `050-sl-tp-trigger-monitor` | **Date**: 2025-12-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/050-sl-tp-trigger-monitor/spec.md`

## Summary

偵測交易所停損/停利條件單的觸發事件，自動平倉對沖倉位的另一邊，發送通知並更新持倉狀態。Phase 1 使用 REST API 輪詢（30 秒間隔），Phase 2 升級為 WebSocket 即時監聽。

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**: Next.js 14 App Router, Prisma 5.x (ORM), CCXT 4.x (多交易所抽象), Socket.io 4.8.1 (WebSocket), Pino (結構化日誌)
**Storage**: PostgreSQL 15 + TimescaleDB（現有 Position 模型擴展）
**Testing**: Vitest + Playwright（現有測試框架）
**Target Platform**: Linux server (Docker)
**Project Type**: Web application (Next.js 全棧)
**Performance Goals**: 30 秒內偵測觸發，10 秒內完成自動平倉
**Constraints**: 99% 觸發偵測成功率，支援 4 個交易所並行查詢
**Scale/Scope**: 單用戶多持倉監控

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Check ✅

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Trading Safety First | ✅ Pass | 觸發後自動平倉保護用戶免受單邊暴露風險 |
| II. Complete Observability | ✅ Pass | 使用 Pino 結構化日誌，記錄觸發事件和處理結果 |
| III. Defensive Programming | ✅ Pass | 重用現有 retry 機制，處理網路異常和 API 錯誤 |
| IV. Data Integrity | ✅ Pass | 使用 Prisma migration，新增 closeReason 欄位 |
| V. Incremental Delivery | ✅ Pass | Phase 1 輪詢，Phase 2 WebSocket，逐步交付 |
| VI. System Architecture | ✅ Pass | 監控服務在 Web 後端，符合 CLI → DB → Web 架構 |
| VII. TDD Discipline | ✅ Pass | 先寫測試，再實作功能 |

### Post-Design Check ✅

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Trading Safety First | ✅ Pass | 平倉失敗時通知用戶手動處理 |
| II. Complete Observability | ✅ Pass | WebSocket 事件推送前端，通知服務發送外部通知 |
| III. Defensive Programming | ✅ Pass | 雙邊觸發識別，訂單歷史確認機制 |

## Project Structure

### Documentation (this feature)

```
specs/050-sl-tp-trigger-monitor/
├── spec.md              # 功能規格
├── plan.md              # 本文件
├── research.md          # 技術研究
├── data-model.md        # 資料模型
├── quickstart.md        # 快速入門
├── contracts/           # API 合約
│   └── websocket.md     # WebSocket 事件規格
└── tasks.md             # 任務清單 (由 /speckit.tasks 生成)
```

### Source Code (repository root)

```
prisma/
└── schema.prisma                    # 新增 CloseReason enum

src/
├── services/
│   ├── monitor/
│   │   ├── ConditionalOrderMonitor.ts    # 核心監控服務
│   │   └── types.ts                       # 監控類型定義
│   ├── trading/
│   │   └── PositionCloser.ts             # 擴展 closeSingleSide()
│   └── notification/
│       └── NotificationService.ts        # 擴展觸發通知
├── lib/
│   └── trigger-detector.ts               # 觸發偵測邏輯
└── scripts/
    └── trading-validation/
        └── ExchangeQueryService.ts       # 重用條件單查詢

app/
└── api/
    └── monitor/
        ├── status/route.ts               # 監控狀態 API
        └── init.ts                       # 監控服務初始化

tests/
├── unit/
│   └── services/
│       └── ConditionalOrderMonitor.test.ts
└── integration/
    └── trigger-detection.test.ts
```

**Structure Decision**: 採用現有 Web 應用結構，新增 `src/services/monitor/ConditionalOrderMonitor.ts` 作為核心監控服務，擴展現有 PositionCloser 和 NotificationService。

## Implementation Phases

### Phase 1: 資料模型與基礎設施 (P1)

- 新增 CloseReason enum 到 Prisma schema
- 執行 migration
- 擴展 PositionCloser 支援 closeSingleSide()

### Phase 2: 觸發偵測服務 (P1)

- 建立 ConditionalOrderMonitor 服務
- 實作定時輪詢邏輯（30 秒間隔）
- 重用 ExchangeQueryService 查詢條件單
- 實作訂單歷史查詢確認觸發狀態

### Phase 3: 自動平倉處理 (P1)

- 偵測到觸發後自動平倉另一邊
- 取消剩餘條件單
- 更新持倉狀態和平倉原因

### Phase 4: 通知整合 (P2)

- 擴展 NotificationService 支援觸發通知
- WebSocket 事件推送前端

### Phase 5: 應用程式整合 (P2)

- 在 Web 伺服器啟動時初始化監控
- 優雅關閉處理

## Complexity Tracking

*無需複雜度例外 - 本功能符合所有憲法原則*

## Key Dependencies

| 依賴項 | 用途 | 現有/新增 |
|--------|------|----------|
| ExchangeQueryService | 條件單狀態查詢 | 現有（可重用） |
| PositionCloser | 平倉執行 | 現有（需擴展） |
| NotificationService | 通知發送 | 現有（需擴展） |
| PositionProgressEmitter | WebSocket 事件 | 現有（可重用） |
| FundingRateMonitor | 監控服務參考架構 | 現有（參考） |

## Risks & Mitigations

| 風險 | 緩解措施 |
|------|---------|
| API Rate Limit | 批次查詢同一交易所，使用 retry 機制 |
| 網路延遲 | 30 秒間隔可接受，Phase 2 升級 WebSocket |
| 服務重啟遺失狀態 | 重啟後重新檢查所有 ACTIVE 持倉 |
| 雙邊同時觸發 | 查詢雙邊訂單歷史，正確識別 BOTH_TRIGGERED |
