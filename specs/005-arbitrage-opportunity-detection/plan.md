# Implementation Plan: 套利機會自動偵測系統

**Branch**: `005-arbitrage-opportunity-detection` | **Date**: 2025-10-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-arbitrage-opportunity-detection/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

實作套利機會自動偵測系統，根據可配置的閾值（預設 0.05%）自動判斷資金費率差異是否達到套利條件。系統整合到現有的 FundingRateMonitor 服務，使用事件驅動架構即時通知使用者，追蹤機會生命週期，支援多幣別排序，計算年化收益率，並提供歷史記錄查詢。資料持久化到 PostgreSQL，實作防抖動機制避免通知轟炸。

## Technical Context

**Language/Version**: TypeScript 5.3+ with Node.js 20.x LTS
**Primary Dependencies**:
  - Prisma 5.x (ORM for PostgreSQL)
  - Commander.js (CLI 框架)
  - Pino (結構化日誌)
  - Zod (資料驗證)
**Storage**: PostgreSQL 15 + TimescaleDB extension (已配置於 Docker Compose)
**Testing**: Vitest (單元測試與整合測試)
**Target Platform**: Linux/macOS server (Node.js runtime)
**Project Type**: Single (CLI application with background monitoring service)
**Performance Goals**:
  - 偵測延遲 <5 秒（從費率變化到通知）
  - 支援同時監控 10+ 幣別
  - 歷史查詢回應時間 <3 秒（30 天資料範圍）
**Constraints**:
  - 整合到現有 FundingRateMonitor 服務（避免重複監控邏輯）
  - 防抖動機制（30 秒窗口內同幣別只通知一次）
  - 優雅降級（單一交易所 API 失敗不影響整體功能）
**Scale/Scope**:
  - 監控 3-10 個幣別（BTC、ETH、SOL 等）
  - 預期每小時產生 0-20 個機會記錄
  - 歷史資料保留 90 天（約 43,000 筆記錄）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Trading Safety First (NON-NEGOTIABLE)

**Status**: ✅ NOT APPLICABLE (本功能不執行實際交易)

本功能僅偵測和通知套利機會，不涉及任何交易執行。所有交易安全要求將在 User Story 3（執行雙邊對沖交易）時實施。

### II. Complete Observability (NON-NEGOTIABLE)

**Status**: ✅ COMPLIANT

- [x] 使用 Pino 結構化日誌記錄所有關鍵操作
- [x] 機會偵測、狀態變化、通知發送都會記錄日誌
- [x] 錯誤日誌包含完整上下文（幣別、時間戳、錯誤類型）
- [x] 機會生命週期完整可追蹤（從出現到消失）
- [x] 記錄通知次數和防抖動統計

### III. Defensive Programming

**Status**: ✅ COMPLIANT

- [x] 整合現有的重試機制（lib/retry.ts）
- [x] 單一交易所 API 失敗時標記「資料過期」，不影響其他幣別
- [x] 使用 Zod schema 驗證資料庫讀取的資料
- [x] 資料庫寫入失敗時記錄錯誤但仍發送通知（fail-safe）
- [x] 閾值調整時立即套用，避免使用過期配置

### IV. Data Integrity

**Status**: ✅ COMPLIANT

- [x] 使用 Prisma migrations 管理 schema 變更
- [x] ArbitrageOpportunity 表使用 TimescaleDB hypertable
- [x] 機會記錄為 append-only（只新增，不修改歷史記錄）
- [x] 年化收益率計算使用 Decimal 型別（避免浮點數誤差）
- [x] 狀態轉換記錄（ACTIVE → EXPIRED → CLOSED）

### V. Incremental Delivery

**Status**: ✅ COMPLIANT

- [x] 本功能對應 User Story 2（自動偵測套利機會）
- [x] 依賴 User Story 1（即時監控）已完成
- [x] 可獨立測試（不需實際交易即可驗證偵測邏輯）
- [x] User Story 拆分為 P1（偵測+排序）、P2（歷史）、P3（多通道通知）
- [x] MVP 聚焦於 P1 功能

**憲法合規總結**: ✅ 所有適用原則都已遵守，無需豁免

## Project Structure

### Documentation (this feature)

