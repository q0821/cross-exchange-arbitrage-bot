# Implementation Plan: 通知加入開倉連結

**Branch**: `058-notification-open-link` | **Date**: 2026-01-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/058-notification-open-link/spec.md`

## Summary

在 Discord/Slack 套利機會通知中加入「開倉」按鈕連結，點擊後跳轉到平台的市場監控頁面並自動帶入交易對、多方和空方交易所參數，同時在前端解析 URL 參數並自動開啟開倉對話框。

## Technical Context

**Language/Version**: TypeScript 5.8 + Node.js 20.x LTS
**Primary Dependencies**: Next.js 15, React 19, axios (Discord/Slack webhook)
**Storage**: N/A (無新增資料儲存需求)
**Testing**: Vitest 4.x
**Target Platform**: Web (Next.js App Router)
**Project Type**: Web application
**Performance Goals**: 通知發送延遲 < 1 秒
**Constraints**: 連結必須在 Discord/Slack 內可點擊
**Scale/Scope**: 現有用戶規模，無新增負載

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- ✅ 無新增外部依賴
- ✅ 無新增資料模型
- ✅ 修改範圍限於通知服務和前端頁面
- ✅ 遵循現有程式碼風格

## Project Structure

### Documentation (this feature)

```
specs/058-notification-open-link/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── quickstart.md        # Phase 1 output
└── checklists/
    └── requirements.md  # Spec validation checklist
```

### Source Code (repository root)

```
src/
├── services/
│   └── notification/
│       ├── DiscordNotifier.ts    # [MODIFY] 新增開倉連結按鈕
│       ├── SlackNotifier.ts      # [MODIFY] 新增開倉連結按鈕
│       └── utils.ts              # [MODIFY] 新增連結生成函式

app/
├── (dashboard)/
│   └── market-monitor/
│       └── page.tsx              # [MODIFY] 解析 URL 參數並自動開啟對話框

tests/
├── unit/
│   └── services/
│       └── notification/
│           └── OpenLinkNotification.test.ts  # [NEW] 連結生成測試
```

**Structure Decision**: 單一專案結構，前後端共用 TypeScript codebase

## Complexity Tracking

*No violations - straightforward feature addition*

## Phase 0: Research

### 技術決策

1. **連結格式**：`{BASE_URL}/market-monitor?symbol={symbol}&long={longExchange}&short={shortExchange}`
   - 使用 query parameters 而非 path parameters，便於前端解析
   - 參數名稱簡潔明確

2. **Discord 按鈕實作**：使用 Discord Embed 的 `fields` 區塊加入超連結
   - 現有實作已有「交易連結」區塊，可在同位置新增「開倉」連結
   - 格式：`[🚀 開倉](URL)`

3. **Slack 按鈕實作**：使用 Block Kit 的 `section` 區塊加入超連結
   - 格式：`<URL|🚀 開倉>`

4. **BASE_URL 配置**：
   - 使用環境變數 `NEXT_PUBLIC_BASE_URL`
   - 預設值：`http://localhost:3000`

5. **前端 URL 參數解析**：
   - 使用 Next.js `useSearchParams` hook
   - 參數存在時自動查找對應 rate 並開啟對話框

## Phase 1: Design

### 1.1 連結生成函式

```typescript
// src/services/notification/utils.ts
export function generateOpenPositionUrl(
  symbol: string,
  longExchange: string,
  shortExchange: string
): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const params = new URLSearchParams({
    symbol,
    long: longExchange,
    short: shortExchange,
  });
  return `${baseUrl}/market-monitor?${params.toString()}`;
}
```

### 1.2 Discord 通知修改

在 `sendArbitrageNotification` 的 embed fields 中，將「交易連結」區塊改為包含開倉連結：

```typescript
{
  name: '🔗 快速操作',
  value: [
    `[🚀 開倉](${generateOpenPositionUrl(message.symbol, message.longExchange, message.shortExchange)})`,
    `[${message.longExchange.toUpperCase()}](${generateExchangeUrl(message.longExchange, message.symbol)})`,
    `[${message.shortExchange.toUpperCase()}](${generateExchangeUrl(message.shortExchange, message.symbol)})`,
  ].join(' | '),
  inline: false,
}
```

### 1.3 Slack 通知修改

在 `sendArbitrageNotification` 的 blocks 中，將「交易連結」區塊改為包含開倉連結：

```typescript
{
  type: 'section',
  text: {
    type: 'mrkdwn',
    text: `*🔗 快速操作*\n<${generateOpenPositionUrl(message.symbol, message.longExchange, message.shortExchange)}|🚀 開倉> | <${generateExchangeUrl(message.longExchange, message.symbol)}|${message.longExchange.toUpperCase()}> | <${generateExchangeUrl(message.shortExchange, message.symbol)}|${message.shortExchange.toUpperCase()}>`,
  },
}
```

### 1.4 前端 URL 參數處理

```typescript
// app/(dashboard)/market-monitor/page.tsx
import { useSearchParams } from 'next/navigation';

// 在 MarketMonitorPage 組件內
const searchParams = useSearchParams();
const urlSymbol = searchParams.get('symbol');
const urlLong = searchParams.get('long');
const urlShort = searchParams.get('short');

// 當 URL 參數存在且 ratesMap 已載入時，自動開啟開倉對話框
useEffect(() => {
  if (urlSymbol && urlLong && urlShort && ratesMap.size > 0) {
    const rate = ratesMap.get(urlSymbol);
    if (rate?.bestPair?.longExchange === urlLong && rate.bestPair.shortExchange === urlShort) {
      openPositionDialog(rate);
    }
  }
}, [urlSymbol, urlLong, urlShort, ratesMap, openPositionDialog]);
```

### 1.5 Edge Cases 處理

1. **套利機會已不存在**：顯示 toast 提示「此套利機會已不存在」
2. **用戶未登入**：Next.js middleware 處理，重定向到登入頁
3. **參數不完整/格式錯誤**：忽略，正常顯示頁面不自動開啟對話框

## Dependencies

```
Phase 1: Design
└── Phase 2: Implementation (並行)
    ├── T001: 新增連結生成函式
    ├── T002: 修改 Discord 通知 (depends on T001)
    ├── T003: 修改 Slack 通知 (depends on T001)
    ├── T004: 前端 URL 參數解析
    └── T005: 撰寫測試
```
