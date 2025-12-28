# Research: BalanceValidator 單元測試

**Feature**: 047-balance-validator-tests
**Date**: 2025-12-28

## 研究目標

確定 BalanceValidator 測試的最佳實踐和 mock 策略。

---

## Decision 1: Mock Strategy for UserConnectorFactory

**Decision**: 使用 vi.mock 在模組層級 mock UserConnectorFactory

**Rationale**:
- UserConnectorFactory 內部依賴 PrismaClient 和多個交易所 API
- 直接 mock 整個模組可以完全隔離外部依賴
- 現有專案（ApiKeyValidator.test.ts）已使用此模式

**Alternatives considered**:
1. 使用 dependency injection mock - 需要修改 BalanceValidator 建構子
2. 使用 spyOn - 無法完全控制內部實現
3. 整合測試 - 需要真實 API Key，不適合 CI/CD

**Implementation**:
```typescript
vi.mock('../../../src/services/assets/UserConnectorFactory', () => ({
  UserConnectorFactory: vi.fn().mockImplementation(() => ({
    getBalancesForUser: vi.fn(),
  })),
}));
```

---

## Decision 2: Test Data Strategy

**Decision**: 使用貼近真實的測試數據（BTC、ETH 典型價格和數量）

**Rationale**:
- 提高測試可讀性和可維護性
- 便於發現精度相關問題
- 測試結果易於人工驗算

**Test Data Examples**:
| Symbol | Quantity | Price | Leverage | Expected Margin |
|--------|----------|-------|----------|-----------------|
| BTC | 1 | 50000 | 10x | 5500 USDT |
| ETH | 0.5 | 2000 | 5x | 220 USDT |
| SOL | 10 | 100 | 20x | 55 USDT |

**Margin Formula**:
```
requiredMargin = (quantity * price / leverage) * 1.1
```

---

## Decision 3: Error Type Verification

**Decision**: 使用 `expect().rejects.toThrow(ErrorClass)` 和 `expect.objectContaining()` 驗證錯誤

**Rationale**:
- 確保拋出正確的錯誤類型
- 驗證錯誤包含正確的上下文資訊（exchange、required、available）

**Example**:
```typescript
await expect(validator.validateBalance(...))
  .rejects
  .toThrow(InsufficientBalanceError);

await expect(validator.validateBalance(...))
  .rejects
  .toMatchObject({
    exchange: 'binance',
    required: 5500,
    available: 1000,
  });
```

---

## Decision 4: Decimal.js Handling

**Decision**: 測試中使用 `new Decimal()` 構造輸入，使用 `.toNumber()` 比較輸出

**Rationale**:
- BalanceValidator 接受 Decimal 類型輸入
- 輸出結果轉換為 number 便於斷言
- 避免 Decimal 物件比較的複雜性

**Example**:
```typescript
const result = validator.calculateRequiredMargin(
  new Decimal('1'),
  new Decimal('50000'),
  10
);
expect(result.toNumber()).toBe(5500);
```

---

## Decision 5: Test Organization

**Decision**: 按方法分組，每組包含正常、邊界、錯誤三類測試

**Rationale**:
- 清晰的測試結構
- 便於定位失敗測試
- 符合專案現有測試風格

**Structure**:
```
describe('BalanceValidator')
  describe('calculateRequiredMargin')
    describe('normal cases')
    describe('edge cases')
  describe('getBalances')
    describe('success scenarios')
    describe('error scenarios')
  describe('validateBalance')
    describe('validation passes')
    describe('validation fails')
  describe('checkBalance')
    describe('success')
    describe('failure handling')
```

---

## Key Findings

1. **現有測試模式**: 專案已有 8 個服務層測試，可參考 ApiKeyValidator.test.ts 的 mock 模式
2. **Mock 順序**: 必須在 import 之前設置 vi.mock
3. **Logger Mock**: 所有測試都需要 mock logger 避免輸出
4. **Async 測試**: 所有涉及 API 的方法都是 async，需使用 await/rejects