```
specs/005-arbitrage-opportunity-detection/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── OpportunityDetector.interface.ts
│   ├── OpportunityRepository.interface.ts
│   └── NotificationService.interface.ts
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
src/
├── models/                         # 領域模型
│   ├── ArbitrageOpportunity.ts     # 套利機會實體（新增）
│   ├── OpportunityHistory.ts       # 機會歷史記錄（新增）
│   └── FundingRate.ts              # 現有資金費率模型
│
├── services/                       # 業務邏輯服務
│   ├── monitor/
│   │   ├── FundingRateMonitor.ts   # 現有監控服務（整合點）
│   │   └── OpportunityDetector.ts  # 機會偵測服務（新增）
│   └── notification/
│       └── NotificationService.ts  # 通知服務（新增）
│
├── repositories/                   # 資料存取層
│   ├── ArbitrageOpportunityRepository.ts  # 機會儲存庫（新增）
│   └── OpportunityHistoryRepository.ts    # 歷史記錄儲存庫（新增）
│
├── cli/                            # CLI 指令
│   └── commands/
│       └── opportunities/          # 機會相關指令（新增）
│           ├── list.ts             # 列出當前機會
│           ├── history.ts          # 查詢歷史記錄
│           └── config.ts           # 配置閾值
│
└── lib/                            # 共用函式庫
    ├── logger.ts                   # 現有日誌模組
    ├── retry.ts                    # 現有重試機制
    └── debounce.ts                 # 防抖動工具（新增）

tests/
├── unit/                           # 單元測試
│   ├── services/
│   │   ├── OpportunityDetector.test.ts
│   │   └── NotificationService.test.ts
│   └── lib/
│       └── debounce.test.ts
│
├── integration/                    # 整合測試
│   ├── ArbitrageOpportunityRepository.test.ts
│   └── OpportunityHistoryRepository.test.ts
│
└── contract/                       # 合約測試（新增）
    └── OpportunityDetector.contract.test.ts
```

**Structure Decision**: 使用單一專案結構（Option 1），因為這是 CLI 應用程式，不涉及前端或行動裝置介面。新功能整合到現有的 `FundingRateMonitor` 服務中，透過事件驅動架構觸發機會偵測。新增檔案包括：

