# 套利機會自動偵測系統 - 使用指南

**版本**: v0.4.0
**最後更新**: 2025-10-23

本指南將幫助你快速上手使用套利機會自動偵測系統（Phase 1-3 MVP）。

---

## 📋 目錄

1. [系統概述](#系統概述)
2. [前置需求](#前置需求)
3. [安裝與設定](#安裝與設定)
4. [基本使用](#基本使用)
5. [進階功能](#進階功能)
6. [配置調整](#配置調整)
7. [疑難排解](#疑難排解)
8. [最佳實踐](#最佳實踐)

---

## 系統概述

### 功能簡介

套利機會自動偵測系統會持續監控 Binance 和 OKX 兩個交易所的資金費率，當費率差異達到設定的閾值時，系統會：

1. **自動偵測**套利機會
2. **即時通知**使用者（終端機彩色輸出 + 結構化日誌）
3. **記錄機會**生命週期（從出現到消失）
4. **提供統計**和歷史查詢功能

### 核心概念

- **資金費率 (Funding Rate)**: 永續合約定期結算的費用，用於維持合約價格接近現貨價格
- **費率差異 (Rate Difference)**: 兩個交易所之間的資金費率差距
- **閾值 (Threshold)**: 系統偵測套利機會的最小費率差異（預設 0.05%）
- **年化收益率 (Annualized Return)**: 考慮結算頻率計算的預期年化收益
- **防抖動 (Debounce)**: 避免短時間內重複通知的機制（預設 30 秒）

---

## 前置需求

### 系統需求

- **作業系統**: macOS, Linux, Windows (WSL2)
- **Node.js**: >= 20.0.0
- **pnpm**: >= 8.0.0
- **PostgreSQL**: >= 15.0 (含 TimescaleDB extension)
- **Docker** (可選，用於本地開發環境)

### 技能需求

- 基本的終端機命令列操作
- 了解資金費率套利的基本概念

---

## 安裝與設定

### 步驟 1: 克隆專案

```bash
git clone git@github.com:q0821/cross-exchange-arbitrage-bot.git
cd cross-exchange-arbitrage-bot
```

### 步驟 2: 安裝依賴

```bash
pnpm install
```

### 步驟 3: 設定環境變數

```bash
# 複製範例環境變數檔案
cp .env.example .env

# 編輯 .env 檔案，填入資料庫連線資訊
# 如果你使用 Docker，預設值應該就可以運作
```

### 步驟 4: 啟動資料庫

使用 Docker（推薦）：
```bash
pnpm docker:up
```

或手動啟動 PostgreSQL 並安裝 TimescaleDB extension。

### 步驟 5: 執行資料庫遷移

```bash
# 執行所有 migrations
pnpm prisma migrate deploy

# 生成 Prisma Client
pnpm prisma generate
```

### 步驟 6: 驗證安裝

```bash
# 執行測試確認一切正常
pnpm test --run

# 應該看到：186 個測試通過
```

---

## 基本使用

### 場景 1: 首次使用

**目標**: 查看當前的套利機會

```bash
# 1. 確保資料庫正在運行
pnpm docker:up

# 2. 列出所有活躍的套利機會
pnpm tsx src/cli/index.ts opportunities list

# 如果是第一次使用，可能會看到「目前沒有活躍的套利機會」
# 這是正常的，因為系統需要先收集資金費率資料
```

**預期輸出**：
```
┌─────────────────────────────────────────────────────────────────┐
│ 活躍套利機會                                                    │
├────────┬──────────┬───────────┬─────────┬──────────┬───────────┤
│ Symbol │ Long     │ Short     │ Spread  │ Annual % │ Duration  │
├────────┼──────────┼───────────┼─────────┼──────────┼───────────┤
│ BTC    │ binance  │ okx       │ 0.07%   │ 76.65%   │ 5m 23s    │
│ ETH    │ binance  │ okx       │ 0.06%   │ 65.70%   │ 2m 15s    │
└────────┴──────────┴───────────┴─────────┴──────────┴───────────┘
```

### 場景 2: 查看機會詳情

```bash
# 從上面的列表中複製機會 ID
pnpm tsx src/cli/index.ts opportunities show <opportunity-id>
```

**預期輸出**：
```
套利機會詳情
═══════════════════════════════════════════

基本資訊
  ID:              abc123-def456-...
  幣別:            BTC
  狀態:            ACTIVE

交易策略
  做多交易所:      binance
  做空交易所:      okx
  做多費率:        0.01%
  做空費率:        0.08%
  費率差異:        0.07%

收益預估
  預期年化收益:    76.65%
  最大費率差異:    0.09%

時間資訊
  偵測時間:        2025-10-23 14:30:25
  持續時間:        5 分 23 秒
  最後通知:        2025-10-23 14:35:00
  通知次數:        3
```

### 場景 3: 調整偵測閾值

**目標**: 只接收高收益機會的通知（例如年化收益 > 100%）

```bash
# 1. 查看當前配置
pnpm tsx src/cli/index.ts opportunities config

# 2. 計算閾值：年化 100% = 費率差異約 0.091%
#    公式: threshold = target_annual / (3 * 365)
#    100 / (3 * 365) = 0.000914

# 3. 設定新的閾值
pnpm tsx src/cli/index.ts opportunities config --threshold 0.00091

# 4. 驗證配置已更新
pnpm tsx src/cli/index.ts opportunities config
```

**預期輸出**：
```
套利機會偵測配置
═══════════════════════════════════════════

偵測參數
  最小費率差異:     0.091% (年化約 99.64%)
  防抖動窗口:       30 秒

通知設定
  已啟用渠道:       Terminal, Log
  通知詳細度:       標準
```

### 場景 4: 篩選特定幣別

```bash
# 只查看 BTC 的機會
pnpm tsx src/cli/index.ts opportunities list --symbol BTC

# 只查看年化收益 > 80% 的機會
pnpm tsx src/cli/index.ts opportunities list --min-return 80

# 按持續時間排序
pnpm tsx src/cli/index.ts opportunities list --sort-by time

# 組合使用
pnpm tsx src/cli/index.ts opportunities list \
  --symbol BTC \
  --min-return 80 \
  --sort-by return \
  --limit 5
```

---

## 進階功能

### JSON 輸出模式

適合用於腳本自動化或整合到其他系統：

```bash
# 獲取 JSON 格式的機會列表
pnpm tsx src/cli/index.ts opportunities list --format json

# 獲取 JSON 格式的配置
pnpm tsx src/cli/index.ts opportunities config --format json
```

**範例輸出**：
```json
{
  "opportunities": [
    {
      "id": "abc123-def456-...",
      "symbol": "BTC",
      "longExchange": "binance",
      "shortExchange": "okx",
      "rateDifference": "0.0007",
      "expectedReturnRate": "0.7665",
      "status": "ACTIVE",
      "detectedAt": "2025-10-23T14:30:25.123Z",
      "durationMinutes": 5.38
    }
  ],
  "total": 1,
  "timestamp": "2025-10-23T14:35:48.456Z"
}
```

### 查看所有狀態的機會

```bash
# 包含已過期和已關閉的機會
pnpm tsx src/cli/index.ts opportunities list --status ALL

# 只查看已過期的機會
pnpm tsx src/cli/index.ts opportunities list --status EXPIRED

# 只查看已關閉的機會
pnpm tsx src/cli/index.ts opportunities list --status CLOSED
```

### 使用 Prisma Studio 查看資料

```bash
# 開啟 Prisma Studio（資料庫 GUI）
pnpm prisma studio

# 瀏覽器會自動開啟 http://localhost:5555
# 你可以查看所有資料表：
# - arbitrage_opportunities（套利機會）
# - opportunity_history（機會歷史）
# - notification_logs（通知日誌）
```

---

## 配置調整

### 偵測參數

```bash
# 查看當前配置
pnpm tsx src/cli/index.ts opportunities config

# 設定閾值（最小費率差異）
# 例如: 0.0005 = 0.05% (預設值)
pnpm tsx src/cli/index.ts opportunities config --threshold 0.0005

# 設定防抖動窗口（秒）
# 例如: 60 = 1 分鐘內同一幣別只通知一次
pnpm tsx src/cli/index.ts opportunities config --debounce 60

# 重置為預設值
pnpm tsx src/cli/index.ts opportunities config --reset
```

### 閾值建議

根據你的風險偏好和交易策略：

| 類型 | 閾值 | 年化收益 | 特點 |
|------|------|----------|------|
| 保守型 | 0.001 (0.1%) | ~109% | 機會較少但較穩定 |
| 平衡型 | 0.0005 (0.05%) | ~55% | 預設值，適合大多數情況 |
| 積極型 | 0.0003 (0.03%) | ~33% | 機會較多但可能雜訊較多 |

**計算公式**:
```
年化收益率 = 閾值 × 3（每天結算次數）× 365（天）
```

### 防抖動設定建議

| 窗口時間 | 適用場景 |
|----------|----------|
| 10 秒 | 開發測試環境 |
| 30 秒 | 預設值，一般使用 |
| 60 秒 | 減少通知頻率 |
| 120 秒 | 只關注持續較久的機會 |

---

## 疑難排解

### 問題 1: 資料庫連線失敗

**症狀**:
```
Error: Can't reach database server at `localhost:5432`
```

**解決方案**:
```bash
# 1. 檢查 Docker 容器是否運行
docker ps

# 2. 如果沒有運行，啟動容器
pnpm docker:up

# 3. 檢查 .env 檔案中的 DATABASE_URL 是否正確
cat .env | grep DATABASE_URL

# 4. 重新連接
pnpm prisma db push
```

### 問題 2: 沒有偵測到機會

**可能原因**:
1. 閾值設定過高
2. 資料庫中沒有資料
3. 監控服務未啟動

**解決方案**:
```bash
# 1. 降低閾值（例如改為 0.03%）
pnpm tsx src/cli/index.ts opportunities config --threshold 0.0003

# 2. 確認資料庫中是否有資料
pnpm prisma studio
# 查看 arbitrage_opportunities 表

# 3. 查看日誌
# 如果有錯誤會顯示在終端機或日誌檔案中
```

### 問題 3: 測試失敗

**症狀**:
```
FAIL tests/integration/opportunity-detection-mvp.test.ts
```

**解決方案**:
```bash
# 1. 確保資料庫正在運行
pnpm docker:up

# 2. 重置資料庫
pnpm prisma migrate reset --force

# 3. 重新執行測試
pnpm test --run
```

### 問題 4: CLI 指令找不到

**症狀**:
```
Command not found: opportunities
```

**解決方案**:
```bash
# 使用完整路徑執行
pnpm tsx src/cli/index.ts opportunities list

# 或建立 alias (加入 ~/.bashrc 或 ~/.zshrc)
alias arb="pnpm tsx src/cli/index.ts"

# 然後就可以使用
arb opportunities list
```

---

## 最佳實踐

### 1. 監控與告警

```bash
# 定期檢查系統狀態（建議每小時）
pnpm tsx src/cli/index.ts opportunities list

# 使用 cron 自動化（範例）
# 每小時執行一次，將結果寫入日誌
0 * * * * cd /path/to/bot && pnpm tsx src/cli/index.ts opportunities list >> /var/log/arb-bot.log 2>&1
```

### 2. 資料備份

```bash
# 定期備份資料庫（建議每天）
pg_dump -h localhost -U arbitrage_user arbitrage_db > backup_$(date +%Y%m%d).sql

# 或使用 Docker
docker exec arbitrage-postgres pg_dump -U arbitrage_user arbitrage_db > backup_$(date +%Y%m%d).sql
```

### 3. 效能優化

```bash
# 清理過期的通知日誌（TimescaleDB 會自動清理 90 天前的資料）
# 但你可以手動清理更早的資料

# 使用 Prisma Studio 或直接執行 SQL
DELETE FROM notification_logs WHERE sent_at < NOW() - INTERVAL '30 days';
```

### 4. 安全性建議

1. **不要提交 .env 檔案**到版本控制
2. **定期更新依賴**：`pnpm update`
3. **使用強密碼**保護資料庫
4. **限制網路存取**：只允許本機連接資料庫

### 5. 日常使用工作流程

```bash
# 早上 - 檢查昨晚的機會
pnpm tsx src/cli/index.ts opportunities list --status ALL

# 中午 - 檢查當前活躍機會
pnpm tsx src/cli/index.ts opportunities list

# 晚上 - 查看配置是否需要調整
pnpm tsx src/cli/index.ts opportunities config

# 每週 - 執行測試確保系統正常
pnpm test --run
```

---

## 參考資源

### 相關文件

- [README.md](../README.md) - 專案概述
- [API 文件](./API_REFERENCE.md) - API 參考手冊
- [開發指南](../specs/005-arbitrage-opportunity-detection/quickstart.md) - 開發者快速上手

### 外部資源

- [Prisma 文件](https://www.prisma.io/docs)
- [TimescaleDB 文件](https://docs.timescale.com)
- [資金費率套利原理](https://www.binance.com/en/support/faq/360033525031)

---

## 獲取幫助

如果你遇到問題或有建議：

1. 查看本文件的[疑難排解](#疑難排解)章節
2. 查看專案的 [Issues](https://github.com/q0821/cross-exchange-arbitrage-bot/issues)
3. 提交新的 Issue 描述你的問題

---

**版本歷史**:
- v0.4.0 (2025-10-23): Phase 1-3 MVP 完成，新增本使用指南
- v0.3.0 (2025-10-22): 基礎監控功能完成
