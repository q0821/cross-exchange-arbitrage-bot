/**
 * FundingRateValidationRepository Integration Test
 *
 * 測試 repository 的資料庫寫入功能
 * Feature: 004-fix-okx-add-price-display
 * Task: T012
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { FundingRateValidationRepository } from '../../src/repositories/FundingRateValidationRepository';
import { createValidationResult, createValidationError } from '../../src/models/FundingRateValidation';

describe('FundingRateValidationRepository Integration Tests', () => {
  let prisma: PrismaClient;
  let repository: FundingRateValidationRepository;

  beforeAll(() => {
    // 初始化 Prisma Client
    prisma = new PrismaClient();
    repository = new FundingRateValidationRepository(prisma);
  });

  afterAll(async () => {
    // 清理並關閉連線
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // 清空測試資料（在測試前）
    await prisma.fundingRateValidation.deleteMany({
      where: {
        symbol: {
          startsWith: 'TEST',
        },
      },
    });
  });

  describe('create()', () => {
    it('應該成功建立驗證記錄（PASS 狀態）', async () => {
      // Arrange
      const validationResult = createValidationResult({
        symbol: 'TEST-BTC-SWAP',
        okxRate: 0.0001,
        okxNextRate: 0.00012,
        ccxtRate: 0.0001, // 完全一致，差異 = 0%
      });

      // Act
      await repository.create(validationResult);

      // Assert
      const saved = await prisma.fundingRateValidation.findFirst({
        where: { symbol: 'TEST-BTC-SWAP' },
        orderBy: { timestamp: 'desc' },
      });

      expect(saved).toBeDefined();
      expect(saved?.symbol).toBe('TEST-BTC-SWAP');
      expect(saved?.validationStatus).toBe('PASS');
      expect(saved?.okxRate.toNumber()).toBeCloseTo(0.0001, 8);
      expect(saved?.ccxtRate?.toNumber()).toBeCloseTo(0.0001, 8);
      expect(saved?.discrepancyPercent?.toNumber()).toBe(0);
    });

    it('應該成功建立驗證記錄（FAIL 狀態）', async () => {
      // Arrange
      const validationResult = createValidationResult({
        symbol: 'TEST-ETH-SWAP',
        okxRate: 0.0001,
        ccxtRate: 0.0002, // 差異過大，應該 FAIL
      });

      // Act
      await repository.create(validationResult);

      // Assert
      const saved = await prisma.fundingRateValidation.findFirst({
        where: { symbol: 'TEST-ETH-SWAP' },
        orderBy: { timestamp: 'desc' },
      });

      expect(saved).toBeDefined();
      expect(saved?.validationStatus).toBe('FAIL');
      expect(saved?.discrepancyPercent?.toNumber()).toBeGreaterThan(0.000001);
    });

    it('應該成功建立驗證錯誤記錄（ERROR 狀態）', async () => {
      // Arrange
      const errorResult = createValidationError('TEST-SOL-SWAP', 'API timeout');

      // Act
      await repository.create(errorResult);

      // Assert
      const saved = await prisma.fundingRateValidation.findFirst({
        where: { symbol: 'TEST-SOL-SWAP' },
        orderBy: { timestamp: 'desc' },
      });

      expect(saved).toBeDefined();
      expect(saved?.validationStatus).toBe('ERROR');
      expect(saved?.errorMessage).toBe('API timeout');
    });
  });

  describe('createBatch()', () => {
    it('應該成功批量建立多個驗證記錄', async () => {
      // Arrange - 使用不同的 symbol 避免 unique constraint 衝突
      const results = [
        createValidationResult({
          symbol: 'TEST-BATCH-BTC',
          okxRate: 0.0001,
          ccxtRate: 0.0001,
        }),
        createValidationResult({
          symbol: 'TEST-BATCH-ETH',
          okxRate: 0.0002,
          ccxtRate: 0.0002,
        }),
        createValidationError('TEST-BATCH-SOL', 'Network error'),
      ];

      // Act
      await repository.createBatch(results);

      // Assert
      const count = await prisma.fundingRateValidation.count({
        where: {
          symbol: {
            startsWith: 'TEST',
          },
        },
      });

      expect(count).toBe(3);
    });
  });

  describe('findByTimeRange()', () => {
    it('應該查詢指定時間範圍的驗證記錄', async () => {
      // Arrange
      const symbol = 'TEST-BTC-USDT-SWAP';
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      // 建立第一筆記錄
      await repository.create(
        createValidationResult({ symbol, okxRate: 0.0001, ccxtRate: 0.0001 })
      );

      // 等待 10ms 確保時間戳不同
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 建立第二筆記錄
      await repository.create(
        createValidationResult({ symbol, okxRate: 0.0002, ccxtRate: 0.0002 })
      );

      const now = new Date();

      // Act
      const results = await repository.findByTimeRange(symbol, oneHourAgo, now);

      // Assert
      expect(results.length).toBe(2);
      results.forEach((result) => {
        expect(result.symbol).toBe(symbol);
        expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(oneHourAgo.getTime());
        expect(result.timestamp.getTime()).toBeLessThanOrEqual(now.getTime());
      });
    });
  });

  describe('findFailures()', () => {
    it('應該查詢驗證失敗記錄', async () => {
      // Arrange - 使用不同的 symbol (注意長度 ≤ 20)
      await repository.create(
        createValidationResult({
          symbol: 'TEST-FAIL-BTC-SWAP',
          okxRate: 0.0001,
          ccxtRate: 0.0002, // FAIL
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      await repository.create(
        createValidationResult({
          symbol: 'TEST-FAIL-ETH-SWAP',
          okxRate: 0.0001,
          ccxtRate: 0.0001, // PASS
        })
      );

      // Act
      const failures = await repository.findFailures(10);

      // Assert
      expect(failures.length).toBeGreaterThanOrEqual(1);
      failures.forEach((result) => {
        expect(result.validationStatus).toBe('FAIL');
      });
    });
  });

  describe('calculatePassRate()', () => {
    it('應該正確計算驗證通過率', async () => {
      // Arrange
      const symbol = 'TEST-PASSRATE-SWAP';

      // 建立 2 筆 PASS 記錄
      await repository.create(
        createValidationResult({ symbol, okxRate: 0.0001, ccxtRate: 0.0001 })
      );
      await new Promise((resolve) => setTimeout(resolve, 10));

      await repository.create(
        createValidationResult({ symbol, okxRate: 0.0002, ccxtRate: 0.0002 })
      );
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 建立 1 筆 FAIL 記錄
      await repository.create(
        createValidationResult({ symbol, okxRate: 0.0001, ccxtRate: 0.0002 })
      );
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 建立 1 筆 ERROR 記錄（不計入）
      await repository.create(createValidationError(symbol, 'Error'));

      // Act
      const passRate = await repository.calculatePassRate(symbol, 1);

      // Assert
      // 2 PASS / 3 total (PASS + FAIL) = 66.67%
      expect(passRate).toBeCloseTo(66.67, 1);
    });

    it('應該在沒有記錄時返回 0', async () => {
      // Act
      const passRate = await repository.calculatePassRate('TEST-NONEXISTENT', 1);

      // Assert
      expect(passRate).toBe(0);
    });
  });
});
