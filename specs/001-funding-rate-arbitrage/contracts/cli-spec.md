# CLI 介面規格文件

**Feature**: 跨交易所資金費率套利平台
**Version**: 1.0.0
**Created**: 2025-10-17
**Status**: Draft

## 概述

本文件定義套利平台的命令列介面 (CLI),提供使用者對系統進行監控、交易執行、查詢和設定管理的完整操作介面。所有指令遵循一致的語法規範,支援人性化的 table 輸出和程式化的 JSON 輸出。

### 設計原則

1. **語義清晰**: 指令名稱採用 resource-action 模式,易於理解和記憶
2. **一致性**: 所有指令遵循統一的參數和選項命名規範
3. **安全性**: 敏感操作需要確認,提供 dry-run 模式
4. **可組合性**: 支援管道操作和腳本整合
5. **友善性**: 提供豐富的說明文件和使用範例

---

## 全域選項

所有指令都支援以下全域選項:

| 選項 | 簡寫 | 說明 | 預設值 |
|------|------|------|--------|
| `--config <path>` | `-c` | 指定設定檔路徑 | `./config/default.json` |
| `--json` | `-j` | 以 JSON 格式輸出結果 | `false` (使用 table 格式) |
| `--verbose` | `-v` | 顯示詳細的執行資訊和日誌 | `false` |
| `--quiet` | `-q` | 只輸出結果,不顯示額外訊息 | `false` |
| `--help` | `-h` | 顯示指令說明 | - |
| `--version` | `-V` | 顯示版本資訊 | - |

### 範例

```bash
# 使用自訂設定檔
arbitrage-bot --config ~/my-config.json monitor status

# 以 JSON 格式輸出
arbitrage-bot --json positions list

# 詳細輸出模式
arbitrage-bot --verbose trade execute --opportunity-id abc123
```

---

## 指令分類

### 1. 監控相關指令 (Monitor)

#### 1.1 `monitor start`

啟動資金費率監控服務。

**語法**

```bash
arbitrage-bot monitor start [options]
```

**選項**

| 選項 | 簡寫 | 說明 | 必填 | 預設值 |
|------|------|------|------|--------|
| `--symbols <LIST>` | `-s` | 指定監控的幣別,逗號分隔 | 否 | `BTC,ETH,SOL` |
| `--exchanges <LIST>` | `-e` | 指定監控的交易所,逗號分隔 | 否 | `binance,okx` |
| `--interval <SECONDS>` | `-i` | 資金費率更新間隔 (秒) | 否 | `5` |
| `--daemon` | `-d` | 以背景程序模式執行 | 否 | `false` |

**輸出格式**

Table 格式:
```
✓ Monitor service started successfully

Configuration:
  Symbols:    BTC, ETH, SOL
  Exchanges:  binance, okx
  Interval:   5 seconds
  Mode:       foreground

Press Ctrl+C to stop monitoring
```

JSON 格式:
```json
{
  "status": "started",
  "config": {
    "symbols": ["BTC", "ETH", "SOL"],
    "exchanges": ["binance", "okx"],
    "interval": 5,
    "daemon": false
  },
  "pid": 12345,
  "startedAt": "2025-10-17T10:00:00.000Z"
}
```

**使用範例**

```bash
# 使用預設設定啟動
arbitrage-bot monitor start

# 只監控 BTC 和 ETH
arbitrage-bot monitor start --symbols BTC,ETH

# 以背景程序模式執行
arbitrage-bot monitor start --daemon

# 自訂更新間隔
arbitrage-bot monitor start --interval 10
```

**錯誤處理**

| 錯誤代碼 | 說明 | 處理方式 |
|---------|------|---------|
| `E001` | 監控服務已在執行中 | 提示使用者先停止現有服務 |
| `E002` | 交易所 API 連線失敗 | 顯示失敗的交易所和錯誤訊息 |
| `E003` | 無效的幣別代碼 | 列出支援的幣別清單 |
| `E004` | 設定檔讀取失敗 | 顯示設定檔路徑和錯誤原因 |

---

#### 1.2 `monitor stop`

停止資金費率監控服務。

**語法**

```bash
arbitrage-bot monitor stop [options]
```

**選項**

| 選項 | 簡寫 | 說明 | 必填 | 預設值 |
|------|------|------|------|--------|
| `--force` | `-f` | 強制停止,不等待當前任務完成 | 否 | `false` |

**輸出格式**

Table 格式:
```
✓ Monitor service stopped successfully

Statistics:
  Running time:     2h 34m 12s
  Data points:      18,456
  Opportunities:    23
```

JSON 格式:
```json
{
  "status": "stopped",
  "statistics": {
    "runningTime": 9252,
    "dataPoints": 18456,
    "opportunities": 23
  },
  "stoppedAt": "2025-10-17T12:34:12.000Z"
}
```

**錯誤處理**

| 錯誤代碼 | 說明 | 處理方式 |
|---------|------|---------|
| `E005` | 監控服務未在執行 | 提示服務狀態 |
| `E006` | 有進行中的交易 | 詢問是否強制停止或等待交易完成 |

---

#### 1.3 `monitor status`

查詢監控服務的執行狀態。

**語法**

```bash
arbitrage-bot monitor status
```

**輸出格式**

Table 格式:
```
Monitor Service Status: Running

Configuration:
  Symbols:    BTC, ETH, SOL
  Exchanges:  binance, okx
  Interval:   5 seconds

Statistics:
  Uptime:            2h 34m 12s
  Last update:       2 seconds ago
  Data points:       18,456
  Opportunities:     23
  Active positions:  2

Exchange Connections:
  ✓ binance  (latency: 45ms)
  ✓ okx      (latency: 52ms)
```

