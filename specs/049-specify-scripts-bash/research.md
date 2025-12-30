# Research: 交易操作驗證腳本

**Date**: 2025-12-29
**Feature**: 049-trading-validation-script

---

## 1. 如何透過 CLI 呼叫 Web API

### Decision: 使用 axios 直接呼叫本地 API

**Rationale**:
- 專案已使用 axios 作為 HTTP 客戶端
- 可以呼叫 `http://localhost:3000/api/*` 端點
- 確保測試的程式碼路徑與 Web 界面完全一致

**Alternatives Considered**:
- 直接呼叫服務層（PositionOrchestrator）：程式碼路徑不同，無法驗證 API 層
- 使用 fetch：需要額外 polyfill，axios 更穩定

**Implementation Pattern**:
```typescript
import axios from 'axios';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

async function openPosition(params: OpenPositionRequest): Promise<OpenPositionResponse> {
  const response = await axios.post(`${API_BASE}/api/positions/open`, params, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
  });
  return response.data;
}
```

---

## 2. 如何查詢交易所持倉和條件單

### Decision: 使用 CCXT 統一查詢 API

**Rationale**:
- 專案已使用 CCXT 4.x 作為多交易所抽象層
- `fetchPositions()` 和 `fetchOpenOrders()` 提供統一介面
- 條件單查詢需要使用交易所特定 API

**查詢方法**:

| 交易所 | 持倉查詢 | 條件單查詢 |
|--------|---------|-----------|
| Binance | `fetchPositions()` | `fetchOpenOrders(symbol)` + 過濾 STOP_MARKET |
| OKX | `fetchPositions()` | `privateGetTradeOrdersAlgoPending()` |
| Gate.io | `fetchPositions()` | `privateFuturesGetSettlePriceOrders()` |
| BingX | `fetchPositions()` | `fetchOpenOrders(symbol)` |

**Implementation Pattern**:
```typescript
class ExchangeQueryService {
  private exchange: ccxt.Exchange;

  async fetchPosition(symbol: string): Promise<ExchangePosition | null> {
    const positions = await this.exchange.fetchPositions([symbol]);
    return positions.find(p => p.symbol === symbol && Math.abs(p.contracts) > 0);
  }

  async fetchConditionalOrders(symbol: string): Promise<ExchangeConditionalOrder[]> {
    // 各交易所特定實現
  }
}
```

---

## 3. 如何驗證數量正確性（contractSize 問題）

### Decision: 比對前先轉換為統一單位

**Rationale**:
- 不同交易所的 contractSize 不同（有些是 1，有些是 10）
- 需要將合約張數轉換回幣本位數量進行比對
- 使用 CCXT 的 `market.contractSize` 進行轉換

**Validation Logic**:
```typescript
function validateQuantity(
  expectedQuantity: number,        // 幣本位（如 0.1 BTC）
  actualContracts: number,         // 合約張數
  market: ccxt.Market,
): ValidationResult {
  const contractSize = market.contractSize || 1;
  const actualQuantity = actualContracts * contractSize;

  const tolerance = 0.0001; // 0.01% 容差
  const isValid = Math.abs(expectedQuantity - actualQuantity) < tolerance * expectedQuantity;

  return {
    item: '數量驗證',
    expected: expectedQuantity,
    actual: actualQuantity,
    passed: isValid,
  };
}
```

---

## 4. 如何處理認證（API Key）

### Decision: 從資料庫讀取加密的 API Key

**Rationale**:
- 專案已有 ApiKey 模型和加密機制
- 使用現有的解密函數 `decryptApiKey()`
- 不需要用戶手動輸入 API Key

**Implementation Pattern**:
```typescript
import { PrismaClient } from '@prisma/client';
import { decryptApiKey } from '@/src/lib/crypto';

async function getApiKey(userId: string, exchange: string): Promise<DecryptedApiKey> {
  const prisma = new PrismaClient();
  const apiKey = await prisma.apiKey.findFirst({
    where: { userId, exchange, isActive: true },
  });

  if (!apiKey) {
    throw new Error(`No active API key found for ${exchange}`);
  }

  return decryptApiKey(apiKey);
}
```

---

## 5. 報告格式設計

### Decision: 結構化文字輸出 + JSON 選項

**Rationale**:
- 終端機可讀的文字格式作為預設
- 可選 JSON 格式供自動化處理
- 使用 emoji 增加可讀性

**Report Format**:
```
══════════════════════════════════════════════════════════════
交易驗證報告 - Gate.io BTCUSDT
══════════════════════════════════════════════════════════════
📍 驗證時間: 2025-12-29 10:30:45

📊 開倉驗證
✅ 交易對格式正確: BTCUSDT → BTC/USDT:USDT
✅ 開倉數量正確: 預期 0.01 BTC, 實際 0.01 BTC (1 張)
✅ contractSize 轉換: contractSize=0.01, 1 張 × 0.01 = 0.01 BTC

🛡️ 條件單驗證
✅ 停損單已建立: orderId=xxx
✅ 停損價格正確: 預期 $94,123.45, 實際 $94,123.45
✅ 停損數量正確: 1 張
✅ 停利單已建立: orderId=yyy
✅ 停利價格正確: 預期 $103,876.55, 實際 $103,876.55
✅ 停利數量正確: 1 張

📈 平倉驗證
✅ 平倉執行成功: 狀態 CLOSED
✅ 平倉數量正確: 預期 0.01 BTC, 實際 0.01 BTC

──────────────────────────────────────────────────────────────
結果: 11/11 通過 ✅
══════════════════════════════════════════════════════════════
```

---

## 6. CLI 參數設計

### Decision: 使用 commander 進行參數解析

**Commands**:
```bash
# 完整驗證（開倉→停損停利→平倉）
pnpm tsx src/scripts/trading-validation/validate-trading.ts run \
  --exchange gateio \
  --symbol BTCUSDT \
  --quantity 10 \
  --leverage 1 \
  --stop-loss 5 \
  --take-profit 5 \
  --user-id <userId>

# 查詢驗證（驗證現有持倉）
pnpm tsx src/scripts/trading-validation/validate-trading.ts verify \
  --position-id <positionId>

# 輸出 JSON 格式
pnpm tsx src/scripts/trading-validation/validate-trading.ts run \
  --exchange gateio \
  --symbol BTCUSDT \
  --quantity 10 \
  --json
```

---

## 7. 錯誤處理策略

### Decision: 繼續執行可行項目，完整報告錯誤

**Rationale**:
- 部分失敗不應終止整個驗證
- 完整報告讓用戶了解哪些項目通過、哪些失敗
- 特殊情況（如立即觸發）標記為「無法驗證」

**Error Categories**:
1. **致命錯誤**（終止驗證）：
   - API Key 不存在
   - 餘額不足
   - 交易所連線失敗

2. **可恢復錯誤**（繼續驗證）：
   - 停損設定失敗 → 標記為 ❌，繼續驗證停利
   - 查詢超時 → 重試 3 次後標記為 ⚠️

3. **跳過項目**：
   - 未啟用停損停利 → 跳過相關驗證項目
