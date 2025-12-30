# Implementation Plan: Core Trading Unit Tests

**Branch**: `051-core-trading-tests` | **Date**: 2025-12-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/051-core-trading-tests/spec.md`

## Summary

建立核心交易服務的自動化單元測試套件，涵蓋 BalanceValidator、PositionOrchestrator、PositionCloser、ConditionalOrderMonitor、FundingFeeQueryService 五個關鍵服務，目標覆蓋率 80%，使用 Vitest 測試框架和 mock 模式隔離外部依賴。

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**: Vitest 2.1.2, vitest-mock-extended, Decimal.js, Prisma 5.x (mocked)
**Storage**: PostgreSQL 15 + TimescaleDB (mocked via Prisma)
**Testing**: Vitest with vitest-mock-extended for mocking
**Target Platform**: Node.js server environment
**Project Type**: Single project (existing codebase)
**Performance Goals**: 全部測試執行時間 < 2 分鐘
**Constraints**: 測試必須可離線執行（所有外部依賴已 mock）
**Scale/Scope**: 5 個服務，每服務 10+ 測試案例，總計 50+ 測試案例

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Trading Safety First | ✅ N/A | 測試不執行實際交易 |
| II. Complete Observability | ✅ Pass | 測試將驗證日誌行為 |
| III. Defensive Programming | ✅ Pass | 測試將涵蓋錯誤處理路徑 |
| IV. Data Integrity | ✅ Pass | 測試將使用 Decimal 驗證財務計算 |
| V. Incremental Delivery | ✅ Pass | 按 Priority 分階段實作測試 |
| VI. System Architecture | ✅ N/A | 測試不改變架構邊界 |
| VII. TDD Discipline | ✅ 核心 | 本 feature 正是實踐 TDD 的基礎 |

**Gate Status**: ✅ PASSED

## Project Structure

### Documentation (this feature)

```
specs/051-core-trading-tests/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # N/A (純測試，無新資料模型)
├── quickstart.md        # Phase 1 output
├── contracts/           # N/A (無 API 變更)
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```
tests/
├── unit/
│   └── services/
│       ├── trading/
│       │   ├── BalanceValidator.test.ts
│       │   ├── PositionOrchestrator.test.ts
│       │   ├── PositionCloser.test.ts
│       │   └── FundingFeeQueryService.test.ts
│       └── monitor/
│           └── ConditionalOrderMonitor.test.ts
├── fixtures/
│   ├── positions.ts         # 測試用持倉數據
│   ├── exchanges.ts         # 交易所模擬數據
│   └── users.ts             # 用戶模擬數據
├── mocks/
│   ├── prisma.ts            # Prisma mock 設定
│   ├── ccxt.ts              # CCXT mock 設定
│   └── redis.ts             # Redis mock 設定
└── helpers/
    └── testUtils.ts         # 測試工具函數

src/services/trading/       # 現有服務（測試目標）
├── BalanceValidator.ts
├── PositionOrchestrator.ts
├── PositionCloser.ts
└── FundingFeeQueryService.ts

src/services/monitor/       # 現有服務（測試目標）
└── ConditionalOrderMonitor.ts
```

**Structure Decision**: 在現有 `tests/` 目錄下建立 `unit/services/` 結構，與服務目錄結構對應，便於導航和維護。

## Complexity Tracking

*無違反 Constitution 的項目，無需額外說明。*

## Phase 0 Research Findings

### 現有測試覆蓋狀況

經過 Phase 0 研究發現，**五個目標服務中已有四個具備完整測試**：

| 服務 | 測試數量 | 狀態 | 行動項目 |
|------|----------|------|----------|
| BalanceValidator | 30 | ✅ 通過 | 維護現有測試 |
| PositionOrchestrator | 35 | ✅ 通過 | 維護現有測試 |
| PositionCloser.singleSide | 15 | ✅ 通過 | 補充雙邊平倉測試 |
| ConditionalOrderMonitor | 67 | ✅ 通過 | 維護現有測試 |
| FundingFeeQueryService | 17 (6 失敗) | ⚠️ 需修復 | 修復失敗測試 |

### 調整後的實作範圍

基於 Phase 0 發現，本 feature 調整為：

1. **修復 FundingFeeQueryService 的 6 個失敗測試**（Priority: P1）
2. **補充 PositionCloser 的雙邊平倉測試**（Priority: P2）
3. **執行覆蓋率報告確認 80% 目標達成**（Priority: P3）

### FundingFeeQueryService 失敗測試分析

失敗原因：CCXT mock 的 `mockResolvedValueOnce` 順序問題

待修復測試：
- `should correctly accumulate multiple settlement records`
- `should return Long and Short funding fees separately and combined total`
- `should handle same exchange for both Long and Short sides`
- `should handle Long 1h settlement + Short 8h settlement separately`
- `should use actual API response without calculating frequency`
- `should use Long result when Short fails`

## Implementation Strategy

### 優先順序

1. **P1 - 修復 FundingFeeQueryService 測試**：解決 mock 順序問題
2. **P2 - 補充 PositionCloser.bilateral 測試**：新增雙邊平倉測試檔案
3. **P3 - 覆蓋率驗證**：執行報告確認達標

### 技術方案

#### FundingFeeQueryService Mock 修復

問題：多次調用 `fetchFundingHistory` 時 mock 返回順序不一致

解決方案：
```typescript
// 使用 mockImplementation 而非 mockResolvedValueOnce
let callCount = 0;
mockCcxtExchange.fetchFundingHistory.mockImplementation(() => {
  callCount++;
  return Promise.resolve(mockResponses[callCount - 1]);
});
```

#### PositionCloser Bilateral 測試

新增測試檔案：`tests/unit/services/PositionCloser.bilateral.test.ts`

測試案例：
- 雙邊平倉成功
- 一邊成功一邊失敗
- 雙邊都失敗
- Trade 績效記錄正確

## Dependencies

- 無外部依賴變更
- 現有 Vitest、vitest-mock-extended 配置可直接使用

## Next Steps

1. 執行 `/speckit.tasks` 生成詳細任務清單
2. 按 Priority 順序執行任務
3. 執行 `pnpm test:coverage` 驗證達標
