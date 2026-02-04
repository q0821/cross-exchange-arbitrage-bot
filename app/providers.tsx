'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { type ReactNode } from 'react';

import { getQueryClient } from '@/lib/query-client';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * 應用程式 Providers 封裝
 * 包含主題切換功能和 TanStack Query 資料快取
 */
export function Providers({ children }: ProvidersProps) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
      </NextThemesProvider>
      {/*
        ReactQueryDevtools 使用 buttonPosition="bottom-left" 讓它不干擾 UI
        在 production build 時，@tanstack/react-query-devtools 會自動
        通過 tree-shaking 移除（當使用 NODE_ENV=production build 時）

        如果需要完全移除，可在 Zeabur 設定 NEXT_PUBLIC_DISABLE_DEVTOOLS=true
      */}
      {process.env.NEXT_PUBLIC_DISABLE_DEVTOOLS !== 'true' && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  );
}
