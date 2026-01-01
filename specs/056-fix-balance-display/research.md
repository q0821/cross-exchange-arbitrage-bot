# Research: 各交易所餘額 API 分析

**Feature**: 056-fix-balance-display
**Date**: 2026-01-01

## 研究目標

確認各交易所如何獲取：
1. **可用餘額** (availableBalanceUSD) - 用於開倉驗證
2. **總權益** (totalEquityUSD) - 用於資產總覽

---

## 各交易所 API 分析

### 1. Binance

**現有實作**: `UserConnectorFactory.ts` (第 302-485 行)

| 欄位 | API 來源 | 含義 |
|------|---------|------|
| `free` | `/api/v3/account` | 可用餘額 |
| `locked` | `/api/v3/account` | 凍結餘額（保證金） |
| `totalWalletBalance` | `/papi/v1/balance` (Portfolio Margin) | 總權益 |

**Decision**: 使用 CCXT `balance.free['USDT']` 作為可用餘額
**Rationale**: CCXT 已封裝合約帳戶 API，返回標準化的 free/used/total 結構
**Alternatives**: 直接呼叫 `/fapi/v2/account` 獲取 `availableBalance`，但 CCXT 已處理

### 2. OKX

**現有實作**: `UserConnectorFactory.ts` (第 637-773 行)

| 欄位 | API 來源 | 含義 |
|------|---------|------|
| `balance.free[asset]` | CCXT fetchBalance | 可用餘額 |
| `balance.used[asset]` | CCXT fetchBalance | 已用保證金 |
| `balance.total['USDT']` | CCXT fetchBalance | 總權益 (USD) |

**Decision**: 使用 `balance.free['USDT']` 作為可用餘額
**Rationale**: CCXT 標準結構，直接可用
**Alternatives**: 無需額外 API 調用

### 3. Gate.io

**現有實作**: `UserConnectorFactory.ts` (第 919-1054 行)

| 欄位 | API 來源 | 含義 |
|------|---------|------|
| `unified_account_total_equity` | `/api/v4/unified/accounts` | 總權益 (包含持倉) |
| `available` | 統一帳戶 API | 可用餘額 |

**問題發現**: 現有實作使用 `unified_account_total_equity` 作為 `totalEquityUSD`，但這個值**已扣除持倉保證金**，導致資產總覽不一致。

**Decision**:
- `availableBalanceUSD`: 維持現有邏輯（統一帳戶 available）
- `totalEquityUSD`: 需要額外查詢持倉 API，計算 `available + 持倉價值`

**Rationale**: 統一帳戶的 equity 定義與其他交易所不同
**Alternatives**: 呼叫 `/api/v4/futures/usdt/positions` 獲取持倉，計算總權益

### 4. BingX

**現有實作**: `UserConnectorFactory.ts` (第 1135-1193 行)

| 欄位 | API 來源 | 含義 |
|------|---------|------|
| `balance.free[asset]` | CCXT fetchBalance (swap) | 可用餘額 |
| `balance.total['USDT']` | CCXT fetchBalance (swap) | 總權益 |

**Decision**: 使用 `balance.free['USDT']` 作為可用餘額
**Rationale**: CCXT 標準結構
**Alternatives**: 無需額外 API 調用

### 5. MEXC

**現有實作**: `UserConnectorFactory.ts` (第 779-913 行)

| 欄位 | API 來源 | 含義 |
|------|---------|------|
| `balance.free[asset]` | CCXT fetchBalance (swap) | 可用餘額 |
| `balance.total['USDT']` | CCXT fetchBalance (swap) | 總權益 |

**Decision**: 使用 `balance.free['USDT']` 作為可用餘額
**Rationale**: 與 BingX 相同處理方式
**Alternatives**: 無需額外 API 調用

---

## 統一對比表

| 交易所 | 可用餘額來源 | 總權益來源 | 需要修改 |
|--------|-------------|-----------|---------|
| Binance | `balance.free['USDT']` | `balance.total['USDT']` | ✅ 新增 availableBalanceUSD |
| OKX | `balance.free['USDT']` | `balance.total['USDT']` | ✅ 新增 availableBalanceUSD |
| Gate.io | `available` (現有) | 需額外查詢持倉計算 | ✅ 修改 totalEquityUSD 計算 |
| BingX | `balance.free['USDT']` | `balance.total['USDT']` | ✅ 新增 availableBalanceUSD |
| MEXC | `balance.free['USDT']` | `balance.total['USDT']` | ⚪ 可選（目前不在開倉範圍） |

---

## Gate.io 持倉價值計算

**API 端點**: `/api/v4/futures/usdt/positions`

**返回欄位**:
```json
{
  "contract": "BTC_USDT",
  "size": 100,
  "margin": "500",           // 佔用保證金
  "unrealised_pnl": "12.5"   // 未實現損益
}
```

**計算公式**:
```
持倉價值 = Σ(margin + unrealised_pnl) for all positions
總權益 = 可用餘額 + 持倉價值
```

---

## 結論

1. **Binance/OKX/BingX**: 使用 CCXT `balance.free['USDT']` 作為可用餘額，簡單直接
2. **Gate.io**: 需要額外呼叫持倉 API 來計算正確的總權益
3. **介面修改**: `AccountBalance` 新增 `availableBalanceUSD` 欄位
