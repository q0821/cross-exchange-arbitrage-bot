/**
 * Admin Repository Base (Feature 068)
 *
 * Admin 相關資料存取的基礎類別
 */

import { prisma } from '@lib/db';
import type { PrismaClient } from '@/generated/prisma/client';

export type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Admin Repository 基礎類別
 */
export abstract class AdminRepository {
  protected prisma: PrismaClient | TransactionClient;

  constructor(prismaClient?: PrismaClient | TransactionClient) {
    this.prisma = prismaClient || prisma;
  }

  /**
   * 在 transaction 中執行操作
   */
  protected async withTransaction<T>(
    operation: (tx: TransactionClient) => Promise<T>
  ): Promise<T> {
    if ('$transaction' in this.prisma) {
      return (this.prisma as PrismaClient).$transaction(operation);
    }
    // 已經在 transaction 中
    return operation(this.prisma as TransactionClient);
  }
}
