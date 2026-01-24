/**
 * next-intl Request Configuration
 *
 * 從 Cookie 讀取語言偏好（Admin 專用）
 */

import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

const locales = ['zh-TW', 'en'] as const;
type Locale = (typeof locales)[number];

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('admin-locale')?.value;

  // 驗證並取得有效語言
  const locale: Locale = locales.includes(localeCookie as Locale)
    ? (localeCookie as Locale)
    : 'zh-TW';

  return {
    locale,
    messages: (await import(`../messages/admin/${locale}.json`)).default,
  };
});
