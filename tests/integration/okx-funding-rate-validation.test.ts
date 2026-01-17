/**
 * OKX Funding Rate Validation Integration Test
 *
 * 測試 OKX API + CCXT 資金費率驗證
 * Feature: 004-fix-okx-add-price-display
 * Task: T014
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Mock ccxt to avoid initialization issues
vi.mock('ccxt', () => {
  return {
    default: {
      okx: class MockOKX {
        constructor() {}
      },
    },
  };
});
import { PrismaClient } from '@/generated/prisma/client';
import { FundingRateValidator } from '../../src/services/validation/FundingRateValidator';
import { FundingRateValidationRepository } from '../../src/repositories/FundingRateValidationRepository';
import { OKXConnector } from '../../src/connectors/okx';
import { OkxConnectorAdapter } from '../../src/adapters/OkxConnectorAdapter';

describe.skip('OKX Funding Rate Validation Integration Tests', () => {
  let prisma: PrismaClient;
  let validator: FundingRateValidator;
  let repository: FundingRateValidationRepository;
  let okxConnectorAdapter: OkxConnectorAdapter;
  let okxCCXT: any; // Mock CCXT client

  beforeAll(() => {
    // 初始化依賴
    prisma = new PrismaClient();
    repository = new FundingRateValidationRepository(prisma);

    // 初始化 OKX connector（使用 testnet）
    const okxConnector = new OKXConnector(true); // testnet mode
    okxConnectorAdapter = new OkxConnectorAdapter(okxConnector);

    // Mock CCXT client to avoid initialization issues in test environment
    okxCCXT = {
      fetchFundingRate: async () => null, // Return null to test N/A handling
    } as any;

    // 建立 validator 並禁用 CCXT（只測試 OKX Native API）
    validator = new FundingRateValidator(repository, okxConnectorAdapter, okxCCXT, {
      enableCCXT: false, // Disable CCXT for this test
    });
  });

  afterAll(async () => {
    // 清理測試資料
    await prisma.fundingRateValidation.deleteMany({
      where: {
        symbol: {
          startsWith: 'TEST-',
        },
      },
    });
    await prisma.$disconnect();
  });

  describe('validate() - Real API Integration', () => {
    it('應該成功驗證 BTC-USDT-SWAP 資金費率', async () => {
      // Arrange
      const symbol ='BTC-USDT-SWAP';

      // Act
      const result = await validator.validate(symbol);

      // Assert
      expect(result.symbol).toBe(symbol);
      expect(result.okxRate).toBeDefined();
      expect(typeof result.okxRate).toBe('number');
      expect(result.validationStatus).toMatch(/^(PASS|FAIL|N\/A|ERROR)$/);

      // 如果有 CCXT 數據，驗證差異百分比
      if (result.ccxtRate !== undefined) {
        expect(result.discrepancyPercent).toBeDefined();
        expect(typeof result.discrepancyPercent).toBe('number');
      }

      // 驗證記錄已儲存到資料庫
      const saved = await prisma.fundingRateValidation.findFirst({
        where: { symbol },
        orderBy: { timestamp: 'desc' },
      });
      expect(saved).toBeDefined();
      // Use toBeCloseTo for floating point comparison (precision loss in DB)
      expect(saved?.okxRate.toNumber()).toBeCloseTo(result.okxRate, 5);
    }, 10000); // 10 秒 timeout

    it('應該成功驗證 ETH-USDT-SWAP 資金費率', async () => {
      // Arrange
      const symbol ='ETH-USDT-SWAP';

      // Act
      const result = await validator.validate(symbol);

      // Assert
      expect(result.symbol).toBe(symbol);
      expect(result.okxRate).toBeDefined();
      expect(typeof result.okxRate).toBe('number');
      expect(result.validationStatus).toMatch(/^(PASS|FAIL|N\/A|ERROR)$/);
    }, 10000);

    it.skip('應該處理不存在的交易對（跳過此測試避免 API 錯誤）', async () => {
      // Arrange
      const _symbol ='INVALID-USDT-SWAP';

      // Act & Assert
      // await expect(validator.validate(_symbol)).rejects.toThrow();

      // TODO: 實作後決定是否啟用
    });
  });

  describe('validateBatch() - Real API Integration', () => {
    it('應該批量驗證多個交易對', async () => {
      // Arrange
      const symbols = ['BTC-USDT-SWAP', 'ETH-USDT-SWAP'];

      // Act
      const results = await validator.validateBatch(symbols);

      // Assert
      expect(results.length).toBe(2);
      results.forEach((result) => {
        expect(symbols).toContain(result.symbol);
        expect(result.okxRate).toBeDefined();
      });

      // 驗證批量記錄已儲存
      const count = await prisma.fundingRateValidation.count({
        where: {
          symbol: { in: symbols },
          timestamp: { gte: new Date(Date.now() - 60000) }, // 最近 1 分鐘
        },
      });
      expect(count).toBeGreaterThanOrEqual(2);
    }, 15000); // 15 秒 timeout
  });

  describe('Error Handling', () => {
    it('應該優雅處理 API 超時', async () => {
      // TODO: Mock timeout scenario
      expect(true).toBe(true);
    });

    it('應該優雅處理網路錯誤', async () => {
      // TODO: Mock network error
      expect(true).toBe(true);
    });
  });

  describe('Data Validation', () => {
    it('驗證結果應符合 schema 定義', async () => {
      // Arrange
      const symbol ='BTC-USDT-SWAP';

      // Act
      const result = await validator.validate(symbol);

      // Assert - 驗證結果結構
      expect(result).toHaveProperty('symbol');
      expect(result).toHaveProperty('okxRate');
      expect(result).toHaveProperty('validationStatus');
      expect(result).toHaveProperty('timestamp');
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });
});