JSON 格式:
```json
{
  "status": "running",
  "config": {
    "symbols": ["BTC", "ETH", "SOL"],
    "exchanges": ["binance", "okx"],
    "interval": 5
  },
  "statistics": {
    "uptime": 9252,
    "lastUpdate": 2,
    "dataPoints": 18456,
    "opportunities": 23,
    "activePositions": 2
  },
  "connections": {
    "binance": {
      "status": "connected",
      "latency": 45
    },
    "okx": {
      "status": "connected",
      "latency": 52
    }
  }
}
```

---

### 2. 套利機會相關指令 (Opportunities)

#### 2.1 `opportunities list`

列出當前的套利機會。

**語法**

```bash
arbitrage-bot opportunities list [options]
```

**選項**

| 選項 | 簡寫 | 說明 | 必填 | 預設值 |
|------|------|------|------|--------|
| `--symbol <SYMBOL>` | `-s` | 篩選特定幣別 | 否 | 全部 |
| `--min-rate <PERCENT>` | `-m` | 最小費率差異百分比 | 否 | `0` |
| `--status <STATUS>` | | 篩選狀態: pending, executed, expired | 否 | `pending` |
| `--sort <FIELD>` | | 排序欄位: rate, profit, time | 否 | `rate` |
| `--limit <N>` | `-l` | 限制顯示筆數 | 否 | `20` |

**輸出格式**

Table 格式:
```
Current Arbitrage Opportunities (3 found)

ID       Symbol  Long       Short     Rate Diff  Est. Profit  Detected
─────────────────────────────────────────────────────────────────────
abc123   BTC     binance    okx       0.15%      $45.23      2m ago
def456   ETH     okx        binance   0.08%      $24.56      5m ago
ghi789   SOL     binance    okx       0.12%      $8.90       1m ago

Total estimated profit: $78.69
```

JSON 格式:
```json
{
  "opportunities": [
    {
      "id": "abc123",
      "symbol": "BTC",
      "longExchange": "binance",
      "shortExchange": "okx",
      "rateDiff": 0.15,
      "longRate": 0.01,
      "shortRate": -0.14,
      "estimatedProfit": 45.23,
      "detectedAt": "2025-10-17T10:32:00.000Z",
      "status": "pending"
    }
  ],
  "summary": {
    "total": 3,
    "totalEstimatedProfit": 78.69
  }
}
```

**使用範例**

```bash
# 列出所有套利機會
arbitrage-bot opportunities list

# 只顯示 BTC 的機會
arbitrage-bot opportunities list --symbol BTC

# 只顯示費率差異大於 0.1% 的機會
arbitrage-bot opportunities list --min-rate 0.1

# 按照預期收益排序
arbitrage-bot opportunities list --sort profit
```

---

#### 2.2 `opportunities show`

顯示特定套利機會的詳細資訊。

**語法**

```bash
arbitrage-bot opportunities show <OPPORTUNITY_ID>
```

**輸出格式**

Table 格式:
```
Arbitrage Opportunity: abc123

Basic Info:
  Symbol:           BTC
  Status:           pending
  Detected:         2025-10-17 10:32:00
  Rate Difference:  0.15%

Funding Rates:
  binance:  0.01%   (long position)
  okx:     -0.14%   (short position)

Next Settlement:    2025-10-17 16:00:00 (in 5h 28m)

Profit Estimation:
  Position size:    $10,000
  Funding income:   $15.00
  Trading fees:     $8.00
  Net profit:       $7.00
  ROI:              0.07%
```

JSON 格式:
```json
{
  "id": "abc123",
  "symbol": "BTC",
  "status": "pending",
  "detectedAt": "2025-10-17T10:32:00.000Z",
  "rateDiff": 0.15,
  "fundingRates": {
    "binance": {
      "rate": 0.01,
      "position": "long",
      "nextSettlement": "2025-10-17T16:00:00.000Z"
    },
    "okx": {
      "rate": -0.14,
      "position": "short",
      "nextSettlement": "2025-10-17T16:00:00.000Z"
    }
  },
  "estimation": {
    "positionSize": 10000,
    "fundingIncome": 15.00,
    "tradingFees": 8.00,
    "netProfit": 7.00,
    "roi": 0.07
  }
}
```

---

#### 2.3 `funding-rates list`

列出當前的資金費率資訊。

**語法**

```bash
arbitrage-bot funding-rates list [options]
```

**選項**

| 選項 | 簡寫 | 說明 | 必填 | 預設值 |
|------|------|------|------|--------|
| `--symbol <SYMBOL>` | `-s` | 篩選特定幣別 | 否 | 全部 |
| `--exchange <EXCHANGE>` | `-e` | 篩選特定交易所 | 否 | 全部 |

**輸出格式**

Table 格式:
```
Current Funding Rates

Symbol  Binance    OKX        Difference  Next Settlement
─────────────────────────────────────────────────────────
BTC     0.01%     -0.14%      0.15%      2025-10-17 16:00
ETH    -0.05%     -0.13%      0.08%      2025-10-17 16:00
SOL     0.02%     -0.10%      0.12%      2025-10-17 16:00

Last updated: 2 seconds ago
```

JSON 格式:
```json
{
  "rates": [
    {
      "symbol": "BTC",
      "exchanges": {
        "binance": {
          "rate": 0.01,
          "nextSettlement": "2025-10-17T16:00:00.000Z"
        },
        "okx": {
          "rate": -0.14,
          "nextSettlement": "2025-10-17T16:00:00.000Z"
        }
      },
      "difference": 0.15
    }
  ],
  "updatedAt": "2025-10-17T10:34:58.000Z"
}
```

---

### 3. 交易相關指令 (Trade)

#### 3.1 `trade execute`

執行套利交易。

**語法**

```bash
arbitrage-bot trade execute [options]
```

**選項**

