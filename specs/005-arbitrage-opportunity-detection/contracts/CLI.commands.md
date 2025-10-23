# CLI Commands Specification

**Feature**: 005-arbitrage-opportunity-detection
**Purpose**: 定義套利機會相關的 CLI 指令規格

## 概述

新增 3 個 CLI 指令到 `arb opportunities` 命名空間，用於查看當前機會、查詢歷史記錄和配置閾值。

---

## C1: arb opportunities list

### 用途

列出當前所有活躍的套利機會，按照費率差異由高到低排序。

### 語法

```bash
arb opportunities list [options]
```

### 選項

| 選項 | 簡寫 | 類型 | 預設值 | 說明 |
|-----|------|------|--------|------|
| `--symbol <SYMBOL>` | `-s` | string | - | 篩選特定交易對 |
| `--min-spread <PERCENT>` | `-m` | number | - | 最小費率差異（%）|
| `--format <FORMAT>` | `-f` | enum | table | 輸出格式（table, json, csv） |
| `--limit <N>` | `-l` | number | 10 | 限制顯示數量 |
| `--all` | `-a` | boolean | false | 顯示所有狀態的機會（包含 EXPIRED, CLOSED）|

### 輸出格式（Table）

```
Current Arbitrage Opportunities (5)
Updated: 2025-10-21 14:32:15

┌──────────┬────────────────┬─────────────────┬───────────┬─────────┬──────────────┬──────────┐
│ Symbol   │ Long Exchange  │ Short Exchange  │ Spread %  │ Annual% │ Duration     │ Notif.   │
├──────────┼────────────────┼─────────────────┼───────────┼─────────┼──────────────┼──────────┤
│ BTCUSDT  │ Binance        │ OKX             │ 0.0650    │ 71.18   │ 15m 32s      │ 3        │
│ ETHUSDT  │ OKX            │ Binance         │ 0.0520    │ 56.94   │ 8m 14s       │ 2        │
│ SOLUSDT  │ Binance        │ OKX             │ 0.0505    │ 55.30   │ 3m 42s       │ 1        │
└──────────┴────────────────┴─────────────────┴───────────┴─────────┴──────────────┴──────────┘

Legend: Spread % = Funding rate difference | Annual% = Expected annualized return
```

### 輸出格式（JSON）

```json
{
  "timestamp": "2025-10-21T14:32:15.123Z",
  "total": 3,
  "opportunities": [
    {
      "symbol": "BTCUSDT",
      "longExchange": "Binance",
      "shortExchange": "OKX",
      "longFundingRate": 0.0001,
      "shortFundingRate": 0.0066,
      "spreadPercent": 0.065,
      "expectedAnnualReturn": 71.18,
      "detectedAt": "2025-10-21T14:16:43.000Z",
      "durationMs": 932000,
      "durationMinutes": 15.53,
      "notificationCount": 3,
      "status": "ACTIVE"
    }
  ]
}
```

### 範例

```bash
# 列出所有活躍機會
arb opportunities list

# 只顯示 BTC 的機會
arb opportunities list --symbol BTCUSDT

# 只顯示費率差異 >= 0.1% 的機會
arb opportunities list --min-spread 0.1

# 輸出 JSON 格式
arb opportunities list --format json

# 顯示所有狀態的機會（包含已過期）
arb opportunities list --all
```

### 退出碼

- `0`: 成功
- `1`: 錯誤（資料庫連線失敗、參數錯誤等）

---

## C2: arb opportunities history

### 用途

查詢歷史套利機會記錄，提供統計摘要和詳細記錄。

### 語法

```bash
arb opportunities history [options]
```

### 選項

| 選項 | 簡寫 | 類型 | 預設值 | 說明 |
|-----|------|------|--------|------|
| `--symbol <SYMBOL>` | `-s` | string | - | 篩選特定交易對 |
| `--hours <N>` | `-h` | number | 24 | 查詢最近 N 小時 |
| `--days <N>` | `-d` | number | - | 查詢最近 N 天（優先於 --hours）|
| `--min-duration <MINUTES>` | | number | - | 最小持續時間（分鐘）|
| `--max-duration <MINUTES>` | | number | - | 最大持續時間（分鐘）|
| `--format <FORMAT>` | `-f` | enum | table | 輸出格式（table, json, summary） |
| `--limit <N>` | `-l` | number | 20 | 限制顯示數量 |

### 輸出格式（Table）

```
Arbitrage Opportunity History (Last 24 hours)
Period: 2025-10-20 14:32 - 2025-10-21 14:32

Summary:
  Total Opportunities: 12
  Avg Duration: 8.5 minutes
  Max Duration: 25.3 minutes
  Avg Spread: 0.068%
  Max Spread: 0.125%

Recent Opportunities:

┌──────────┬────────────────┬────────┬──────────┬──────────┬──────────────┬────────────┐
│ Symbol   │ Detected At    │ Dur.   │ Spread % │ Max %    │ Notifications│ Reason     │
├──────────┼────────────────┼────────┼──────────┼──────────┼──────────────┼────────────┤
│ BTCUSDT  │ 14:05:22       │ 15.2m  │ 0.065    │ 0.089    │ 5            │ Rate Drop  │
│ ETHUSDT  │ 13:48:11       │ 8.7m   │ 0.052    │ 0.061    │ 3            │ Rate Drop  │
│ SOLUSDT  │ 13:22:45       │ 3.5m   │ 0.051    │ 0.055    │ 1            │ Rate Drop  │
└──────────┴────────────────┴────────┴──────────┴──────────┴──────────────┴────────────┘
```

