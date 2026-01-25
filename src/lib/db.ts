import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { logger } from './logger';

declare global {

  var prisma: PrismaClient | undefined;

  var __dbServicesInitialized: boolean | undefined;

  var __beforeExitHandlerRegistered: boolean | undefined;
}

/**
 * 檢測是否在 Next.js build 階段
 * - NEXT_PHASE 在 build 時會被設定為特定值
 * - 在 runtime 時通常為 undefined 或 'phase-production-server'
 */
const isBuildPhase = (): boolean => {
  const phase = process.env.NEXT_PHASE;
  return phase === 'phase-production-build' || phase === 'phase-export';
};

const prismaClientSingleton = () => {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
};

const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

/**
 * 初始化服務 - 只在 runtime 執行，避免在 build 階段執行
 */
const initializeServices = async () => {
  // 避免重複初始化
  if (globalThis.__dbServicesInitialized) {
    return;
  }

  // 在 build 階段跳過服務初始化
  if (isBuildPhase()) {
    logger.debug('Skipping service initialization during build phase');
    return;
  }

  globalThis.__dbServicesInitialized = true;

  // 動態 import 避免 build 階段載入
  const { ratesCache } = await import('../services/monitor/RatesCache');

  // Feature 026: 初始化通知服務
  ratesCache.initializeNotificationService(prisma);
  logger.info('NotificationService initialized via db.ts');

  // Feature 029: 初始化模擬追蹤服務
  ratesCache.initializeTrackingService(prisma);
  logger.info('SimulatedTrackingService initialized via db.ts');

  // Feature 050: 初始化條件單觸發監控服務
  // 使用環境變數控制是否啟動，預設關閉
  if (process.env.ENABLE_CONDITIONAL_ORDER_MONITOR === 'true') {
    try {
      const { initializeConditionalOrderMonitor } = await import('./monitor-init');
      initializeConditionalOrderMonitor({ autoStart: true });
      logger.info('ConditionalOrderMonitor initialized and started via db.ts');
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to initialize ConditionalOrderMonitor');
    }
  }
};

// 在 runtime 時初始化服務（非阻塞）
if (!isBuildPhase()) {
  initializeServices().catch((error) => {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to initialize services');
  });
}

// 優雅關閉資料庫連線
// 使用全域 flag 防止重複註冊監聽器（避免 MaxListenersExceededWarning）
if (!globalThis.__beforeExitHandlerRegistered) {
  globalThis.__beforeExitHandlerRegistered = true;
  process.on('beforeExit', async () => {
    await prisma.$disconnect();
    logger.info('Database connection closed');
  });
}

export { prisma };
