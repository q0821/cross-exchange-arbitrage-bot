# Implementation Plan: Frontend Data Caching

**Branch**: `063-frontend-data-caching` | **Date**: 2026-01-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/063-frontend-data-caching/spec.md`

## Summary

導入 TanStack Query (React Query) 實現前端資料快取機制，解決頁面切換時的延遲問題。主要改善：

1. 使用快取取代每次頁面切換的重複 API 請求
2. 整合 WebSocket 即時更新與快取機制
3. 實現跨頁面資料共享
4. 交易操作後自動刷新相關資料

目標：頁面切換延遲從 500ms 降至 100ms（改善 80%）

## Technical Context

**Language/Version**: TypeScript 5.8 + Node.js 20.x LTS
**Primary Dependencies**: TanStack Query 5.x (新增), React 19, Next.js 15, Socket.io-client 4.x
**Storage**: N/A (客戶端記憶體快取，無持久化儲存)
**Testing**: Vitest 4.x + React Testing Library
**Target Platform**: Web browser (Chrome, Firefox, Safari, Edge)
**Project Type**: web (Next.js App Router)
**Performance Goals**:
- 已快取頁面切換 < 100ms
- 首次載入 < 500ms
- API 請求減少 60%+
**Constraints**:
- 瀏覽器記憶體使用 < 50MB
- 快取資料不持久化（重新整理後清除）
- 維持現有 WebSocket 即時更新功能
**Scale/Scope**: 單一使用者、5+ 個儀表板頁面、10+ 個 API 端點

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Trading Safety First | ✅ PASS | 此功能不涉及交易執行，僅為 UI 快取層 |
| II. Complete Observability | ✅ PASS | 不影響現有日誌機制，可選擇性加入快取命中/失效日誌 |
| III. Defensive Programming | ✅ PASS | TanStack Query 內建錯誤處理、重試機制 |
| IV. Data Integrity | ✅ PASS | 不涉及 schema.prisma 變更，無需 migration |
| V. Incremental Delivery | ✅ PASS | 可逐頁面遷移，不需一次性重構 |
| VI. System Architecture | ✅ PASS | Web 端仍從 Database/API 讀取，快取僅優化請求頻率 |
| VII. TDD Discipline | ⚠️ REQUIRED | 所有新 hooks 必須先寫測試 |

**Gate Result**: PASS - 可進入 Phase 0 研究

## Project Structure

### Documentation (this feature)

```
specs/063-frontend-data-caching/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (快取策略定義)
├── quickstart.md        # Phase 1 output (整合指南)
├── contracts/           # Phase 1 output (Query hooks 介面)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```
# Frontend caching layer (新增/修改)
app/
├── providers.tsx                    # 修改: 加入 QueryClientProvider
└── (dashboard)/
    ├── assets/
    │   └── page.tsx                 # 修改: 使用 useQuery hooks
    ├── market-monitor/
    │   ├── page.tsx                 # 修改: 使用 useQuery hooks
    │   └── hooks/
    │       ├── useMarketRates.ts    # 重構: 整合 TanStack Query
    │       └── useTradingSettings.ts # 重構: 整合 TanStack Query
    ├── positions/
    │   └── page.tsx                 # 修改: 使用 useQuery hooks
    └── trades/
        └── page.tsx                 # 修改: 使用 useQuery hooks

# New shared hooks (新增)
hooks/
├── queries/
│   ├── useAssetsQuery.ts           # 新增: 資產查詢 hook
│   ├── useAssetHistoryQuery.ts     # 新增: 資產歷史 hook
│   ├── usePositionsQuery.ts        # 新增: 持倉查詢 hook
│   ├── useTradesQuery.ts           # 新增: 交易歷史 hook
│   ├── useMarketRatesQuery.ts      # 新增: 市場費率 hook (含 WebSocket 整合)
│   └── useBalancesQuery.ts         # 新增: 餘額查詢 hook (含 WebSocket 整合)
└── mutations/
    ├── useOpenPositionMutation.ts  # 新增: 開倉 mutation
    └── useClosePositionMutation.ts # 新增: 平倉 mutation

# Core utilities (新增)
lib/
├── query-client.ts                 # 新增: QueryClient 配置
└── query-keys.ts                   # 新增: 集中化 query key 管理

# Tests (新增)
tests/
├── hooks/
│   ├── queries/
│   │   ├── useAssetsQuery.test.ts
│   │   ├── usePositionsQuery.test.ts
│   │   └── useMarketRatesQuery.test.ts
│   └── mutations/
│       └── useOpenPositionMutation.test.ts
└── integration/
    └── caching-behavior.test.ts
```

**Structure Decision**: 採用共享 hooks 目錄 (`hooks/queries/`, `hooks/mutations/`) 集中管理所有 TanStack Query hooks，便於跨頁面重用和維護。現有頁面 hooks 將逐步遷移至此結構。

## Complexity Tracking

*No Constitution violations requiring justification.*

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Query Library | TanStack Query v5 | 優於 SWR：更好的 mutation 支援、DevTools、TypeScript 型別推導 |
| Cache Strategy | stale-while-revalidate | 即時顯示快取 + 背景更新，符合使用者體驗需求 |
| WebSocket Integration | setQueryData on updates | 即時更新直接寫入快取，避免重新 fetch |

## Post-Design Constitution Check

*Re-evaluation after Phase 1 design completion.*

| Principle | Status | Design Validation |
|-----------|--------|-------------------|
| I. Trading Safety First | ✅ PASS | 快取層不影響交易邏輯，mutation 成功後正確 invalidate |
| II. Complete Observability | ✅ PASS | DevTools 提供快取狀態可視化，可追蹤快取命中/失效 |
| III. Defensive Programming | ✅ PASS | TanStack Query 內建 retry、error boundary 整合 |
| IV. Data Integrity | ✅ PASS | 無 schema 變更，客戶端快取不涉及持久化 |
| V. Incremental Delivery | ✅ PASS | 設計支援逐頁面遷移，可獨立測試各 hook |
| VI. System Architecture | ✅ PASS | 快取僅優化 Web → API 請求頻率，架構邊界不變 |
| VII. TDD Discipline | ⚠️ ENFORCED | 每個 query/mutation hook 必須先寫測試 |

**Post-Design Gate Result**: PASS - 可進入 Phase 2 任務生成

## Generated Artifacts

| Artifact | Path | Description |
|----------|------|-------------|
| research.md | `specs/063-frontend-data-caching/research.md` | 技術研究與決策記錄 |
| data-model.md | `specs/063-frontend-data-caching/data-model.md` | 快取資料結構與策略定義 |
| contracts/ | `specs/063-frontend-data-caching/contracts/` | Query hooks TypeScript 介面 |
| quickstart.md | `specs/063-frontend-data-caching/quickstart.md` | 整合指南與範例程式碼 |

## Next Steps

執行 `/speckit.tasks` 生成詳細任務清單。
