'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster } from 'sonner';
import { useTheme } from 'next-themes';
import { AdminSidebar } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';

/**
 * Admin Layout Client Component
 *
 * 客戶端 Layout，處理側邊欄狀態和登出邏輯
 */

interface AdminLayoutClientProps {
  children: React.ReactNode;
}

export function AdminLayoutClient({ children }: AdminLayoutClientProps) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Required for hydration mismatch prevention
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
      router.push('/admin-login');
    } catch (error) {
      // eslint-disable-next-line no-console -- Error logging for debugging
      console.error('Logout failed:', error);
      setIsLoggingOut(false);
    }
  };

  // 根據主題決定 Toaster 主題
  const toasterTheme = mounted ? (resolvedTheme === 'dark' ? 'dark' : 'light') : 'dark';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      <Toaster position="top-right" theme={toasterTheme} />

      <AdminSidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
      />

      <main className={`transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-16'}`}>
        <AdminHeader />

        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
