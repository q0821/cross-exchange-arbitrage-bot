# Data Model: CLI 狀態儀表板

**Feature**: 071-cli-status-dashboard
**Date**: 2026-02-04

---

## 實體定義

本功能不涉及資料庫 Schema 變更，以下為 TypeScript 介面定義。

### 核心類型

```typescript
// src/cli/status-dashboard/types.ts

/**
 * 系統狀態資訊
 */
export interface SystemStatus {
  /** 系統運行時間（秒） */
  uptimeSeconds: number;
  /** 格式化的運行時間 (e.g., "1h 23m 45s") */
  uptimeFormatted: string;
  /** Heap 已使用（MB） */
  heapUsedMB: number;
  /** Heap 總大小（MB） */
  heapTotalMB: number;
  /** Heap 使用率（%） */
  heapUsagePercent: number;
  /** 是否啟用 Proxy */
  proxyEnabled: boolean;
  /** Proxy URL（若啟用） */
  proxyUrl: string | null;
  /** 公開 IP 位址 */
  publicIp: string | null;
}

/**
 * 業務指標資訊
 */
export interface BusinessMetrics {
  /** 當前活躍套利機會數量 */
  activeOpportunities: number;
  /** 監控中的交易對數量 */
  monitoredSymbols: number;
  /** 已連接的交易所數量 */
  connectedExchanges: number;
  /** 交易所清單 */
  exchangeList: string[];
}

/**
 * 單一交易所連線狀態
 */
export interface ExchangeConnectionStatus {
  /** 交易所名稱 */
  exchange: string;
  /** WebSocket 連線狀態 */
  wsStatus: 'connected' | 'disconnected' | 'connecting' | 'unknown';
  /** 目前資料來源模式 */
  dataSourceMode: 'websocket' | 'rest' | 'unknown';
  /** 最後收到資料時間 */
  lastDataTime: Date | null;
}

/**
 * 連線狀態總覽
 */
export interface ConnectionStatus {
  /** 各交易所連線狀態 */
  exchanges: ExchangeConnectionStatus[];
  /** 整體連線健康度（0-100%） */
  overallHealth: number;
  /** 連線中的交易所數量 */
  connectedCount: number;
  /** 總交易所數量 */
  totalCount: number;
}

/**
 * 錯誤統計資訊
 */
export interface ErrorStats {
  /** 累計錯誤次數 */
  totalErrors: number;
  /** 最近錯誤時間 */
  lastErrorTime: Date | null;
}

/**
 * 儀表板完整狀態
 */
export interface DashboardState {
  /** 系統狀態 */
  system: SystemStatus | null;
  /** 業務指標 */
  business: BusinessMetrics | null;
  /** 連線狀態 */
  connection: ConnectionStatus | null;
  /** 錯誤統計 */
  errors: ErrorStats | null;
  /** 最後更新時間 */
  lastUpdated: Date;
  /** 收集是否成功 */
  collectSuccess: boolean;
}

/**
 * 儀表板配置
 */
export interface DashboardConfig {
  /** 是否啟用 */
  enabled: boolean;
  /** 刷新間隔（毫秒） */
  refreshIntervalMs: number;
  /** 是否強制 TTY 模式 */
  forceTty: boolean;
}
```

### 渲染器介面

```typescript
/**
 * 渲染器介面
 */
export interface IDashboardRenderer {
  /** 渲染儀表板狀態 */
  render(state: DashboardState): void;
  /** 清理資源 */
  cleanup(): void;
}
```

### 收集器介面

```typescript
/**
 * 狀態收集器介面
 */
export interface IStatusCollector<T> {
  /** 收集狀態資訊 */
  collect(): Promise<T | null>;
  /** 取得收集器名稱（用於錯誤報告） */
  getName(): string;
}
```

---

## 類別關係圖