| 選項 | 簡寫 | 說明 | 必填 | 預設值 |
|------|------|------|------|--------|
| `--opportunity-id <ID>` | `-o` | 指定套利機會 ID | 是 (或使用 --symbol) | - |
| `--symbol <SYMBOL>` | `-s` | 指定幣別 (自動選擇最佳機會) | 是 (或使用 --opportunity-id) | - |
| `--amount <USDT>` | `-a` | 交易金額 (USDT) | 否 | 使用設定檔預設值 |
| `--dry-run` | `-d` | 模擬執行,不實際下單 | 否 | `false` |
| `--confirm` | `-y` | 不詢問確認,直接執行 | 否 | `false` |

**輸出格式**

Table 格式 (執行前確認):
```
Trade Execution Plan

Opportunity:  abc123
Symbol:       BTC
Amount:       $10,000

Actions:
  1. Open LONG  on binance: 0.5 BTC @ market price
  2. Open SHORT on okx:     0.5 BTC @ market price

Estimated Costs:
  binance trading fee:  $4.00
  okx trading fee:      $4.00
  Total fees:           $8.00

Estimated Net Profit:   $7.00
ROI:                    0.07%

⚠ This will execute real trades. Continue? [y/N]
```

Table 格式 (執行後):
```
✓ Trade executed successfully

Position ID: pos_xyz789

Execution Summary:
  binance: LONG  0.5 BTC @ $42,350.00 (fee: $4.23)
  okx:     SHORT 0.5 BTC @ $42,345.00 (fee: $4.12)

Total fees:     $8.35
Position value: $10,000
Status:         Active
```

JSON 格式:
```json
{
  "status": "success",
  "positionId": "pos_xyz789",
  "execution": {
    "binance": {
      "exchange": "binance",
      "side": "long",
      "symbol": "BTC",
      "quantity": 0.5,
      "price": 42350.00,
      "fee": 4.23,
      "orderId": "bn_123456"
    },
    "okx": {
      "exchange": "okx",
      "side": "short",
      "symbol": "BTC",
      "quantity": 0.5,
      "price": 42345.00,
      "fee": 4.12,
      "orderId": "okx_789012"
    }
  },
  "totalFees": 8.35,
  "positionValue": 10000,
  "executedAt": "2025-10-17T10:35:30.000Z"
}
```

**使用範例**

```bash
# 執行特定套利機會
arbitrage-bot trade execute --opportunity-id abc123

# 執行 BTC 的最佳套利機會
arbitrage-bot trade execute --symbol BTC

# 指定交易金額
arbitrage-bot trade execute --opportunity-id abc123 --amount 5000

# 模擬執行 (不實際下單)
arbitrage-bot trade execute --opportunity-id abc123 --dry-run

# 不詢問確認直接執行
arbitrage-bot trade execute --opportunity-id abc123 --confirm
```

**錯誤處理**

| 錯誤代碼 | 說明 | 處理方式 |
|---------|------|---------|
| `E101` | 套利機會不存在或已過期 | 提示使用者重新查詢 |
| `E102` | 帳戶餘額不足 | 顯示所需金額和當前餘額 |
| `E103` | 單邊訂單失敗 | 自動取消或平倉另一邊,並記錄詳細資訊 |
| `E104` | 超過風險限制 | 顯示觸發的風險規則 |
| `E105` | 交易所 API 錯誤 | 顯示錯誤訊息和建議的處理方式 |

---

#### 3.2 `trade close`

平倉對沖部位。

**語法**

```bash
arbitrage-bot trade close <POSITION_ID> [options]
```

**選項**

| 選項 | 簡寫 | 說明 | 必填 | 預設值 |
|------|------|------|------|--------|
| `--confirm` | `-y` | 不詢問確認,直接執行 | 否 | `false` |
| `--dry-run` | `-d` | 模擬執行,不實際平倉 | 否 | `false` |

**輸出格式**

Table 格式:
```
✓ Position closed successfully

Position ID: pos_xyz789
Symbol:      BTC
Duration:    7h 45m

Closing Summary:
  binance: Closed LONG  0.5 BTC @ $42,450.00 (fee: $4.25)
  okx:     Closed SHORT 0.5 BTC @ $42,440.00 (fee: $4.18)

Profit & Loss:
  Funding income:   $15.00
  Opening fees:     $8.35
  Closing fees:     $8.43
  Price impact:     -$2.50
  Net profit:       -$4.28
  ROI:              -0.04%
```

JSON 格式:
```json
{
  "status": "closed",
  "positionId": "pos_xyz789",
  "symbol": "BTC",
  "duration": 27900,
  "closing": {
    "binance": {
      "side": "long",
      "quantity": 0.5,
      "price": 42450.00,
      "fee": 4.25
    },
    "okx": {
      "side": "short",
      "quantity": 0.5,
      "price": 42440.00,
      "fee": 4.18
    }
  },
  "profitLoss": {
    "fundingIncome": 15.00,
    "openingFees": 8.35,
    "closingFees": 8.43,
    "priceImpact": -2.50,
    "netProfit": -4.28,
    "roi": -0.04
  },
  "closedAt": "2025-10-17T18:20:30.000Z"
}
```

**錯誤處理**

| 錯誤代碼 | 說明 | 處理方式 |
|---------|------|---------|
| `E106` | 部位不存在 | 列出現有部位清單 |
| `E107` | 部位已關閉 | 顯示部位狀態 |
| `E108` | 單邊平倉失敗 | 記錄失敗資訊並提示手動處理 |

---

#### 3.3 `trade cancel`

取消待執行的套利交易 (僅適用於排程或待確認的交易)。

**語法**

```bash
arbitrage-bot trade cancel <OPPORTUNITY_ID>
```

**輸出格式**

