# Quickstart: Core Trading Unit Tests

**Feature**: 051-core-trading-tests
**Date**: 2025-12-30

## 快速開始

### 1. 執行現有測試

```bash
# 執行所有測試
pnpm test

# 執行核心交易服務測試
pnpm test BalanceValidator PositionOrchestrator PositionCloser ConditionalOrderMonitor FundingFeeQueryService

# 執行單一服務測試
pnpm test BalanceValidator

# 監看模式
pnpm test:watch

# 覆蓋率報告
pnpm test:coverage
```

### 2. 測試檔案位置

| 服務 | 測試檔案 |
|------|----------|
| BalanceValidator | `tests/unit/services/BalanceValidator.test.ts` |
| PositionOrchestrator | `tests/unit/services/PositionOrchestrator.test.ts` |
| PositionCloser | `tests/unit/services/PositionCloser.singleSide.test.ts` |
| ConditionalOrderMonitor | `tests/unit/services/monitor/ConditionalOrderMonitor.test.ts` |
| FundingFeeQueryService | `tests/unit/services/FundingFeeQueryService.test.ts` |

### 3. Mock 設定模式

#### Logger Mock（必須放在 import 之前）

```typescript
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));
```

#### CCXT Mock（使用 vi.hoisted）

```typescript
const { mockFnStore } = vi.hoisted(() => ({
  mockFnStore: {
    createMarketOrder: vi.fn(),
    fetchTicker: vi.fn(),
    loadMarkets: vi.fn(),
  },
}));

vi.mock('ccxt', () => {
  class MockExchange {
    createMarketOrder = (...args) => mockFnStore.createMarketOrder(...args);
    fetchTicker = (...args) => mockFnStore.fetchTicker(...args);
    loadMarkets = (...args) => mockFnStore.loadMarkets(...args);
  }
  return {
    binance: MockExchange,
    okx: MockExchange,
    // ...其他交易所
  };
});
```

#### Prisma Mock

```typescript
const createMockPrisma = () => ({
  position: {
    create: vi.fn().mockResolvedValue(mockPosition),
    update: vi.fn().mockResolvedValue(mockPosition),
    findUnique: vi.fn().mockResolvedValue(mockPosition),
  },
  apiKey: {
    findFirst: vi.fn().mockResolvedValue(mockApiKey),
  },
}) as unknown as PrismaClient;
```

### 4. 測試案例範例

#### Arrange-Act-Assert 模式

```typescript
describe('BalanceValidator', () => {
  it('should calculate margin with 10% buffer', () => {
    // Arrange
    const quantity = new Decimal('1');
    const price = new Decimal('50000');
    const leverage = 10;

    // Act
    const result = validator.calculateRequiredMargin(quantity, price, leverage);

    // Assert: (1 * 50000 / 10) * 1.1 = 5500
    expect(result.toNumber()).toBe(5500);
  });
});
```

#### 非同步錯誤測試

```typescript
it('should throw InsufficientBalanceError', async () => {
  // Arrange
  mockGetBalancesForUser.mockResolvedValue([
    { exchange: 'binance', status: 'success', balanceUSD: 1000 }, // 不足
  ]);

  // Act & Assert
  await expect(
    validator.validateBalance('user-123', 'binance', 'okx', ...)
  ).rejects.toThrow(InsufficientBalanceError);
});
```

### 5. 常見問題

#### Q: Mock 順序錯誤導致測試失敗？

A: 確保 `vi.mock()` 在 import 之前：

```typescript
// ✅ 正確順序
vi.mock('@/lib/logger', ...);
import { BalanceValidator } from '@/services/trading/BalanceValidator';

// ❌ 錯誤順序
import { BalanceValidator } from '@/services/trading/BalanceValidator';
vi.mock('@/lib/logger', ...);
```

#### Q: Decimal 比較失敗？

A: 使用 `.toNumber()` 轉換：

```typescript
// ✅ 正確
expect(result.toNumber()).toBe(5500);

// ❌ 可能失敗
expect(result).toEqual(new Decimal('5500'));
```

#### Q: 非同步 mock 順序不一致？

A: 使用 `mockResolvedValueOnce` 確保順序：

```typescript
mockExchange.fetchFundingHistory
  .mockResolvedValueOnce([{ amount: 0.5 }])  // 第一次調用
  .mockResolvedValueOnce([{ amount: -0.2 }]); // 第二次調用
```

#### Q: 如何測試 Fake Timers？

A: 使用 Vitest 的 fake timers：

```typescript
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it('should retry after timeout', async () => {
  const promise = service.retryOperation();
  await vi.advanceTimersByTimeAsync(1000);
  await expect(promise).resolves.toBeDefined();
});
```

### 6. 覆蓋率目標

- **整體目標**：80% 覆蓋率
- **每服務最低**：10+ 測試案例
- **必須覆蓋**：
  - 正常流程
  - 錯誤處理路徑
  - 邊界條件

### 7. 執行覆蓋率報告

```bash
# 生成覆蓋率報告
pnpm test:coverage

# 報告位置
# - 終端機：summary
# - HTML：coverage/index.html
# - JSON：coverage/coverage-summary.json
```