```
┌─────────────────────────────────────────────────────────────────┐
│                       StatusDashboard                           │
│  ─────────────────────────────────────────────────────────────  │
│  - config: DashboardConfig                                      │
│  - renderer: IDashboardRenderer                                 │
│  - collectors: IStatusCollector[]                               │
│  - refreshTimer: NodeJS.Timeout | null                          │
│  ─────────────────────────────────────────────────────────────  │
│  + start(): Promise<void>                                       │
│  + stop(): void                                                 │
│  + refresh(): Promise<void>                                     │
│  - selectRenderer(): IDashboardRenderer                         │
└─────────────────────────────────────────────────────────────────┘
         │
         │ uses
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Collectors                               │
├─────────────────────────────────────────────────────────────────┤
│  SystemStatusCollector    ───▶  SystemStatus                    │
│    - monitorStats: MonitorStatsTracker                          │
│    - getMemoryStats()                                           │
│    - publicIpCache                                              │
├─────────────────────────────────────────────────────────────────┤
│  BusinessMetricsCollector ───▶  BusinessMetrics                 │
│    - monitorStats: MonitorStatsTracker                          │
│    - fundingRateMonitor: FundingRateMonitor                     │
│    - activeExchanges: ExchangeName[]                            │
├─────────────────────────────────────────────────────────────────┤
│  ConnectionStatusCollector ───▶ ConnectionStatus                │
│    - dataSourceManager: DataSourceManager                       │
└─────────────────────────────────────────────────────────────────┘
         │
         │ uses
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Renderers                                │
├─────────────────────────────────────────────────────────────────┤
│  TtyRenderer                                                    │
│    - 使用 ANSI 控制碼清屏                                        │
│    - 格式化輸出表格                                              │
│    - 顏色高亮（綠色=正常, 紅色=異常）                             │
├─────────────────────────────────────────────────────────────────┤
│  LogRenderer                                                    │
│    - 使用 Pino logger                                           │
│    - JSON 結構化輸出                                             │
│    - 無控制碼                                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 狀態轉換

本功能無複雜狀態機，儀表板僅有兩個狀態：

```
┌─────────┐     start()      ┌─────────┐
│ STOPPED │ ───────────────▶ │ RUNNING │
└─────────┘                  └─────────┘
     ▲                            │
     │         stop()             │
     └────────────────────────────┘
```

---

## 驗證規則

| 欄位 | 規則 | 預設值 |
|------|------|--------|
| `refreshIntervalMs` | >= 1000, <= 60000 | 10000 |
| `uptimeSeconds` | >= 0 | 0 |
| `heapUsagePercent` | 0-100 | 0 |
| `overallHealth` | 0-100 | 0 |
| `publicIp` | 有效 IPv4/IPv6 或 null | null |

---

## 與既有元件的關係

```
┌─────────────────────────────────────────────────────────────────┐
│                      既有元件（唯讀存取）                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  MonitorStatsTracker ◄────── SystemStatusCollector              │
│  (getStats, getFormattedUptime)  BusinessMetricsCollector       │
│                                                                 │
│  getMemoryStats() ◄────────── SystemStatusCollector             │
│  (memory-monitor.ts)                                            │
│                                                                 │
│  DataSourceManager ◄───────── ConnectionStatusCollector         │
│  (getSummary)                                                   │
│                                                                 │
│  FundingRateMonitor ◄──────── BusinessMetricsCollector          │
│  (getMonitoredSymbols)                                          │
│                                                                 │
│  ACTIVE_EXCHANGES ◄────────── BusinessMetricsCollector          │
│  (constants.ts)                                                 │
│                                                                 │
│  process.env.PROXY_URL ◄───── SystemStatusCollector             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 無資料庫變更聲明

✅ **本功能不需要 Prisma Schema 變更**

本功能為純展示層功能，所有資料均從現有元件的記憶體狀態讀取，不涉及：
- 新增資料表
- 修改現有 Schema
- Migration 檔案

符合 Constitution 原則四（資料完整性）的要求。
