# Implementation Plan: 交易所資產追蹤和歷史曲線

**Branch**: `031-asset-tracking-history` | **Date**: 2025-12-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/031-asset-tracking-history/spec.md`

## Summary

實作一個資產追蹤系統，讓用戶能查看各交易所（Binance, OKX, MEXC, Gate.io）的總資產（USD）、當前持倉，以及 30 天內的資產歷史曲線。系統每小時自動記錄快照，並提供手動刷新功能。技術上採用既有的 Repository Pattern 和 setInterval 排程模式，前端使用已安裝的 Recharts 繪製曲線圖。

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**: Next.js 14.2.33 (App Router), Prisma 5.22.0, Socket.io 4.8.1, Recharts 2.15.4, CCXT 4.5.11, @binance/connector 3.6.1
**Storage**: PostgreSQL 15 + TimescaleDB extension (existing)
**Testing**: Vitest 2.1.2 (unit), Playwright 1.56.1 (E2E)
**Target Platform**: Web application (Next.js on Node.js server)
**Project Type**: Web application (full-stack Next.js)
**Performance Goals**: 資產總覽 <5s 載入，歷史曲線 <3s 載入，支援 100 用戶並行快照
**Constraints**: 每小時快照頻率，30 天資料保留，遵守交易所 API Rate Limit
**Scale/Scope**: 100+ 用戶，4 交易所，每用戶每小時 1 快照 (~72,000 records/month/100 users)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Trading Safety First | ✅ N/A | 本功能為唯讀查詢，不涉及交易執行 |
| II. Complete Observability | ✅ PASS | 使用 Pino 結構化日誌記錄快照任務執行、API 錯誤 |
| III. Defensive Programming | ✅ PASS | API 呼叫含重試邏輯，部分失敗時繼續處理其他交易所 |
| IV. Data Integrity | ✅ PASS | 使用 Prisma migrations，Decimal 類型存儲金額 |
| V. Incremental Delivery | ✅ PASS | 可獨立交付：US1 資產總覽 → US2 歷史曲線 → US3/4 持倉/刷新 |
| VI. System Architecture Boundaries | ✅ PASS | 遵循 CLI→DB→Web 模式，排程任務寫入 DB，Web 只讀取顯示 |

## Project Structure

### Documentation (this feature)

```
specs/031-asset-tracking-history/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
src/
├── services/
│   └── assets/
│       ├── AssetSnapshotService.ts      # 快照建立與查詢服務
│       ├── AssetSnapshotScheduler.ts    # 排程服務（每小時執行）
│       └── UserConnectorFactory.ts      # 用戶交易所連接器工廠
├── repositories/
│   └── AssetSnapshotRepository.ts       # 資料存取層
├── connectors/
│   └── binance.ts                       # 需補完 getPositions() 實作

app/(dashboard)/assets/
├── page.tsx                             # 資產總覽頁面
└── components/
    ├── AssetSummaryCard.tsx             # 單一交易所餘額卡片
    ├── TotalAssetCard.tsx               # 總資產摘要卡片
    ├── AssetHistoryChart.tsx            # Recharts AreaChart 歷史曲線
    ├── PositionTable.tsx                # 持倉列表表格
    └── TimeRangeSelector.tsx            # 7/14/30 天選擇器

app/api/assets/
├── route.ts                             # GET /api/assets (即時餘額)
├── history/route.ts                     # GET /api/assets/history (歷史曲線)
└── positions/route.ts                   # GET /api/positions (持倉)

tests/
├── unit/
│   ├── services/AssetSnapshotService.test.ts
│   └── repositories/AssetSnapshotRepository.test.ts
└── integration/
    └── asset-snapshot-scheduler.test.ts
```

**Structure Decision**: 採用現有的 Web application 結構，新增 `src/services/assets/` 目錄集中資產相關服務，遵循專案既有的 Repository Pattern 和服務層分離模式。

## Complexity Tracking

*無 Constitution 違規需要 justify*

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| 資料模型 | 單一 AssetSnapshot 表 | 簡化設計，各交易所餘額作為欄位而非正規化 |
| 排程 | 原生 setInterval | 遵循現有 OIRefreshService 模式，無需新增依賴 |
| 前端圖表 | Recharts AreaChart | 已安裝，社群活躍，與 React 18 相容 |

## Post-Design Constitution Check

*Re-check after Phase 1 design completion.*

| Principle | Status | Design Verification |
|-----------|--------|---------------------|
| I. Trading Safety First | ✅ N/A | 本功能不涉及交易執行，僅查詢餘額和持倉 |
| II. Complete Observability | ✅ PASS | AssetSnapshotScheduler 使用 Pino 結構化日誌記錄每次快照執行結果、各交易所狀態、錯誤詳情 |
| III. Defensive Programming | ✅ PASS | Promise.allSettled 確保單一交易所失敗不影響其他；連續失敗計數器；API 重試邏輯 |
| IV. Data Integrity | ✅ PASS | AssetSnapshot 模型使用 Decimal(18,8) 類型；Prisma migration 管理 schema |
| V. Incremental Delivery | ✅ PASS | 5 個 User Stories 可獨立實作測試：US1 餘額 → US2 曲線 → US3 快照 → US4 持倉 → US5 刷新 |
| VI. System Architecture Boundaries | ✅ PASS | AssetSnapshotScheduler 寫入 DB，Web API 僅讀取；API Key 僅在 scheduler 中解密使用 |

## Generated Artifacts

- `research.md` - 技術研究：Binance API、排程模式、Recharts 使用
- `data-model.md` - 資料模型：AssetSnapshot Prisma 模型設計
- `contracts/openapi.yaml` - API 合約：/api/assets, /api/assets/history, /api/assets/positions
- `quickstart.md` - 快速入門：設定、測試、故障排除

## Next Steps

執行 `/speckit.tasks` 產生詳細任務清單 (tasks.md)
