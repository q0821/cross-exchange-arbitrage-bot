import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getLocale } from 'next-intl/server';
import { ThemeProvider } from 'next-themes';
import { AdminLayoutClient } from './components/AdminLayoutClient';

/**
 * Admin Layout (Feature 068)
 *
 * Server Component wrapper，提供 i18n 和主題支援
 */

export const metadata = {
  title: 'Admin Dashboard | Arbitrage Trading Platform',
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <AdminLayoutClient>{children}</AdminLayoutClient>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
