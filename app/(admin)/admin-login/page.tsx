'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';

/**
 * Admin Login Page (Feature 068)
 *
 * 管理員專用登入頁面，支援 i18n 和主題切換
 */

type Locale = 'zh-TW' | 'en';

// 翻譯內容內嵌（登入頁不使用 next-intl provider）
const translations = {
  'zh-TW': {
    title: '管理員登入',
    subtitle: '平台管理控制台',
    email: '電子郵件',
    emailPlaceholder: 'admin@example.com',
    password: '密碼',
    passwordPlaceholder: '請輸入密碼',
    submit: '登入',
    submitting: '登入中...',
    error: {
      default: '登入失敗',
      locked: '帳戶已鎖定，請稍後再試',
      inactive: '帳戶已被停用，請聯繫系統管理員',
      unexpected: '發生未預期的錯誤',
    },
    notice: '此區域僅限管理人員存取。未經授權禁止進入。',
    theme: {
      light: '亮色模式',
      dark: '暗色模式',
      system: '跟隨系統',
    },
  },
  en: {
    title: 'Admin Login',
    subtitle: 'Platform Administration Console',
    email: 'Email',
    emailPlaceholder: 'admin@example.com',
    password: 'Password',
    passwordPlaceholder: 'Enter your password',
    submit: 'Sign in',
    submitting: 'Signing in...',
    error: {
      default: 'Login failed',
      locked: 'Account is locked. Please try again later.',
      inactive: 'Account is inactive. Please contact the administrator.',
      unexpected: 'An unexpected error occurred',
    },
    notice: 'This is a restricted area. Unauthorized access is prohibited.',
    theme: {
      light: 'Light Mode',
      dark: 'Dark Mode',
      system: 'System',
    },
  },
};

export default function AdminLoginPage() {
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [locale, setLocale] = useState<Locale>('zh-TW');
  const [mounted, setMounted] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);

  const t = translations[locale];

  useEffect(() => {
    setMounted(true);
    document.title = `${translations[locale].title} | Arbitrage Trading Platform`;

    // 從 Cookie 讀取語言偏好
    const localeCookie = document.cookie
      .split('; ')
      .find((row) => row.startsWith('admin-locale='))
      ?.split('=')[1] as Locale | undefined;

    if (localeCookie && (localeCookie === 'zh-TW' || localeCookie === 'en')) {
      setLocale(localeCookie);
    }
  }, [locale]);

  const handleLocaleChange = (newLocale: Locale) => {
    // 設定 Cookie（365 天有效期）
    // eslint-disable-next-line react-hooks/immutability
    document.cookie = `admin-locale=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}`;
    setLocale(newLocale);
    setShowLangMenu(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error?.code === 'ADMIN_ACCOUNT_LOCKED') {
          setError(t.error.locked);
        } else if (data.error?.code === 'ADMIN_ACCOUNT_INACTIVE') {
          setError(t.error.inactive);
        } else {
          setError(data.error?.message || t.error.default);
        }
        setIsLoading(false);
        return;
      }

      router.push('/admin/dashboard');
    } catch (_err) {
      setError(t.error.unexpected);
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center transition-colors
        bg-slate-100 dark:bg-slate-900
        bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100
        dark:from-slate-900 dark:via-slate-800 dark:to-slate-900`}
    >
      {/* Top Right Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        {/* Language Toggle */}
        <div className="relative">
          <button
            onClick={() => setShowLangMenu(!showLangMenu)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors
              text-slate-600 hover:text-slate-900 hover:bg-white/50
              dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/50"
          >
            <span className="text-base">{locale === 'zh-TW' ? '🇹🇼' : '🇺🇸'}</span>
            <svg
              className={`w-4 h-4 transition-transform ${showLangMenu ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          {showLangMenu && (
            <div
              className="absolute right-0 mt-2 w-36 rounded-lg shadow-lg border z-50
                bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700"
            >
              <div className="py-1">
                {[
                  { value: 'zh-TW' as Locale, label: '繁體中文', flag: '🇹🇼' },
                  { value: 'en' as Locale, label: 'English', flag: '🇺🇸' },
                ].map((lang) => (
                  <button
                    key={lang.value}
                    onClick={() => handleLocaleChange(lang.value)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                      ${
                        locale === lang.value
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-500'
                          : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/50'
                      }`}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <div className="relative">
          <button
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors
              text-slate-600 hover:text-slate-900 hover:bg-white/50
              dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/50"
          >
            {mounted && resolvedTheme === 'dark' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            )}
          </button>
          {showThemeMenu && (
            <div
              className="absolute right-0 mt-2 w-40 rounded-lg shadow-lg border z-50
                bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700"
            >
              <div className="py-1">
                {[
                  { value: 'light', labelKey: 'light' as const },
                  { value: 'dark', labelKey: 'dark' as const },
                  { value: 'system', labelKey: 'system' as const },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setTheme(opt.value);
                      setShowThemeMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                      ${
                        theme === opt.value
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-500'
                          : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/50'
                      }`}
                  >
                    <span>{t.theme[opt.labelKey]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        className="max-w-md w-full space-y-8 p-8 rounded-xl border shadow-xl transition-colors
          bg-white/80 border-slate-200
          dark:bg-slate-800/50 dark:border-slate-700/50
          backdrop-blur-sm"
      >
        <div>
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center">
              <svg
                className="w-6 h-6 text-amber-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
          </div>
          <h2 className="text-center text-2xl font-bold text-slate-900 dark:text-white">
            {t.title}
          </h2>
          <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">{t.subtitle}</p>
        </div>

        <form className="mt-8 space-y-6" method="POST" action="" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                {t.email}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border rounded-lg transition-colors
                  bg-white border-slate-300 text-slate-900 placeholder-slate-400
                  dark:bg-slate-700/50 dark:border-slate-600 dark:text-white dark:placeholder-slate-400
                  focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder={t.emailPlaceholder}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                {t.password}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border rounded-lg transition-colors
                  bg-white border-slate-300 text-slate-900 placeholder-slate-400
                  dark:bg-slate-700/50 dark:border-slate-600 dark:text-white dark:placeholder-slate-400
                  focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder={t.passwordPlaceholder}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-amber-600 hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  {t.submitting}
                </span>
              ) : (
                t.submit
              )}
            </button>
          </div>

          <div className="text-center text-xs text-slate-500 dark:text-slate-500">
            <p>{t.notice}</p>
          </div>
        </form>
      </div>
    </div>
  );
}
