import { PrismaClient } from '@prisma/client';
import { logger } from './logger';
import { ratesCache } from '../services/monitor/RatesCache';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      } as { emit: 'event'; level: 'query' },
      {
        emit: 'event',
        level: 'error',
      } as { emit: 'event'; level: 'error' },
      {
        emit: 'event',
        level: 'warn',
      } as { emit: 'event'; level: 'warn' },
    ],
  });
};

const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

// 監聽查詢事件 (記錄慢查詢)
(prisma.$on as (event: string, handler: (e: { query: string; duration: number; params: string }) => void) => void)('query', (e) => {
  if (e.duration > 100) {
    logger.warn({
      query: e.query,
      duration: e.duration,
      params: e.params,
    }, 'Slow query detected');
  }
});

// 監聽錯誤事件
(prisma.$on as (event: string, handler: (e: { message: string; target: string }) => void) => void)('error', (e) => {
  logger.error({
    message: e.message,
    target: e.target,
  }, 'Prisma error');
});

// 監聽警告事件
(prisma.$on as (event: string, handler: (e: { message: string }) => void) => void)('warn', (e) => {
  logger.warn({
    message: e.message,
  }, 'Prisma warning');
});

// Feature 026: 初始化通知服務
ratesCache.initializeNotificationService(prisma);
logger.info('NotificationService initialized via db.ts');

// 優雅關閉資料庫連線
process.on('beforeExit', async () => {
  await prisma.$disconnect();
  logger.info('Database connection closed');
});

export { prisma };
