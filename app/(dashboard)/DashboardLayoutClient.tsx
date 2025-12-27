'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/ui/theme-toggle';

/**
 * Dashboard Layout
 * 包含導航欄、登出功能和頁面連結
 */
interface IndicatorStyle {
  left: number;
  width: number;
}

export default function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Liquid Glass Navigation State
  const navRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const [activeIndicator, setActiveIndicator] = useState<IndicatorStyle>({ left: 0, width: 0 });
  const [hoverIndicator, setHoverIndicator] = useState<IndicatorStyle>({ left: 0, width: 0 });
  const [isHovering, setIsHovering] = useState(false);

  // 計算指示器位置
  const calculateIndicatorPosition = useCallback((element: HTMLElement | null): IndicatorStyle => {
    if (!element || !navRef.current) return { left: 0, width: 0 };
    const navRect = navRef.current.getBoundingClientRect();
    const itemRect = element.getBoundingClientRect();
    return {
      left: itemRect.left - navRect.left,
      width: itemRect.width,
    };
  }, []);

  // 更新 active 指示器位置
  useEffect(() => {
    if (!pathname) return;
    const updateActiveIndicator = () => {
      const activeItem = itemRefs.current.get(pathname);
      if (activeItem) {
        setActiveIndicator(calculateIndicatorPosition(activeItem));
      }
    };

    // 初始更新
    updateActiveIndicator();

    // 監聽視窗大小變化
    window.addEventListener('resize', updateActiveIndicator);
    return () => window.removeEventListener('resize', updateActiveIndicator);
  }, [pathname, calculateIndicatorPosition]);

  // 處理 hover
  const handleMouseEnter = (href: string) => {
    const item = itemRefs.current.get(href);
    if (item) {
      setHoverIndicator(calculateIndicatorPosition(item));
      setIsHovering(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  // 設置 item ref
  const setItemRef = (href: string) => (el: HTMLAnchorElement | null) => {
    if (el) {
      itemRefs.current.set(href, el);
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });

      // 跳轉到登入頁面
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      setIsLoggingOut(false);
    }
  };

  const navLinks = [
    { href: '/market-monitor', label: '市場監控' },
    { href: '/simulated-tracking', label: '模擬追蹤' }, // Feature 029
    { href: '/assets', label: '資產總覽' }, // Feature 031
    { href: '/positions', label: '持倉管理' }, // Feature 033
    { href: '/trades', label: '交易歷史' }, // Feature 035
    { href: '/settings/api-keys', label: 'API 金鑰管理' },
    { href: '/settings/notifications', label: '通知設定' },
    { href: '/settings/trading', label: '交易設定' }, // Feature 036
  ];

  return (
    <div className="min-h-screen bg-background bg-gradient-mesh">
      {/* Liquid Glass SVG Filter */}
      <svg width="0" height="0" style={{ position: 'fixed', left: '-9999px', top: '-9999px' }}>
        <defs>
          <filter id="liquid_glass_filter" x="0%" y="0%" width="100%" height="100%" filterUnits="objectBoundingBox">
            <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="2" seed="7" result="noise"/>
            <feGaussianBlur in="noise" stdDeviation="1.5" result="map"/>
            <feDisplacementMap in="SourceGraphic" in2="map" scale="8" xChannelSelector="R" yChannelSelector="B"/>
          </filter>
        </defs>
      </svg>

      {/* Header 導航欄 */}
      <header className="glass-nav shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo 和標題 */}
            <div className="flex items-center space-x-4">
              <Link href="/market-monitor" className="text-xl font-bold text-foreground">
                套利交易平台
              </Link>
            </div>

            {/* Liquid Glass 導航連結 */}
            <nav
              ref={navRef}
              className="hidden md:flex liquid-glass-nav"
              onMouseLeave={handleMouseLeave}
            >
              {/* Active 指示器 */}
              <div
                className="liquid-glass-indicator"
                style={{
                  left: activeIndicator.left,
                  width: activeIndicator.width,
                  opacity: activeIndicator.width > 0 ? 1 : 0,
                }}
              />
              {/* Hover 指示器 */}
              <div
                className="liquid-glass-hover"
                style={{
                  left: hoverIndicator.left,
                  width: hoverIndicator.width,
                  opacity: isHovering ? 1 : 0,
                }}
              />
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    ref={setItemRef(link.href)}
                    href={link.href}
                    className={`liquid-glass-item ${isActive ? 'active' : ''}`}
                    onMouseEnter={() => handleMouseEnter(link.href)}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* 主題切換和登出按鈕 */}
            <div className="flex items-center space-x-3">
              <ThemeToggle />
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="px-4 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingOut ? '登出中...' : '登出'}
              </button>
            </div>
          </div>

          {/* 移動版導航 */}
          <nav className="md:hidden py-3 space-y-1 border-t border-border">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary dark:bg-primary/20'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">{children}</main>

      {/* Footer */}
      <footer className="bg-card border-t border-border mt-auto">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center text-sm text-muted-foreground">
            <p>© 2025 Cross-Exchange Arbitrage Platform</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
