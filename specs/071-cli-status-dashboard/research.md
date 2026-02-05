# Research: CLI 狀態儀表板

**Feature**: 071-cli-status-dashboard
**Date**: 2026-02-04

---

## 研究項目

### R1: TTY 偵測與終端機控制

**決策**: 使用 Node.js 原生 `process.stdout.isTTY` 進行偵測

**理由**:
- Node.js 原生支援，無需額外依賴
- 可靠且跨平台（Linux/macOS/Windows）
- 效能開銷為零（僅為布林值檢查）

**替代方案評估**:
| 方案 | 優點 | 缺點 | 結論 |
|------|------|------|------|
| `process.stdout.isTTY` | 原生、零依賴 | 無 | ✅ 採用 |
| `is-interactive` 套件 | 更多檢查 | 額外依賴 | ❌ 過度設計 |
| 環境變數強制 | 可配置 | 需額外管理 | 作為補充選項 |

**清屏方式**:
- TTY 環境：使用 ANSI 控制碼 `\x1B[2J\x1B[0;0H`（清屏並移動游標至左上角）
- 非 TTY 環境：直接輸出日誌格式（無控制碼）

---

### R2: 公開 IP 查詢服務

**決策**: 使用 ipify API (`https://api.ipify.org?format=json`)

**理由**:
- 免費、無需 API key
- 簡單 JSON 回應：`{"ip": "x.x.x.x"}`
- 高可用性和低延遲
- 支援 IPv4 和 IPv6

**替代方案評估**:
| 服務 | 可靠性 | 格式 | 結論 |
|------|--------|------|------|
| ipify.org | 高 | JSON | ✅ 採用 |
| icanhazip.com | 高 | 純文字 | 備用選項 |
| ipinfo.io | 高 | JSON | 需 API key 有限流 |
| checkip.amazonaws.com | 高 | 純文字 | 備用選項 |

**實作策略**:
- 啟動時查詢一次並快取（IP 不常變動）
- 設定 5 秒 timeout
- 失敗時顯示 "無法取得" 並不影響其他功能
- 快取有效期 5 分鐘（可透過刷新間隔自然更新）

---

### R3: 既有元件整合點分析

**已識別的整合點**:

| 元件 | 路徑 | 提供資訊 | 整合方式 |
|------|------|----------|----------|
| `MonitorStatsTracker` | `src/services/monitor/MonitorStats.ts` | uptime, 套利機會數, 錯誤計數 | 呼叫 `getStats()` |
| `getMemoryStats()` | `src/lib/memory-monitor.ts` | 記憶體使用量 | 直接呼叫 |
| `DataSourceManager` | `src/services/monitor/DataSourceManager.ts` | WebSocket 連線狀態 | 呼叫 `getSummary()` |
| `FundingRateMonitor` | `src/services/monitor/FundingRateMonitor.ts` | 監控交易對數量 | 呼叫 `getMonitoredSymbols()` |
| `ACTIVE_EXCHANGES` | `src/lib/exchanges/constants.ts` | 活躍交易所清單 | 直接引用 |
| `process.env.PROXY_URL` | 環境變數 | Proxy 設定 | 直接讀取 |

**決策**: 所有整合採用「讀取」模式，不修改既有元件的公開介面

---

### R4: 刷新機制設計

**決策**: 使用 `setInterval` + 非同步收集

**理由**:
- 簡單直觀，符合 10 秒刷新需求
- 非同步收集允許資料來源獨立失敗
- 可透過 `clearInterval` 優雅停止

**實作細節**:
```
┌─────────────────────────────────────────────────────────────┐
│                      StatusDashboard                        │
├─────────────────────────────────────────────────────────────┤
│  start()                                                    │
│    └─> 初始化收集器                                          │
│    └─> 首次渲染                                              │
│    └─> 啟動 setInterval(refresh, 10000)                     │
│                                                             │
│  refresh()                                                  │
│    └─> Promise.allSettled([                                 │
│          systemCollector.collect(),                         │
│          businessCollector.collect(),                       │
│          connectionCollector.collect()                      │
│        ])                                                   │
│    └─> renderer.render(collectedData)                       │
│                                                             │
│  stop()                                                     │
│    └─> clearInterval                                        │
│    └─> 清理資源                                              │
└─────────────────────────────────────────────────────────────┘
```

**異常處理**:
- 使用 `Promise.allSettled` 確保單一收集器失敗不影響其他
- 失敗的收集器回傳 `null` 或預設值
- 渲染器負責處理 null 值並顯示 "載入中..." 或 "無法取得"

---

### R5: 環境變數設計

**決策**: 新增以下環境變數

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `ENABLE_CLI_DASHBOARD` | `true` | 是否啟用 CLI 狀態儀表板 |
| `CLI_DASHBOARD_INTERVAL_MS` | `10000` | 刷新間隔（毫秒） |
| `CLI_DASHBOARD_FORCE_TTY` | `false` | 強制啟用 TTY 模式（除錯用） |

**理由**:
- 符合 FR-009 要求（可透過環境變數控制）
- 提供彈性配置選項
- 與既有環境變數命名風格一致

---

## 技術決策摘要

| 項目 | 決策 | 備註 |
|------|------|------|
| TTY 偵測 | `process.stdout.isTTY` | 原生支援 |
| 清屏方式 | ANSI 控制碼 | `\x1B[2J\x1B[0;0H` |
| 公開 IP | ipify API | 啟動時查詢並快取 |
| 刷新機制 | setInterval | 10 秒間隔 |
| 錯誤處理 | Promise.allSettled | 單一收集器失敗不影響整體 |
| 環境變數 | ENABLE_CLI_DASHBOARD | 控制啟用/停用 |

---

## 風險評估

| 風險 | 機率 | 影響 | 緩解措施 |
|------|------|------|----------|
| ipify 服務不可用 | 低 | 低 | 提供備用服務，失敗時顯示友善訊息 |
| 收集器阻塞主執行緒 | 低 | 中 | 所有 I/O 操作使用非同步 |
| 記憶體洩漏 | 低 | 高 | 停止時清理 interval 和監聽器 |
| ANSI 控制碼相容性 | 低 | 低 | TTY 偵測自動降級 |
