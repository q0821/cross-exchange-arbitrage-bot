/**
 * next-intl Request Configuration
 *
 * 從 Cookie 讀取語言偏好
 */

import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { routing, type Locale } from './routing';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('admin-locale')?.value;

  // 驗證並取得有效語言
  const locale: Locale = routing.locales.includes(localeCookie as Locale)
    ? (localeCookie as Locale)
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/admin/${locale}.json`)).default,
  };
});
