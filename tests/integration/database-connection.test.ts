/**
 * Database Connection Integration Test (INT-105)
 *
 * 測試 PostgreSQL 連線、TimescaleDB 擴展、表格完整性
 *
 * 整合自：test-db-connection.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PrismaClient } from '@/generated/prisma/client';
import { createPrismaClient } from '@/lib/prisma-factory';

const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === 'true';

describe.skipIf(!RUN_INTEGRATION)('Database Connection Integration Tests', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = createPrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('PostgreSQL Connection', () => {
    it('應該成功連接到資料庫', async () => {
      // Act & Assert - 若無法連接會拋出錯誤
      await expect(prisma.$connect()).resolves.toBeUndefined();
    });

    it('應該成功執行查詢並回傳當前時間和版本', async () => {
      // Act
      const result = await prisma.$queryRaw<
        Array<{ current_time: Date; postgres_version: string }>
      >`SELECT NOW() as current_time, version() as postgres_version`;

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('current_time');
      expect(result[0]).toHaveProperty('postgres_version');
      expect(result[0].current_time).toBeInstanceOf(Date);
      expect(result[0].postgres_version).toContain('PostgreSQL');
    });
  });

  describe('TimescaleDB Extension', () => {
    it('應該已安裝 TimescaleDB 擴展', async () => {
      // Act
      const timescaleCheck = await prisma.$queryRaw<
        Array<{ extname: string; extversion: string }>
      >`
        SELECT extname, extversion
        FROM pg_extension
        WHERE extname = 'timescaledb'
      `;

      // Assert
      expect(timescaleCheck).toHaveLength(1);
      expect(timescaleCheck[0].extname).toBe('timescaledb');
      expect(timescaleCheck[0].extversion).toBeTruthy();
    });
  });

  describe('Database Schema', () => {
    it('應該包含所有必要的資料表', async () => {
      // Act
      const tables = await prisma.$queryRaw<
        Array<{ table_name: string }>
      >`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `;

      const tableNames = tables.map((t) => t.table_name);

      // Assert - 驗證核心表格存在（使用資料庫實際表名，注意 Prisma 的 @@map）
      const requiredTables = [
        'users',
        'api_keys',
        'asset_snapshots',
        'positions',
        'trades',
        'opportunity_end_histories',
        'funding_rate_validations',
        'notification_webhooks',
        'trading_settings',
        'audit_logs',
        'funding_rates',
        'risk_parameters',
        'system_events',
        '_prisma_migrations',
      ];

      for (const tableName of requiredTables) {
        expect(
          tableNames,
          `表格 "${tableName}" 應存在於資料庫中`
        ).toContain(tableName);
      }

      // Assert - 至少應有 12 個表格（包含 Prisma migrations）
      expect(tableNames.length).toBeGreaterThanOrEqual(12);
    });

    it('應該能夠查詢 _prisma_migrations 表確認遷移已執行', async () => {
      // Act
      const migrations = await prisma.$queryRaw<
        Array<{ migration_name: string; applied_steps_count: number }>
      >`
        SELECT migration_name, applied_steps_count
        FROM _prisma_migrations
        ORDER BY finished_at DESC
        LIMIT 5
      `;

      // Assert
      expect(migrations.length).toBeGreaterThan(0);
      expect(migrations[0]).toHaveProperty('migration_name');
      expect(migrations[0]).toHaveProperty('applied_steps_count');
      expect(migrations[0].applied_steps_count).toBeGreaterThan(0);
    });
  });

  describe('Database Performance', () => {
    it('連線響應時間應小於 100ms', async () => {
      // Arrange
      const startTime = Date.now();

      // Act
      await prisma.$queryRaw`SELECT 1`;

      // Assert
      const elapsedTime = Date.now() - startTime;
      expect(elapsedTime).toBeLessThan(100);
    });
  });

  describe('Transaction Support', () => {
    it('應該支援交易回滾', async () => {
      // Arrange - 建立測試資料
      const testEmail = `test-${Date.now()}@example.com`;

      // Act & Assert
      await expect(
        prisma.$transaction(async (tx) => {
          // 建立一個測試用戶
          await tx.user.create({
            data: {
              email: testEmail,
              password: 'test-password-hash', // 必填欄位
            },
          });

          // 拋出錯誤以觸發回滾
          throw new Error('Test rollback');
        })
      ).rejects.toThrow('Test rollback');

      // Assert - 確認資料已回滾
      const user = await prisma.user.findUnique({
        where: { email: testEmail },
      });
      expect(user).toBeNull();
    });
  });
});