```
✓ Trade cancelled successfully

Opportunity ID: abc123
Symbol:         BTC
Status:         Cancelled
```

---

### 4. 持倉查詢指令 (Positions)

#### 4.1 `positions list`

列出所有對沖部位。

**語法**

```bash
arbitrage-bot positions list [options]
```

**選項**

| 選項 | 簡寫 | 說明 | 必填 | 預設值 |
|------|------|------|------|--------|
| `--status <STATUS>` | `-s` | 篩選狀態: active, closed | 否 | `active` |
| `--symbol <SYMBOL>` | | 篩選特定幣別 | 否 | 全部 |

**輸出格式**

Table 格式:
```
Active Hedge Positions (2)

ID          Symbol  Long      Short   Amount    PnL      ROI     Duration
──────────────────────────────────────────────────────────────────────────
pos_xyz789  BTC     binance   okx     $10,000  +$12.45  0.12%   7h 45m
pos_abc123  ETH     okx       binance $5,000   +$5.20   0.10%   3h 12m

Total PnL: +$17.65
Total Margin Used: $15,000
```

JSON 格式:
```json
{
  "positions": [
    {
      "id": "pos_xyz789",
      "symbol": "BTC",
      "longExchange": "binance",
      "shortExchange": "okx",
      "amount": 10000,
      "pnl": 12.45,
      "roi": 0.12,
      "duration": 27900,
      "status": "active",
      "openedAt": "2025-10-17T10:35:30.000Z"
    }
  ],
  "summary": {
    "totalPnL": 17.65,
    "totalMarginUsed": 15000,
    "count": 2
  }
}
```

---

#### 4.2 `positions show`

顯示特定部位的詳細資訊。

**語法**

```bash
arbitrage-bot positions show <POSITION_ID>
```

**輸出格式**

Table 格式:
```
Position Details: pos_xyz789

Basic Info:
  Symbol:         BTC
  Status:         Active
  Opened:         2025-10-17 10:35:30
  Duration:       7h 45m

Position Details:
  binance (LONG):
    Quantity:     0.5 BTC
    Entry price:  $42,350.00
    Current:      $42,450.00
    Margin used:  $5,000
    Margin rate:  5.2%

  okx (SHORT):
    Quantity:     0.5 BTC
    Entry price:  $42,345.00
    Current:      $42,440.00
    Margin used:  $5,000
    Margin rate:  5.1%

Profit & Loss:
  Unrealized PnL:    +$12.45
  Funding income:    +$15.00
  Trading fees:      -$8.35
  Price impact:      +$5.80
  ROI:               0.12%

Next Funding:        2025-10-17 16:00:00 (in 25m)
Expected income:     $7.50
```

JSON 格式:
```json
{
  "id": "pos_xyz789",
  "symbol": "BTC",
  "status": "active",
  "openedAt": "2025-10-17T10:35:30.000Z",
  "duration": 27900,
  "positions": {
    "binance": {
      "side": "long",
      "quantity": 0.5,
      "entryPrice": 42350.00,
      "currentPrice": 42450.00,
      "marginUsed": 5000,
      "marginRate": 5.2
    },
    "okx": {
      "side": "short",
      "quantity": 0.5,
      "entryPrice": 42345.00,
      "currentPrice": 42440.00,
      "marginUsed": 5000,
      "marginRate": 5.1
    }
  },
  "profitLoss": {
    "unrealizedPnL": 12.45,
    "fundingIncome": 15.00,
    "tradingFees": -8.35,
    "priceImpact": 5.80,
    "roi": 0.12
  },
  "nextFunding": {
    "time": "2025-10-17T16:00:00.000Z",
    "expectedIncome": 7.50
  }
}
```

---

### 5. 交易歷史指令 (History)

#### 5.1 `history list`

列出歷史交易記錄。

**語法**

```bash
arbitrage-bot history list [options]
```

**選項**

| 選項 | 簡寫 | 說明 | 必填 | 預設值 |
|------|------|------|------|--------|
| `--symbol <SYMBOL>` | `-s` | 篩選特定幣別 | 否 | 全部 |
| `--from <DATE>` | | 起始日期 (YYYY-MM-DD) | 否 | 7 天前 |
| `--to <DATE>` | | 結束日期 (YYYY-MM-DD) | 否 | 今天 |
| `--limit <N>` | `-l` | 限制顯示筆數 | 否 | `50` |

**輸出格式**

Table 格式:
```
Trading History (Last 7 days)

Closed    Symbol  Duration  Net Profit  ROI     Funding  Fees
─────────────────────────────────────────────────────────────
10/17 18  BTC     7h 45m    +$12.45    0.12%   $15.00   $16.78
10/17 14  ETH     4h 20m    +$8.90     0.18%   $12.00   $3.10
10/16 22  SOL     6h 10m    -$2.30    -0.05%   $4.50    $6.80

Total: 23 trades
Profitable: 18 (78.3%)
Total Net Profit: +$245.67
Average ROI: 0.14%
```

JSON 格式:
```json
{
  "trades": [
    {
      "id": "pos_xyz789",
      "symbol": "BTC",
      "openedAt": "2025-10-17T10:35:30.000Z",
      "closedAt": "2025-10-17T18:20:30.000Z",
      "duration": 27900,
      "netProfit": 12.45,
      "roi": 0.12,
      "fundingIncome": 15.00,
      "totalFees": 16.78
    }
  ],
  "summary": {
    "total": 23,
    "profitable": 18,
    "profitableRate": 78.3,
    "totalNetProfit": 245.67,
    "averageROI": 0.14
  }
}
```

---

#### 5.2 `history stats`

顯示交易統計資訊。

**語法**

```bash
arbitrage-bot history stats [options]
```

**選項**

| 選項 | 簡寫 | 說明 | 必填 | 預設值 |
|------|------|------|------|--------|
| `--period <DAYS>` | `-p` | 統計期間 (天數) | 否 | `30` |

