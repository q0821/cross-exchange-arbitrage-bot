# Implementation Plan: Web 市場監控整合價差顯示與淨收益計算

**Branch**: `011-price-spread-net-return` | **Date**: 2025-11-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-price-spread-net-return/spec.md`

## Summary

為 Web 市場監控頁面新增價差和淨收益欄位，透過動態計算「費率差異 - |價差| - 手續費」來評估套利機會的真實獲利能力。支援按價差和淨收益排序，使用顏色指示器標示有利（綠色）、持平（黃色）或不利（紅色）的機會。解決「賺資金費率、賠價差」的核心問題，讓交易員能快速識別真正有獲利潛力的套利機會。

**技術方法**：
- 後端：擴展 WebSocket handler 推送價差（`priceDiffPercent`）和淨收益（`netReturn`）資料
- 前端：在 RatesTable 新增兩個欄位，使用 Tailwind CSS 顏色類別實作指示器，擴展穩定排序邏輯（基於 Feature 009）
- 淨收益計算：在 WebSocket handler 執行簡單減法：`spreadPercent - Math.abs(priceDiffPercent) - TRADING_FEE_PERCENT`
- 不需要資料庫變更，所有資料已存在於記憶體快取中

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**: Next.js 14.2.33 (App Router), React 18, Tailwind CSS, Socket.io 4.8.1
**Storage**: N/A（純前端擴展，使用現有記憶體快取 RatesCache）
**Testing**: Vitest (單元測試), Playwright (E2E 測試)
**Target Platform**: Web (現代瀏覽器，支援 ES2020+)
**Project Type**: Web application（前端 + 後端，但此功能主要為前端擴展）
**Performance Goals**: 排序操作 < 1 秒（100 個交易對），WebSocket 推送延遲 < 100ms
**Constraints**:
- 表格寬度有限（最多可容納 10-12 個欄位）
- 必須保持穩定排序（Feature 009 要求）
- 顏色指示器必須符合 Web 無障礙標準（WCAG AA）
- 淨收益計算必須在 WebSocket 推送路徑中完成（< 10ms）
**Scale/Scope**:
- 監控 30-100 個交易對
- 支援 10+ 並發用戶查看市場監控頁面
- 每 5 秒推送一次 WebSocket 更新

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ Principle I: Trading Safety First

**Status**: NOT APPLICABLE

**Rationale**: 此功能僅為資料顯示和計算，不涉及任何交易執行或資金管理。淨收益計算在後端執行，但僅用於顯示目的，不觸發任何自動交易邏輯。

**Compliance**:
- ❌ No trade execution - N/A
- ❌ No position management - N/A
- ❌ No balance operations - N/A
- ✅ 顯示數值有助於手動決策，提升交易安全性

---

### ✅ Principle II: Complete Observability

**Status**: PASS

**Compliance**:
- ✅ WebSocket handler 已有 Pino 結構化日誌（MarketRatesHandler.ts）
- ✅ 將添加淨收益計算日誌（記錄計算輸入和輸出）
- ✅ 前端錯誤（價差或淨收益顯示異常）將通過 console.error 記錄
- ✅ 無需新增 API 端點或關鍵操作日誌

**Observability Points**:
- 後端：記錄淨收益計算（symbol、spreadPercent、priceDiffPercent、netReturn）
- 前端：記錄排序操作（sortBy、sortDirection、itemCount）
- WebSocket：記錄推送的價差和淨收益資料大小

---

### ✅ Principle III: Defensive Programming

**Status**: PASS

**Compliance**:
- ✅ 處理價差資料缺失（顯示 "N/A"）
- ✅ 處理淨收益計算異常（使用可選鏈和空值合併）
- ✅ 排序時處理 undefined 和 null 值（排至列表末尾）
- ✅ WebSocket 連線中斷時保持最後有效資料（現有機制）
- ✅ 顏色指示器使用明確閾值，避免邊界值問題

**Error Handling**:
- 價差計算失敗 → 顯示 "N/A"，不影響其他欄位
- 淨收益計算失敗 → 顯示 "N/A"，不影響其他欄位
- 排序時遇到無效數值 → 使用 0 作為預設值，保持穩定排序
- WebSocket 推送失敗 → 保留最後有效資料，等待下次更新

---

### ✅ Principle IV: Data Integrity

**Status**: PASS

**Compliance**:
- ✅ 無資料庫變更（不需要 Prisma migrations）
- ✅ 淨收益計算使用數值類型（JavaScript Number，精度足夠處理百分比）
- ✅ 價差和淨收益資料來自可靠來源（RatesCache，已驗證）
- ✅ 不修改原始資料（價差和淨收益為計算欄位，不寫回快取）

**Data Flow**:
1. RatesCache 已儲存 `priceDiffPercent`（由 RateDifferenceCalculator 計算）
2. WebSocket handler 讀取價差，計算淨收益，推送到前端
3. 前端接收資料，顯示並支援排序
4. 無資料回寫或狀態修改

---

### ✅ Principle V: Incremental Delivery

**Status**: PASS

**Compliance**:
- ✅ 3 個獨立 User Stories（US1: 價差顯示、US2: 淨收益顯示、US3: 排序功能）
- ✅ 每個 User Story 可獨立測試和交付
- ✅ MVP 為 US1+US2（P1），US3 為增強功能（P2）
- ✅ 無交易功能，僅為資料顯示（符合監控 → 交易的優先順序）

**Delivery Sequence**:
1. **Phase 1** (P1): US1 - 顯示價差欄位
2. **Phase 2** (P1): US2 - 顯示淨收益欄位 + 顏色指示器
3. **Phase 3** (P2): US3 - 價差和淨收益排序功能

---

### ✅ Principle VI: System Architecture Boundaries

**Status**: PASS

**Compliance**:
- ✅ **CLI 不受影響**：此功能僅修改 Web 介面
- ✅ **資料來源正確**：Web 從 RatesCache（記憶體快取）讀取，不直接呼叫交易所 API
- ✅ **計算位置正確**：淨收益計算在 WebSocket handler（Web 後端），不在前端
- ✅ **單一真相來源**：價差由 CLI（RateDifferenceCalculator）計算並快取，Web 僅讀取

**Architecture Compliance**:
```
CLI Monitor → RatesCache (Memory) → WebSocket Handler → Web UI
    ↓                                       ↓               ↓
