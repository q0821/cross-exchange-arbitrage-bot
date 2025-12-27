'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

/**
 * ThemeToggle - 主題切換元件
 * 支援淺色、深色、跟隨系統三種模式
 */
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // 避免 hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // 返回佔位符避免 layout shift
    return (
      <div className="w-9 h-9 rounded-md bg-muted animate-pulse" />
    );
  }

  // 循環切換：system -> light -> dark -> system
  const cycleTheme = () => {
    if (theme === 'system') {
      setTheme('light');
    } else if (theme === 'light') {
      setTheme('dark');
    } else {
      setTheme('system');
    }
  };

  const getIcon = () => {
    if (theme === 'system') {
      return <Monitor className="h-5 w-5" />;
    }
    if (resolvedTheme === 'dark') {
      return <Moon className="h-5 w-5" />;
    }
    return <Sun className="h-5 w-5" />;
  };

  const getLabel = () => {
    if (theme === 'system') {
      return '跟隨系統';
    }
    if (theme === 'dark') {
      return '深色模式';
    }
    return '淺色模式';
  };

  return (
    <button
      onClick={cycleTheme}
      className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      title={getLabel()}
      aria-label={`切換主題，目前：${getLabel()}`}
    >
      {getIcon()}
    </button>
  );
}
