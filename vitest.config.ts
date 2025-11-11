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
      '@': path.resolve(__dirname, './src'),
    },
  },
});
