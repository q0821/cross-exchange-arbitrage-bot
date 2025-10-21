/**
 * FundingRateValidator Service
 *
 * 資金費率驗證服務：雙重驗證 OKX 資金費率（OKX API + CCXT）
 * Feature: 004-fix-okx-add-price-display
 * Task: T015
 */

import {
  IFundingRateValidator,
  FundingRateValidationResult,
  FundingRateValidatorConfig,
} from '../../types/service-interfaces';
import { IFundingRateValidationRepository } from '../../types/service-interfaces';
import { createValidationResult, createValidationError } from '../../models/FundingRateValidation';
import { logger } from '../../lib/logger';

// 這些會在後續任務中實作
interface IOkxConnector {
  getFundingRate(symbol: string): Promise<{
    fundingRate: number;
    nextFundingRate?: number;
    fundingTime?: Date;
  }>;
}

interface IOkxCCXT {
  fetchFundingRate(symbol: string): Promise<{
    fundingRate: number | null;
    fundingTimestamp: number | null;
  } | null>;
}

export class FundingRateValidator implements IFundingRateValidator {
  private config: FundingRateValidatorConfig;

  constructor(
    private repository: IFundingRateValidationRepository,
    private okxConnector: IOkxConnector,
    private ccxtClient: IOkxCCXT,
    config?: Partial<FundingRateValidatorConfig>
  ) {
    // 預設配置
    this.config = {
      acceptableDiscrepancy: config?.acceptableDiscrepancy ?? 0.000001, // 0.0001%
      maxRetries: config?.maxRetries ?? 3,
      timeoutMs: config?.timeoutMs ?? 5000,
      enableCCXT: config?.enableCCXT ?? true,
    };
  }

  /**
   * 驗證指定交易對的資金費率
   */
  async validate(symbol: string): Promise<FundingRateValidationResult> {
    logger.info({ symbol }, 'Starting funding rate validation');

    try {
      // 1. 並行調用 OKX Native API 和 CCXT
      const [okxResult, ccxtResult] = await Promise.allSettled([
        this.fetchOkxFundingRate(symbol),
        this.config.enableCCXT ? this.fetchCCXTFundingRate(symbol) : Promise.resolve(null),
      ]);

      // 2. 處理 OKX API 結果
      if (okxResult.status === 'rejected') {
        const errorMsg = okxResult.reason?.message || 'Unknown OKX API error';
        logger.error({ symbol, error: errorMsg }, 'OKX API failed');

        const errorResult = createValidationError(symbol, errorMsg);
        await this.repository.create(errorResult);
        return errorResult;
      }

      const okxData = okxResult.value;

      // 3. 處理 CCXT 結果（優雅降級）
      let ccxtData: { fundingRate: number; fundingTimestamp: number } | null = null;

      if (ccxtResult.status === 'fulfilled' && ccxtResult.value) {
        ccxtData = {
          fundingRate: ccxtResult.value.fundingRate ?? 0,
          fundingTimestamp: ccxtResult.value.fundingTimestamp ?? Date.now(),
        };
      } else if (ccxtResult.status === 'rejected') {
        logger.warn(
          { symbol, error: ccxtResult.reason?.message },
          'CCXT failed, continuing with OKX data only'
        );
      }

      // 4. 建立驗證結果
      const validationResult = createValidationResult({
        symbol,
        okxRate: okxData.fundingRate,
        okxNextRate: okxData.nextFundingRate,
        okxFundingTime: okxData.fundingTime,
        ccxtRate: ccxtData?.fundingRate,
        ccxtFundingTime: ccxtData ? new Date(ccxtData.fundingTimestamp) : undefined,
      });

      // 5. 記錄驗證結果
      await this.repository.create(validationResult);

      logger.info(
        {
          symbol,
          status: validationResult.validationStatus,
          okxRate: validationResult.okxRate,
          ccxtRate: validationResult.ccxtRate,
          discrepancy: validationResult.discrepancyPercent,
        },
        'Funding rate validation completed'
      );

      return validationResult;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error({ symbol, error: errorMsg }, 'Unexpected error during validation');

      const errorResult = createValidationError(symbol, `Unexpected error: ${errorMsg}`);
      await this.repository.create(errorResult);
      return errorResult;
    }
  }

  /**
   * 批量驗證多個交易對
   */
  async validateBatch(symbols: string[]): Promise<FundingRateValidationResult[]> {
    logger.info({ count: symbols.length, symbols }, 'Starting batch validation');

    // 並行驗證所有交易對
    const results = await Promise.all(symbols.map((symbol) => this.validate(symbol)));

    logger.info({ count: results.length }, 'Batch validation completed');

    return results;
  }

  /**
   * 查詢最近的驗證失敗記錄
   */
  async getRecentFailures(limit: number): Promise<FundingRateValidationResult[]> {
    return this.repository.findFailures(limit);
  }

  /**
   * 計算指定交易對的驗證通過率
   */
  async getPassRate(symbol: string, daysBack: number): Promise<number> {
    return this.repository.calculatePassRate(symbol, daysBack);
  }

  /**
   * 從 OKX Native API 獲取資金費率
   */
  private async fetchOkxFundingRate(symbol: string): Promise<{
    fundingRate: number;
    nextFundingRate?: number;
    fundingTime?: Date;
  }> {
    try {
      const result = await this.okxConnector.getFundingRate(symbol);
      return result;
    } catch (error) {
      logger.error(
        { symbol, error: error instanceof Error ? error.message : String(error) },
        'Failed to fetch OKX funding rate'
      );
      throw error;
    }
  }

  /**
   * 從 CCXT 獲取資金費率
   */
  private async fetchCCXTFundingRate(symbol: string): Promise<{
    fundingRate: number;
    fundingTimestamp: number;
  } | null> {
    try {
      const result = await this.ccxtClient.fetchFundingRate(symbol);

      if (!result || result.fundingRate === null) {
        return null;
      }

      return {
        fundingRate: result.fundingRate,
        fundingTimestamp: result.fundingTimestamp ?? Date.now(),
      };
    } catch (error) {
      logger.warn(
        { symbol, error: error instanceof Error ? error.message : String(error) },
        'Failed to fetch CCXT funding rate'
      );
      // 不拋出錯誤，返回 null 以優雅降級
      return null;
    }
  }
}
