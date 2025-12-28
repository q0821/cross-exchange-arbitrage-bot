# Quickstart: PositionOrchestrator 單元測試

**Feature**: 048-position-orchestrator-tests
**Branch**: `048-position-orchestrator-tests`

## 快速開始

### 1. 執行測試

```bash
# 執行所有 PositionOrchestrator 測試
pnpm test PositionOrchestrator --run

# 執行特定場景
pnpm test PositionOrchestrator -- --grep "successful bilateral open"
pnpm test PositionOrchestrator -- --grep "rollback"
pnpm test PositionOrchestrator -- --grep "both failed"
```

### 2. 測試檔案位置

```
tests/unit/services/PositionOrchestrator.test.ts
```

### 3. 基本 Mock 設定範例

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PositionOrchestrator } from '../../../src/services/trading/PositionOrchestrator';
import { PositionLockService } from '../../../src/services/trading/PositionLockService';
import type { PrismaClient } from '@prisma/client';

// Mock CCXT 動態導入
const mockCreateMarketOrder = vi.fn();
const mockClosePosition = vi.fn();

vi.mock('ccxt', () => ({
  default: {
    binance: vi.fn().mockImplementation(() => ({
      createMarketOrder: mockCreateMarketOrder,
      fetchTicker: vi.fn().mockResolvedValue({ last: 50000 }),
      loadMarkets: vi.fn().mockResolvedValue({}),
      markets: { 'BTC/USDT:USDT': { contractSize: 1 } },
      setLeverage: vi.fn(),
      fetchOrder: vi.fn(),
      fetchMyTrades: vi.fn().mockResolvedValue([]),
    })),
    okx: vi.fn().mockImplementation(() => ({
      createMarketOrder: mockCreateMarketOrder,
      fetchTicker: vi.fn().mockResolvedValue({ last: 50100 }),
      loadMarkets: vi.fn().mockResolvedValue({}),
      markets: { 'BTC/USDT:USDT': { contractSize: 1 } },
      setLeverage: vi.fn(),
      fetchOrder: vi.fn(),
      fetchMyTrades: vi.fn().mockResolvedValue([]),
    })),
  },
}));

// Mock 其他依賴
vi.mock('../../../src/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}));

vi.mock('../../../src/lib/encryption', () => ({
  decrypt: vi.fn().mockReturnValue('decrypted-key'),
}));

describe('PositionOrchestrator', () => {
  let orchestrator: PositionOrchestrator;
  let mockPrisma: PrismaClient;

  beforeEach(() => {
    vi.useFakeTimers();

    // Mock PositionLockService.withLock 靜態方法
    vi.spyOn(PositionLockService, 'withLock').mockImplementation(
      async (_userId, _symbol, callback) => {
        return callback({ lockId: 'mock-lock-id', acquired: true });
      }
    );

    // Mock PrismaClient
    mockPrisma = {
      position: {
        create: vi.fn().mockResolvedValue({
          id: 'test-position-id',
          userId: 'user-123',
          symbol: 'BTCUSDT',
          status: 'PENDING',
        }),
        update: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'test-position-id', ...data })
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

    orchestrator = new PositionOrchestrator(mockPrisma);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // 測試案例...
});
```

### 4. 測試數據範例

```typescript
const baseParams = {
  userId: 'user-123',
  symbol: 'BTCUSDT',
  longExchange: 'binance',
  shortExchange: 'okx',
  quantity: 0.1,
  leverage: 1,
  stopLossEnabled: false,
  takeProfitEnabled: false,
};

const successfulOrderResult = {
  id: 'order-123',
  status: 'closed',
  filled: 0.1,
  average: 50000,
  fee: { cost: 0.5, currency: 'USDT' },
};
```

### 5. 驗證覆蓋率

```bash
# 生成覆蓋率報告
pnpm test PositionOrchestrator --coverage --run

# 查看 HTML 報告
open coverage/index.html
```

## 關鍵測試場景

| 場景 | 驗證重點 | 優先級 |
|------|----------|--------|
| 雙邊成功 | Position 狀態變為 OPEN，記錄正確價格 | P1 |
| Long 成功 Short 失敗 | 回滾 Long，Position 變為 FAILED | P1 |
| Short 成功 Long 失敗 | 回滾 Short，Position 變為 FAILED | P1 |
| 回滾重試耗盡 | Position 變為 PARTIAL，拋出 RollbackFailedError | P1 |
| 雙邊都失敗 | Position 變為 FAILED，記錄兩邊錯誤 | P1 |
| 餘額不足 | 拋出 InsufficientBalanceError | P2 |
| 條件單設定 | 記錄停損停利價格和訂單 ID | P2 |

## 參考資源

- **被測試模組**: `src/services/trading/PositionOrchestrator.ts`
- **相關測試**: `tests/unit/services/ConditionalOrderService.test.ts`（可參考 mock 模式）
- **錯誤類型**: `src/lib/errors/trading-errors.ts`
