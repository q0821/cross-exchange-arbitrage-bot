# Technical Research: 通知加入開倉連結

**Feature**: 058-notification-open-link
**Date**: 2026-01-07

## Research Questions

### Q1: Discord/Slack 連結格式選擇

**決策**: 使用 Markdown 超連結格式

**理由**:
1. Discord Embed 支援 Markdown 格式 `[text](url)`
2. Slack Block Kit 支援 mrkdwn 格式 `<url|text>`
3. 無需額外的 Button component（需要 Interactions endpoint）
4. 現有程式碼已使用此模式（交易所連結）

**替代方案考慮**:
- Discord Button component: 需要設定 Interactions endpoint，複雜度高
- Slack Button component: 需要設定 Action endpoint，複雜度高

### Q2: BASE_URL 環境變數

**決策**: 使用 `NEXT_PUBLIC_BASE_URL`

**理由**:
1. 前綴 `NEXT_PUBLIC_` 確保在 server-side 和 client-side 都可用
2. 與 Next.js 慣例一致
3. 容易在不同環境配置（開發、測試、生產）

**配置範例**:
```env
# .env.local (開發)
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# .env.production (生產)
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

### Q3: 前端 URL 參數解析時機

**決策**: 使用 `useEffect` 監聽參數變化

**理由**:
1. 需要等待 `ratesMap` 載入完成
2. 避免多次觸發開啟對話框
3. 符合 React hooks 最佳實踐

**實作細節**:
```typescript
// 使用 ref 避免重複觸發
const hasOpenedFromUrl = useRef(false);

useEffect(() => {
  if (hasOpenedFromUrl.current) return;
  if (urlSymbol && urlLong && urlShort && ratesMap.size > 0) {
    // ... 開啟對話框
    hasOpenedFromUrl.current = true;
  }
}, [urlSymbol, urlLong, urlShort, ratesMap]);
```

### Q4: 當套利機會不存在時的處理

**決策**: 顯示 toast 提示，不阻斷頁面載入

**理由**:
1. 用戶仍可正常瀏覽其他機會
2. 提示訊息清楚告知原因
3. 不影響頁面其他功能

**實作方式**:
- 使用現有的 toast/notification 系統（如果有）
- 或使用 `console.warn` + alert（簡易方案）

## 現有程式碼分析

### DiscordNotifier.ts

- 位置：`src/services/notification/DiscordNotifier.ts`
- `sendArbitrageNotification` 方法第 91-99 行有「交易連結」區塊
- 可直接在此區塊新增開倉連結

### SlackNotifier.ts

- 位置：`src/services/notification/SlackNotifier.ts`
- `sendArbitrageNotification` 方法第 117-124 行有「交易連結」區塊
- 可直接在此區塊新增開倉連結

### market-monitor/page.tsx

- 位置：`app/(dashboard)/market-monitor/page.tsx`
- 已使用 `useOpenPosition` hook 提供 `openPositionDialog` 方法
- 需新增 `useSearchParams` 和相關 effect

### utils.ts

- 位置：`src/services/notification/utils.ts`
- 已有 `generateExchangeUrl` 函式可參考
- 新增 `generateOpenPositionUrl` 函式

## 風險評估

| 風險 | 可能性 | 影響 | 緩解措施 |
|------|--------|------|----------|
| 連結在某些 Discord 客戶端無法點擊 | 低 | 中 | 使用標準 Markdown 格式 |
| BASE_URL 配置錯誤 | 中 | 高 | 提供預設值、文件說明 |
| 參數被惡意篡改 | 低 | 低 | 前端驗證 rate 存在性 |

## 結論

此功能實作複雜度低，主要修改現有通知程式碼和前端頁面。無需新增外部依賴或資料模型。
