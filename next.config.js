/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

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

export default nextConfig;
