# Research: 手動開倉功能

**Date**: 2025-12-17
**Feature**: 033-manual-open-position

## Research Tasks

### 1. 雙邊開倉協調模式（Saga Pattern）

**Decision**: 使用 Orchestration-based Saga Pattern

**Rationale**:
- 開倉操作涉及兩個獨立的交易所 API 調用
- 需要協調兩邊的執行順序和狀態
- 失敗時需要補償（回滾）已成功的操作
- Orchestrator 模式比 Choreography 更適合，因為：
  - 流程相對簡單（2 步）
  - 需要集中控制和監控
  - 便於實現超時和重試邏輯

**Implementation**:
```
PositionOrchestrator.openPosition():
  1. 創建 Position 記錄（PENDING）
  2. 獲取分散式鎖
  3. 驗證餘額
  4. 更新 Position 狀態（OPENING）
  5. 並行執行兩邊開倉
  6. 處理結果：
     - 兩邊成功 → Position 狀態改為 OPEN
     - 兩邊失敗 → Position 狀態改為 FAILED
     - 一邊成功一邊失敗 → 回滾成功的一邊，Position 狀態改為 FAILED 或 ABNORMAL
  7. 釋放分散式鎖
  8. 記錄審計日誌
```

**Alternatives Considered**:
- Choreography-based Saga: 更適合分散式系統，但對於 2 步操作過於複雜
- Two-Phase Commit: 交易所 API 不支援 prepare/commit 模式
- 順序執行（先 A 後 B）: 增加總執行時間，不符合 < 30 秒的要求

---

### 2. 並發控制策略

**Decision**: Redis 分散式鎖 + 前端按鈕禁用

**Rationale**:
- 需要防止同一用戶對同一交易對的並發開倉
- 用戶可能在多個裝置/瀏覽器視窗操作
- 前端禁用只能防止同一視窗的重複點擊
- Redis 鎖可以跨進程、跨節點保護

**Implementation**:
```typescript
// 鎖的 key 格式
const lockKey = `position:open:${userId}:${symbol}`;
const lockTTL = 30000; // 30 秒超時

// 使用 Redlock 算法（或簡化版 SET NX EX）
await redis.set(lockKey, requestId, 'NX', 'PX', lockTTL);
```

**Alternatives Considered**:
- 資料庫行鎖: 需要額外的 transaction，增加複雜度
- 內存鎖（單進程）: 無法處理多節點部署
- 樂觀鎖（version check）: 無法防止並發進入業務邏輯

---

### 3. 餘額驗證策略

**Decision**: 即時查詢 + 10% 緩衝

**Rationale**:
- 餘額可能隨時變化（其他交易、資金費率結算）
- 需要在開倉前再次驗證，而不是只依賴對話框顯示
- 10% 緩衝用於應對：
  - 手續費扣除
  - 滑點導致的額外成本
  - 保證金計算差異

**Implementation**:
```typescript
const requiredMargin = positionSize / leverage; // 例如 1000 / 2 = 500
const requiredWithBuffer = requiredMargin * 1.1; // 550

const balance = await connector.getBalance();
if (balance.available < requiredWithBuffer) {
  throw new InsufficientBalanceError(exchange, requiredWithBuffer, balance.available);
}
```

**Alternatives Considered**:
- 無緩衝: 可能因滑點導致餘額不足
- 20% 緩衝: 過於保守，限制用戶的資金使用效率
- 預先凍結: 交易所 API 不支援

---

### 4. 回滾策略

**Decision**: 最多 3 次重試，指數退避

**Rationale**:
- 回滾失敗可能是暫時性網路問題
- 需要快速完成以減少風險暴露時間
- 3 次重試在速度和可靠性之間取得平衡

**Implementation**:
```typescript
const rollbackRetries = [0, 1000, 2000]; // 立即、1秒後、2秒後

for (const delay of rollbackRetries) {
  await sleep(delay);
  try {
    await connector.createOrder({
      symbol,
      side: oppositeSide,
      type: 'market',
      quantity: openedQuantity,
    });
    return { success: true };
  } catch (error) {
    logger.warn({ attempt: i, error }, 'Rollback attempt failed');
  }
}

// 所有重試都失敗
return { success: false, requiresManualIntervention: true };
```

