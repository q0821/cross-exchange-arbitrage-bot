# Research: PositionOrchestrator 單元測試

**Feature**: 048-position-orchestrator-tests
**Date**: 2025-12-28

## 研究目標

確定 PositionOrchestrator 測試的最佳 mock 策略和測試架構。

---

## Decision 1: Mock Strategy for PositionLockService

**Decision**: 使用 vi.spyOn mock PositionLockService.withLock 靜態方法

**Rationale**:
- PositionLockService.withLock 是靜態方法，需要使用 spyOn
- Mock 實現應直接執行回調函數，跳過實際的鎖機制
- 這樣可以測試 PositionOrchestrator 的邏輯而不需要 Redis

**Implementation**:
```typescript
import { PositionLockService } from '../../../src/services/trading/PositionLockService';

vi.spyOn(PositionLockService, 'withLock').mockImplementation(
  async (_userId, _symbol, callback) => {
    return callback({ lockId: 'mock-lock-id', acquired: true });
  }
);
```

---

## Decision 2: Mock Strategy for CCXT

**Decision**: Mock 動態導入的 ccxt 模組並控制 createMarketOrder 結果

**Rationale**:
- PositionOrchestrator 使用動態 import (`await import('ccxt')`)
- 需要 mock 整個 ccxt 模組以控制交易所行為
- 每個測試可以設定不同的成功/失敗場景

**Implementation**:
```typescript
const mockCreateMarketOrder = vi.fn();
const mockFetchTicker = vi.fn();
const mockLoadMarkets = vi.fn();

vi.mock('ccxt', () => ({
  default: {
    binance: vi.fn().mockImplementation(() => ({
      createMarketOrder: mockCreateMarketOrder,
      fetchTicker: mockFetchTicker,
      loadMarkets: mockLoadMarkets,
      markets: { 'BTC/USDT:USDT': { contractSize: 1 } },
      setLeverage: vi.fn(),
      fetchOrder: vi.fn(),
      fetchMyTrades: vi.fn(),
    })),
    okx: vi.fn().mockImplementation(() => ({
      // 同上
    })),
  },
}));
```

---

## Decision 3: Mock Strategy for PrismaClient

**Decision**: 傳入 mock PrismaClient 實例並控制 position.create/update

**Rationale**:
- PositionOrchestrator 接受 PrismaClient 作為建構子參數
- 可以直接傳入 mock 物件而不需要 vi.mock

**Implementation**:
```typescript
const mockPosition = {
  id: 'test-position-id',
  userId: 'user-123',
  symbol: 'BTCUSDT',
  status: 'PENDING',
  // ...其他欄位
};

const mockPrisma = {
  position: {
    create: vi.fn().mockResolvedValue(mockPosition),
    update: vi.fn().mockImplementation(({ where, data }) =>
      Promise.resolve({ ...mockPosition, ...data })
    ),
  },
  apiKey: {
    findFirst: vi.fn().mockResolvedValue({
      id: 'key-1',
      encryptedKey: 'encrypted-key',
      encryptedSecret: 'encrypted-secret',
      environment: 'MAINNET',
      isActive: true,
    }),
  },
} as unknown as PrismaClient;
```

---

## Decision 4: Test Data Strategy

**Decision**: 使用貼近真實的測試數據（BTC、ETH 典型價格和數量）

**Rationale**:
- 提高測試可讀性和可維護性
- 便於發現精度相關問題
- 測試結果易於人工驗算

**Test Data Examples**:
| Symbol | Quantity | Long Price | Short Price | Leverage |
|--------|----------|------------|-------------|----------|
| BTCUSDT | 0.1 | 50000 | 50100 | 1x |
| ETHUSDT | 1.0 | 2000 | 2010 | 2x |

---

## Decision 5: Rollback Test Strategy

**Decision**: 使用 fake timers 模擬重試間隔

**Rationale**:
- 回滾機制有重試間隔（0, 1000, 2000 ms）
- 使用 vi.useFakeTimers 可以快速測試重試邏輯
- 避免測試因等待而變慢

**Implementation**:
```typescript
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it('should retry rollback with delays', async () => {
  // 設定 closePosition 失敗
  mockClosePosition.mockRejectedValue(new Error('Network error'));

  const promise = orchestrator.openPosition(params);

  // 快進時間模擬重試
  await vi.advanceTimersByTimeAsync(1000);
  await vi.advanceTimersByTimeAsync(2000);

  await expect(promise).rejects.toThrow(RollbackFailedError);
});
```

---

## Decision 6: Error Type Verification

**Decision**: 使用 `expect().rejects.toThrow(ErrorClass)` 和 `toMatchObject()` 驗證錯誤

**Rationale**:
- 確保拋出正確的錯誤類型
- 驗證錯誤包含正確的上下文資訊

**Example**:
```typescript
await expect(orchestrator.openPosition(params))
  .rejects
  .toThrow(RollbackFailedError);

await expect(orchestrator.openPosition(params))
  .rejects
  .toMatchObject({
    exchange: 'binance',
    side: 'LONG',
  });
```

---

## Key Findings

1. **現有測試模式**: 專案已有 ConditionalOrderService.test.ts 可參考複雜服務的 mock 模式
2. **動態 import**: CCXT 使用動態 import，需要特殊的 mock 策略
3. **靜態方法**: PositionLockService.withLock 是靜態方法，需要 spyOn
4. **Async 測試**: 所有方法都是 async，需使用 await/rejects
5. **回滾重試**: 需要使用 fake timers 測試重試間隔