計算價差                            計算淨收益並推送      顯示 + 排序
(RateDifferenceCalculator)    (MarketRatesHandler)   (RatesTable)
```

- ✅ 資料流向正確：CLI 計算 → 快取 → Web 顯示
- ✅ Web 不執行業務邏輯：淨收益計算在後端（WebSocket handler）
- ✅ 前端僅負責顯示和排序（UI 邏輯）

---

### Summary: All Gates PASSED ✅

此功能完全符合所有 Constitution 原則：
- 不涉及交易安全問題（僅顯示）
- 有完整日誌和錯誤處理
- 防禦性編程到位
- 無資料完整性問題
- 支援增量交付
- 符合架構邊界

**無需 Complexity Tracking**（無憲法違規需要說明）

## Project Structure

### Documentation (this feature)

```
specs/011-price-spread-net-return/
├── spec.md              # Feature specification (completed by /speckit.specify)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (technical decisions and alternatives)
├── data-model.md        # Phase 1 output (TypeScript interfaces and types)
├── quickstart.md        # Phase 1 output (testing and validation guide)
├── contracts/           # Phase 1 output (WebSocket payload schema)
│   └── websocket.md     # WebSocket event schema for price spread and net return
├── checklists/          # Quality checklists
│   └── requirements.md  # Specification quality checklist (completed)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created yet)
```

### Source Code (repository root)

```
# Existing structure (Web application with monorepo layout)

src/                                    # Backend (Node.js + TypeScript)
├── websocket/
│   └── handlers/
│       └── MarketRatesHandler.ts      # MODIFY: Add priceDiffPercent and netReturn to formatRates()
├── lib/
│   └── cost-constants.ts              # REFERENCE: Read TRADING_FEE_PERCENT constant
└── services/
    └── monitor/
        └── RatesCache.ts               # REFERENCE: Contains priceDiffPercent in cached data

