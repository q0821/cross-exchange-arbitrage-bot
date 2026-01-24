import { ThemeProvider } from 'next-themes';

/**
 * Admin Login Layout
 *
 * 為登入頁面提供主題支援
 */
export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      {children}
    </ThemeProvider>
  );
}