- **models/**: 2 個新模型（ArbitrageOpportunity, OpportunityHistory）
- **services/**: 2 個新服務（OpportunityDetector, NotificationService）
- **repositories/**: 2 個新儲存庫
- **cli/commands/opportunities/**: 3 個新 CLI 指令
- **lib/**: 1 個防抖動工具
- **tests/**: 對應的單元測試、整合測試和合約測試

## Complexity Tracking

無憲法違規，本區段留空。

---

## Phase 0: Research

**Status**: ✅ COMPLETED

所有研究議題已完成，詳見 [research.md](./research.md)

### 研究成果總結

| 議題 | 決策 | 文件連結 |
|------|------|----------|
| R1: 防抖動機制 | 自訂 Per-Symbol Debounce Manager | [research.md#R1](./research.md#r1-防抖動機制-debounce-mechanism) |
| R2: TimescaleDB Hypertable 設計 | 不使用（ArbitrageOpportunity 保持一般資料表）| [research.md#R2](./research.md#r2-timescaledb-hypertable-設計) |
| R3: 事件驅動通知架構 | Native TypeScript EventEmitter | [research.md#R3](./research.md#r3-事件驅動通知架構) |

---

## Phase 1: Design

**Status**: ✅ COMPLETED

所有設計文件已生成：

### 產出文件

1. **[data-model.md](./data-model.md)**: 資料模型設計
   - 3 個核心實體：ArbitrageOpportunity, OpportunityHistory, NotificationLog
   - 完整的 Prisma Schema 定義
   - 狀態轉換邏輯（ACTIVE → EXPIRED → CLOSED）
   - 索引策略和效能優化

2. **[contracts/](./contracts/)**: 服務介面合約
   - `OpportunityDetector.interface.ts`: 機會偵測器介面
   - `OpportunityRepository.interface.ts`: 資料儲存庫介面
   - `NotificationService.interface.ts`: 通知服務介面
   - `CLI.commands.md`: CLI 指令規格

3. **[quickstart.md](./quickstart.md)**: 快速入門指南
   - 5 個步驟 30 分鐘完成基礎架構
   - 包含完整的測試範例
   - 常見問題解答

---

## Post-Design Constitution Check

*GATE: Must pass before proceeding to Phase 2 (tasks generation)*

### I. Trading Safety First (NON-NEGOTIABLE)

**Status**: ✅ NOT APPLICABLE (保持不變)

設計階段確認：本功能僅偵測和通知，無任何交易執行邏輯。

### II. Complete Observability (NON-NEGOTIABLE)

**Status**: ✅ COMPLIANT (設計後驗證)

- [x] **NotificationLog 模型**已設計，記錄所有通知事件（data-model.md）
- [x] **OpportunityHistory 模型**已設計，記錄完整生命週期（data-model.md）
- [x] **事件架構**使用 Pino logger 記錄所有關鍵操作（research.md）
- [x] **防抖動統計**追蹤 `debounce_skipped_count`（data-model.md, NotificationLog）
- [x] **Repository 介面**包含 `getStatistics()` 方法（contracts/OpportunityRepository.interface.ts）

### III. Defensive Programming

**Status**: ✅ COMPLIANT (設計後驗證)

- [x] **NotificationService** 實作 graceful degradation，使用 `Promise.allSettled`（research.md）
- [x] **OpportunityDetector** 使用 `captureRejections: true` 捕獲 async 錯誤（research.md）
- [x] **Zod Schema 驗證**定義於 `ArbitrageOpportunitySchema`（quickstart.md）
- [x] **防抖動機制**避免通知轟炸（research.md, R1 決策）
- [x] **資料庫操作**使用 try-catch 並記錄錯誤（quickstart.md, Repository 範例）

### IV. Data Integrity

**Status**: ⚠️ UPDATED (研究後修正)

**原先規劃**:
- ~~ArbitrageOpportunity 表使用 TimescaleDB hypertable~~ ❌

**設計後修正**:
- [x] ArbitrageOpportunity **保持一般 PostgreSQL 資料表**（research.md, R2 決策）
  - **理由**: 資料量小（43,000 筆）、有更新操作、外鍵限制
- [x] **只有 NotificationLog** 使用 TimescaleDB hypertable（data-model.md）
  - **理由**: 高頻寫入、純 append-only、自動保留策略
- [x] Prisma Migrations 管理 schema 變更（data-model.md）
- [x] Decimal 型別用於金融計算（data-model.md, ArbitrageOpportunity 模型）
- [x] 狀態轉換邏輯明確定義（data-model.md, 狀態轉換圖）
- [x] 外鍵約束確保資料完整性（data-model.md, Prisma Schema）

### V. Incremental Delivery

**Status**: ✅ COMPLIANT (保持不變)

- [x] Phase 0 (Research) 完成
- [x] Phase 1 (Design) 完成
- [x] 快速入門指南提供 30 分鐘 MVP（quickstart.md）
- [x] 測試案例獨立可執行（quickstart.md, Step 4）

**憲法合規總結（設計後）**: ✅ 所有原則已遵守，R2 決策經研究後修正為最佳實務

---

## Next Steps

Phase 1 planning completed successfully. Ready to proceed to:

1. **Execute `/speckit.tasks`** to generate detailed task breakdown
2. **Begin implementation** following the quickstart guide
3. **Incremental testing** as tasks are completed

### Deliverables Summary

| 階段 | 產出 | 狀態 |
|------|------|------|
| Phase 0 | research.md | ✅ |
| Phase 1 | data-model.md | ✅ |
| Phase 1 | contracts/ (4 files) | ✅ |
| Phase 1 | quickstart.md | ✅ |
| Phase 1 | Agent Context Update | ✅ |
| Phase 1 | Post-Design Constitution Check | ✅ |

**Branch**: `005-arbitrage-opportunity-detection`
**Plan File**: `/Users/hd/WORK/case/cross-exchange-arbitrage-bot/specs/005-arbitrage-opportunity-detection/plan.md`

---

## Generated Artifacts

- **Research**: `/Users/hd/WORK/case/cross-exchange-arbitrage-bot/specs/005-arbitrage-opportunity-detection/research.md`
- **Data Model**: `/Users/hd/WORK/case/cross-exchange-arbitrage-bot/specs/005-arbitrage-opportunity-detection/data-model.md`
- **Contracts**: `/Users/hd/WORK/case/cross-exchange-arbitrage-bot/specs/005-arbitrage-opportunity-detection/contracts/`
  - `OpportunityDetector.interface.ts`
  - `OpportunityRepository.interface.ts`
  - `NotificationService.interface.ts`
  - `CLI.commands.md`
- **Quickstart**: `/Users/hd/WORK/case/cross-exchange-arbitrage-bot/specs/005-arbitrage-opportunity-detection/quickstart.md`

**All gates passed. Ready for `/speckit.tasks`.**

