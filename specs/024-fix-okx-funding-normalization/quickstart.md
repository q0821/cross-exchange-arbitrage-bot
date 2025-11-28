# Quick Start: OKX 資金費率標準化修復

**Feature**: 024-fix-okx-funding-normalization
**Branch**: `024-fix-okx-funding-normalization`
**Estimated Time**: 4-6 hours

---

## 目標

修正 OKX 資金費率間隔偵測邏輯，確保標準化計算準確。當前問題是系統在多個降級點誤用預設 8 小時值，導致實際間隔不同時（如 1 小時或 4 小時）標準化計算錯誤。

---

## 前置條件

### 1. 環境設定

```bash
# 確認 Node.js 版本
node --version  # 應該是 v20.x

# 確認專案依賴已安裝
pnpm install

# 確認測試框架運作正常
pnpm test --run
```

### 2. 了解現有實作

閱讀以下檔案：

| 檔案 | 說明 | 重點區域 |
|------|------|---------|
| `src/connectors/okx.ts` | OKX connector 實作 | L98-169 (`getFundingInterval`) |
| `src/lib/FundingIntervalCache.ts` | 快取機制 | 全檔案 |
| `tests/unit/connectors/okx.test.ts` | OKX 單元測試 | 間隔偵測相關測試 |
| `tests/integration/okx-funding-rate-validation.test.ts` | OKX 整合測試 | 費率驗證測試 |

### 3. 分支管理

```bash
# 切換到功能分支（已由 speckit 建立）
git checkout 024-fix-okx-funding-normalization

# 確認分支狀態
git status

# 確認上游分支
git branch -vv
```

---

## 開發流程

### Phase 1: 設定和環境驗證（15 分鐘）

#### Step 1.1: 驗證現有問題

執行診斷腳本（待實作）確認問題存在：

```bash
# 這個腳本會在任務執行階段建立
# node scripts/test-okx-funding-interval.mjs
```

**預期輸出**：
- 部分交易對使用預設 8 小時值
- CCXT 和 Native API 結果可能不一致
- 日誌顯示「using default 8h」警告

#### Step 1.2: 執行現有測試

```bash
# 執行 OKX connector 測試
pnpm test okx.test.ts --run

# 執行整合測試
pnpm test okx-funding-rate-validation.test.ts --run
```

**預期結果**：
- 所有測試應該通過（現有測試只驗證基本功能）
- 注意任何與間隔相關的警告日誌

---

### Phase 2: 實作核心修復（2-3 小時）

#### Step 2.1: 增強 CCXT 路徑日誌

**檔案**: `src/connectors/okx.ts`

**目標**: 在 `getFundingInterval()` 方法中新增詳細日誌

**修改區域**: L113-143

**實作要點**：
```typescript
// 在成功計算間隔後加入日誌
logger.info(
  {
    symbol,
    interval: intervalHours,
    source: 'calculated',
    fundingTime: new Date(fundingTime).toISOString(),
    nextFundingTime: new Date(nextFundingTime).toISOString(),
  },
  'Funding interval calculated from OKX timestamps'
);
```

**驗證**：
```bash
# 啟動監控服務並查看日誌
pnpm start

# 查找 OKX 相關日誌
grep "Funding interval" logs/*.log
```

#### Step 2.2: 實作 Native API 降級

**檔案**: `src/connectors/okx.ts`

**目標**: 實作 Native API 備援方案

**新增方法**：
```typescript
private async getFundingIntervalFromNativeAPI(symbol: string): Promise<number>
```

**整合到 getFundingInterval()**：
```typescript
// 在 CCXT 失敗時呼叫
if (!fundingTimeStr || !nextFundingTimeStr) {
  logger.warn({ symbol }, 'CCXT timestamps missing, trying Native API');

  try {
    const nativeInterval = await this.getFundingIntervalFromNativeAPI(symbol);
    this.intervalCache.set('okx', symbol, nativeInterval, 'native-api');
    return nativeInterval;
  } catch (nativeError) {
    logger.error({ symbol, error: nativeError }, 'Native API also failed');
    // 降級到預設值
    this.intervalCache.set('okx', symbol, 8, 'default');
    return 8;
  }
}
```

**驗證**：
```typescript
// 新增單元測試
it('should fall back to Native API when CCXT fails', async () => {
  // Mock CCXT 失敗
  // 驗證 Native API 被呼叫
  // 驗證快取來源為 'native-api'
});
```

