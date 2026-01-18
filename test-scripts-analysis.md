# 測試腳本整合分析報告

生成時間：2026-01-18

## 概述

本文件分析專案中所有測試腳本（`test-*.ts/js/mjs`），評估其與現有測試案例的重疊性，並規劃整合策略。

## 測試腳本分類

### 📁 根目錄測試腳本

| 檔案 | 功能 | 現有測試覆蓋 | 整合策略 |
|------|------|--------------|----------|
| `test-db-connection.ts` | 測試資料庫連線、TimescaleDB 擴展、表格清單 | ❌ 無 | 整合到 `tests/integration/database-connection.test.ts` |
| `test-binance-funding-interval.js` | 測試幣安資金費率間隔 API | ✅ `tests/unit/connectors/BinanceConnector-funding-interval.test.ts` | **可移除**（已有完整測試） |
| `test-binance-interval-fix.mjs` | 測試幣安間隔修復 | ✅ 同上 | **可移除** |
| `test-gateio-funding-interval.mjs` | 測試 Gate.io 資金費率間隔 | ✅ `tests/unit/connectors/GateioConnector-funding-interval.test.ts` | **可移除** |
| `test-mexc-okx-intervals.mjs` | 測試 MEXC/OKX 間隔 | ✅ `tests/unit/connectors/MexcConnector-funding-interval.test.ts` | **可移除** |

### 📁 scripts/ 測試腳本

#### API 測試類

| 檔案 | 功能 | 現有測試覆蓋 | 整合策略 |
|------|------|--------------|----------|
| `test-balance-api.ts` | 測試 BalanceValidator.getBalances() | ✅ `tests/unit/services/trading/BalanceValidator.test.ts` | **可移除**（已有單元測試） |
| `test-balance-user1.ts` | 測試特定用戶餘額 | ✅ 同上 | **可移除** |
| `test-binance-api.ts` | 測試 Binance API 連線和解密 | ⚠️ 部分覆蓋 | 保留作為 **診斷工具**（手動測試 API Key） |
| `test-gateio-api.ts` | 測試 Gate.io API 連線 | ⚠️ 部分覆蓋 | 保留作為 **診斷工具** |
| `test-mexc-api.ts` | 測試 MEXC API 連線 | ⚠️ 部分覆蓋 | 保留作為 **診斷工具** |
| `test-okx-funding-interval.mjs` | 測試 OKX 資金費率間隔 | ✅ `tests/unit/connectors/okx-interval-detection.test.ts` | **可移除** |

#### Connector 測試類

| 檔案 | 功能 | 現有測試覆蓋 | 整合策略 |
|------|------|--------------|----------|
| `test-user-connector.ts` | 測試 UserConnectorFactory | ✅ `tests/unit/services/assets/UserConnectorFactory.test.ts` | **可移除** |
| `test-gateio-connector.ts` | 測試 GateioConnector | ✅ `tests/unit/connectors/gateio.test.ts` | **可移除** |

#### Trading 測試類

| 檔案 | 功能 | 現有測試覆蓋 | 整合策略 |
|------|------|--------------|----------|
| `test-open-position.ts` | 測試開倉流程 | ✅ `tests/integration/trading/position-orchestrator.test.ts` | **可移除** |
| `test-okx-position.ts` | 測試 OKX 持倉查詢 | ⚠️ 部分覆蓋 | 保留作為 **診斷工具** |
| `test-pm-balance.ts` | 測試 Portfolio Manager 餘額 | ❓ 需確認 | 待評估 |

#### 驗證測試類

| 檔案 | 功能 | 現有測試覆蓋 | 整合策略 |
|------|------|--------------|----------|
| `test-funding-rate-validation.ts` | 測試 FundingRateValidator | ✅ `tests/unit/services/validation/FundingRateValidator.test.ts` | **可移除** |

### 📁 scripts/manual-tests/ 手動測試腳本

這些腳本主要用於**開發階段的快速驗證**，不應整合為自動化測試：

