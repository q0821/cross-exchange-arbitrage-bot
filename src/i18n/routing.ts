/**
 * next-intl Routing Configuration
 *
 * Admin 後台 i18n 路由設定
 * - 支援語言：zh-TW（預設）、en
 * - 使用 Cookie 模式，不改變 URL 結構
 */

import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['zh-TW', 'en'],
  defaultLocale: 'zh-TW',
  localePrefix: 'never', // URL 不帶語言前綴
});

export type Locale = (typeof routing.locales)[number];
