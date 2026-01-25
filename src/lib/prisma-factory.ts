import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

// 使用 globalThis 確保在 Next.js hot reload 時只有一個實例
declare global {
  // eslint-disable-next-line no-var
  var __prismaFactoryInstance: PrismaClient | undefined;
}

/**
 * 創建 Prisma Client 實例（Singleton）
 * Prisma 7 需要使用 Driver Adapter 來連接資料庫
 *
 * 使用 singleton pattern 避免：
 * 1. 多個 PrismaClient 實例導致連線池過度使用
 * 2. 每個 PrismaClient 都會註冊 exit handlers，導致 MaxListenersExceededWarning
 */
export function createPrismaClient(): PrismaClient {
  if (globalThis.__prismaFactoryInstance) {
    return globalThis.__prismaFactoryInstance;
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const client = new PrismaClient({ adapter });

  // 在非生產環境下保存到 globalThis（生產環境也需要保存以避免 hot reload 問題）
  globalThis.__prismaFactoryInstance = client;

  return client;
}