**輸出格式**

Table 格式:
```
Trading Statistics (Last 30 days)

Overall Performance:
  Total trades:        87
  Profitable trades:   68 (78.2%)
  Total net profit:    $1,234.56
  Average ROI:         0.14%
  Win rate:            78.2%

By Symbol:
  BTC: 35 trades, +$567.89 (avg ROI: 0.15%)
  ETH: 32 trades, +$456.78 (avg ROI: 0.13%)
  SOL: 20 trades, +$209.89 (avg ROI: 0.12%)

Cost Analysis:
  Total funding income: $1,890.00
  Total trading fees:   -$655.44
  Net after fees:       $1,234.56

Risk Metrics:
  Max drawdown:        -$45.67
  Sharpe ratio:        2.34
  Average duration:    6h 23m
```

JSON 格式:
```json
{
  "period": {
    "days": 30,
    "from": "2025-09-17",
    "to": "2025-10-17"
  },
  "overall": {
    "totalTrades": 87,
    "profitableTrades": 68,
    "totalNetProfit": 1234.56,
    "averageROI": 0.14,
    "winRate": 78.2
  },
  "bySymbol": {
    "BTC": {
      "trades": 35,
      "profit": 567.89,
      "averageROI": 0.15
    },
    "ETH": {
      "trades": 32,
      "profit": 456.78,
      "averageROI": 0.13
    },
    "SOL": {
      "trades": 20,
      "profit": 209.89,
      "averageROI": 0.12
    }
  },
  "costs": {
    "fundingIncome": 1890.00,
    "tradingFees": -655.44,
    "netAfterFees": 1234.56
  },
  "risk": {
    "maxDrawdown": -45.67,
    "sharpeRatio": 2.34,
    "averageDuration": 22980
  }
}
```

---

### 6. 設定管理指令 (Config)

#### 6.1 `config show`

顯示當前設定。

**語法**

```bash
arbitrage-bot config show [options]
```

**選項**

| 選項 | 簡寫 | 說明 | 必填 | 預設值 |
|------|------|------|------|--------|
| `--section <SECTION>` | `-s` | 只顯示特定區塊 | 否 | 全部 |

**輸出格式**

Table 格式:
```
Current Configuration

Monitoring:
  symbols:           [BTC, ETH, SOL]
  exchanges:         [binance, okx]
  update_interval:   5 seconds

Trading:
  auto_execute:      false
  default_amount:    $10,000
  max_positions:     5

Risk Management:
  threshold:            0.05%
  max_trade_amount:     $20,000
  max_margin_usage:     70%
  stop_loss_threshold:  -0.1%

Exchanges:
  binance:
    api_key:     bn_****3456
    testnet:     false
  okx:
    api_key:     okx_****9012
    testnet:     false

Config file: /Users/bot/config/default.json
```

JSON 格式:
```json
{
  "monitoring": {
    "symbols": ["BTC", "ETH", "SOL"],
    "exchanges": ["binance", "okx"],
    "updateInterval": 5
  },
  "trading": {
    "autoExecute": false,
    "defaultAmount": 10000,
    "maxPositions": 5
  },
  "risk": {
    "threshold": 0.05,
    "maxTradeAmount": 20000,
    "maxMarginUsage": 70,
    "stopLossThreshold": -0.1
  },
  "exchanges": {
    "binance": {
      "apiKey": "bn_****3456",
      "testnet": false
    },
    "okx": {
      "apiKey": "okx_****9012",
      "testnet": false
    }
  },
  "configFile": "/Users/bot/config/default.json"
}
```

---

#### 6.2 `config set`

修改設定值。

**語法**

```bash
arbitrage-bot config set --key <KEY> --value <VALUE>
```

**選項**

| 選項 | 簡寫 | 說明 | 必填 | 預設值 |
|------|------|------|------|--------|
| `--key <KEY>` | `-k` | 設定鍵 (使用點號分隔) | 是 | - |
| `--value <VALUE>` | `-v` | 設定值 | 是 | - |

**使用範例**

```bash
# 修改套利閾值
arbitrage-bot config set --key risk.threshold --value 0.08

# 啟用自動交易
arbitrage-bot config set --key trading.auto_execute --value true

# 修改預設交易金額
arbitrage-bot config set --key trading.default_amount --value 15000

# 新增監控幣別
arbitrage-bot config set --key monitoring.symbols --value BTC,ETH,SOL,MATIC
```

**輸出格式**

```
✓ Configuration updated successfully

Key:    risk.threshold
Value:  0.08 (was: 0.05)

⚠ Changes will take effect after restarting the monitor service
```

**錯誤處理**

| 錯誤代碼 | 說明 | 處理方式 |
|---------|------|---------|
| `E201` | 無效的設定鍵 | 列出可用的設定鍵 |
| `E202` | 無效的值格式 | 顯示預期的格式 |
| `E203` | 設定檔寫入失敗 | 顯示權限或路徑錯誤 |

---

#### 6.3 `config validate`

驗證設定檔的正確性。

**語法**

```bash
arbitrage-bot config validate [<CONFIG_FILE>]
```

**輸出格式**

Table 格式 (通過):
```
✓ Configuration is valid

Checks passed:
  ✓ Syntax is correct
  ✓ All required fields present
  ✓ Value types are correct
  ✓ Exchange credentials format valid
  ✓ Risk parameters in acceptable range
```

Table 格式 (失敗):
```
✗ Configuration validation failed

Errors found:
  ✗ risk.threshold: Must be between 0.01 and 1.0
  ✗ exchanges.binance.api_key: Missing required field
  ⚠ trading.default_amount: Exceeds recommended limit of $50,000

Please fix these issues before starting the service.
```

