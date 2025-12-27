# Quick Start: 統一 UI 主題系統

**Feature**: 046-unified-ui-theme
**Date**: 2025-12-28

## Prerequisites

- Node.js 20.x LTS
- pnpm 8.x+
- 已完成專案基礎設定

## 快速開始

### 1. 安裝依賴

```bash
pnpm add next-themes
```

### 2. 建立 ThemeProvider

建立 `app/providers.tsx`：

```tsx
'use client'

import { ThemeProvider } from 'next-themes'
import { type ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  )
}
```

### 3. 更新根佈局

修改 `app/layout.tsx`：

```tsx
import { Providers } from './providers'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

### 4. 建立主題切換元件

建立 `components/ui/theme-toggle.tsx`：

```tsx
'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme, resolvedTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="w-9 h-9" />
  }

  return (
    <button
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className="p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      aria-label="Toggle theme"
    >
      {resolvedTheme === 'dark' ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  )
}
```

### 5. 更新 CSS 變數

修改 `app/globals.css`，添加主題變數和毛玻璃效果：

```css
@layer base {
  :root {
    --background: 210 20% 98%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --secondary: 38 92% 50%;
    --profit: 142 76% 36%;
    --loss: 0 84% 60%;
    /* ... 其他變數 */
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 217.2 32.6% 11%;
    --profit: 142 71% 45%;
    --loss: 0 72% 51%;
    /* ... 其他變數 */
  }
}

@layer components {
  .glass-card {
    @apply bg-white/70 dark:bg-slate-800/70
           backdrop-blur-xl
           border border-white/20 dark:border-slate-700/50
           shadow-lg rounded-lg;
  }

  @supports not (backdrop-filter: blur(1px)) {
    .glass-card {
      @apply bg-white dark:bg-slate-800;
    }
  }
}
```

### 6. 使用主題感知樣式

將硬編碼顏色替換為語意化 class：

```tsx
// Before
<div className="bg-gray-50 text-gray-900">

// After
<div className="bg-background text-foreground">
```

```tsx
// Before (資產總覽深色頁面)
<div className="bg-gray-900 text-white">

// After (統一為主題感知)
<div className="bg-background text-foreground">
```

### 7. 使用毛玻璃卡片

```tsx
<div className="glass-card p-6">
  <h2 className="text-lg font-semibold text-foreground">卡片標題</h2>
  <p className="text-muted-foreground">卡片內容</p>
</div>
```

## 驗證

### 測試主題切換

1. 開啟開發伺服器：`pnpm dev`
2. 訪問 http://localhost:3000
3. 點擊主題切換按鈕
4. 確認所有頁面一致切換

### 測試系統偏好

1. 開啟系統設定
2. 切換至深色模式
3. 確認網站自動跟隨

### 檢查無 FOUC

1. 設定為深色模式
2. 重新整理頁面
3. 確認無白色閃爍

## 常見問題

### Q: 主題切換有延遲？

確保 ThemeProvider 設定了 `disableTransitionOnChange`，避免 CSS transition 影響切換速度。

### Q: 出現 hydration mismatch 警告？

1. 確保 `<html>` 標籤有 `suppressHydrationWarning`
2. 主題相關元件使用 `mounted` 狀態檢查

### Q: 毛玻璃效果在某些瀏覽器無效？

這是正常行為，`@supports` 降級會自動套用純色背景。

## 下一步

完成基礎設定後，執行 `/speckit.tasks` 生成詳細任務清單。
