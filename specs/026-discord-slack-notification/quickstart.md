# Quickstart: Discord/Slack 套利機會即時推送通知

## 先決條件

- Node.js 20.x LTS
- PostgreSQL 15+ 已啟動
- 已完成專案基本設定（`pnpm install`）
- 已有 Discord 或 Slack 的 Webhook URL

## 快速開始

### 1. 執行資料庫遷移

```bash
# 建立並執行遷移
pnpm prisma migrate dev --name add_notification_webhooks
```

### 2. 啟動開發伺服器

```bash
pnpm dev
```

### 3. 設定 Webhook

1. 登入 Web 介面
2. 進入「設定」→「通知設定」
3. 點擊「新增 Webhook」
4. 選擇平台（Discord 或 Slack）
5. 貼上 Webhook URL
6. 設定名稱和觸發閾值（預設 800%）
7. 點擊「測試」確認連線正常
8. 儲存設定

### 4. 取得 Webhook URL

#### Discord

1. 進入 Discord 伺服器設定
2. 選擇「整合」→「Webhooks」
3. 點擊「新 Webhook」
4. 選擇要發送通知的頻道
5. 複製 Webhook URL

#### Slack

1. 進入 Slack Workspace 設定
2. 選擇「Apps」→「Incoming Webhooks」
3. 啟用 Incoming Webhooks
4. 點擊「Add New Webhook to Workspace」
5. 選擇要發送通知的頻道
6. 複製 Webhook URL

## 驗證功能

### 測試通知發送

在通知設定頁面，對已設定的 Webhook 點擊「測試」按鈕：

- 成功：Discord/Slack 頻道會收到測試訊息
- 失敗：顯示錯誤訊息（如 URL 無效、頻道不存在等）

### 模擬套利機會

在開發環境中，可透過修改 RatesCache 模擬高收益套利機會：

```typescript
// 僅供測試用
import { ratesCache } from './src/services/monitor/RatesCache';

// 模擬一個 1000% 年化收益的機會
const mockRate = {
  symbol: 'BTCUSDT',
  bestPair: {
    longExchange: 'binance',
    shortExchange: 'okx',
    spreadPercent: 0.1,
    spreadAnnualized: 1095, // 1095% 年化
    priceDiffPercent: 0.01,
  },
  // ... 其他欄位
};

ratesCache.set('BTCUSDT', mockRate);
```

## 通知內容範例

### Discord

```
🚀 套利機會：BTCUSDT
━━━━━━━━━━━━━━━━━━

📈 做多：Binance
   原始：0.0100% / 8h
   標準化(8h)：0.0100%

📉 做空：OKX
   原始：-0.0300% / 4h
   標準化(8h)：-0.0600%

━━━━━━━━━━━━━━━━━━
💰 費率差：0.0700%
📊 年化收益：1022.75%
⏱️ 回本：約 10 次費率

━━━━━━━━━━━━━━━━━━
📊 價差分析：
   方向：✅ 正確
   建議：✅ 適合套利

━━━━━━━━━━━━━━━━━━
🔗 Binance | OKX
```

## 環境變數

無需額外環境變數，所有設定透過 Web 介面管理。

## 常見問題

### Q: 為什麼沒收到通知？

1. 確認 Webhook 已啟用（`isEnabled: true`）
2. 確認年化收益超過設定閾值
3. 確認 5 分鐘內沒有重複推送（同一機會）
4. 檢查伺服器日誌是否有錯誤

### Q: 如何調整通知頻率？

同一套利機會 5 分鐘內不會重複推送。此設定目前為系統預設，暫不支援自訂。

### Q: Webhook URL 如何儲存？

Webhook URL 使用 AES-256-GCM 加密儲存，與 API Key 使用相同的加密機制。
