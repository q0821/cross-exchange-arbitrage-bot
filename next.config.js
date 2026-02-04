import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // 使用 standalone 輸出模式（適用於 Docker/容器化部署）
  output: 'standalone',

  // 禁用開發指示器（左下角的 Next.js Dev Toolbar）
  devIndicators: false,

  typescript: {
    // Ignore specs directory to prevent type conflicts
    tsconfigPath: './tsconfig.json',
  },

  eslint: {
    // 暫時忽略 ESLint 警告，待升級 ESLint 9 後再處理
    ignoreDuringBuilds: true,
  },

  // Server external packages (moved from experimental in Next.js 15)
  serverExternalPackages: ['@prisma/client', 'bcrypt', 'ccxt'],

  // Environment variables exposed to the browser
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000',
  },
};

export default withNextIntl(nextConfig);
