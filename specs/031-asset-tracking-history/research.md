# Technical Research: 交易所資產追蹤和歷史曲線

**Feature**: `031-asset-tracking-history` | **Date**: 2025-12-11

## 研究項目

### 1. Binance 期貨持倉 API (`getPositions()`)

**問題**: 現有 `src/connectors/binance.ts` 的 `getPositions()` 為 TODO 狀態

**Decision**: 使用 `/fapi/v2/positionRisk` API 端點實作

**Rationale**:
- 官方推薦的 V2 端點，V1 已淘汰
- 返回所有持倉資訊，包含未實現盈虧、槓桿、強平價格等
- API 權重為 5，對 Rate Limit 影響小

**API 規格**:

| 項目 | 內容 |
|------|------|
| 端點 | `GET /fapi/v2/positionRisk` |
| 認證 | HMAC SHA256 簽名 (USER_DATA) |
| 請求頭 | `X-MBX-APIKEY: {apiKey}` |
| 必要參數 | `timestamp`, `signature` |
| 可選參數 | `symbol`, `recvWindow` |

**欄位對應**:

| Binance API | Position 介面 | 轉換 |
|-------------|---------------|------|
| `symbol` | `symbol` | 直接使用 |
| `positionSide` + `positionAmt` | `side` | BOTH+正數→LONG, BOTH+負數→SHORT |
| `positionAmt` | `quantity` | parseFloat, 取絕對值 |
| `entryPrice` | `entryPrice` | parseFloat |
| `markPrice` | `markPrice` | parseFloat |
| `leverage` | `leverage` | parseInt |
| `isolatedMargin` | `marginUsed` | parseFloat |
| `unRealizedProfit` | `unrealizedPnl` | parseFloat |
| `liquidationPrice` | `liquidationPrice` | parseFloat 或 undefined |
| `updateTime` | `timestamp` | new Date() |

**Alternatives Considered**:
- `/fapi/v3/positionRisk`: 效能更好（只返回有持倉的交易對），但需評估 API 版本支援
- CCXT 封裝：需要替換現有 @binance/connector，改動較大

---

### 2. 排程服務實作模式

**Decision**: 遵循 `OIRefreshService` 的 setInterval 模式

**Rationale**:
- 現有專案已有成熟的排程服務模式
- 無需引入新的排程依賴（如 node-cron）
- 與 server.ts 的生命週期管理無縫整合

**核心架構**:

```typescript
class AssetSnapshotScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private readonly updateInterval: number; // 1 hour = 3600000ms
  private lastUpdateTime: Date | null = null;
  private consecutiveFailures: number = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 3;

  async start(): Promise<void>
  async stop(): Promise<void>
  async refresh(): Promise<void>  // 手動觸發
  getStatus(): StatusObject
}
```

**模組導出**:
```typescript
export async function startAssetSnapshotScheduler(): Promise<void>
export async function stopAssetSnapshotScheduler(): Promise<void>
export function getAssetSnapshotSchedulerStatus(): SchedulerStatus
export async function manualSnapshotTrigger(): Promise<void>
```

**server.ts 整合**:
- 在 `httpServer.listen()` 回調中啟動
- 在 `shutdown()` 函數中停止
- 支援 `ENABLE_ASSET_SNAPSHOT=true` 環境變數控制

**錯誤處理模式**:
- 連續失敗計數器，超過閾值時警告
- 非阻塞 catch，不中斷服務
- 詳細 Pino 結構化日誌

**Alternatives Considered**:
- node-cron: 功能強大但增加依賴，且 setInterval 已足夠
- 資料庫觸發器: 無法控制精確時間，且增加資料庫負載

---

### 3. 前端圖表實作

**Decision**: 使用 Recharts AreaChart with stacked series

**Rationale**:
- Recharts 2.15.4 已安裝於專案
- 與 React 18.3.1 完全相容
- AreaChart 適合展示趨勢和累積資產

**技術規格**:
- `ResponsiveContainer`: 自適應容器寬度
- `AreaChart with stackId`: 堆疊各交易所面積
- `multiple Area elements`: 每個交易所一個系列
- `Tooltip + Legend`: 互動式資訊顯示

**配色方案**:
| 交易所 | 品牌色 | Hex |
|--------|--------|-----|
| Binance | 黃色 | #F3BA2F |
| OKX | 黑色 | #000000 |
| MEXC | 綠色 | #00B897 |
| Gate.io | 藍色 | #2354E6 |
| 總資產 | 灰色 | #6B7280 |

**資料格式**:
```typescript
interface ChartDataPoint {
  timestamp: string;  // ISO 8601
  binance: number;    // USD
  okx: number;
  mexc: number;
  gate: number;
  total: number;
}
```

**Alternatives Considered**:
- Chart.js: 需要額外安裝，Recharts 已可用
- D3.js: 過於底層，開發成本高
- Tremor Charts: 需要額外安裝

---

### 4. 資料清理策略

**Decision**: 使用每日 Prisma deleteMany 批次清理

**Rationale**:
- 簡單直接，無需額外基礎設施
- 可在每小時快照任務後順帶執行
- 符合 30 天保留政策

**清理邏輯**:
```typescript
await prisma.assetSnapshot.deleteMany({
  where: {
    recordedAt: {
      lt: subDays(new Date(), 30)
    }
  }
});
```

**執行時機**:
- 每次快照任務完成後
- 非同步執行，不阻塞主流程
- 每日只需執行一次（記錄上次清理時間）

**Alternatives Considered**:
- PostgreSQL pg_cron: 需要額外設定，增加運維複雜度
- TimescaleDB 自動壓縮: 此表規模不大，不需要
- TTL Index: PostgreSQL 原生不支援

---

### 5. 並行快照處理

**Decision**: 使用 Promise.allSettled 並行處理用戶

**Rationale**:
- 100 用戶每小時快照需要高效處理
- `allSettled` 確保部分失敗不影響其他用戶
- 可控制並行數量避免 Rate Limit

**實作策略**:
```typescript
// 每批處理 10 個用戶
const BATCH_SIZE = 10;
const batches = chunk(users, BATCH_SIZE);

for (const batch of batches) {
  const results = await Promise.allSettled(
    batch.map(user => createSnapshotForUser(user.id))
  );

  // 記錄成功/失敗統計
  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  // 批次間延遲，避免 Rate Limit
  await sleep(1000);
}
```

**Alternatives Considered**:
- 單一順序處理: 太慢，100 用戶需要太長時間
- 全部並行: 可能超出 API Rate Limit
- 訊息佇列: 增加基礎設施複雜度，目前規模不需要

---

## 未解決問題

1. **Binance totalEquityUSD**: 現有 `getBalance()` 的 `totalEquityUSD` 為 TODO，需要補完
2. **MEXC/Gate.io 連接器**: 需確認 CCXT 的 `fetchBalance()` 返回格式
3. **WebSocket 即時更新**: Phase 5 優化項目，初期可先用 polling

---

## 參考資源

- [Binance Position Information V2 API](https://developers.binance.com/docs/derivatives/usds-margined-futures/trade/rest-api/Position-Information-V2)
- [Recharts AreaChart Documentation](https://recharts.org/en-US/api/AreaChart)
- [Prisma deleteMany](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference#deletemany)