---

#### 6.4 `config init`

建立初始設定檔。

**語法**

```bash
arbitrage-bot config init [options]
```

**選項**

| 選項 | 簡寫 | 說明 | 必填 | 預設值 |
|------|------|------|------|--------|
| `--output <PATH>` | `-o` | 設定檔輸出路徑 | 否 | `./config/default.json` |
| `--interactive` | `-i` | 互動式設定 | 否 | `false` |

**輸出格式**

```
Creating configuration file...

? Enter Binance API Key: ****
? Enter Binance Secret Key: ****
? Enter OKX API Key: ****
? Enter OKX Secret Key: ****
? Enter OKX Passphrase: ****

? Select symbols to monitor: BTC, ETH, SOL
? Arbitrage threshold (%): 0.05
? Default trade amount (USDT): 10000
? Enable auto-trading: No

✓ Configuration file created: ./config/default.json

Next steps:
  1. Review the configuration: arbitrage-bot config show
  2. Validate settings: arbitrage-bot config validate
  3. Start monitoring: arbitrage-bot monitor start
```

---

### 7. 帳戶相關指令 (Account)

#### 7.1 `account balance`

查詢交易所帳戶餘額。

**語法**

```bash
arbitrage-bot account balance [options]
```

**選項**

| 選項 | 簡寫 | 說明 | 必填 | 預設值 |
|------|------|------|------|--------|
| `--exchange <EXCHANGE>` | `-e` | 指定交易所 | 否 | 全部 |

**輸出格式**

Table 格式:
```
Account Balances

Binance:
  Available:        $15,234.56 USDT
  In positions:     $10,000.00 USDT
  Total:            $25,234.56 USDT
  Margin used:      39.6%

OKX:
  Available:        $12,890.45 USDT
  In positions:     $10,000.00 USDT
  Total:            $22,890.45 USDT
  Margin used:      43.7%

Combined:
  Total available:  $28,125.01 USDT
  Total in use:     $20,000.00 USDT
  Grand total:      $48,125.01 USDT
```

JSON 格式:
```json
{
  "balances": {
    "binance": {
      "available": 15234.56,
      "inPositions": 10000.00,
      "total": 25234.56,
      "marginUsed": 39.6
    },
    "okx": {
      "available": 12890.45,
      "inPositions": 10000.00,
      "total": 22890.45,
      "marginUsed": 43.7
    }
  },
  "combined": {
    "totalAvailable": 28125.01,
    "totalInUse": 20000.00,
    "grandTotal": 48125.01
  }
}
```

---

#### 7.2 `account check`

檢查帳戶狀態和連線。

**語法**

```bash
arbitrage-bot account check
```

**輸出格式**

```
Account Status Check

Binance:
  ✓ API connection successful
  ✓ Permissions: spot, futures
  ✓ Account status: active
  ⚠ Margin level: 39.6% (safe)

OKX:
  ✓ API connection successful
  ✓ Permissions: spot, swap
  ✓ Account status: active
  ⚠ Margin level: 43.7% (safe)

Overall Status: Healthy
```

---

### 8. 系統相關指令 (System)

#### 8.1 `logs`

查看系統日誌。

**語法**

```bash
arbitrage-bot logs [options]
```

**選項**

| 選項 | 簡寫 | 說明 | 必填 | 預設值 |
|------|------|------|------|--------|
| `--level <LEVEL>` | `-l` | 日誌級別: debug, info, warn, error | 否 | `info` |
| `--lines <N>` | `-n` | 顯示行數 | 否 | `50` |
| `--follow` | `-f` | 持續顯示新日誌 | 否 | `false` |
| `--grep <PATTERN>` | `-g` | 篩選包含特定文字的日誌 | 否 | - |

**使用範例**

```bash
# 查看最近 50 行日誌
arbitrage-bot logs

# 只顯示錯誤日誌
arbitrage-bot logs --level error

# 持續追蹤日誌
arbitrage-bot logs --follow

# 搜尋包含 "BTC" 的日誌
arbitrage-bot logs --grep BTC
```

---

#### 8.2 `version`

顯示版本資訊。

**語法**

```bash
arbitrage-bot version
```

**輸出格式**

```
Arbitrage Bot v1.0.0

Environment: production
Node.js:     v20.10.0
Platform:    linux-x64

Dependencies:
  binance-connector-node: v3.2.0
  okx-node-sdk:           v1.0.5
  ccxt:                   v4.1.50
```

---

#### 8.3 `doctor`

診斷系統狀態和設定問題。

**語法**

```bash
arbitrage-bot doctor
```

**輸出格式**

```
System Diagnostic

Environment:
  ✓ Node.js version (v20.10.0)
  ✓ Required dependencies installed
  ✓ Configuration file exists
  ✓ Configuration is valid

Database:
  ✓ PostgreSQL connection
  ✓ Redis connection
  ✓ Required tables exist

Exchanges:
  ✓ Binance API connectivity
  ✓ OKX API connectivity
  ✓ API rate limits: OK

Permissions:
  ✓ Log directory writable
  ✓ Config directory writable

Network:
  ✓ Internet connectivity
  ⚠ Latency to Binance: 156ms (acceptable)
  ⚠ Latency to OKX: 178ms (acceptable)

Overall Status: All systems operational
```

---

## 錯誤代碼總覽

| 代碼範圍 | 類別 | 說明 |
|---------|------|------|
| E001-E099 | Monitor | 監控相關錯誤 |
| E100-E199 | Trade | 交易執行錯誤 |
| E200-E299 | Config | 設定相關錯誤 |
| E300-E399 | Account | 帳戶和連線錯誤 |
| E400-E499 | System | 系統和資料庫錯誤 |

### 詳細錯誤代碼表

