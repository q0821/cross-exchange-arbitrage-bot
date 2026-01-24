'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';

/**
 * Language Toggle Component
 *
 * 語言切換下拉選單，儲存偏好至 Cookie
 */

type Locale = 'zh-TW' | 'en';

interface LanguageOption {
  value: Locale;
  label: string;
  flag: string;
}

const languages: LanguageOption[] = [
  { value: 'zh-TW', label: '繁體中文', flag: '🇹🇼' },
  { value: 'en', label: 'English', flag: '🇺🇸' },
];

export function LanguageToggle() {
  const t = useTranslations('language');
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [currentLocale, setCurrentLocale] = useState<Locale>('zh-TW');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 從 Cookie 讀取當前語言
  useEffect(() => {
    const locale = document.cookie
      .split('; ')
      .find((row) => row.startsWith('admin-locale='))
      ?.split('=')[1] as Locale | undefined;

    if (locale && languages.some((l) => l.value === locale)) {
      setCurrentLocale(locale);
    }
  }, []);

  // 點擊外部關閉下拉選單
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLocaleChange = (locale: Locale) => {
    // 設定 Cookie（365 天有效期）
    // eslint-disable-next-line react-hooks/immutability
    document.cookie = `admin-locale=${locale}; path=/; max-age=${60 * 60 * 24 * 365}`;
    setCurrentLocale(locale);
    setIsOpen(false);

    // 重新整理頁面以套用新語言
    router.refresh();
  };

  const currentLanguage = languages.find((l) => l.value === currentLocale) ?? languages[0]!;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors
          text-slate-600 hover:text-slate-900 hover:bg-slate-100
          dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700/50"
        title={t('toggle')}
      >
        <span className="text-base">{currentLanguage.flag}</span>
        <span className="text-sm font-medium hidden sm:inline">{currentLanguage.label}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-40 rounded-lg shadow-lg border z-50
            bg-white border-slate-200
            dark:bg-slate-800 dark:border-slate-700"
        >
          <div className="py-1">
            {languages.map((lang) => (
              <button
                key={lang.value}
                onClick={() => handleLocaleChange(lang.value)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                  ${
                    currentLocale === lang.value
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-500'
                      : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/50'
                  }`}
              >
                <span className="text-base">{lang.flag}</span>
                <span>{lang.label}</span>
                {currentLocale === lang.value && (
                  <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
