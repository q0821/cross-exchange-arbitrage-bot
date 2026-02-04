# Implementation Plan: CLI 狀態儀表板

**Branch**: `071-cli-status-dashboard` | **Date**: 2026-02-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/071-cli-status-dashboard/spec.md`

## Summary

實作一個 CLI 狀態儀表板，在程式啟動後即時顯示系統健康狀態（uptime、記憶體、Proxy/IP）、業務指標（套利機會、監控交易對、交易所連接數）、WebSocket 連線狀態和錯誤統計。每 10 秒自動刷新，支援 TTY 偵測自動降級。

## Technical Context

**Language/Version**: TypeScript 5.8 + Node.js 20.x LTS
**Primary Dependencies**: Pino (logger)、既有 MonitorStatsTracker、getMemoryStats()、DataSourceManager
**Storage**: N/A（僅讀取現有資料，不持久化）
**Testing**: Vitest 4.x
**Target Platform**: Linux server / Docker / macOS CLI
**Project Type**: Single (CLI + Web 混合，本功能專注 CLI 層)
**Performance Goals**: 狀態收集 < 100ms，畫面渲染 < 50ms
**Constraints**: 不影響現有 Web 服務效能，記憶體開銷 < 5MB
**Scale/Scope**: 監控 5 個交易所、100+ 交易對、10+ 資料來源

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 狀態 | 說明 |
|------|------|------|
| 原則一：交易安全優先 | ✅ 通過 | 本功能為唯讀監控，不涉及交易執行 |
| 原則二：完整可觀測性 | ✅ 通過 | 儀表板本身即為可觀測性增強功能 |
| 原則三：防禦性程式設計 | ✅ 通過 | 設計包含優雅降級（TTY 偵測、資料來源異常處理） |
| 原則四：資料完整性 | ✅ 通過 | 不涉及 Schema 變更或資料庫寫入 |
| 原則五：漸進式交付 | ✅ 通過 | User Stories 已分優先級，P1 可獨立驗證 |
| 原則六：系統架構邊界 | ✅ 通過 | 僅在 CLI 層運作，讀取既有元件狀態。CLI 儀表板屬於「日誌記錄」職責的擴展，為運維人員提供系統狀態摘要，非用戶互動 UI |
| 原則七：TDD | ✅ 遵循 | 將為每個模組先寫測試 |

## Project Structure

### Documentation (this feature)

```text
specs/071-cli-status-dashboard/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # N/A (no API contracts for CLI feature)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── cli/
│   └── status-dashboard/
│       ├── index.ts                 # 主入口，整合所有收集器和渲染器
│       ├── StatusDashboard.ts       # 儀表板核心類別
│       ├── collectors/
│       │   ├── SystemStatusCollector.ts    # 系統狀態收集（uptime, memory, proxy, IP）
│       │   ├── BusinessMetricsCollector.ts # 業務指標收集
│       │   └── ConnectionStatusCollector.ts # WebSocket 連線狀態收集
│       ├── renderers/
│       │   ├── TtyRenderer.ts       # TTY 互動式渲染（清屏刷新）
│       │   └── LogRenderer.ts       # 非 TTY 日誌渲染
│       └── types.ts                 # 儀表板相關類型定義
├── lib/
│   └── public-ip.ts                 # 公開 IP 查詢工具（新增）
└── services/
    └── monitor/
        └── MonitorStats.ts          # 既有，將擴展 getter 方法

tests/
├── unit/
│   └── cli/
│       └── status-dashboard/
│           ├── StatusDashboard.test.ts
│           ├── collectors/
│           │   ├── SystemStatusCollector.test.ts
│           │   ├── BusinessMetricsCollector.test.ts
│           │   └── ConnectionStatusCollector.test.ts
│           └── renderers/
│               ├── TtyRenderer.test.ts
│               └── LogRenderer.test.ts
└── integration/
    └── cli/
        └── status-dashboard.integration.test.ts
```

**Structure Decision**: 採用 Option 1 (Single project) 結構，在現有 `src/cli/` 下新增 `status-dashboard/` 目錄。使用 Collector + Renderer 模式分離資料收集與呈現邏輯，便於測試和維護。

## Complexity Tracking

> 無 Constitution 違規需要說明

---

## Phase 0: Research

詳見 [research.md](./research.md)

## Phase 1: Design

詳見 [data-model.md](./data-model.md) 和 [quickstart.md](./quickstart.md)

---

## Constitution Re-Check (Post Phase 1)

| 原則 | 狀態 | 驗證結果 |
|------|------|----------|
| 原則一：交易安全優先 | ✅ 通過 | 資料模型僅定義唯讀介面，無交易操作 |
| 原則二：完整可觀測性 | ✅ 通過 | 設計包含結構化日誌輸出（LogRenderer） |
| 原則三：防禦性程式設計 | ✅ 通過 | Promise.allSettled 處理收集器失敗、TTY 偵測降級 |
| 原則四：資料完整性 | ✅ 通過 | 已明確聲明「無資料庫變更」，無 Migration 需求 |
| 原則五：漸進式交付 | ✅ 通過 | Collector/Renderer 模組可獨立測試和交付 |
| 原則六：系統架構邊界 | ✅ 通過 | CLI 儀表板為運維監控工具，屬於日誌/狀態輸出範疇，非用戶互動 UI |
| 原則七：TDD | ✅ 遵循 | 測試目錄結構已規劃，tasks.md 將包含 [TEST] 標記 |

**Gate 結果**: ✅ 全部通過，可進入 Phase 2 (Task Generation)
