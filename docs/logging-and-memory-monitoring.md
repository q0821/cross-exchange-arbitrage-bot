# 日誌與記憶體監控架構

本文件說明專案的日誌系統架構與記憶體監控機制。

## 目錄

- [日誌系統架構](#日誌系統架構)
- [記憶體監控系統](#記憶體監控系統)
- [WebSocket 連線監控](#websocket-連線監控)
- [使用範例](#使用範例)
- [故障排除](#故障排除)

---

## 日誌系統架構

### 概述

專案使用 [Pino](https://github.com/pinojs/pino) 作為日誌框架，依照 log level 分流到不同目錄，方便問題追蹤和告警設定。

### 目錄結構

```
logs/
├── YYYY-MM-DD.log      # 完整日誌（所有 level）
├── warning/
│   └── YYYY-MM-DD.log  # 警告日誌（warn only）
├── critical/
│   └── YYYY-MM-DD.log  # 嚴重錯誤（error, fatal）
└── memory/
    └── YYYY-MM-DD.log  # 記憶體監控日誌
```

### Log Level 分流規則

| Level | 目錄 | 說明 |
|:------|:-----|:-----|
| `trace`, `debug`, `info` | `logs/` | 一般日誌，完整記錄 |
| `warn` | `logs/warning/` | 警告，需關注但非緊急 |
| `error`, `fatal` | `logs/critical/` | 嚴重錯誤，需立即處理 |
| memory snapshot | `logs/memory/` | 記憶體監控專用日誌 |

### 主要檔案

| 檔案 | 說明 |
|:-----|:-----|
| `src/lib/logger.ts` | 主要 logger，處理 level 分流 |
| `src/lib/memory-logger.ts` | 記憶體監控專用 logger |

### 使用方式

```typescript
import { logger, createLogger } from '@/lib/logger';

// 使用預設 logger
logger.info('一般訊息');
logger.warn({ userId }, '使用者操作警告');
logger.error({ error: err.message }, '發生錯誤');

// 使用領域 logger（自動加上 context）
const tradingLogger = createLogger('trading');
tradingLogger.info({ orderId }, 'Order placed');
```

### 預設領域 Logger

```typescript
import {
  exchangeLogger,  // 交易所 API 相關
  tradingLogger,   // 交易操作相關
  arbitrageLogger, // 套利邏輯相關
  wsLogger,        // WebSocket 相關
  dbLogger,        // 資料庫相關
} from '@/lib/logger';
```

---

## 記憶體監控系統

### 概述

記憶體監控系統（Feature 066）提供：

1. **定期記憶體快照** - 定期記錄 Node.js 記憶體使用狀況（預設每 5 分鐘）
2. **資料結構大小追蹤** - 監控各服務的 Map/Set/EventEmitter 大小
3. **Delta 變化量追蹤** - 識別潛在的記憶體洩漏
4. **WebSocket 連線統計** - 追蹤各交易所的 WS 連線數和訂閱數

### 核心元件

```
┌─────────────────────────────────────────────────────────────────┐
│                     Memory Monitor                               │
│                   (src/lib/memory-monitor.ts)                    │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  getMemoryStats  │  │ DataStructure-   │  │ MemoryDelta-  │  │
│  │  (Node.js 記憶體) │  │ Registry         │  │ Tracker       │  │
│  └────────┬─────────┘  │ (服務統計收集)    │  │ (變化量計算)  │  │
│           │            └────────┬─────────┘  └───────┬───────┘  │
│           │                     │                    │          │
│           └─────────────────────┼────────────────────┘          │
│                                 ▼                               │
│                        ┌───────────────┐                        │
│                        │ memoryLogger  │                        │
│                        │ (寫入 log)    │                        │
│                        └───────┬───────┘                        │
└────────────────────────────────┼────────────────────────────────┘
                                 ▼
                    logs/memory/YYYY-MM-DD.log
```

### DataStructureRegistry

資料結構註冊中心，收集各服務的統計資訊。

#### 支援兩種註冊方式

1. **動態註冊** - 適用於多實例服務
   ```typescript
   // 在 ConnectionPool 建構函數中
   DataStructureRegistry.register(`ConnectionPool:${exchange}`, this);
   ```

2. **Singleton Getter** - 適用於單例服務（延遲載入，避免循環依賴）
   ```typescript
   // 在 initializeSingletonGetters() 中
   DataStructureRegistry.registerSingletonGetter('RatesCache', () => {
     const { RatesCache } = require('@/services/monitor/RatesCache');
     return RatesCache.getInstance();
   });
   ```

#### 已註冊的服務

| 服務名稱 | 註冊方式 | 監控內容 |
|:---------|:---------|:---------|
| `RatesCache` | Singleton | 資金費率快取大小 |
| `PositionWsHandler` | Singleton | WebSocket handler 狀態 |
| `DataSourceManager` | Singleton | 數據源狀態 |
| `TriggerDetector` | Singleton | 觸發偵測器狀態 |
| `ConnectionPoolManager` | Singleton | **WebSocket 連線數彙總** |
| `ConnectionPool:${exchange}` | 動態 | 各交易所連線池詳細資料 |

### Monitorable 介面

所有需要監控的服務必須實作此介面：

```typescript
interface Monitorable {
  getDataStructureStats(): DataStructureStats;
}

interface DataStructureStats {
  name: string;                           // 服務名稱
  sizes: Record<string, number>;          // 各資料結構大小
  totalItems: number;                     // 總項目數
  eventListenerCount?: number;            // EventEmitter listener 數
  details?: Record<string, unknown>;      // 額外診斷資訊
}
```

---

## WebSocket 連線監控

### 架構說明

```
┌─────────────────────────────────────────────────────────────────┐
│                  ConnectionPoolManager (Singleton)               │
│                                                                  │
│  totalItems = wsConnections（重點監控指標）                       │
│                                                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │ConnectionPool│ │ConnectionPool│ │ConnectionPool│ │ConnectionPool││
│  │  (binance)   │ │   (okx)     │ │  (gateio)   │ │  (bingx)    ││
│  │             │ │             │ │             │ │             ││
│  │ connections │ │ connections │ │ connections │ │ connections ││
│  │  ┌───┐      │ │  ┌───┐      │ │  ┌───┐      │ │  ┌───┐      ││
│  │  │WS1│      │ │  │WS1│      │ │  │WS1│      │ │  │WS1│      ││
│  │  └───┘      │ │  └───┘      │ │  ├───┤      │ │  └───┘      ││
│  │             │ │             │ │  │WS2│      │ │             ││
│  │             │ │             │ │  ├───┤      │ │             ││
│  │             │ │             │ │  │WS3│      │ │             ││
│  │             │ │             │ │  └───┘      │ │             ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 各交易所連線限制

| 交易所 | 每連線最大訂閱數 | 說明 |
|:-------|:-----------------|:-----|
| Binance | 無嚴格限制 | 使用 Combined Streams |
| OKX | 100 | 超過時自動建立新連線 |
| Gate.io | 20 | 超過時自動建立新連線 |
| BingX | 50 | 超過時自動建立新連線 |

### 連線數計算範例

假設監控 68 個交易對：

| 交易所 | 需要連線數 | 計算方式 |
|:-------|:----------|:---------|
| Binance | 1 | Combined Streams |
| OKX | 1 | 68 < 100 |
| Gate.io | 4 | ceil(68/20) = 4 |
| BingX | 2 | ceil(68/50) = 2 |
| **總計** | **8** | |

### 日誌輸出格式

`logs/memory/YYYY-MM-DD.log` 中的 ConnectionPoolManager 區塊：

```json
{
  "name": "ConnectionPoolManager",
  "items": 8,
  "listeners": 0,
  "sizes": {
    "exchanges": 4,
    "wsConnections": 8,
    "subscriptions": 272
  },
  "details": {
    "poolDetails": {
      "binance": { "connections": 1, "subscriptions": 68 },
      "okx": { "connections": 1, "subscriptions": 68 },
      "gateio": { "connections": 4, "subscriptions": 68 },
      "bingx": { "connections": 2, "subscriptions": 68 }
    }
  }
}
```

### 欄位說明

| 欄位 | 說明 |
|:-----|:-----|
| `items` / `totalItems` | WebSocket 連線總數 |
| `wsConnections` | WebSocket 連線總數（同上，更明確的命名）|
| `exchanges` | 交易所數量 |
| `subscriptions` | 訂閱的交易對總數 |
| `poolDetails` | 各交易所的連線數和訂閱數明細 |

---

## 使用範例

### 環境變數設定

記憶體監控可透過環境變數控制：

| 環境變數 | 預設值 | 說明 |
|:---------|:-------|:-----|
| `ENABLE_MEMORY_MONITOR` | `true` | 是否啟用記憶體監控 |
| `MEMORY_MONITOR_INTERVAL_MS` | `300000` | 監控間隔（毫秒），預設 5 分鐘 |
| `ENABLE_HEAP_SNAPSHOT` | `false` | 是否啟用 heap snapshot 自動抓取 |
| `HEAP_SNAPSHOT_THRESHOLD_MB` | `100` | Heap 增長閾值，超過才觸發 snapshot |

**建議設定：**

```bash
# 正式環境（預設值，常規監控，不抓 snapshot）
ENABLE_MEMORY_MONITOR=true
MEMORY_MONITOR_INTERVAL_MS=300000   # 5 分鐘
ENABLE_HEAP_SNAPSHOT=false

# 開發環境或問題排查（密集監控 + heap snapshot）
ENABLE_MEMORY_MONITOR=true
MEMORY_MONITOR_INTERVAL_MS=60000    # 1 分鐘
ENABLE_HEAP_SNAPSHOT=true
HEAP_SNAPSHOT_THRESHOLD_MB=100

# 高負載環境（降低開銷）
ENABLE_MEMORY_MONITOR=true
MEMORY_MONITOR_INTERVAL_MS=600000   # 10 分鐘
ENABLE_HEAP_SNAPSHOT=false

# 完全關閉記憶體監控
ENABLE_MEMORY_MONITOR=false
```

**⚠️ Heap Snapshot 注意事項：**

- `v8.writeHeapSnapshot()` 會**暫停主執行緒**數秒至數十秒（取決於 heap 大小）
- Snapshot 檔案可能達到數百 MB，需注意磁碟空間
- 建議僅在問題排查時臨時啟用，排查完畢後關閉

### 啟動記憶體監控

記憶體監控會在 MonitorService 啟動時根據環境變數自動開啟。也可以手動控制：

```typescript
import { startMemoryMonitor, stopMemoryMonitor } from '@/lib/memory-monitor';

// 啟動（每 60 秒記錄一次）
startMemoryMonitor(60000);

// 停止
stopMemoryMonitor();
```

### 手動取得記憶體統計

```typescript
import { getExtendedMemoryStats } from '@/lib/memory-monitor';

const stats = getExtendedMemoryStats();
console.log(stats.heapUsed);                    // Heap 使用量 (MB)
console.log(stats.dataStructures.totalItems);   // 資料結構總項目數
console.log(stats.dataStructureDetails);        // 各服務詳細統計
```

### 實作自訂服務的監控

```typescript
import type { DataStructureStats, Monitorable } from '@/types/memory-stats';
import { DataStructureRegistry } from '@/lib/data-structure-registry';

class MyService implements Monitorable {
  private cache = new Map<string, unknown>();

  constructor() {
    // 註冊到監控系統
    DataStructureRegistry.register('MyService', this);
  }

  getDataStructureStats(): DataStructureStats {
    return {
      name: 'MyService',
      sizes: {
        cache: this.cache.size,
      },
      totalItems: this.cache.size,
    };
  }

  destroy() {
    // 取消註冊
    DataStructureRegistry.unregister('MyService');
  }
}
```

---

## 故障排除

### 記憶體使用量持續增長

1. 檢查 `logs/memory/` 日誌中的 `topGrowers` 欄位
2. 識別增長最快的服務
3. 檢查該服務的 `sizes` 明細，找出是哪個資料結構在增長

### WebSocket 連線數異常

1. 檢查 `ConnectionPoolManager` 的 `wsConnections` 值
2. 比對 `poolDetails` 確認是哪個交易所的連線數異常
3. 檢查對應交易所的訂閱數是否超出預期

### 日誌分析指令

```bash
# 查看最新的記憶體快照
tail -1 logs/memory/$(date +%Y-%m-%d).log | jq .

# 查看 WebSocket 連線統計
tail -1 logs/memory/$(date +%Y-%m-%d).log | jq '.services[] | select(.name == "ConnectionPoolManager")'

# 查看 Heap 使用趨勢
cat logs/memory/$(date +%Y-%m-%d).log | jq -r '.heap.used' | tail -10

# 查看增長最快的服務
tail -1 logs/memory/$(date +%Y-%m-%d).log | jq '.summary.topGrowers'
```

### 告警閾值

| 指標 | 警告閾值 | 錯誤閾值 |
|:-----|:---------|:---------|
| Heap 使用量 | > 1GB | > 2GB |
| 單次 items 增長 | > 10 | - |

---

## 相關檔案

| 檔案 | 說明 |
|:-----|:-----|
| `src/lib/logger.ts` | 主要日誌模組 |
| `src/lib/memory-logger.ts` | 記憶體日誌模組 |
| `src/lib/memory-monitor.ts` | 記憶體監控核心 |
| `src/lib/memory-delta-tracker.ts` | Delta 變化追蹤 |
| `src/lib/data-structure-registry.ts` | 資料結構註冊中心 |
| `src/services/websocket/ConnectionPoolManager.ts` | WebSocket 連線管理器 |
| `src/services/websocket/ConnectionPool.ts` | 連線池實作 |
| `src/types/memory-stats.ts` | 型別定義 |
