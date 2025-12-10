# Quickstart: 交易所資產追蹤和歷史曲線

**Feature**: `031-asset-tracking-history`

## Prerequisites

1. **Docker** - PostgreSQL 15 + TimescaleDB
2. **Node.js 20.x** + pnpm
3. **已設定交易所 API Key** - 至少一個交易所的 API Key

## Setup

### 1. 確保資料庫運行

```bash
pnpm docker:up
```

### 2. 執行 Migration

```bash
pnpm prisma migrate dev
```

### 3. 配置環境變數

在 `.env` 中新增（如有需要）：

```bash
# 資產快照服務
ENABLE_ASSET_SNAPSHOT=true
ASSET_SNAPSHOT_INTERVAL_MS=3600000  # 每小時 (1000 * 60 * 60)
```

### 4. 啟動開發伺服器

```bash
pnpm dev
```

## Testing

### 手動測試 API

```bash
# 獲取 JWT Token（先登入）
TOKEN="your-jwt-token"

# 查詢即時資產餘額
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/assets

# 手動刷新（從交易所 API 重新查詢）
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/assets?refresh=true"

# 查詢 7 天歷史曲線資料
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/assets/history?days=7"

# 查詢當前持倉
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/assets/positions
```

### 執行測試套件

```bash
# 單元測試
pnpm test:unit src/services/assets
pnpm test:unit src/repositories/AssetSnapshotRepository

# 整合測試
pnpm test:integration asset-snapshot
```

## File Structure

```
src/
├── services/
│   └── assets/
│       ├── AssetSnapshotService.ts      # 快照建立與查詢
│       ├── AssetSnapshotScheduler.ts    # 每小時排程
│       └── UserConnectorFactory.ts      # 用戶連接器工廠
├── repositories/
│   └── AssetSnapshotRepository.ts       # 資料存取層

app/(dashboard)/assets/
├── page.tsx                             # 資產總覽頁面
└── components/
    ├── AssetSummaryCard.tsx             # 交易所餘額卡片
    ├── TotalAssetCard.tsx               # 總資產摘要
    ├── AssetHistoryChart.tsx            # Recharts 曲線圖
    ├── PositionTable.tsx                # 持倉列表
    └── TimeRangeSelector.tsx            # 時間範圍選擇器

app/api/assets/
├── route.ts                             # GET /api/assets
├── history/route.ts                     # GET /api/assets/history
└── positions/route.ts                   # GET /api/assets/positions
```

## Key Components

### AssetSnapshotService

```typescript
// 建立快照
const service = new AssetSnapshotService(prisma, connectorFactory);
await service.createSnapshot(userId);

// 查詢歷史
const snapshots = await service.getSnapshots(userId, { days: 7 });

// 清理過期資料
await service.cleanupOldSnapshots(30);
```

### AssetSnapshotScheduler

```typescript
// 啟動排程服務
import { startAssetSnapshotScheduler } from './src/services/assets/AssetSnapshotScheduler';
await startAssetSnapshotScheduler();

// 手動觸發（用於測試）
import { manualSnapshotTrigger } from './src/services/assets/AssetSnapshotScheduler';
await manualSnapshotTrigger();

// 查詢狀態
import { getAssetSnapshotSchedulerStatus } from './src/services/assets/AssetSnapshotScheduler';
const status = getAssetSnapshotSchedulerStatus();
```

### UserConnectorFactory

```typescript
// 建立用戶的交易所連接器
const factory = new UserConnectorFactory(apiKeyService);
const connectors = await factory.getConnectorsForUser(userId);

// connectors: Map<ExchangeName, IExchangeConnector>
const binanceConnector = connectors.get('binance');
const balance = await binanceConnector?.getBalance();
```

## Development Notes

### 交易所連接器狀態

| 交易所 | getBalance() | getPositions() |
|--------|--------------|----------------|
| Binance | ✅ 已實作 | ⚠️ 需補完 |
| OKX | ✅ 已實作 | ✅ 已實作 |
| MEXC | ✅ 已實作 | ✅ 已實作 |
| Gate.io | ✅ 已實作 | ✅ 已實作 |

### Binance getPositions() 補完

需要實作 `/fapi/v2/positionRisk` API 呼叫：

```typescript
// src/connectors/binance.ts
async getPositions(): Promise<PositionInfo> {
  // 1. 簽名計算
  const timestamp = Date.now();
  const queryString = `timestamp=${timestamp}&recvWindow=5000`;
  const signature = crypto
    .createHmac('sha256', this.apiSecret)
    .update(queryString)
    .digest('hex');

  // 2. API 呼叫
  const response = await axios.get(
    `${this.baseUrl}/fapi/v2/positionRisk?${queryString}&signature=${signature}`,
    { headers: { 'X-MBX-APIKEY': this.apiKey } }
  );

  // 3. 轉換為 Position 介面
  return {
    exchange: 'binance',
    positions: response.data
      .filter((p: any) => Math.abs(parseFloat(p.positionAmt)) > 0)
      .map((p: any) => ({
        symbol: p.symbol,
        side: parseFloat(p.positionAmt) > 0 ? 'LONG' : 'SHORT',
        quantity: Math.abs(parseFloat(p.positionAmt)),
        entryPrice: parseFloat(p.entryPrice),
        markPrice: parseFloat(p.markPrice),
        leverage: parseInt(p.leverage),
        marginUsed: parseFloat(p.isolatedMargin),
        unrealizedPnl: parseFloat(p.unRealizedProfit),
        liquidationPrice: parseFloat(p.liquidationPrice) || undefined,
        timestamp: new Date(p.updateTime),
      })),
    timestamp: new Date(),
  };
}
```

## Troubleshooting

### 快照服務未啟動

1. 確認 `ENABLE_ASSET_SNAPSHOT=true`
2. 檢查 server.ts 是否有啟動 scheduler
3. 查看日誌: `grep "AssetSnapshotScheduler" logs/`

### API 查詢返回空資料

1. 確認用戶已設定 API Key
2. 確認 API Key 有 "讀取" 權限
3. 手動觸發快照: `POST /api/assets?refresh=true`

### 曲線圖無資料

1. 快照服務需要運行一段時間才有歷史資料
2. 測試時可手動建立測試資料:

```typescript
// scripts/seed-asset-snapshots.ts
import { prisma } from './src/lib/db';

const userId = 'your-user-id';
const now = new Date();

for (let i = 0; i < 168; i++) { // 7 天 × 24 小時
  await prisma.assetSnapshot.create({
    data: {
      userId,
      binanceBalanceUSD: 5000 + Math.random() * 100,
      okxBalanceUSD: 4000 + Math.random() * 80,
      mexcBalanceUSD: 3000 + Math.random() * 60,
      gateioBalanceUSD: 2000 + Math.random() * 40,
      totalBalanceUSD: 14000 + Math.random() * 280,
      binanceStatus: 'success',
      okxStatus: 'success',
      mexcStatus: 'success',
      gateioStatus: 'success',
      recordedAt: new Date(now.getTime() - i * 60 * 60 * 1000),
    },
  });
}
```