#### Step 2.3: 實作間隔驗證層

**檔案**: `src/connectors/okx.ts`

**目標**: 驗證並四捨五入間隔值

**新增方法**：
```typescript
private validateAndRoundInterval(
  calculatedHours: number,
  symbol: string
): { interval: number; rounded: boolean; deviation: number }
```

**整合到計算流程**：
```typescript
const intervalHours = (nextFundingTime - fundingTime) / 3600000;

// 驗證並四捨五入
const validated = this.validateAndRoundInterval(intervalHours, symbol);

if (validated.rounded) {
  logger.info(
    {
      symbol,
      original: intervalHours,
      rounded: validated.interval,
      deviation: validated.deviation,
    },
    'Interval rounded to nearest standard value'
  );
}

return validated.interval;
```

**驗證**：
```bash
pnpm test validateAndRoundInterval --run
```

---

### Phase 3: 擴充快取機制（30 分鐘）

#### Step 3.1: 更新 FundingIntervalCache

**檔案**: `src/lib/FundingIntervalCache.ts`

**目標**: 新增 `getWithMetadata()` 方法

**實作**：
```typescript
getWithMetadata(
  exchange: string,
  symbol: string
): CachedIntervalMetadata | null {
  const key = this.generateKey(exchange, symbol);
  const cached = this.cache.get(key);

  if (!cached) {
    this.stats.misses++;
    return null;
  }

  const now = Date.now();
  const age = now - cached.timestamp;

  if (age > cached.ttl) {
    this.cache.delete(key);
    this.stats.misses++;
    return null;
  }

  this.stats.hits++;

  return {
    ...cached,
    exchange,
    symbol,
    isExpired: false,
    remainingTTL: cached.ttl - age,
  };
}
```

**驗證**：
```bash
pnpm test FundingIntervalCache.test.ts --run
```

#### Step 3.2: 更新 source 類型

**變更**: `'api'` → `'native-api'`

**影響檔案**：
- `src/lib/FundingIntervalCache.ts` - 類型定義
- `src/connectors/binance.ts` - 使用 `'native-api'`

**實作**：
```typescript
// 更新類型定義
export type IntervalSource = 'native-api' | 'calculated' | 'default';

// 更新 Binance connector
this.intervalCache.set('binance', symbol, interval, 'native-api');
```

---

### Phase 4: 建立診斷工具（45 分鐘）

#### Step 4.1: 建立診斷腳本

**檔案**: `scripts/test-okx-funding-interval.mjs`

**目標**: 對比 CCXT 和 Native API 結果

**實作範例**：
```javascript
import ccxt from 'ccxt';
import axios from 'axios';

const TEST_SYMBOLS = [
  'BTC-USDT-SWAP',
  'ETH-USDT-SWAP',
  'SOL-USDT-SWAP',
  // ... 更多交易對
];

async function testCCXT(symbol) {
  // 實作 CCXT 查詢邏輯
}

async function testNativeAPI(symbol) {
  // 實作 Native API 查詢邏輯
}

async function runDiagnostic() {
  // 執行對比測試
  // 輸出表格格式結果
}

runDiagnostic().catch(console.error);
```

**執行**：
```bash
node scripts/test-okx-funding-interval.mjs
```

**預期輸出**：
```
Symbol          | CCXT Interval | Native Interval | Match | Deviation
----------------|---------------|-----------------|-------|----------
BTC-USDT-SWAP   | 8h            | 8h              | ✓     | 0h
ETH-USDT-SWAP   | 8h            | 8h              | ✓     | 0h
...
```

---

### Phase 5: 完整測試覆蓋（1-1.5 小時）

#### Step 5.1: 單元測試

**檔案**: `tests/unit/connectors/okx-interval-detection.test.ts`

**測試案例**：
```typescript
describe('OKX Interval Detection', () => {
  describe('CCXT Path', () => {
    it('should calculate interval from valid timestamps');
    it('should handle missing fundingTime');
    it('should handle missing nextFundingTime');
    it('should handle invalid timestamp format');
    it('should handle nextFundingTime <= fundingTime');
  });

  describe('Native API Path', () => {
    it('should fetch interval from Native API');
    it('should handle 51001 error (invalid instId)');
    it('should handle 50011 error (rate limit)');
    it('should handle network timeout');
  });

  describe('Interval Validation', () => {
    it('should accept standard intervals (1, 4, 8)');
    it('should round 7.9 to 8');
    it('should round 8.1 to 8');
    it('should warn on large deviation (6h → 8h)');
    it('should reject non-positive intervals');
  });

  describe('Fallback Logic', () => {
    it('should use cached value if available');
    it('should try CCXT first');
    it('should fall back to Native API on CCXT failure');
    it('should use default 8h on all failures');
  });
});
```

