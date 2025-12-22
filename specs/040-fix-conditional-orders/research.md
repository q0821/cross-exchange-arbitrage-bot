# Research: 修復開倉停損停利條件單設定

**Date**: 2025-12-23
**Feature**: 040-fix-conditional-orders

## 問題分析

### 問題 1: OKX 帳戶模式未偵測

**現狀**:
- `ConditionalOrderAdapterFactory.createOkxAdapter()` 硬編碼 `positionMode: 'long_short_mode'`
- 若用戶使用 `net_mode`，條件單參數不匹配導致失敗

**根本原因**:
- OKX 有兩種持倉模式：
  - `long_short_mode`: 多空分開計算，需指定 `posSide: 'long'` 或 `'short'`
  - `net_mode`: 淨倉位模式，使用 `posSide: 'net'`
- 未動態偵測導致參數錯誤

**解決方案**:
- 調用 OKX Account Config API 偵測 `posMode`
- API: `GET /api/v5/account/config` → `data[0].posMode`

---

### 問題 2: Gate.io parseInt 截斷

**現狀**:
```typescript
const sizeInt = Math.abs(parseInt(sizeValue.toString(), 10));
```

**根本原因**:
- `parseInt('0.5')` 返回 `0`，導致下單失敗
- Gate.io 合約以張數計算，最小為 1 張

**解決方案**:
```typescript
const sizeAbs = Math.abs(parseFloat(sizeValue.toString()));
const sizeInt = Math.max(1, Math.round(sizeAbs));
```

---

### 問題 3: 日誌不足

**現狀**:
- 條件單設定失敗時缺少完整上下文
- 無法快速定位問題

**解決方案**:
- 請求前：記錄完整參數（交易對、方向、數量、觸發價格、帳戶模式）
- 請求後：記錄 API 回應
- 失敗時：記錄完整錯誤和重試建議

---

## 技術決策

### Decision 1: OKX 帳戶模式偵測

**Decision**: 使用 CCXT `privateGetAccountConfig()` API 偵測

**Rationale**:
- OKX 官方 API，可靠性高
- CCXT 已封裝，無需直接調用 REST API
- 與現有 Binance 偵測模式一致

**Alternatives Considered**:
- 讓用戶手動配置帳戶模式 → 增加用戶負擔，易出錯
- 嘗試設定後再重試 → 浪費 API 配額，延遲高

---

### Decision 2: Gate.io 數量轉換

**Decision**: 使用 `Math.round()` + `Math.max(1, ...)`

**Rationale**:
- 四捨五入符合直覺
- 最小值 1 確保訂單有效
- 與 Gate.io 合約規格一致

**Alternatives Considered**:
- `Math.ceil()` → 可能導致數量偏大
- `Math.floor()` → 可能導致 0
- 直接用小數 → Gate.io 不支援小數張

---

### Decision 3: 日誌增強策略

**Decision**: 使用結構化日誌（Pino）記錄完整上下文

**Rationale**:
- 符合 Constitution Principle II (Complete Observability)
- 結構化日誌便於搜索和分析
- 與現有日誌基礎設施一致

**Log Format**:
```typescript
logger.info({
  exchange: 'okx',
  symbol: 'BTC-USDT-SWAP',
  side: 'LONG',
  type: 'stopLoss',
  triggerPrice: '50000.00',
  quantity: '0.1',
  accountMode: 'long_short_mode',
}, 'Setting conditional order');
```

---

## API 研究

### OKX Account Config API

**Endpoint**: `GET /api/v5/account/config`

**Response**:
```json
{
  "code": "0",
  "data": [{
    "acctLv": "2",
    "posMode": "long_short_mode",  // or "net_mode"
    "uid": "12345678"
  }]
}
```

**CCXT Method**: `ccxtExchange.privateGetAccountConfig()`

---

### Gate.io Price Order API

**Endpoint**: `POST /futures/{settle}/price_orders`

**Key Parameters**:
- `initial.size`: 整數，正數=買入，負數=賣出
- `trigger.rule`: 1 (>=) 或 2 (<=)

**CCXT Method**: `ccxtExchange.privateFuturesPostSettlePriceOrders()`

---

## 測試策略

### Unit Tests

| 測試檔案 | 測試案例 |
|---------|---------|
| `ConditionalOrderAdapterFactory.test.ts` | OKX 帳戶模式偵測（3 案例）|
| `GateioConditionalOrderAdapter.test.ts` | 合約數量轉換（5 案例）|
| `ConditionalOrderService.test.ts` | 價格驗證警告（2 案例）|

### Mock Strategy

- Mock CCXT Exchange instance
- Mock API responses for different account modes
- Verify correct parameters are passed

---

## 結論

所有技術決策已確定，無需進一步澄清。準備進入 Phase 1 設計階段。
