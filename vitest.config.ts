import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // 排除 Playwright 測試檔案 (.spec.ts)
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
      '**/*.spec.ts', // 排除 Playwright E2E 測試
    ],
    // 執行 .test.ts 和 .test.tsx 檔案
    include: ['**/*.test.ts', '**/*.test.tsx'],
    // 使用 jsdom 環境支援 React 元件測試
    environment: 'jsdom',
    // Setup files to run before each test file
    setupFiles: ['./tests/setup.ts'],
    // Global setup: 執行資料庫遷移（僅執行一次）
    globalSetup: ['./tests/global-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.spec.ts',
        '**/*.config.*',
        '**/types/**',
      ],
    },
  },
  resolve: {
    alias: {
      // Root-level directories (must be defined before @/)
      '@/app': path.resolve(__dirname, './app'),
      '@/tests': path.resolve(__dirname, './tests'),
      '@/hooks': path.resolve(__dirname, './hooks'),
      // 根目錄 lib/ 和 components/ 使用 @root/ 別名（用於 Next.js 共享工具）
      '@root/lib': path.resolve(__dirname, './lib'),
      '@root/components': path.resolve(__dirname, './components'),
      // @/components/xxx 現在解析到 ./src/components/xxx
      // src/ directory aliases
      '@': path.resolve(__dirname, './src'),
      // @/lib/xxx 現在解析到 ./src/lib/xxx
      '@lib': path.resolve(__dirname, './src/lib'),
      '@models': path.resolve(__dirname, './src/models'),
      '@services': path.resolve(__dirname, './src/services'),
      '@connectors': path.resolve(__dirname, './src/connectors'),
      '@cli': path.resolve(__dirname, './src/cli'),
      '@components': path.resolve(__dirname, './components'),
    },
  },
});
