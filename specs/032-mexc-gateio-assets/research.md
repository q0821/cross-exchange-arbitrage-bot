# Research: MEXC 和 Gate.io 資產追蹤

**Feature**: 032-mexc-gateio-assets
**Date**: 2025-12-11

## 研究問題

1. CCXT 4.x 是否支援 MEXC 和 Gate.io 的餘額和持倉查詢？
2. 現有連接器的 `getBalance()` 和 `getPositions()` 實作是否可直接參考？
3. 是否需要特殊的 API 權限或配置？

---

## 研究結果

### Q1: CCXT 支援度

**Decision**: CCXT 4.x 完整支援 MEXC 和 Gate.io

**Rationale**:
- 現有程式碼 `src/connectors/mexc.ts` 和 `src/connectors/gateio.ts` 已經使用 CCXT 實作完整的連接器
- `MexcConnector.getBalance()` (行 283-312) 和 `GateioConnector.getBalance()` (行 287-316) 已驗證可運作
- CCXT 的 `fetchBalance()` 和 `fetchPositions()` 方法支援兩個交易所

**Alternatives considered**:
- 直接使用交易所原生 API：更複雜，需處理簽名和格式轉換
- 使用官方 SDK：兩個交易所的官方 SDK 不如 CCXT 成熟

### Q2: 現有實作參考

**Decision**: 參考 `OkxUserConnector` 模式實作

**Rationale**:
- `OkxUserConnector` (UserConnectorFactory.ts 行 596-730) 已經示範如何使用 CCXT 建立輕量級用戶連接器
- 模式: 動態 import CCXT → 建立 exchange 實例 → 實作 `getBalance()` 和 `getPositions()`
- 程式碼約 80 行/連接器，易於維護

**關鍵實作細節**:

```typescript
// OkxUserConnector 模式
async connect(): Promise<void> {
  this.ccxt = await import('ccxt');
  this.exchange = new this.ccxt.okx({
    apiKey: this.apiKey,
    secret: this.apiSecret,
    password: this.passphrase,  // OKX 專用
    sandbox: this.isTestnet,
    options: { defaultType: 'swap' }
  });
}

async getBalance(): Promise<AccountBalance> {
  const balance = await this.exchange.fetchBalance();
  const totalUSD = balance.total?.USDT || balance.total?.USD || 0;
  // ... 格式化餘額資料
}
```

**MEXC 差異**:
- 不需要 `passphrase`
- 使用 `ccxt.mexc` 類別

**Gate.io 差異**:
- 不需要 `passphrase`
- 使用 `ccxt.gateio` 類別

### Q3: API 權限需求

**Decision**: 只需讀取權限

**Rationale**:
- `fetchBalance()` 只需要「讀取」權限
- `fetchPositions()` 只需要「讀取」權限
- 不涉及交易操作，不需要「交易」權限

**MEXC API 權限**:
- 需要啟用「讀取」權限
- 支援 IP 白名單（可選）

**Gate.io API 權限**:
- 需要啟用「讀取」權限
- 需要啟用「永續合約」權限（用於查詢期貨持倉）

---

## USD 總值計算

### 現有實作分析

兩個連接器目前都使用簡化的 USD 計算方式：

```typescript
// MexcConnector.getBalance() 行 300-301
const totalEquityUSD = balance.total['USDT'] as number || 0;

// GateioConnector.getBalance() 行 303-304
const totalEquityUSD = balance.total['USDT'] as number || 0;
```

**問題**: 只計算 USDT 餘額，忽略其他幣種

**解決方案**: 參考 `BinanceUserConnector.getBalance()` 的實作：
1. 如果是穩定幣 (USDT/USDC/BUSD)，直接加總
2. 其他幣種，使用 `{ASSET}USDT` 市場價格換算

```typescript
// 改進的 USD 計算
let totalEquityUSD = 0;
for (const [asset, total] of Object.entries(balance.total)) {
  if (['USDT', 'USD', 'USDC', 'BUSD'].includes(asset)) {
    totalEquityUSD += total as number;
  } else {
    // 可選：查詢價格換算
  }
}
```

**建議**: 第一版保持與現有連接器一致（只計算 USDT），未來可增強為多幣種換算。

---

## 錯誤處理

### 常見錯誤類型

| 錯誤 | 原因 | 處理方式 |
|------|------|---------|
| `AuthenticationError` | API Key 無效 | 返回 `api_error` 狀態 |
| `PermissionDenied` | 權限不足 | 返回 `api_error` 狀態 |
| `RateLimitExceeded` | 請求過於頻繁 | 返回 `rate_limited` 狀態 |
| `NetworkError` | 網路連線問題 | 返回 `api_error` 狀態 |

### 現有錯誤處理模式

`UserConnectorFactory.getBalancesForUser()` (行 150-194) 已有完善的錯誤處理：

```typescript
try {
  await connector.connect();
  const balance = await connector.getBalance();
  // success
} catch (error) {
  const isRateLimit = errorMessage.includes('rate limit') || errorMessage.includes('429');
  results.push({
    status: isRateLimit ? 'rate_limited' : 'api_error',
    errorMessage
  });
}
```

---

## 結論

此功能實作相對簡單，主要工作是：
1. 複製 `OkxUserConnector` 模式
2. 修改為 MEXC 和 Gate.io 的 CCXT 類別
3. 更新 `createConnector()` switch 語句

預估工作量：約 160 行新增程式碼
