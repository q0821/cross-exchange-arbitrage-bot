'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LanguageToggle } from './LanguageToggle';
import { AdminThemeToggle } from './AdminThemeToggle';

/**
 * Admin Header Component
 *
 * 管理後臺頂部欄，含語言和主題切換
 */

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface AdminHeaderProps {}

export function AdminHeader(_props: AdminHeaderProps) {
  const t = useTranslations('nav');
  const pathname = usePathname();

  // 根據路徑取得頁面標題 key
  const getPageTitleKey = (): 'dashboard' | 'users' | 'trades' => {
    if (pathname.includes('/users')) return 'users';
    if (pathname.includes('/trades')) return 'trades';
    return 'dashboard';
  };

  return (
    <header
      className="h-16 border-b flex items-center justify-between px-6 transition-colors
        bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm
        border-slate-200 dark:border-slate-700"
    >
      <h1 className="text-lg font-medium text-slate-900 dark:text-white">{t(getPageTitleKey())}</h1>

      <div className="flex items-center gap-2">
        <LanguageToggle />
        <AdminThemeToggle />
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-2" />
        <Link
          href="/market-monitor"
          className="text-sm px-3 py-1.5 rounded-lg transition-colors
            text-slate-600 hover:text-slate-900 hover:bg-slate-100
            dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700/50"
        >
          {t('backToPlatform')}
        </Link>
      </div>
    </header>
  );
}
