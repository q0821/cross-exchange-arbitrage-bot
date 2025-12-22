# Quickstart: 修復開倉停損停利條件單設定

**Date**: 2025-12-23
**Feature**: 040-fix-conditional-orders

## 開發環境設定

### 前置需求

- Node.js 20.x LTS
- pnpm 8.x+
- PostgreSQL 15+ (Docker)
- 交易所 API Keys（測試網）

### 安裝依賴

```bash
pnpm install
```

### 環境變數

確保 `.env` 包含以下設定：

```bash
# Database
DATABASE_URL="postgresql://..."

# OKX Testnet API (for testing)
OKX_API_KEY="your-testnet-key"
OKX_API_SECRET="your-testnet-secret"
OKX_PASSPHRASE="your-passphrase"
OKX_SANDBOX=true

# Gate.io Testnet API (for testing)
GATEIO_API_KEY="your-testnet-key"
GATEIO_API_SECRET="your-testnet-secret"
GATEIO_SANDBOX=true
```

## TDD 開發流程

### Cycle 1: OKX 帳戶模式偵測

#### 🔴 Step 1 - 寫測試（Red）

```bash
# 創建測試檔案並撰寫測試案例
# 運行測試確認失敗
pnpm test tests/unit/services/ConditionalOrderAdapterFactory.test.ts --run
```

#### 🟢 Step 2 - 實作（Green）

```bash
# 實作 detectOkxPositionMode() 方法
# 運行測試確認通過
pnpm test tests/unit/services/ConditionalOrderAdapterFactory.test.ts --run
```

#### 🔵 Step 3 - 重構（Refactor）

```bash
# 增強日誌記錄
# 確認測試仍然通過
pnpm test tests/unit/services/ConditionalOrderAdapterFactory.test.ts --run
```

### Cycle 2: Gate.io 整數轉換

```bash
# Red
pnpm test tests/unit/services/GateioConditionalOrderAdapter.test.ts --run

# Green (修復後)
pnpm test tests/unit/services/GateioConditionalOrderAdapter.test.ts --run

# Refactor
pnpm test tests/unit/services/GateioConditionalOrderAdapter.test.ts --run
```

### Cycle 3: 價格驗證警告

```bash
# Red
pnpm test tests/unit/services/ConditionalOrderService.test.ts --run

# Green
pnpm test tests/unit/services/ConditionalOrderService.test.ts --run

# Refactor
pnpm test tests/unit/services/ConditionalOrderService.test.ts --run
```

## 驗證修復

### 運行所有測試

```bash
pnpm test tests/unit/services/ --run
```

### 手動測試（可選）

1. 啟動 Web 開發伺服器：
   ```bash
   pnpm dev
   ```

2. 在 Market Monitor 頁面選擇套利機會

3. 開倉並啟用停損停利

4. 檢查日誌確認：
   - OKX 帳戶模式正確偵測
   - Gate.io 合約數量正確轉換
   - 條件單設定成功

### 日誌檢查

查找以下日誌確認修復成功：

```
# OKX 帳戶模式偵測
{"level":"info","positionMode":"long_short_mode","msg":"Detected OKX position mode"}

# Gate.io 數量轉換
{"level":"info","originalQuantity":"0.5","sizeInt":1,"finalSize":-1,"msg":"Gate.io contract size conversion"}

# 條件單設定成功
{"level":"info","orderId":"123456","type":"stopLoss","msg":"OKX conditional order created successfully"}
```

## 常見問題

### Q: 測試失敗怎麼辦？

確保：
1. Mock 設定正確
2. CCXT Exchange 方法名稱正確
3. 參數格式符合交易所要求

### Q: 如何測試真實 API？

使用測試網環境：
1. 設定 `*_SANDBOX=true`
2. 使用測試網 API Keys
3. 確保測試網餘額充足