| 代碼 | 說明 | 建議處理方式 |
|------|------|------------|
| E001 | 監控服務已在執行中 | 使用 `monitor stop` 停止現有服務 |
| E002 | 交易所 API 連線失敗 | 檢查網路連線和 API 金鑰 |
| E003 | 無效的幣別代碼 | 使用支援的幣別: BTC, ETH, SOL |
| E004 | 設定檔讀取失敗 | 檢查檔案路徑和權限 |
| E005 | 監控服務未在執行 | 使用 `monitor start` 啟動服務 |
| E006 | 有進行中的交易 | 等待交易完成或使用 `--force` 強制停止 |
| E101 | 套利機會不存在或已過期 | 使用 `opportunities list` 查詢最新機會 |
| E102 | 帳戶餘額不足 | 充值或降低交易金額 |
| E103 | 單邊訂單失敗 | 系統已自動處理,檢查日誌了解詳情 |
| E104 | 超過風險限制 | 調整風險參數或減少倉位 |
| E105 | 交易所 API 錯誤 | 檢查 API 狀態,稍後重試 |
| E106 | 部位不存在 | 使用 `positions list` 查詢現有部位 |
| E107 | 部位已關閉 | 使用 `history list` 查看歷史記錄 |
| E108 | 單邊平倉失敗 | 聯繫技術支援,可能需要手動處理 |
| E201 | 無效的設定鍵 | 使用 `config show` 查看可用設定 |
| E202 | 無效的值格式 | 檢查值的資料類型和範圍 |
| E203 | 設定檔寫入失敗 | 檢查檔案權限 |
| E301 | API 金鑰無效 | 重新設定正確的 API 金鑰 |
| E302 | API 權限不足 | 確保 API 金鑰有期貨交易權限 |
| E303 | API 請求超過限流 | 降低請求頻率或等待限制解除 |
| E401 | 資料庫連線失敗 | 檢查資料庫服務狀態 |
| E402 | Redis 連線失敗 | 檢查 Redis 服務狀態 |

---

## 使用範例腳本

### 完整套利流程

```bash
#!/bin/bash

# 1. 檢查系統狀態
arbitrage-bot doctor

# 2. 驗證設定
arbitrage-bot config validate

# 3. 檢查帳戶餘額
arbitrage-bot account balance

# 4. 啟動監控
arbitrage-bot monitor start --daemon

# 5. 查看即時機會
watch -n 5 "arbitrage-bot opportunities list --json | jq '.opportunities[] | select(.rateDiff > 0.1)'"

# 6. 查看持倉狀態
arbitrage-bot positions list

# 7. 查看統計
arbitrage-bot history stats --period 7
```

### 自動化交易腳本

```bash
#!/bin/bash

# 監控套利機會並自動執行
while true; do
  # 查詢最佳機會
  BEST_OPP=$(arbitrage-bot opportunities list --json --limit 1 | jq -r '.opportunities[0].id')

  if [ "$BEST_OPP" != "null" ]; then
    echo "Found opportunity: $BEST_OPP"

    # 執行交易
    arbitrage-bot trade execute --opportunity-id "$BEST_OPP" --confirm --json

    # 等待 30 秒
    sleep 30
  else
    echo "No opportunities found, waiting..."
    sleep 10
  fi
done
```

### 批次平倉腳本

```bash
#!/bin/bash

# 平倉所有活躍部位
POSITIONS=$(arbitrage-bot positions list --status active --json | jq -r '.positions[].id')

for POS_ID in $POSITIONS; do
  echo "Closing position: $POS_ID"
  arbitrage-bot trade close "$POS_ID" --confirm
  sleep 2
done

echo "All positions closed"
```

---

## 輸出格式規範

### Table 格式規則

1. **寬度**: 自動調整至終端寬度,最大 120 字元
2. **對齊**: 數值靠右對齊,文字靠左對齊
3. **分隔符**: 使用 `─` 作為表頭分隔線
4. **符號**: 使用 `✓` 表示成功,`✗` 表示失敗,`⚠` 表示警告
5. **顏色** (如果終端支援):
   - 綠色: 正值、成功狀態
   - 紅色: 負值、錯誤狀態
   - 黃色: 警告訊息
   - 灰色: 次要資訊

### JSON 格式規則

1. **縮排**: 2 個空格
2. **命名**: 使用 camelCase
3. **時間格式**: ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ)
4. **數值**: 金額使用浮點數,保留 2 位小數
5. **null 值**: 顯示為 `null`,不省略欄位

---

## 設定檔範例

### default.json

```json
{
  "monitoring": {
    "symbols": ["BTC", "ETH", "SOL"],
    "exchanges": ["binance", "okx"],
    "updateInterval": 5,
    "retryAttempts": 3,
    "retryDelay": 1000
  },
  "trading": {
    "autoExecute": false,
    "defaultAmount": 10000,
    "maxPositions": 5,
    "orderType": "market",
    "confirmRequired": true
  },
  "risk": {
    "threshold": 0.05,
    "maxTradeAmount": 20000,
    "maxMarginUsage": 70,
    "stopLossThreshold": -0.1,
    "maxDailyLoss": -500
  },
  "exchanges": {
    "binance": {
      "apiKey": "${BINANCE_API_KEY}",
      "secretKey": "${BINANCE_SECRET_KEY}",
      "testnet": false,
      "timeout": 10000
    },
    "okx": {
      "apiKey": "${OKX_API_KEY}",
      "secretKey": "${OKX_SECRET_KEY}",
      "passphrase": "${OKX_PASSPHRASE}",
      "testnet": false,
      "timeout": 10000
    }
  },
  "database": {
    "host": "localhost",
    "port": 5432,
    "database": "arbitrage_bot",
    "user": "${DB_USER}",
    "password": "${DB_PASSWORD}"
  },
  "redis": {
    "host": "localhost",
    "port": 6379,
    "password": "${REDIS_PASSWORD}"
  },
  "logging": {
    "level": "info",
    "file": "./logs/app.log",
    "maxSize": "20m",
    "maxFiles": 10
  },
  "notifications": {
    "enabled": false,
    "channels": ["telegram"],
    "telegram": {
      "botToken": "${TELEGRAM_BOT_TOKEN}",
      "chatId": "${TELEGRAM_CHAT_ID}"
    }
  }
}
```