### 輸出格式（Summary）

```
Arbitrage Opportunity Summary
Period: Last 7 days (2025-10-14 to 2025-10-21)

Overall Statistics:
  Total Opportunities: 87
  Active Rate: 13.8% (12 currently active)
  Avg Duration: 9.2 minutes
  Avg Spread: 0.072%
  Total Notifications Sent: 342

By Symbol:
  BTCUSDT:  32 opportunities | Avg 10.5m | Avg spread 0.078%
  ETHUSDT:  28 opportunities | Avg 8.3m  | Avg spread 0.069%
  SOLUSDT:  27 opportunities | Avg 8.8m  | Avg spread 0.070%

Disappear Reasons:
  Rate Dropped: 82 (94.3%)
  Data Unavailable: 5 (5.7%)
```

### 範例

```bash
# 查詢最近 24 小時的歷史
arb opportunities history

# 查詢最近 7 天的歷史
arb opportunities history --days 7

# 只顯示 BTC 的歷史
arb opportunities history --symbol BTCUSDT --days 7

# 只顯示持續時間 >= 10 分鐘的機會
arb opportunities history --min-duration 10

# 顯示摘要統計
arb opportunities history --format summary --days 7
```

### 退出碼

- `0`: 成功
- `1`: 錯誤（資料庫連線失敗、參數錯誤等）

---

## C3: arb opportunities config

### 用途

查看或更新套利機會偵測的配置（閾值、防抖動等）。

### 語法

```bash
# 查看當前配置
arb opportunities config

# 更新配置
arb opportunities config [options]
```

### 選項

| 選項 | 簡寫 | 類型 | 預設值 | 說明 |
|-----|------|------|--------|------|
| `--threshold <PERCENT>` | `-t` | number | - | 最小套利閾值（%）|
| `--warning <PERCENT>` | `-w` | number | - | 警告等級閾值（%）|
| `--critical <PERCENT>` | `-c` | number | - | 嚴重等級閾值（%）|
| `--debounce <MS>` | `-d` | number | - | 防抖動時間（毫秒）|
| `--symbol-debounce <SYMBOL:MS>` | | string | - | Per-symbol 防抖動（例如：BTCUSDT:20000）|
| `--reset` | | boolean | false | 重置為預設值 |
| `--format <FORMAT>` | `-f` | enum | table | 輸出格式（table, json） |

### 輸出格式（Table）

```
Arbitrage Opportunity Detection Configuration

Thresholds:
  Minimum:  0.05% (0.0005)
  Warning:  0.20% (0.002)
  Critical: 0.50% (0.005)

Debounce:
  Enabled:       true
  Default:       30000 ms (30 seconds)
  Per-Symbol:
    BTCUSDT:     20000 ms
    ETHUSDT:     30000 ms
    SOLUSDT:     40000 ms

Notifications:
  Enabled:       true
  Min Severity:  INFO
  Channels:      Terminal, Log
```

### 輸出格式（JSON）

```json
{
  "thresholds": {
    "minimum": 0.0005,
    "warning": 0.002,
    "critical": 0.005
  },
  "debounce": {
    "enabled": true,
    "defaultMs": 30000,
    "perSymbol": {
      "BTCUSDT": 20000,
      "ETHUSDT": 30000,
      "SOLUSDT": 40000
    }
  },
  "notifications": {
    "enabled": true,
    "minSeverity": "INFO",
    "channels": ["Terminal", "Log"]
  }
}
```

### 範例

```bash
# 查看當前配置
arb opportunities config

# 更新最小閾值為 0.08%
arb opportunities config --threshold 0.08

# 更新防抖動時間為 60 秒
arb opportunities config --debounce 60000

# 為 BTC 設定 20 秒防抖動
arb opportunities config --symbol-debounce BTCUSDT:20000

# 同時更新多個配置
arb opportunities config --threshold 0.08 --warning 0.25 --critical 0.60

# 重置為預設值
arb opportunities config --reset

# 輸出 JSON 格式
arb opportunities config --format json
```

### 退出碼

- `0`: 成功
- `1`: 錯誤（參數錯誤、無效的閾值等）

---

## 實作架構

### 目錄結構

```
src/cli/commands/opportunities/
├── index.ts              # 導出所有指令
├── list.ts               # arb opportunities list
├── history.ts            # arb opportunities history
└── config.ts             # arb opportunities config
```

### Commander.js 註冊