**執行測試**：
```bash
pnpm test okx-interval-detection.test.ts --run
```

#### Step 5.2: 整合測試

**檔案**: `tests/integration/okx-funding-interval.test.ts`

**測試案例**：
```typescript
describe('OKX Funding Interval Integration', () => {
  it('should detect intervals for top 10 symbols', async () => {
    const symbols = ['BTCUSDT', 'ETHUSDT', ...];

    for (const symbol of symbols) {
      const interval = await okxConnector.getFundingInterval(symbol);
      expect([1, 4, 8]).toContain(interval);
    }
  });

  it('should compare CCXT and Native API results', async () => {
    // 同時呼叫兩種方法，驗證結果一致
  });

  it('should cache intervals correctly', async () => {
    // 第一次呼叫，驗證快取寫入
    // 第二次呼叫，驗證快取命中
  });
});
```

**執行測試**（需要網路連線）：
```bash
pnpm test okx-funding-interval.test.ts --run
```

---

### Phase 6: 驗證和調整（30 分鐘）

#### Step 6.1: 本地驗證

```bash
# 1. 執行所有測試
pnpm test --run

# 2. 類型檢查
pnpm tsc --noEmit

# 3. Lint 檢查
pnpm lint

# 4. 建置專案
pnpm build
```

#### Step 6.2: 手動測試

```bash
# 啟動監控服務
pnpm start

# 在另一個終端監控日誌
tail -f logs/*.log | grep "okx.*interval"

# 觀察：
# - 間隔偵測日誌是否包含來源標記
# - 是否有「using default」警告（應該很少）
# - 間隔值是否為 1, 4, 或 8
```

#### Step 6.3: 診斷工具驗證

```bash
# 執行診斷腳本
node scripts/test-okx-funding-interval.mjs

# 檢查輸出：
# - 匹配率應該 > 95%
# - 錯誤數量應該 < 5%
# - 執行時間應該 < 30 秒
```

---

## 常見問題

### Q1: CCXT fetchFundingRate 拋出異常

**症狀**：
```
Error: okx does not have market symbol ...
```

**原因**: 交易對符號格式錯誤

**解決方案**：
```typescript
// 確認使用 CCXT 格式
const ccxtSymbol = this.toCcxtSymbol(symbol); // BTC/USDT:USDT
```

### Q2: Native API 返回 51001 錯誤

**症狀**：
```json
{
  "code": "51001",
  "msg": "Instrument ID doesn't exist"
}
```

**原因**: instId 格式錯誤

**解決方案**：
```typescript
// 確認 instId 格式
const instId = this.toOkxInstId(symbol); // BTC-USDT-SWAP

// 驗證轉換邏輯
private toOkxInstId(symbol: string): string {
  const base = symbol.replace('USDT', '');
  return `${base}-USDT-SWAP`;
}
```

### Q3: 時間戳解析返回 NaN

**症狀**：
```
Invalid timestamps detected, using default 8h
```

**原因**: 時間戳字串包含非數字字元

**解決方案**：
```typescript
// 加入詳細日誌
logger.warn({
  symbol,
  fundingTimeRaw: fundingTimeStr,
  fundingTimeParsed: fundingTime,
  fundingTimeType: typeof fundingTimeStr,
}, 'Timestamp parsing details');

// 驗證字串格式
if (!/^\d+$/.test(fundingTimeStr)) {
  logger.error({ fundingTimeStr }, 'Timestamp contains non-digit characters');
}
```

### Q4: 測試失敗 - 限流錯誤

**症狀**：
```
OKX API Error [50011]: Too Many Requests
```

**原因**: 測試中連續呼叫 API 超過限流

**解決方案**：
```typescript
// 在測試中加入延遲
describe('OKX Integration', () => {
  it('should fetch multiple symbols', async () => {
    for (const symbol of symbols) {
      await okxConnector.getFundingInterval(symbol);
      await sleep(200); // 延遲 200ms
    }
  });
});
```

### Q5: 快取未命中

**症狀**: 每次查詢都執行 API 呼叫

**原因**: 快取鍵格式不一致

