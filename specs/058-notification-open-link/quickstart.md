# Quickstart: 通知加入開倉連結

**Feature**: 058-notification-open-link
**Date**: 2026-01-07

## 環境設定

### 1. 設定 BASE_URL 環境變數

在 `.env.local` 中新增：

```env
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

生產環境：

```env
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

## 功能測試

### 測試 1: Discord 通知連結

1. 確保已設定 Discord Webhook
2. 觸發套利機會通知（或使用測試 API）
3. 在 Discord 查看通知，確認「開倉」連結存在
4. 點擊連結，確認跳轉到市場監控頁面
5. 確認 URL 包含正確參數：`?symbol=BTCUSDT&long=binance&short=okx`
6. 確認開倉對話框自動開啟並預填資訊

### 測試 2: Slack 通知連結

1. 確保已設定 Slack Webhook
2. 觸發套利機會通知
3. 在 Slack 查看通知，確認「開倉」連結存在
4. 點擊連結，確認跳轉到市場監控頁面
5. 確認開倉對話框自動開啟

### 測試 3: Edge Case - 機會已不存在

1. 手動構造 URL：`/market-monitor?symbol=INVALID&long=binance&short=okx`
2. 訪問該 URL
3. 確認頁面正常載入（不自動開啟對話框）
4. 確認顯示提示訊息「此套利機會已不存在」

### 測試 4: Edge Case - 參數不完整

1. 訪問 `/market-monitor?symbol=BTCUSDT`（缺少 long/short）
2. 確認頁面正常載入
3. 確認不自動開啟對話框

### 測試 5: Edge Case - 交易所組合不匹配

1. 假設當前 BTCUSDT 最佳組合是 binance/okx
2. 訪問 `/market-monitor?symbol=BTCUSDT&long=gateio&short=mexc`
3. 確認頁面正常載入
4. 確認不自動開啟對話框（或顯示提示）

## 單元測試

執行測試：

```bash
pnpm test -- OpenLinkNotification
```

測試案例：
1. `generateOpenPositionUrl` 生成正確的 URL
2. URL 包含正確的 query parameters
3. 特殊字元正確編碼

## 驗收標準

- [ ] Discord 通知包含可點擊的「開倉」連結
- [ ] Slack 通知包含可點擊的「開倉」連結
- [ ] 點擊連結後跳轉到正確頁面
- [ ] URL 參數正確傳遞
- [ ] 開倉對話框自動開啟並預填資訊
- [ ] Edge cases 處理正確
