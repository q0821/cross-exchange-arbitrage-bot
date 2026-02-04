# Quickstart: CLI 狀態儀表板

**Feature**: 071-cli-status-dashboard
**Date**: 2026-02-04

---

## 功能概述

CLI 狀態儀表板在程式啟動後自動顯示系統即時狀態，每 10 秒自動刷新。

## 啟用方式

儀表板預設啟用。可透過環境變數控制：

```bash
# 停用儀表板
ENABLE_CLI_DASHBOARD=false pnpm dev

# 調整刷新間隔（毫秒）
CLI_DASHBOARD_INTERVAL_MS=5000 pnpm dev

# 強制 TTY 模式（除錯用）
CLI_DASHBOARD_FORCE_TTY=true pnpm dev
```

## 顯示範例

### TTY 模式（互動式終端機）

```
╔══════════════════════════════════════════════════════════════╗
║              跨交易所套利機器人 - 狀態儀表板                    ║
╠══════════════════════════════════════════════════════════════╣
║  系統狀態                                                     ║
║  ├─ 運行時間: 2h 15m 30s                                     ║
║  ├─ 記憶體:   384 MB / 512 MB (75%)                          ║
║  ├─ Proxy:   啟用 (192.168.2.254:3128)                       ║
║  └─ IP:      203.0.113.42                                    ║
╠══════════════════════════════════════════════════════════════╣
║  業務指標                                                     ║
║  ├─ 套利機會:   12 個                                         ║
║  ├─ 監控交易對: 85 組                                         ║
║  └─ 交易所:     5 個 (Binance, OKX, Gate.io, BingX, MEXC)    ║
╠══════════════════════════════════════════════════════════════╣
║  WebSocket 連線                                               ║
║  ├─ Binance:  ● 已連線                                        ║
║  ├─ OKX:      ● 已連線                                        ║
║  ├─ Gate.io:  ● 已連線                                        ║
║  ├─ BingX:    ● 已連線                                        ║
║  └─ MEXC:     ○ REST 模式                                     ║
╠══════════════════════════════════════════════════════════════╣
║  錯誤統計: 3 次                                                ║
║  最後更新: 2026-02-04 14:30:45                                ║
╚══════════════════════════════════════════════════════════════╝
```

### 非 TTY 模式（日誌輸出）

```json
{
  "level": "info",
  "time": "2026-02-04T14:30:45.123Z",
  "context": "cli-dashboard",
  "uptime": "2h 15m 30s",
  "memory": { "used": 384, "total": 512, "percent": 75 },
  "proxy": { "enabled": true, "url": "192.168.2.254:3128" },
  "publicIp": "203.0.113.42",
  "opportunities": 12,
  "symbols": 85,
  "exchanges": 5,
  "wsStatus": { "connected": 4, "total": 5 },
  "errors": 3
}
```

## 架構簡圖

```
┌────────────────────────────────────────────────────────┐
│                   StatusDashboard                      │
│                                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   System    │  │  Business   │  │ Connection  │    │
│  │  Collector  │  │  Collector  │  │  Collector  │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
│         │                │                │           │
│         └────────────────┼────────────────┘           │
│                          ▼                            │
│                   ┌─────────────┐                     │
│                   │  Renderer   │                     │
│                   │ (TTY/Log)   │                     │
│                   └─────────────┘                     │
└────────────────────────────────────────────────────────┘
```

## 開發指引

### 新增收集項目

1. 在 `types.ts` 定義新類型
2. 建立對應的 Collector
3. 在 `StatusDashboard.ts` 註冊收集器
4. 更新兩個 Renderer 的輸出邏輯

### 測試

```bash
# 執行單元測試
pnpm test tests/unit/cli/status-dashboard

# 執行整合測試
pnpm test tests/integration/cli/status-dashboard
```

## 相關文件

- [spec.md](./spec.md) - 功能規格
- [plan.md](./plan.md) - 實作計畫
- [research.md](./research.md) - 技術研究
- [data-model.md](./data-model.md) - 資料模型
