# Implementation Plan: 統一 UI 主題系統

**Branch**: `046-unified-ui-theme` | **Date**: 2025-12-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/046-unified-ui-theme/spec.md`

## Summary

本功能統一跨交易所套利交易平台的 UI 視覺風格，解決資產總覽頁面（深色主題）與其他頁面（淺色主題）不一致的問題。實作深淺色主題切換（預設跟隨系統）、Glassmorphism 毛玻璃效果、Bento Grid 版面佈局，並確保所有六個主要頁面呈現統一的視覺體驗。

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**: Next.js 14 App Router, React 18, Tailwind CSS 3.4, Radix UI, next-themes (新增)
**Storage**: localStorage (用戶主題偏好)
**Testing**: Vitest (unit), Playwright (e2e)
**Target Platform**: Web (Chrome 76+, Firefox 70+, Safari 14+, Edge 79+)
**Project Type**: Web application (Next.js monorepo)
**Performance Goals**: 主題切換 < 200ms, 無 FOUC
**Constraints**: WCAG 2.1 AA 色彩對比度 (4.5:1)
**Scale/Scope**: 6 個主要頁面, ~20 個元件需遷移

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Trading Safety First | ✅ N/A | 純 UI 功能，不涉及交易邏輯 |
| II. Complete Observability | ✅ N/A | 前端視覺變更，不影響日誌 |
| III. Defensive Programming | ✅ PASS | backdrop-filter 降級方案已規劃 |
| IV. Data Integrity | ✅ N/A | 僅使用 localStorage，不涉及資料庫 |
| V. Incremental Delivery | ✅ PASS | 可按 User Story 優先級漸進式交付 |
| VI. System Architecture Boundaries | ✅ PASS | 純 Web 前端功能，符合邊界分離 |
| VII. TDD Discipline | ✅ PASS | 視覺元件使用 Playwright 視覺測試 |

**Gate Result**: ✅ PASS - 無違規，可進入 Phase 0

## Project Structure

### Documentation (this feature)

```
specs/046-unified-ui-theme/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (localStorage schema)
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (N/A - no API changes)
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```
app/
├── globals.css                      # CSS 變數（需修改）
├── layout.tsx                       # 根佈局（需修改）
├── providers.tsx                    # ThemeProvider（新增）
└── (dashboard)/
    ├── DashboardLayoutClient.tsx    # Dashboard 佈局（需修改）
    ├── assets/
    │   ├── page.tsx                 # 資產總覽（需修改）
    │   └── components/              # 4 個元件（需修改）
    ├── market-monitor/
    │   ├── page.tsx                 # 市場監控（需修改）
    │   └── components/              # 3 個元件（需修改）
    ├── positions/
    │   ├── page.tsx                 # 持倉管理（需修改）
    │   └── components/              # 多個元件（需修改）
    ├── trades/
    │   ├── page.tsx                 # 交易歷史（需修改）
    │   └── components/              # 多個元件（需修改）
    ├── settings/                    # 3 個設定頁面（需修改）
    └── simulated-tracking/
        └── page.tsx                 # 模擬追蹤（需修改）

components/
└── ui/
    ├── theme-toggle.tsx             # 主題切換元件（新增）
    └── glass-card.tsx               # 毛玻璃卡片（新增）

tailwind.config.js                   # Tailwind 配置（需修改）
```

**Structure Decision**: 使用現有 Next.js App Router 結構，新增主題相關元件至 `components/ui/`，全域樣式更新 `app/globals.css`。

## Complexity Tracking

*No violations - table not required*

## Phase 0: Research Tasks

### Research Items

1. **next-themes 整合最佳實踐**
   - 如何在 Next.js 14 App Router 中正確設定
   - 避免 FOUC 的策略
   - SSR hydration 問題處理

2. **Glassmorphism CSS 實作**
   - backdrop-filter 瀏覽器支援度
   - 降級方案 (fallback) 實作方式
   - 效能影響評估

3. **Bento Grid 佈局模式**
   - CSS Grid 實作方式
   - 響應式斷點策略
   - 與 Tailwind CSS 整合

4. **WCAG 2.1 AA 色彩驗證**
   - 深色/淺色模式色彩對比度計算
   - 自動化驗證工具

## Phase 1: Design Artifacts

### Data Model (localStorage Schema)

```typescript
// localStorage key: 'theme'
type ThemePreference = 'light' | 'dark' | 'system';
```

### Contracts

本功能不涉及 API 變更，僅為前端視覺調整。

### Color System Design

```css
/* Light Mode */
:root {
  --background: 210 20% 98%;        /* #F8FAFC */
  --foreground: 222.2 84% 4.9%;     /* #0F172A */
  --card: 0 0% 100% / 0.7;          /* white/70 for glassmorphism */
  --primary: 221.2 83.2% 53.3%;     /* #3B82F6 */
  --secondary: 38 92% 50%;          /* #F59E11 (Amber) */
  --profit: 142 76% 36%;            /* #22C55E */
  --loss: 0 84% 60%;                /* #EF4444 */
}

/* Dark Mode */
.dark {
  --background: 222.2 84% 4.9%;     /* #0F172A */
  --foreground: 210 40% 98%;        /* #F8FAFC */
  --card: 217.2 32.6% 11% / 0.7;    /* slate-800/70 */
  --primary: 217.2 91.2% 59.8%;     /* #60A5FA */
  --secondary: 38 92% 50%;          /* #FBBF24 */
  --profit: 142 71% 45%;            /* #4ADE80 */
  --loss: 0 72% 51%;                /* #F87171 */
}
```

### Glassmorphism Utilities

```css
.glass-card {
  @apply bg-card backdrop-blur-xl border border-white/20 dark:border-slate-700/50 shadow-lg rounded-lg;
}

/* Fallback for browsers without backdrop-filter */
@supports not (backdrop-filter: blur(1px)) {
  .glass-card {
    @apply bg-white dark:bg-slate-800;
  }
}
```

### Bento Grid Layout (Assets Page)

```
Desktop (>= 1024px):
+------------------+------------------+
|                  |                  |
|   總資產 (2x1)   |   BingX 餘額     |
|                  |                  |
+------------------+--------+---------+
|                  |        |         |
|   資產曲線圖     | Binance| OKX     |
|   (2x1)          |        |         |
+------------------+--------+---------+
|          持倉列表 (3x1)             |
+-------------------------------------+

Tablet (768-1023px):
+------------------+
|    總資產 (1x1)  |
+--------+---------+
| Binance| OKX     |
+--------+---------+
| BingX  | Gate.io |
+--------+---------+
|    資產曲線圖    |
+------------------+
|    持倉列表      |
+------------------+

Mobile (< 768px):
Single column stack
```

## Implementation Priority

按 User Story 優先級排序：

1. **P1 - 基礎設施** (US1 + US2)
   - 安裝 next-themes
   - 更新 globals.css CSS 變數
   - 建立 ThemeProvider
   - 統一所有頁面配色

2. **P2 - 主題切換與毛玻璃** (US3 + US4)
   - 建立 ThemeToggle 元件
   - 建立 GlassCard 元件
   - 更新 DashboardLayout

3. **P3 - Bento Grid 佈局** (US5)
   - 重構資產總覽頁面佈局
   - 響應式調整

## Dependencies

```
新增依賴：
- next-themes: ^0.4.0 (主題切換)

現有依賴（已安裝）：
- tailwindcss: ^3.4.18
- @radix-ui/*: (UI 元件)
- lucide-react: ^0.548.0 (圖示)
```
