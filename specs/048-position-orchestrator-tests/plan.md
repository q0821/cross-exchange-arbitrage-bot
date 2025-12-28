# Implementation Plan: PositionOrchestrator 單元測試覆蓋

**Branch**: `048-position-orchestrator-tests` | **Date**: 2025-12-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/048-position-orchestrator-tests/spec.md`

## Summary

為 `PositionOrchestrator` 服務添加完整的單元測試覆蓋，確保開倉流程協調、回滾機制、條件單設定和錯誤處理的正確性。使用 Vitest 框架，通過 mock 隔離外部依賴（PrismaClient、BalanceValidator、ConditionalOrderService、CCXT、PositionLockService），覆蓋雙邊成功、雙邊失敗、部分成功三種主要場景。

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**: Vitest 2.1.2, Decimal.js, Prisma 5.x (mocked), CCXT 4.x (mocked)
**Storage**: N/A（純測試，不涉及資料庫變更）
**Testing**: Vitest + vi.mock + vi.fn + vi.spyOn
**Target Platform**: Node.js (CI/CD 環境)
**Project Type**: single
**Performance Goals**: 測試套件執行時間 < 10 秒
**Constraints**: 無網路依賴，所有外部呼叫必須 mock
**Scale/Scope**: 1 個主要公開方法 + 多個私有方法，預計 25+ 個測試案例

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Trading Safety First | ✅ N/A | 測試功能，不執行真實交易 |
| II. Complete Observability | ✅ N/A | 測試中 mock logger |
| III. Defensive Programming | ✅ Pass | 測試將驗證錯誤處理和回滾邏輯 |
| IV. Data Integrity | ✅ N/A | 不涉及資料庫變更 |
| V. Incremental Delivery | ✅ Pass | 測試可獨立執行和驗證 |
| VI. System Architecture | ✅ N/A | 純服務層測試 |
| VII. TDD Discipline | ✅ Pass | 本功能就是補充測試覆蓋 |

**Gate Result**: ✅ PASS - 無違規項目

## Project Structure

### Documentation (this feature)

```
specs/048-position-orchestrator-tests/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md  # Spec validation checklist
└── tasks.md             # Phase 2 output (by /speckit.tasks)
```

### Source Code (repository root)

```
tests/
└── unit/
    └── services/
        └── PositionOrchestrator.test.ts  # 新增測試檔案

src/
└── services/
    └── trading/
        ├── PositionOrchestrator.ts       # 被測試目標（不修改）
        ├── BalanceValidator.ts           # 依賴（mock）
        ├── ConditionalOrderService.ts    # 依賴（mock）
        └── PositionLockService.ts        # 依賴（mock）
```

**Structure Decision**: 遵循現有專案結構，測試檔案放置於 `tests/unit/services/`，與其他服務測試保持一致。

## Test Strategy

### Mock Strategy

需要 mock 的依賴：

1. **PrismaClient** - mock position.create, position.update 方法
2. **BalanceValidator** - mock validateBalance 方法
3. **ConditionalOrderService** - mock setConditionalOrders 方法
4. **PositionLockService** - mock withLock 靜態方法直接執行回調
5. **CCXT** - mock 交易所實例和 createMarketOrder/closePosition 方法
6. **logger** - 避免測試輸出日誌
7. **encryption** - mock decrypt 方法

### Test Organization

```typescript
describe('PositionOrchestrator', () => {
  describe('openPosition', () => {
    describe('successful bilateral open', () => {
      it('should create position with OPEN status when both sides succeed')
      it('should record correct entry prices and quantities')
      it('should set conditional orders when enabled')
    })

    describe('rollback mechanism', () => {
      it('should rollback long when short fails')
      it('should rollback short when long fails')
      it('should retry rollback up to 3 times')
      it('should mark position as PARTIAL when rollback fails')
      it('should throw RollbackFailedError after max retries')
    })

    describe('both sides failed', () => {
      it('should mark position as FAILED with combined error message')
      it('should throw TradingError with BILATERAL_OPEN_FAILED code')
    })

    describe('balance validation', () => {
      it('should fail early if balance insufficient')
      it('should propagate ApiKeyNotFoundError')
    })

    describe('conditional orders', () => {
      it('should set stop loss orders when enabled')
      it('should set take profit orders when enabled')
      it('should handle conditional order failures gracefully')
    })

    describe('lock mechanism', () => {
      it('should acquire lock before execution')
    })
  })

  describe('edge cases', () => {
    it('should format symbol correctly for CCXT')
    it('should handle order timeout')
  })
})
```

## Complexity Tracking

*無違規項目，不需填寫*