app/                                    # Frontend (Next.js App Router)
└── (dashboard)/
    └── market-monitor/
        ├── components/
        │   ├── RatesTable.tsx          # MODIFY: Add price spread and net return column headers
        │   └── RateRow.tsx             # MODIFY: Add price spread and net return data cells + color indicators
        ├── types.ts                    # MODIFY: Extend BestArbitragePair and SortField types
        ├── hooks/
        │   └── useTableSort.ts         # MODIFY: Add priceDiff and netReturn to valid sort fields
        └── utils/
            └── sortComparator.ts       # MODIFY: Add price spread and net return comparison logic

tests/                                  # Testing
├── unit/
│   └── lib/
│       └── net-return-calculator.test.ts    # NEW: Unit test for net return calculation
└── e2e/
    └── market-monitor-price-spread.spec.ts  # NEW: E2E test for price spread display and sorting
```

**Structure Decision**:
- 使用現有的 Web application 結構（Next.js App Router + Backend）
- 主要修改位於 `app/(dashboard)/market-monitor/` 和 `src/websocket/handlers/`
- 無需新增資料庫 schema 或 API 端點
- 測試檔案遵循現有的 `tests/unit/` 和 `tests/e2e/` 結構

## Complexity Tracking

*No violations to justify - all Constitution checks PASSED*

---

## Phase 0: Research & Decisions

### Research Topics

1. **淨收益計算公式驗證**
   - **Decision**: 使用 `spreadPercent - Math.abs(priceDiffPercent) - TRADING_FEE_PERCENT`
   - **Rationale**:
     - `spreadPercent` 已為資金費率差異（正值表示有利）
     - `priceDiffPercent` 可能為正或負，取絕對值確保一致性
     - `TRADING_FEE_PERCENT` 固定為 0.3%（包含 Maker、Taker 費用和滑價）
   - **Alternatives**:
     - 選項 A：使用 Decimal.js 進行高精度計算 ❌（過度設計，百分比精度足夠）
     - 選項 B：在前端計算淨收益 ❌（違反架構原則，計算應在後端）
   - **Source**: `src/lib/cost-constants.ts` 定義 `TOTAL_TRADING_COST_RATE = 0.003`

2. **顏色指示器實作方式**
   - **Decision**: 使用 Tailwind CSS 背景顏色類別（`bg-green-100`、`bg-yellow-100`、`bg-red-100`）+ 對應文字顏色
   - **Rationale**:
     - 專案已使用 Tailwind CSS
     - 背景顏色比純文字顏色更明顯
     - 符合 Web 無障礙標準（WCAG AA）
   - **Alternatives**:
     - 選項 A：使用圖標（emoji 或 SVG）❌（不夠直觀，增加複雜度）
     - 選項 B：僅文字顏色 ❌（不夠明顯，對色盲用戶不友善）
   - **Thresholds**:
     - 綠色：`netReturn > 0.1%`
     - 黃色：`netReturn >= -0.05% && netReturn <= 0.1%`
     - 紅色：`netReturn < -0.05%`

3. **排序穩定性實作**
   - **Decision**: 擴展 Feature 009 的 `stableSortComparator` 函數，新增 `priceDiff` 和 `netReturn` 排序欄位
   - **Rationale**:
     - Feature 009 已實作完整的穩定排序機制
     - 使用快照排序，避免 WebSocket 更新導致列表跳動
     - 次要排序 key 為 symbol（字母順序）
   - **Alternatives**:
     - 選項 A：重新實作排序邏輯 ❌（重複造輪，浪費時間）
     - 選項 B：使用第三方排序庫 ❌（增加依賴，過度設計）
   - **Implementation**: 在 `sortComparator.ts` 新增兩個 case，遵循現有模式

4. **WebSocket 資料格式**
   - **Decision**: 在 `bestPair` 物件中新增 `priceDiffPercent` 和 `netReturn` 欄位
   - **Rationale**:
     - 與現有欄位（spreadPercent、annualizedReturn）保持一致
     - 前端無需修改 WebSocket 訂閱邏輯
     - 向後相容（新欄位不影響舊客戶端）
   - **Schema**:
     ```typescript
     interface BestArbitragePair {
       longExchange: string;
       shortExchange: string;
       spread: number;
       spreadPercent: number;
       annualizedReturn: number;
       priceDiffPercent: number;   // NEW
       netReturn: number;            // NEW
     }
     ```

5. **錯誤處理策略**
   - **Decision**: Fail-safe 模式 - 顯示 "N/A" 而不是隱藏整行或報錯
   - **Rationale**:
     - 符合 Constitution Principle III（防禦性編程）
     - 單一欄位錯誤不應影響其他欄位
     - 用戶仍可看到其他有效資訊
   - **Implementation**:
     - 後端：`priceDiffPercent ?? null` 和 `netReturn ?? null`
     - 前端：`value != null ? formatPercent(value) : "N/A"`

---

## Phase 1: Design & Contracts

### Data Model

見 `data-model.md`（將在下一步生成）

### API Contracts

見 `contracts/websocket.md`（將在下一步生成）

### Quick Start Guide

見 `quickstart.md`（將在下一步生成）

---

## Phase 2: Task Generation

使用 `/speckit.tasks` 命令生成詳細任務清單（`tasks.md`）。

預期任務結構：
- **Phase 1: Setup** - 驗證環境和依賴
- **Phase 2: Backend** - 修改 WebSocket handler 和計算邏輯
- **Phase 3: Frontend Types** - 更新 TypeScript 介面
- **Phase 4: Frontend Display** - 新增欄位和顏色指示器
- **Phase 5: Frontend Sorting** - 實作排序功能
- **Phase 6: Testing** - 單元測試和 E2E 測試
- **Phase 7: Documentation** - 更新 CHANGELOG 和使用文件

---

## Estimated Effort

**Total**: 5-7 小時（1 位開發者）

| Phase | Task | Effort |
|-------|------|--------|
| Backend | 修改 MarketRatesHandler 推送邏輯 | 1 小時 |
| Frontend | 更新 types.ts 類型定義 | 30 分鐘 |
| Frontend | RatesTable + RateRow 新增欄位 | 1.5 小時 |
| Frontend | 實作顏色指示器 | 1 小時 |
| Frontend | 擴展排序邏輯 | 1 小時 |
| Testing | 單元測試（淨收益計算） | 30 分鐘 |
| Testing | E2E 測試（顯示和排序） | 1 小時 |
| Documentation | CHANGELOG 和使用文件 | 30 分鐘 |

---

## Dependencies

- **Feature 009**: 市場監控穩定排序機制（已完成）
- **cost-constants.ts**: 交易手續費常數定義（已存在）
- **RateDifferenceCalculator**: 價差計算邏輯（已存在）
- **RatesCache**: 價差資料快取（已存在）
- **MarketRatesHandler**: WebSocket 推送機制（已存在）

**無外部依賴或新套件**

---

## Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| 表格寬度不足 | Medium | Low | 調整現有欄位寬度，使用響應式設計 |
| 顏色閾值爭議 | Low | Medium | 在文件中明確說明，未來可配置 |
| 淨收益計算錯誤 | High | Low | 詳細單元測試，手動驗證公式 |
| 排序性能問題 | Medium | Low | Feature 009 已優化，支援 100+ 項目 |
| WebSocket 推送延遲 | Low | Low | 計算簡單（< 10ms），不影響效能 |

---

## Success Metrics

完成後驗證（來自 spec.md Success Criteria）：

- ✅ SC-001: 頁面載入 < 3 秒顯示價差和淨收益
- ✅ SC-002: 淨收益計算 100% 準確
- ✅ SC-003: 排序操作 < 1 秒完成
- ✅ SC-004: WebSocket 更新不會導致列表跳動
- ✅ SC-005: 90% 用戶理解顏色指示器含義
- ✅ SC-006: 正確處理 100% 邊緣情況
- ✅ SC-007: 100 個交易對排序 < 1 秒

---

## Next Steps

1. ✅ Phase 0 完成 - 研究和決策記錄於此文件
2. 🔄 Phase 1 進行中 - 生成 `research.md`、`data-model.md`、`contracts/websocket.md`、`quickstart.md`
3. ⏳ Phase 2 待執行 - 執行 `/speckit.tasks` 生成任務清單
4. ⏳ Phase 3 待執行 - 執行 `/speckit.implement` 開始實作

**當前狀態**: 技術計劃已完成，準備生成設計文件
