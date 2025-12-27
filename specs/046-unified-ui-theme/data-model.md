# Data Model: 統一 UI 主題系統

**Feature**: 046-unified-ui-theme
**Date**: 2025-12-28

## Overview

本功能不涉及資料庫變更，僅使用瀏覽器 localStorage 儲存用戶主題偏好。

---

## localStorage Schema

### Key: `theme`

由 next-themes 自動管理，無需手動操作。

```typescript
// 儲存格式
type ThemeValue = 'light' | 'dark' | 'system';

// localStorage 範例
localStorage.getItem('theme') // → 'dark' | 'light' | 'system' | null
```

### 行為說明

| 值 | 說明 |
|----|------|
| `null` | 未設定，等同於 `'system'` |
| `'system'` | 跟隨系統偏好 |
| `'light'` | 強制淺色模式 |
| `'dark'` | 強制深色模式 |

---

## CSS Variables Schema

### Root Variables (Light Mode)

```css
:root {
  /* 基礎色彩 */
  --background: 210 20% 98%;        /* #F8FAFC - 頁面背景 */
  --foreground: 222.2 84% 4.9%;     /* #0F172A - 主要文字 */

  /* 卡片 */
  --card: 0 0% 100%;                /* #FFFFFF - 卡片背景 */
  --card-foreground: 222.2 84% 4.9%;

  /* 主色調 */
  --primary: 221.2 83.2% 53.3%;     /* #3B82F6 - 主色 */
  --primary-foreground: 210 40% 98%;

  /* 次要色調 */
  --secondary: 38 92% 50%;          /* #F59E11 - Amber */
  --secondary-foreground: 222.2 47.4% 11.2%;

  /* 靜音/次要文字 */
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;

  /* 互動狀態 */
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;

  /* 語意色彩 */
  --destructive: 0 84.2% 60.2%;     /* #EF4444 - 錯誤/警告 */
  --profit: 142 76% 36%;            /* #22C55E - 獲利 */
  --loss: 0 84% 60%;                /* #EF4444 - 虧損 */
  --warning: 38 92% 50%;            /* #F59E0B - 警告 */

  /* 邊框 */
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 221.2 83.2% 53.3%;

  /* 圓角 */
  --radius: 0.5rem;                 /* 8px */
}
```

### Dark Mode Variables

```css
.dark {
  --background: 222.2 84% 4.9%;     /* #0F172A */
  --foreground: 210 40% 98%;        /* #F8FAFC */

  --card: 217.2 32.6% 11%;          /* #1E293B */
  --card-foreground: 210 40% 98%;

  --primary: 217.2 91.2% 59.8%;     /* #60A5FA */
  --primary-foreground: 222.2 47.4% 11.2%;

  --secondary: 38 92% 50%;          /* #FBBF24 */
  --secondary-foreground: 210 40% 98%;

  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;

  --accent: 217.2 32.6% 17.5%;
  --accent-foreground: 210 40% 98%;

  --destructive: 0 62.8% 30.6%;
  --profit: 142 71% 45%;            /* #4ADE80 */
  --loss: 0 72% 51%;                /* #F87171 */
  --warning: 38 92% 50%;            /* #FBBF24 */

  --border: 217.2 32.6% 17.5%;
  --input: 217.2 32.6% 17.5%;
  --ring: 224.3 76.3% 48%;
}
```

---

## Glassmorphism Variables

### 毛玻璃效果變數

```css
:root {
  /* 毛玻璃背景 - 淺色模式 */
  --glass-bg: 255 255 255 / 0.7;    /* white/70 */
  --glass-border: 255 255 255 / 0.2; /* white/20 */
  --glass-blur: 24px;               /* backdrop-blur-xl */
}

.dark {
  /* 毛玻璃背景 - 深色模式 */
  --glass-bg: 30 41 59 / 0.7;       /* slate-800/70 */
  --glass-border: 71 85 105 / 0.5;  /* slate-700/50 */
}
```

---

## Tailwind Utilities Extension

### tailwind.config.js 擴展

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        // 語意色彩
        profit: 'hsl(var(--profit))',
        loss: 'hsl(var(--loss))',
        warning: 'hsl(var(--warning))',
      },
    },
  },
}
```

---

## Component Props Interface

### ThemeToggle

```typescript
interface ThemeToggleProps {
  /** 按鈕大小 */
  size?: 'sm' | 'md' | 'lg';
  /** 是否顯示文字標籤 */
  showLabel?: boolean;
  /** 自定義 className */
  className?: string;
}
```

### GlassCard

```typescript
interface GlassCardProps {
  /** 子元素 */
  children: React.ReactNode;
  /** 自定義 className */
  className?: string;
  /** 是否啟用毛玻璃效果（預設 true） */
  glass?: boolean;
  /** padding 大小 */
  padding?: 'none' | 'sm' | 'md' | 'lg';
}
```

---

## State Transitions

### Theme State Machine

```
                    ┌─────────────────────┐
                    │     Initial Load    │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Check localStorage │
                    └──────────┬──────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
    ┌──────▼──────┐     ┌──────▼──────┐     ┌──────▼──────┐
    │   'light'   │     │   'dark'    │     │  'system'   │
    │   stored    │     │   stored    │     │  or null    │
    └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
           │                   │                   │
           │                   │           ┌──────▼──────┐
           │                   │           │ Check OS    │
           │                   │           │ preference  │
           │                   │           └──────┬──────┘
           │                   │                   │
           ▼                   ▼                   ▼
    ┌─────────────────────────────────────────────────────┐
    │              Apply Theme Class to <html>            │
    │        class="light" | class="dark" | class=""      │
    └─────────────────────────────────────────────────────┘
```

### User Theme Change Flow

```
User clicks ThemeToggle
        │
        ▼
┌───────────────────┐
│ setTheme(newTheme)│
└─────────┬─────────┘
          │
          ├───────────────────────────────┐
          │                               │
          ▼                               ▼
┌─────────────────────┐       ┌─────────────────────┐
│ Update localStorage │       │ Update <html> class │
│   theme = newTheme  │       │  class = newTheme   │
└─────────────────────┘       └─────────────────────┘
          │                               │
          └───────────────┬───────────────┘
                          │
                          ▼
              ┌─────────────────────┐
              │ CSS Variables Apply │
              │ (via :root / .dark) │
              └─────────────────────┘
```

---

## Validation Rules

### Theme Value Validation

```typescript
const validThemes = ['light', 'dark', 'system'] as const;

function isValidTheme(value: unknown): value is ThemeValue {
  return typeof value === 'string' && validThemes.includes(value as ThemeValue);
}
```

### Color Contrast Validation

所有色彩組合必須滿足 WCAG 2.1 AA 標準：

| 用途 | 最小對比度 |
|------|-----------|
| 正常文字 (< 18px) | 4.5:1 |
| 大文字 (>= 18px bold) | 3:1 |
| UI 元件/圖形 | 3:1 |