---

## 環境變數

系統支援以下環境變數:

| 變數名稱 | 說明 | 必填 |
|---------|------|------|
| `BINANCE_API_KEY` | Binance API 金鑰 | 是 |
| `BINANCE_SECRET_KEY` | Binance Secret 金鑰 | 是 |
| `OKX_API_KEY` | OKX API 金鑰 | 是 |
| `OKX_SECRET_KEY` | OKX Secret 金鑰 | 是 |
| `OKX_PASSPHRASE` | OKX API Passphrase | 是 |
| `DB_USER` | PostgreSQL 使用者名稱 | 是 |
| `DB_PASSWORD` | PostgreSQL 密碼 | 是 |
| `REDIS_PASSWORD` | Redis 密碼 | 否 |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token | 否 |
| `TELEGRAM_CHAT_ID` | Telegram Chat ID | 否 |
| `LOG_LEVEL` | 日誌級別 (debug/info/warn/error) | 否 |
| `CONFIG_PATH` | 自訂設定檔路徑 | 否 |

### .env 範例

```bash
# Exchange API Keys
BINANCE_API_KEY=your_binance_api_key
BINANCE_SECRET_KEY=your_binance_secret_key
OKX_API_KEY=your_okx_api_key
OKX_SECRET_KEY=your_okx_secret_key
OKX_PASSPHRASE=your_okx_passphrase

# Database
DB_USER=arbitrage_user
DB_PASSWORD=your_db_password

# Redis
REDIS_PASSWORD=your_redis_password

# Notifications
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id

# Logging
LOG_LEVEL=info

# Custom config
CONFIG_PATH=./config/production.json
```

---

## 安裝與快速開始

### 安裝

```bash
# 全域安裝
npm install -g arbitrage-bot

# 或使用 yarn
yarn global add arbitrage-bot
```

### 初始化

```bash
# 建立設定檔 (互動式)
arbitrage-bot config init --interactive

# 驗證設定
arbitrage-bot config validate

# 檢查系統狀態
arbitrage-bot doctor
```

### 啟動監控

```bash
# 前景執行 (用於測試)
arbitrage-bot monitor start

# 背景執行 (用於生產環境)
arbitrage-bot monitor start --daemon

# 查看狀態
arbitrage-bot monitor status
```

---

## 最佳實踐

### 1. 監控管理

- 使用 `--daemon` 在背景執行監控服務
- 定期檢查 `monitor status` 確認服務狀態
- 使用 `doctor` 命令診斷系統健康狀況

### 2. 交易執行

- 首次使用建議先使用 `--dry-run` 模擬執行
- 執行交易前先檢查 `account balance` 確認餘額充足
- 設定合理的 `risk.threshold` 避免誤判套利機會

### 3. 風險管理

- 設定 `maxTradeAmount` 限制單筆交易金額
- 設定 `maxMarginUsage` 避免過度槓桿
- 定期檢查 `positions list` 監控持倉狀態
- 使用 `history stats` 評估策略績效

### 4. 日誌與監控

- 使用 `--verbose` 記錄詳細執行過程
- 定期檢查 `logs --level error` 發現潛在問題
- 設定通知頻道 (Telegram) 即時接收重要事件

### 5. 設定管理

- 使用環境變數管理敏感資訊 (API 金鑰、密碼)
- 針對不同環境準備不同設定檔 (dev, staging, production)
- 執行 `config validate` 確保設定正確性

---

## 附錄

### A. 支援的交易所

| 交易所 | 代碼 | 永續合約類型 | API 文件 |
|--------|------|------------|---------|
| Binance | `binance` | USDT-M Futures | [docs](https://binance-docs.github.io/apidocs/futures/en/) |
| OKX | `okx` | USDT Swap | [docs](https://www.okx.com/docs-v5/en/) |

### B. 支援的幣別

| 幣別 | 代碼 | 合約符號 (Binance) | 合約符號 (OKX) |
|------|------|------------------|---------------|
| Bitcoin | `BTC` | BTCUSDT | BTC-USDT-SWAP |
| Ethereum | `ETH` | ETHUSDT | ETH-USDT-SWAP |
| Solana | `SOL` | SOLUSDT | SOL-USDT-SWAP |

### C. 時間格式說明

系統使用以下時間格式:

- **ISO 8601**: `2025-10-17T10:35:30.000Z` (JSON 輸出)
- **簡短格式**: `10/17 10:35` (Table 輸出)
- **相對時間**: `2m ago`, `5h 30m` (人性化顯示)

### D. 單位說明

- **金額**: 美元 (USD) 或 USDT
- **數量**: 幣別單位 (BTC, ETH, SOL)
- **百分比**: 小數形式,如 `0.05%` 表示 0.0005
- **時間**: 秒 (seconds) 或人性化格式 (2h 34m)

---

## 版本歷史

| 版本 | 日期 | 變更說明 |
|------|------|---------|
| 1.0.0 | 2025-10-17 | 初始版本,包含所有核心指令 |

---

## 技術支援

- **文件**: [GitHub Wiki](https://github.com/your-org/arbitrage-bot/wiki)
- **問題回報**: [GitHub Issues](https://github.com/your-org/arbitrage-bot/issues)
- **討論區**: [GitHub Discussions](https://github.com/your-org/arbitrage-bot/discussions)