| 檔案 | 功能 | 保留原因 |
|------|------|----------|
| `test-api.ts` | 通用 API 測試 | 開發診斷工具 |
| `test-conditional-orders.ts` | 測試條件單 API（真實交易） | **手動測試**（涉及真實訂單） |
| `test-open-close-position.ts` | 測試開倉平倉流程（真實交易） | **手動測試**（涉及真實倉位） |
| `test-bingx-*.ts` | BingX 交易所測試 | 開發診斷工具 |
| `test-mexc-*.ts` | MEXC 交易所測試 | 開發診斷工具 |
| `test-okx-*.ts` | OKX 交易所測試 | 開發診斷工具 |
| `test-gateio-conditional-price.ts` | Gate.io 條件單價格測試 | 開發診斷工具 |
| `test-db-apikey.ts` | 資料庫 API Key 查詢 | 開發診斷工具 |
| `test-funding-history.ts` | 資金費率歷史查詢 | 開發診斷工具 |
| `test-repo.ts` | Repository 測試 | 開發診斷工具 |
| `test-monitor-bingx.ts` | BingX 監控測試 | 開發診斷工具 |

## 整合計劃

### Phase 1: 移除冗餘腳本（已有完整測試覆蓋）

**立即移除**的腳本（共 9 個）：

```bash
# 根目錄
rm test-binance-funding-interval.js
rm test-binance-interval-fix.mjs
rm test-gateio-funding-interval.mjs
rm test-mexc-okx-intervals.mjs

# scripts/
rm scripts/test-balance-api.ts
rm scripts/test-balance-user1.ts
rm scripts/test-user-connector.ts
rm scripts/test-gateio-connector.ts
rm scripts/test-open-position.ts
rm scripts/test-okx-funding-interval.mjs
rm scripts/test-funding-rate-validation.ts
```

### Phase 2: 新增缺少的整合測試

**新增測試案例**：

1. **Database Connection Test**
   - 檔案：`tests/integration/database-connection.test.ts`
   - 來源：`test-db-connection.ts`
   - 測試內容：
     - PostgreSQL 連線
     - TimescaleDB 擴展檢查
     - 表格完整性驗證

### Phase 3: 重新組織診斷腳本

**保留但移至專用目錄**：

```
scripts/diagnostics/
├── api-key-test.ts          (整合 test-binance-api.ts, test-gateio-api.ts, test-mexc-api.ts)
├── position-query.ts        (test-okx-position.ts)
└── README.md                (診斷工具使用說明)
```

### Phase 4: 保留手動測試腳本

`scripts/manual-tests/` 目錄**完整保留**，這些腳本用於：
- 開發階段快速驗證新功能
- 真實交易所 API 測試（需真實 API Key）
- 問題診斷和調試

### Phase 5: 更新文件

需更新的文件：
- `docs/test/test.md` - 測試統計摘要
- `docs/test/integration-test.md` - 新增 INT-105 (Database Connection)
- `CLAUDE.md` - 更新測試相關命令和說明
- `scripts/diagnostics/README.md` - 新增診斷工具說明

## 測試覆蓋率分析

### 現有測試覆蓋情況

| 類別 | 腳本數量 | 已覆蓋 | 部分覆蓋 | 未覆蓋 |
|------|----------|--------|----------|--------|
| Funding Interval | 4 | 4 | 0 | 0 |
| Balance API | 2 | 2 | 0 | 0 |
| Connector | 2 | 2 | 0 | 0 |
| Trading | 2 | 1 | 1 | 0 |
| Validation | 1 | 1 | 0 | 0 |
| Database | 1 | 0 | 0 | 1 |
| Diagnostics | 3 | 0 | 3 | 0 |
| Manual Tests | 25 | 0 | 0 | 25 |

**總計**：
- 可移除（已完整覆蓋）：11 個腳本
- 需整合為測試：1 個（Database Connection）
- 保留為診斷工具：3 個
- 保留為手動測試：25 個

## 風險評估

### ✅ 低風險移除

以下腳本可安全移除（已有完整單元測試覆蓋）：
- 所有 funding interval 測試腳本
- Balance API 測試腳本
- Connector 測試腳本
- Funding Rate Validation 腳本

### ⚠️ 需確認

- `test-pm-balance.ts` - 需確認是否有對應測試

### 🛡️ 保留原則

- 所有 `scripts/manual-tests/*` 腳本保留
- 涉及真實 API 交互的診斷腳本保留
- 有助於問題診斷的工具腳本保留

## 執行順序

1. ✅ 建立本分析報告
2. 📝 撰寫新的整合測試（Database Connection）
3. 🧪 執行所有測試確保覆蓋率
4. 🗑️ 移除冗餘腳本
5. 📁 重組診斷腳本到 `scripts/diagnostics/`
6. 📚 更新文件
7. ✅ 提交 PR

## 預期成果

- **減少維護負擔**：移除 11 個冗餘腳本
- **提升測試覆蓋率**：新增 1 個整合測試
- **改善組織結構**：診斷工具集中管理
- **保留靈活性**：手動測試腳本完整保留