**Alternatives Considered**:
- 無限重試: 可能無限阻塞，不實際
- 單次嘗試: 成功率太低
- 更長延遲: 增加風險暴露時間

---

### 5. 交易所 API 最佳實踐

#### Binance Futures API

**開倉**:
```typescript
// POST /fapi/v1/order
{
  symbol: 'BTCUSDT',
  side: 'BUY' | 'SELL',
  type: 'MARKET',
  quantity: 0.1,
  positionSide: 'BOTH', // 單向持倉模式
}
```

**設定槓桿**:
```typescript
// POST /fapi/v1/leverage
{
  symbol: 'BTCUSDT',
  leverage: 2,
}
```

**查詢餘額**:
```typescript
// GET /fapi/v2/balance
// 返回 USDT 的 availableBalance
```

#### OKX API

**開倉**:
```typescript
// POST /api/v5/trade/order
{
  instId: 'BTC-USDT-SWAP',
  tdMode: 'cross', // 全倉模式
  side: 'buy' | 'sell',
  ordType: 'market',
  sz: '0.1',
  posSide: 'long' | 'short', // 雙向持倉
}
```

**設定槓桿**:
```typescript
// POST /api/v5/account/set-leverage
{
  instId: 'BTC-USDT-SWAP',
  lever: '2',
  mgnMode: 'cross',
}
```

#### MEXC API

**開倉**: 使用 CCXT 抽象
```typescript
await exchange.createOrder('BTC/USDT:USDT', 'market', 'buy', 0.1);
```

#### Gate.io API

**開倉**: 使用 CCXT 抽象
```typescript
await exchange.createOrder('BTC/USDT:USDT', 'market', 'buy', 0.1);
```

---

### 6. 前端狀態管理

**Decision**: React Query + Local State

**Rationale**:
- 開倉對話框是臨時 UI，不需要全局狀態
- 餘額查詢可以使用 React Query 緩存
- 開倉進度使用 local state 即可

**Implementation**:
```typescript
// 餘額查詢
const { data: balances } = useQuery({
  queryKey: ['balances', exchanges],
  queryFn: () => fetchBalances(exchanges),
  refetchInterval: 5000, // 每 5 秒刷新
});

// 開倉 mutation
const openPosition = useMutation({
  mutationFn: (params) => fetch('/api/positions/open', { ... }),
  onSuccess: () => router.push('/positions'),
  onError: (error) => toast.error(error.message),
});
```

**Alternatives Considered**:
- Redux: 過度設計，此功能不需要複雜狀態管理
- Zustand: 可行，但 React Query 已足夠
- Server Components: 開倉需要用戶交互，需要 Client Component

---

### 7. 錯誤處理分類

**Decision**: 分類處理，區分可重試和不可重試錯誤

| 錯誤類型 | 可重試 | 處理方式 |
|----------|--------|----------|
| 網路超時 | 是 | 自動重試 |
| Rate Limit | 是 | 等待後重試 |
| 餘額不足 | 否 | 立即失敗，提示用戶 |
| 無效參數 | 否 | 立即失敗，記錄日誌 |
| 交易所維護 | 否 | 立即失敗，提示用戶 |
| 訂單被拒絕 | 否 | 立即失敗，顯示原因 |

**Implementation**:
```typescript
class ExchangeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly exchange: string,
    public readonly retryable: boolean,
  ) {
    super(message);
  }
}
```

---

## Summary

所有技術決策已完成，無待澄清項目。主要技術選型：

1. **Saga Pattern**: Orchestration-based，由 PositionOrchestrator 協調
2. **並發控制**: Redis 分散式鎖 + 前端按鈕禁用
3. **餘額驗證**: 即時查詢 + 10% 緩衝
4. **回滾策略**: 3 次重試，指數退避（0ms, 1000ms, 2000ms）
5. **前端狀態**: React Query + Local State
6. **錯誤處理**: 分類處理，區分可重試和不可重試
