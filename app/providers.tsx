'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { type ReactNode } from 'react';

import { getQueryClient } from '@/lib/query-client';

interface ProvidersProps {
  children: ReactNode;
}

// Production 環境不顯示 ReactQueryDevtools
const isDevelopment = process.env.NODE_ENV !== 'production';

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
      {isDevelopment && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