```typescript
// src/cli/index.ts

import { Command } from 'commander';
import { listOpportunities } from './commands/opportunities/list.js';
import { showOpportunityHistory } from './commands/opportunities/history.js';
import { manageOpportunityConfig } from './commands/opportunities/config.js';

const program = new Command();

// 建立 opportunities 子指令
const opportunities = program
  .command('opportunities')
  .description('Manage arbitrage opportunities');

// 註冊子指令
opportunities
  .command('list')
  .description('List active arbitrage opportunities')
  .option('-s, --symbol <SYMBOL>', 'Filter by symbol')
  .option('-m, --min-spread <PERCENT>', 'Minimum spread percentage', parseFloat)
  .option('-f, --format <FORMAT>', 'Output format (table, json, csv)', 'table')
  .option('-l, --limit <N>', 'Limit number of results', parseInt, 10)
  .option('-a, --all', 'Show all opportunities (including expired)', false)
  .action(listOpportunities);

opportunities
  .command('history')
  .description('Show arbitrage opportunity history')
  .option('-s, --symbol <SYMBOL>', 'Filter by symbol')
  .option('-h, --hours <N>', 'Last N hours', parseInt, 24)
  .option('-d, --days <N>', 'Last N days (overrides --hours)', parseInt)
  .option('--min-duration <MINUTES>', 'Minimum duration in minutes', parseFloat)
  .option('--max-duration <MINUTES>', 'Maximum duration in minutes', parseFloat)
  .option('-f, --format <FORMAT>', 'Output format (table, json, summary)', 'table')
  .option('-l, --limit <N>', 'Limit number of results', parseInt, 20)
  .action(showOpportunityHistory);

opportunities
  .command('config')
  .description('View or update opportunity detection configuration')
  .option('-t, --threshold <PERCENT>', 'Minimum arbitrage threshold (%)', parseFloat)
  .option('-w, --warning <PERCENT>', 'Warning level threshold (%)', parseFloat)
  .option('-c, --critical <PERCENT>', 'Critical level threshold (%)', parseFloat)
  .option('-d, --debounce <MS>', 'Debounce time in milliseconds', parseInt)
  .option('--symbol-debounce <SYMBOL:MS>', 'Per-symbol debounce (e.g., BTCUSDT:20000)')
  .option('--reset', 'Reset to default values', false)
  .option('-f, --format <FORMAT>', 'Output format (table, json)', 'table')
  .action(manageOpportunityConfig);
```

---

## 錯誤處理

所有 CLI 指令應遵循以下錯誤處理規範：

1. **資料庫連線錯誤**:
   ```
   Error: Failed to connect to database
   Please ensure PostgreSQL is running and accessible.
   ```

2. **無效的參數**:
   ```
   Error: Invalid threshold value: -0.05
   Threshold must be a positive number between 0 and 100.
   ```

3. **無結果**:
   ```
   No active opportunities found.
   Try adjusting filters or checking system status with `arb status`.
   ```

4. **未預期的錯誤**:
   ```
   Unexpected error occurred: [error message]
   Please check logs for details or contact support.
   ```

---

## 測試案例

### T1: list 指令測試

```bash
# 正常情況：有活躍機會
arb opportunities list
# 預期：顯示 table 格式的機會列表

# 邊界情況：無活躍機會
arb opportunities list
# 預期：顯示 "No active opportunities found."

# 錯誤情況：無效的參數
arb opportunities list --min-spread -0.5
# 預期：錯誤訊息並退出碼 1
```

### T2: history 指令測試

```bash
# 正常情況：查詢 24 小時歷史
arb opportunities history
# 預期：顯示歷史記錄和統計摘要

# 邊界情況：無歷史記錄
arb opportunities history --days 1
# 預期：顯示 "No history records found for the specified period."

# 格式測試：JSON 輸出
arb opportunities history --format json
# 預期：有效的 JSON 格式
```

### T3: config 指令測試

```bash
# 正常情況：查看配置
arb opportunities config
# 預期：顯示當前配置

# 更新情況：修改閾值
arb opportunities config --threshold 0.08
# 預期：顯示更新後的配置並確認訊息

# 錯誤情況：無效的閾值
arb opportunities config --threshold 150
# 預期：錯誤訊息並退出碼 1
```

---

## 效能考量

- **list 指令**: 應在 < 500ms 內返回結果（查詢活躍機會）
- **history 指令**: 應在 < 2s 內返回結果（查詢 30 天歷史）
- **config 指令**: 應在 < 100ms 內返回結果（讀取配置）

---

## 相依性

- `commander` 8.x - CLI 框架
- `chalk` 5.x - 終端顏色（已在專案中）
- `cli-table3` - 表格輸出（建議新增）
- `date-fns` - 日期格式化（建議新增）

---

## 未來擴展

- [ ] `arb opportunities watch` - 即時監控機會變化（類似 `watch` 指令）
- [ ] `arb opportunities export` - 匯出歷史記錄為 CSV/Excel
- [ ] `arb opportunities analyze` - 深度分析和預測
- [ ] `arb opportunities alert` - 設定自訂警報條件