**解決方案**：
```typescript
// 確保交易對符號格式一致（統一大寫）
const normalizedSymbol = symbol.toUpperCase();

// 查詢快取
const cached = this.intervalCache.get('okx', normalizedSymbol);
```

---

## 效能檢查清單

### 開發階段

- [ ] 單元測試覆蓋率 > 90%
- [ ] 所有測試通過
- [ ] 無 TypeScript 錯誤
- [ ] 無 ESLint 警告
- [ ] 建置成功

### 整合測試階段

- [ ] 診斷工具匹配率 > 95%
- [ ] CCXT 和 Native API 結果一致
- [ ] 快取命中率 > 80%（第二次查詢）
- [ ] 預設值使用率 < 5%

### 生產準備

- [ ] 日誌包含偵測來源標記
- [ ] 間隔驗證邏輯運作正常
- [ ] Native API 降級機制有效
- [ ] 錯誤處理完整（不會導致服務中斷）
- [ ] 效能符合預期（間隔偵測 < 2 秒）

---

## 提交和合併

### 提交訊息格式

遵循 Conventional Commits 規範：

```bash
# 功能新增
git commit -m "feat(okx): 增強資金費率間隔偵測邏輯"

# Bug 修復
git commit -m "fix(okx): 修正時間戳解析錯誤處理"

# 測試
git commit -m "test(okx): 新增間隔驗證單元測試"

# 文件
git commit -m "docs(okx): 更新診斷工具使用說明"
```

### Pull Request 檢查清單

- [ ] 所有測試通過
- [ ] 程式碼審查完成
- [ ] CHANGELOG.md 已更新
- [ ] 文件已更新（如需要）
- [ ] 無衝突
- [ ] CI/CD 通過

### 合併後驗證

```bash
# 切換到 main 分支
git checkout main
git pull origin main

# 執行完整測試套件
pnpm test --run

# 啟動監控服務
pnpm start

# 監控 7 天，確認：
# - 無間隔偵測錯誤
# - 標準化計算正確
# - 套利機會判斷準確
```

---

## 監控和維護

### 生產環境監控

**關鍵指標**：
1. 間隔偵測成功率（目標 > 99%）
2. Native API 降級頻率（目標 < 5%）
3. 預設值使用頻率（目標 < 1%）
4. 快取命中率（目標 > 90%）

**監控腳本**（建議）：
```typescript
// 每小時執行
function monitorOkxIntervalHealth() {
  const allCache = intervalCache.getAllWithMetadata('okx');

  const stats = {
    total: allCache.length,
    calculated: allCache.filter(i => i.source === 'calculated').length,
    nativeApi: allCache.filter(i => i.source === 'native-api').length,
    default: allCache.filter(i => i.source === 'default').length,
  };

  logger.info(stats, 'OKX interval cache health check');

  // 警告：預設值使用率過高
  if (stats.default > stats.total * 0.01) {
    logger.warn('High default interval usage - investigation required');
  }
}
```

### 故障排除流程

1. **檢查日誌**：搜尋「using default」警告
2. **執行診斷工具**：`node scripts/test-okx-funding-interval.mjs`
3. **驗證 API 可用性**：手動呼叫 OKX API
4. **檢查快取狀態**：查看 `getStats()` 輸出
5. **重啟服務**：清空快取，重新偵測

---

## 相關資源

### 文件

- [Feature Spec](./spec.md) - 功能規格
- [Implementation Plan](./plan.md) - 實作計劃
- [Research Document](./research.md) - 技術研究
- [Data Model](./data-model.md) - 資料模型
- [OKX API Contract](./contracts/okx-api.md) - API 契約
- [Interval Cache Contract](./contracts/interval-cache.md) - 快取契約

### 外部資源

- [OKX API 文件](https://www.okx.com/docs-v5/en/#public-data-rest-api-get-funding-rate)
- [CCXT Documentation](https://docs.ccxt.com/)
- [Pino Logger](https://github.com/pinojs/pino)
- [Vitest Documentation](https://vitest.dev/)

### 專案檔案

- **主要實作**: `src/connectors/okx.ts`
- **快取實作**: `src/lib/FundingIntervalCache.ts`
- **單元測試**: `tests/unit/connectors/okx-interval-detection.test.ts`
- **整合測試**: `tests/integration/okx-funding-interval.test.ts`
- **診斷工具**: `scripts/test-okx-funding-interval.mjs`

---

**Document Version**: 1.0
**Last Updated**: 2025-01-27
**Maintained By**: Development Team
