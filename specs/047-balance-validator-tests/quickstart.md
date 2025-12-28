# Quickstart: BalanceValidator 單元測試

**Feature**: 047-balance-validator-tests
**Date**: 2025-12-28

## 快速開始

### 1. 建立測試檔案

```bash
touch tests/unit/services/BalanceValidator.test.ts
```

### 2. 基本測試結構

```typescript
/**
 * BalanceValidator Unit Tests
 *
 * 測試餘額驗證服務
 * Feature: 047-balance-validator-tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Decimal } from 'decimal.js';

// Mock logger first
vi.mock('../../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock UserConnectorFactory
const mockGetBalancesForUser = vi.fn();
vi.mock('../../../src/services/assets/UserConnectorFactory', () => ({
  UserConnectorFactory: vi.fn().mockImplementation(() => ({
    getBalancesForUser: mockGetBalancesForUser,
  })),
}));

// Import after mocks
import { BalanceValidator } from '../../../src/services/trading/BalanceValidator';
import {
  InsufficientBalanceError,
  ApiKeyNotFoundError,
  ExchangeApiError,
} from '../../../src/lib/errors/trading-errors';

describe('BalanceValidator', () => {
  let validator: BalanceValidator;
  const mockPrisma = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
    validator = new BalanceValidator(mockPrisma);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Tests go here...
});
```

### 3. 執行測試

```bash
# 執行所有測試
pnpm test

# 只執行 BalanceValidator 測試
pnpm test BalanceValidator

# 監看模式
pnpm test:watch BalanceValidator

# 覆蓋率報告
pnpm test:coverage
```

## 測試案例範例

### calculateRequiredMargin 測試

```typescript
describe('calculateRequiredMargin', () => {
  it('should calculate margin with 10% buffer for BTC', () => {
    // Arrange
    const quantity = new Decimal('1');
    const price = new Decimal('50000');
    const leverage = 10;

    // Act
    const result = validator.calculateRequiredMargin(quantity, price, leverage);

    // Assert
    // (1 * 50000 / 10) * 1.1 = 5500
    expect(result.toNumber()).toBe(5500);
  });

  it('should return 0 for zero quantity', () => {
    const result = validator.calculateRequiredMargin(
      new Decimal('0'),
      new Decimal('50000'),
      10
    );
    expect(result.toNumber()).toBe(0);
  });
});
```

### getBalances 測試

```typescript
describe('getBalances', () => {
  it('should return balances for valid exchanges', async () => {
    // Arrange
    mockGetBalancesForUser.mockResolvedValue([
      { exchange: 'binance', status: 'success', balanceUSD: 10000 },
      { exchange: 'okx', status: 'success', balanceUSD: 5000 },
    ]);

    // Act
    const result = await validator.getBalances('user-123', ['binance', 'okx']);

    // Assert
    expect(result.get('binance')).toBe(10000);
    expect(result.get('okx')).toBe(5000);
  });

  it('should throw ApiKeyNotFoundError for no_api_key status', async () => {
    mockGetBalancesForUser.mockResolvedValue([
      { exchange: 'binance', status: 'no_api_key' },
    ]);

    await expect(
      validator.getBalances('user-123', ['binance'])
    ).rejects.toThrow(ApiKeyNotFoundError);
  });
});
```

### validateBalance 測試

```typescript
describe('validateBalance', () => {
  it('should pass when both exchanges have sufficient balance', async () => {
    // Arrange
    mockGetBalancesForUser.mockResolvedValue([
      { exchange: 'binance', status: 'success', balanceUSD: 10000 },
      { exchange: 'okx', status: 'success', balanceUSD: 10000 },
    ]);

    // Act
    const result = await validator.validateBalance(
      'user-123',
      'binance',
      'okx',
      new Decimal('1'),
      new Decimal('50000'),
      new Decimal('50000'),
      10
    );

    // Assert
    expect(result.isValid).toBe(true);
    expect(result.requiredMarginLong).toBe(5500);
    expect(result.requiredMarginShort).toBe(5500);
  });

  it('should throw InsufficientBalanceError for long exchange', async () => {
    mockGetBalancesForUser.mockResolvedValue([
      { exchange: 'binance', status: 'success', balanceUSD: 1000 }, // Not enough
      { exchange: 'okx', status: 'success', balanceUSD: 10000 },
    ]);

    await expect(
      validator.validateBalance(
        'user-123',
        'binance',
        'okx',
        new Decimal('1'),
        new Decimal('50000'),
        new Decimal('50000'),
        10
      )
    ).rejects.toThrow(InsufficientBalanceError);
  });
});
```

## 常見問題

### Q: Mock 順序錯誤導致測試失敗？

A: 確保 `vi.mock()` 在任何 import 之前調用：

```typescript
// ✅ 正確
vi.mock('../../../src/lib/logger', ...);
import { BalanceValidator } from '...';

// ❌ 錯誤
import { BalanceValidator } from '...';
vi.mock('../../../src/lib/logger', ...);
```

### Q: Decimal 比較失敗？

A: 使用 `.toNumber()` 轉換後比較：

```typescript
// ✅ 正確
expect(result.toNumber()).toBe(5500);

// ❌ 可能失敗（物件比較）
expect(result).toEqual(new Decimal('5500'));
```

### Q: 如何測試 async 錯誤？

A: 使用 `rejects.toThrow()`：

```typescript
await expect(asyncFunction()).rejects.toThrow(ErrorClass);
```
