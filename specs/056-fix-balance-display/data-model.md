# Data Model: 修復餘額顯示不一致問題

**Feature**: 056-fix-balance-display
**Date**: 2026-01-01

## 介面修改

### AccountBalance (修改)

**位置**: `src/connectors/types.ts`

```typescript
interface AccountBalance {
  exchange: ExchangeName;
  balances: Array<{
    asset: string;
    free: number;
    locked: number;
    total: number;
  }>;
  totalEquityUSD: number;        // 總權益（用於資產總覽）
  availableBalanceUSD: number;   // 可用餘額（用於開倉驗證）← 新增
  timestamp: Date;
}
```

### 欄位說明

| 欄位 | 用途 | 計算方式 |
|------|------|---------|
| `totalEquityUSD` | 資產總覽 | 可用餘額 + 持倉價值（保證金 + 未實現損益） |
| `availableBalanceUSD` | 開倉驗證 | 交易所帳戶中可自由使用的餘額 |

### 各交易所計算邏輯

```
Binance:
  availableBalanceUSD = balance.free['USDT']
  totalEquityUSD = balance.total['USDT'] (現有邏輯不變)

OKX:
  availableBalanceUSD = balance.free['USDT']
  totalEquityUSD = balance.total['USDT'] (現有邏輯不變)

BingX:
  availableBalanceUSD = balance.free['USDT']
  totalEquityUSD = balance.total['USDT'] (現有邏輯不變)

Gate.io:
  availableBalanceUSD = available (統一帳戶，現有邏輯不變)
  totalEquityUSD = available + Σ(margin + unrealised_pnl) ← 修改
```

## 無資料庫變更

此功能不需要修改 Prisma schema，只涉及運行時介面的擴展。
