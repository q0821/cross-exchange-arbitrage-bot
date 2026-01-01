# Quickstart: 修復餘額顯示不一致問題

**Feature**: 056-fix-balance-display
**Date**: 2026-01-01

## 前置需求

- Node.js 20.x LTS
- pnpm
- PostgreSQL 15+ with TimescaleDB
- 各交易所 API 金鑰（用於測試）

## 開發設置

```bash
# 切換到功能分支
git checkout 056-fix-balance-display

# 安裝依賴
pnpm install

# 確保資料庫運行中
docker compose up -d postgres redis

# 執行測試
pnpm test
```

## 修改範圍

### 1. 介面修改
```
src/connectors/types.ts
  └── AccountBalance 新增 availableBalanceUSD
```

### 2. 連接器修改
```
src/services/assets/UserConnectorFactory.ts
  ├── BinanceUserConnector.getBalance()
  ├── OkxUserConnector.getBalance()
  ├── BingxUserConnector.getBalance()
  └── GateioUserConnector.getBalance()
```

### 3. 餘額驗證修改
```
src/services/trading/BalanceValidator.ts
  └── getBalances() 改用 availableBalanceUSD
```

### 4. API 修改
```
app/api/balances/route.ts
  └── 返回 availableBalanceUSD 給前端
```

## 測試驗證

### 單元測試
```bash
pnpm test -- --grep "UserConnector"
pnpm test -- --grep "BalanceValidator"
```

### 手動驗證

1. **開倉餘額驗證**:
   - 在交易所開一個倉位（使用部分保證金）
   - 打開開倉對話框
   - 確認顯示的餘額是「可用餘額」而非「總餘額」

2. **資產總覽驗證**:
   - 在 Gate.io 有持倉的情況下查看資產總覽
   - 確認 Gate.io 資產包含持倉價值
   - 確認開/平倉時總資產不會大幅波動

## 驗收標準

- [ ] Binance 開倉顯示可用餘額
- [ ] OKX 開倉顯示可用餘額
- [ ] BingX 開倉顯示可用餘額
- [ ] Gate.io 資產總覽納入持倉價值
- [ ] 資產曲線不因開/平倉異常波動
