# Quickstart: 持倉平倉建議監控

## 功能概述

Feature 067 提供持倉平倉建議功能，當以下條件滿足時通知用戶：

1. **APY < 0%** - 繼續持有會虧損，強制建議平倉
2. **APY < X% 且 累計費率收益 > 價差損失** - 整體有獲利可鎖定

---

## 啟動服務

### 環境變數

```bash
# .env.local
ENABLE_POSITION_EXIT_MONITOR=true  # 啟用平倉建議監控
```

### 服務啟動

服務會隨 FundingRateMonitor 自動啟動，無需額外配置。

---

## 用戶設定

### API 端點

```
PATCH /api/settings/trading
```

### 設定參數

| 參數 | 說明 | 預設值 | 範圍 |
|------|------|--------|------|
| `exitSuggestionEnabled` | 啟用平倉建議 | true | - |
| `exitSuggestionThreshold` | APY 閾值 (%) | 100 | 0-500 |
| `exitNotificationEnabled` | 啟用通知 | true | - |

### 範例請求

```bash
curl -X PATCH /api/settings/trading \
  -H "Content-Type: application/json" \
  -d '{
    "exitSuggestionEnabled": true,
    "exitSuggestionThreshold": 50,
    "exitNotificationEnabled": true
  }'
```

---

## 通知管道

### WebSocket

監聽以下事件：

- `position:exit:suggested` - 平倉建議
- `position:exit:canceled` - 建議取消

### Discord/Slack

需先設定 Webhook（Feature 026）。通知格式：

```
🔔 平倉建議 - BTCUSDT
⚠️ 原因: APY 已轉負
📊 當前 APY: -50.2%
💰 累計費率收益: +12.35 USDT
📉 價差損失: -8.20 USDT
✅ 淨收益: +4.15 USDT
```

---

## 前端整合

### 持倉卡片警告

```tsx
// app/(dashboard)/positions/components/PositionCard.tsx
{position.exitSuggested && (
  <ExitSuggestionWarning
    reason={position.exitSuggestedReason}
    suggestedAt={position.exitSuggestedAt}
  />
)}
```

### WebSocket Hook

```tsx
import { useExitSuggestion } from '@/hooks/useExitSuggestion';

function PositionsPage() {
  useExitSuggestion({
    onSuggested: (data) => {
      toast.warning(`建議平倉: ${data.symbol}`);
    },
    onCanceled: (data) => {
      toast.info(`平倉建議已取消: ${data.symbol}`);
    },
  });
}
```

---

## 測試

### 單元測試

```bash
pnpm test tests/unit/services/PositionExitMonitor.test.ts
```

### 整合測試

```bash
pnpm test tests/integration/PositionExitMonitorFlow.test.ts
```

---

## 故障排除

### 未收到通知

1. 檢查 `exitSuggestionEnabled` 是否為 true
2. 檢查 Discord/Slack Webhook 是否正確設定
3. 查看後端日誌中是否有相關錯誤

### 累計收益計算錯誤

1. 檢查交易所 API Key 是否有讀取權限
2. 查看 `cachedFundingPnLUpdatedAt` 確認快取是否過時

### APY 計算不準確

確認 FundingRateMonitor 正常運行，檢查 `/api/rates` 返回的數據。
