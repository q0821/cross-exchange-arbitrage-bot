# Research: API Key 連線測試

**Feature**: 042-api-key-connection-test
**Date**: 2025-12-24

## 1. Gate.io API 驗證方法

**Decision**: 使用 CCXT 的 `gateio` 交易所類別，透過 `fetchBalance()` 進行連線測試

**Rationale**:
- 專案已依賴 CCXT 4.x，無需新增額外依賴
- 現有 `GateioConnector` 已使用 CCXT 實作
- `fetchBalance()` 可驗證 API Key 有效性和讀取權限
- 保持與 Binance/OKX 相同的驗證模式

**Alternatives considered**:
- `gateapi-nodejs` 官方 SDK - 需新增依賴，增加維護成本
- 直接 REST API - 需手動實作 HMAC-SHA512 簽名

**實現細節**:
```typescript
const exchange = new ccxt.gateio({
  apiKey,
  secret: apiSecret,
  options: { defaultType: 'swap' }
});
const balance = await exchange.fetchBalance();
```

---

## 2. MEXC API 驗證方法

**Decision**: 使用 CCXT 的 `mexc` 交易所類別，透過 `fetchBalance()` 進行連線測試

**Rationale**:
- 專案已依賴 CCXT 4.x，現有 `MexcConnector` 已使用
- MEXC 官方不提供 Node.js SDK
- CCXT 已處理 HMAC-SHA256 簽名邏輯
- 保持與其他交易所一致的驗證模式

**Alternatives considered**:
- 自製 REST API + 簽名 - 增加複雜度和維護成本
- 第三方非官方 SDK - 維護狀態不明

**實現細節**:
```typescript
const exchange = new ccxt.mexc({
  apiKey,
  secret: apiSecret,
  options: { defaultType: 'swap' }
});
const balance = await exchange.fetchBalance();
```

---

## 3. CCXT 統一 API 方案

**Decision**: 使用 CCXT 作為統一的 API Key 驗證方案

**Rationale**:
- 專案已依賴 CCXT 4.x 作為多交易所抽象層
- 現有 `ApiKeyValidator` 已使用 CCXT 驗證 Binance 和 OKX
- `fetchBalance()` 在所有支援的交易所上一致可用
- 減少程式碼重複，易於維護

**驗證策略**:
1. **連線測試**: `fetchBalance()` - 驗證 API Key 有效性
2. **讀取權限**: `fetchBalance()` 成功即表示有讀取權限
3. **交易權限**: 各交易所方法不同：
   - Binance: 從 `fapiPrivateV2GetAccount()` 回應中檢查 permissions
   - OKX: 嘗試 `privateGetAccountConfig()`
   - Gate.io/MEXC: 僅驗證讀取權限（交易權限需實際下單才能確認）

**Alternatives considered**:
- 各交易所獨立 SDK - 增加依賴和複雜度
- 無統一方案 - 程式碼重複，維護困難

---

## 4. 前端 API 請求超時處理

**Decision**: 使用 `AbortController` + 後端超時控制

**Rationale**:
- `AbortController` 是原生 Web 標準，無額外依賴
- 支援 Node.js 20.x 和瀏覽器環境
- 可在請求中斷時正確清理資源

**超時策略**:
| 層級 | 超時時間 | 用途 |
|------|---------|------|
| 交易所 API | 10 秒 | 單次 API 呼叫 |
| 後端總體 | 15 秒 | 包含重試邏輯 |
| 前端請求 | 20 秒 | 包含網路延遲 |

**實現模式**:
```typescript
// 後端
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15000);
try {
  const result = await validateApiKey(params, { signal: controller.signal });
  return Response.json({ success: true, data: result });
} catch (error) {
  if (error.name === 'AbortError') {
    return Response.json({ error: 'Request timeout' }, { status: 408 });
  }
  throw error;
} finally {
  clearTimeout(timeout);
}

// 前端
const response = await fetch('/api/api-keys/test', {
  method: 'POST',
  body: JSON.stringify(data),
  signal: AbortSignal.timeout(20000)
});
```

**Alternatives considered**:
- axios timeout - 需額外依賴
- 無前端超時 - 用戶體驗差

---

## 5. 各交易所驗證矩陣

| 交易所 | 驗證方法 | 讀取權限 | 交易權限 | 特殊需求 |
|--------|---------|---------|---------|---------|
| Binance | `fapiPrivateV2GetAccount()` | ✅ | ✅ (從 permissions 檢查) | testnet 支援 |
| OKX | `fetchBalance()` + `privateGetAccountConfig()` | ✅ | ✅ | passphrase 必需 |
| Gate.io | `fetchBalance()` | ✅ | ⚠️ (僅能確認讀取) | - |
| MEXC | `fetchBalance()` | ✅ | ⚠️ (僅能確認讀取) | - |

**注意**: Gate.io 和 MEXC 無法在不實際下單的情況下驗證交易權限，將在 UI 上說明此限制。

---

## 6. 錯誤訊息對照表

| 錯誤類型 | 原始訊息 (含) | 用戶友善訊息 |
|---------|--------------|-------------|
| 無效 API Key | `Invalid API-key` | 無效的 API Key |
| 簽名錯誤 | `Signature` | API Secret 錯誤 |
| IP 限制 | `IP` | IP 位址未加入白名單 |
| 權限不足 | `permission` | API 權限不足 |
| 超時 | `timeout`, `AbortError` | 連線逾時，請稍後再試 |
| 網路錯誤 | `ECONNREFUSED`, `ETIMEDOUT` | 無法連線到交易所 |

---

## 總結

1. **統一使用 CCXT** 作為各交易所的驗證抽象層
2. **擴展 ApiKeyValidator** 新增 `validateGateioKey()` 和 `validateMexcKey()`
3. **超時設定**: 交易所 10s → 後端 15s → 前端 20s
4. **權限檢查限制**: Gate.io/MEXC 僅能驗證讀取權限
