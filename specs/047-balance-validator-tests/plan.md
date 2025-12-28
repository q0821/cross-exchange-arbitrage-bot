# Implementation Plan: BalanceValidator 單元測試覆蓋

**Branch**: `047-balance-validator-tests` | **Date**: 2025-12-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/047-balance-validator-tests/spec.md`

## Summary

為 `BalanceValidator` 服務添加完整的單元測試覆蓋，確保保證金計算、餘額查詢和餘額驗證邏輯的正確性。使用 Vitest 框架，通過 mock 隔離外部依賴（UserConnectorFactory、PrismaClient），覆蓋正常流程、邊界條件和錯誤處理場景。

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**: Vitest 2.1.2, Decimal.js, Prisma 5.x (mocked)
**Storage**: N/A（純測試，不涉及資料庫變更）
**Testing**: Vitest + vi.mock + vi.fn
**Target Platform**: Node.js (CI/CD 環境)
**Project Type**: single
**Performance Goals**: 測試套件執行時間 < 5 秒
**Constraints**: 無網路依賴，所有外部呼叫必須 mock
**Scale/Scope**: 4 個公開方法，預計 20+ 個測試案例

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Trading Safety First | ✅ N/A | 測試功能，不執行真實交易 |
| II. Complete Observability | ✅ N/A | 測試中 mock logger |
| III. Defensive Programming | ✅ Pass | 測試將驗證錯誤處理邏輯 |
| IV. Data Integrity | ✅ N/A | 不涉及資料庫變更 |
| V. Incremental Delivery | ✅ Pass | 測試可獨立執行和驗證 |
| VI. System Architecture | ✅ N/A | 純服務層測試 |
| VII. TDD Discipline | ✅ Pass | 本功能就是補充測試覆蓋 |

**Gate Result**: ✅ PASS - 無違規項目

## Project Structure

### Documentation (this feature)

```
specs/047-balance-validator-tests/
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
        └── BalanceValidator.test.ts  # 新增測試檔案

src/
└── services/
    └── trading/
        └── BalanceValidator.ts       # 被測試目標（不修改）
```

**Structure Decision**: 遵循現有專案結構，測試檔案放置於 `tests/unit/services/`，與其他服務測試保持一致。

## Test Strategy

### Mock Strategy

需要 mock 的依賴：

1. **PrismaClient** - 傳入 BalanceValidator 建構子
2. **UserConnectorFactory** - mock `getBalancesForUser` 方法
3. **logger** - 避免測試輸出日誌

### Test Organization

```typescript
describe('BalanceValidator', () => {
  describe('calculateRequiredMargin', () => {
    it('should calculate margin with 10% buffer')
    it('should handle zero quantity')
    it('should handle high precision decimals')
    it('should handle leverage 1x')
    it('should handle leverage 125x')
  })

  describe('getBalances', () => {
    it('should return balances for valid API keys')
    it('should throw ApiKeyNotFoundError for missing keys')
    it('should throw ExchangeApiError for API failures')
    it('should handle rate limiting')
    it('should set balance to 0 for missing results')
  })

  describe('validateBalance', () => {
    it('should pass when both exchanges have sufficient balance')
    it('should throw InsufficientBalanceError for long exchange')
    it('should throw InsufficientBalanceError for short exchange')
    it('should check long exchange first when both insufficient')
    it('should fail when balance equals required without buffer')
  })

  describe('checkBalance', () => {
    it('should return isValid=true when sufficient')
    it('should return isValid=false with details when insufficient')
    it('should re-throw non-InsufficientBalanceError errors')
  })
})
```

## Complexity Tracking

*無違規項目，不需填寫*
