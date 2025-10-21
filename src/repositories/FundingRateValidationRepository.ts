/**
 * FundingRateValidationRepository
 *
 * 資金費率驗證記錄儲存庫
 * Feature: 004-fix-okx-add-price-display
 */

import { PrismaClient, Prisma } from '@prisma/client';
import {
  IFundingRateValidationRepository,
  FundingRateValidationResult,
} from '../types/service-interfaces';
import { logger } from '../lib/logger';

export class FundingRateValidationRepository implements IFundingRateValidationRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * 建立驗證記錄
   */
  async create(data: FundingRateValidationResult): Promise<void> {
    try {
      await this.prisma.fundingRateValidation.create({
        data: {
          timestamp: data.timestamp,
          symbol: data.symbol,
          exchange: 'okx', // Default to OKX as per design
          okxRate: new Prisma.Decimal(data.okxRate),
          okxNextRate: data.okxNextRate !== undefined ? new Prisma.Decimal(data.okxNextRate) : null,
          okxFundingTime: data.okxFundingTime ?? null,
          ccxtRate: data.ccxtRate !== undefined ? new Prisma.Decimal(data.ccxtRate) : null,
          ccxtFundingTime: data.ccxtFundingTime ?? null,
          discrepancyPercent:
            data.discrepancyPercent !== undefined
              ? new Prisma.Decimal(data.discrepancyPercent)
              : null,
          validationStatus: data.validationStatus,
          errorMessage: data.errorMessage ?? null,
        },
      });

      logger.debug(
        {
          symbol: data.symbol,
          status: data.validationStatus,
        },
        'Funding rate validation record created'
      );
    } catch (error) {
      logger.error(
        {
          symbol: data.symbol,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to create funding rate validation record'
      );
      throw error;
    }
  }

  /**
   * 批量建立驗證記錄
   */
  async createBatch(dataList: FundingRateValidationResult[]): Promise<void> {
    try {
      await this.prisma.fundingRateValidation.createMany({
        data: dataList.map((data) => ({
          timestamp: data.timestamp,
          symbol: data.symbol,
          exchange: 'okx',
          okxRate: new Prisma.Decimal(data.okxRate),
          okxNextRate: data.okxNextRate !== undefined ? new Prisma.Decimal(data.okxNextRate) : null,
          okxFundingTime: data.okxFundingTime ?? null,
          ccxtRate: data.ccxtRate !== undefined ? new Prisma.Decimal(data.ccxtRate) : null,
          ccxtFundingTime: data.ccxtFundingTime ?? null,
          discrepancyPercent:
            data.discrepancyPercent !== undefined
              ? new Prisma.Decimal(data.discrepancyPercent)
              : null,
          validationStatus: data.validationStatus,
          errorMessage: data.errorMessage ?? null,
        })),
        skipDuplicates: true, // Skip records with duplicate (timestamp, symbol)
      });

      logger.debug(
        {
          count: dataList.length,
        },
        'Batch funding rate validation records created'
      );
    } catch (error) {
      logger.error(
        {
          count: dataList.length,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to create batch funding rate validation records'
      );
      throw error;
    }
  }

  /**
   * 查詢指定時間範圍的驗證記錄
   */
  async findByTimeRange(
    symbol: string,
    startTime: Date,
    endTime: Date
  ): Promise<FundingRateValidationResult[]> {
    try {
      const records = await this.prisma.fundingRateValidation.findMany({
        where: {
          symbol,
          timestamp: {
            gte: startTime,
            lte: endTime,
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
      });

      return records.map((record) => this.mapToValidationResult(record));
    } catch (error) {
      logger.error(
        {
          symbol,
          startTime,
          endTime,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to find validation records by time range'
      );
      throw error;
    }
  }

  /**
   * 查詢驗證失敗記錄
   */
  async findFailures(limit: number): Promise<FundingRateValidationResult[]> {
    try {
      const records = await this.prisma.fundingRateValidation.findMany({
        where: {
          validationStatus: 'FAIL',
        },
        orderBy: {
          timestamp: 'desc',
        },
        take: limit,
      });

      return records.map((record) => this.mapToValidationResult(record));
    } catch (error) {
      logger.error(
        {
          limit,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to find validation failures'
      );
      throw error;
    }
  }

  /**
   * 計算驗證通過率
   */
  async calculatePassRate(symbol: string, daysBack: number): Promise<number> {
    try {
      const startTime = new Date();
      startTime.setDate(startTime.getDate() - daysBack);

      const [totalCount, passCount] = await Promise.all([
        // 總記錄數（不包含 ERROR 和 N/A）
        this.prisma.fundingRateValidation.count({
          where: {
            symbol,
            timestamp: {
              gte: startTime,
            },
            validationStatus: {
              in: ['PASS', 'FAIL'],
            },
          },
        }),
        // 通過記錄數
        this.prisma.fundingRateValidation.count({
          where: {
            symbol,
            timestamp: {
              gte: startTime,
            },
            validationStatus: 'PASS',
          },
        }),
      ]);

      if (totalCount === 0) {
        return 0;
      }

      const passRate = (passCount / totalCount) * 100;
      return Math.round(passRate * 100) / 100; // 保留 2 位小數
    } catch (error) {
      logger.error(
        {
          symbol,
          daysBack,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to calculate pass rate'
      );
      throw error;
    }
  }

  /**
   * 將 Prisma 模型映射為驗證結果
   */
  private mapToValidationResult(record: any): FundingRateValidationResult {
    return {
      symbol: record.symbol,
      timestamp: record.timestamp,
      okxRate: record.okxRate.toNumber(),
      okxNextRate: record.okxNextRate?.toNumber(),
      okxFundingTime: record.okxFundingTime ?? undefined,
      ccxtRate: record.ccxtRate?.toNumber(),
      ccxtFundingTime: record.ccxtFundingTime ?? undefined,
      discrepancyPercent: record.discrepancyPercent?.toNumber(),
      validationStatus: record.validationStatus as any,
      errorMessage: record.errorMessage ?? undefined,
    };
  }
}
