/**
 * BalanceValidator
 *
 * 餘額驗證服務，確保用戶有足夠的餘額進行開倉操作
 * Feature: 033-manual-open-position
 */

import { PrismaClient } from '@/generated/prisma/client';
import { Decimal } from 'decimal.js';
import { logger } from '../../lib/logger';
import { UserConnectorFactory } from '../assets/UserConnectorFactory';
import {
  InsufficientBalanceError,
  ApiKeyNotFoundError,
  ExchangeApiError,
  type SupportedExchange,
} from '../../lib/errors/trading-errors';
import type {
  BalanceValidationResult,
  LeverageOption,
} from '../../types/trading';

/**
 * 餘額驗證配置
 */
const BALANCE_CONFIG = {
  /** 保證金緩衝比例 (10%) */
  MARGIN_BUFFER_RATE: 0.1,
  /** 最小餘額警告閾值 (USDT) */
  MIN_BALANCE_WARNING: 100,
} as const;

/**
 * BalanceValidator
 *
 * 驗證用戶在指定交易所是否有足夠餘額進行開倉
 */
export class BalanceValidator {
  private readonly userConnectorFactory: UserConnectorFactory;

  constructor(prisma: PrismaClient) {
    this.userConnectorFactory = new UserConnectorFactory(prisma);
  }

  /**
   * 計算開倉所需的保證金（含緩衝）
   *
   * @param quantity 開倉數量（幣本位）
   * @param price 當前價格
   * @param leverage 槓桿倍數
   * @returns 所需保證金（USDT）
   */
  calculateRequiredMargin(
    quantity: Decimal,
    price: Decimal,
    leverage: LeverageOption,
  ): Decimal {
    // 倉位價值 = 數量 * 價格
    const positionValue = quantity.mul(price);
    // 基礎保證金 = 倉位價值 / 槓桿
    const baseMargin = positionValue.div(leverage);
    // 加上緩衝 = 基礎保證金 * (1 + 緩衝率)
    const requiredMargin = baseMargin.mul(1 + BALANCE_CONFIG.MARGIN_BUFFER_RATE);

    return requiredMargin;
  }

  /**
   * 查詢用戶在指定交易所的可用餘額
   *
   * @param userId 用戶 ID
   * @param exchanges 要查詢的交易所列表
   * @returns 各交易所的餘額資訊
   */
  async getBalances(
    userId: string,
    exchanges: SupportedExchange[],
  ): Promise<Map<SupportedExchange, number>> {
    logger.info({ userId, exchanges }, 'Fetching user balances');

    let allBalances;
    try {
      allBalances = await this.userConnectorFactory.getBalancesForUser(userId);
      logger.info({ userId, balanceCount: allBalances.length }, 'Got balances from factory');
    } catch (error) {
      logger.error(
        {
          userId,
          exchanges,
          errorName: error instanceof Error ? error.name : 'Unknown',
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
        },
        'Failed to get balances from UserConnectorFactory',
      );
      throw error;
    }
    const balanceMap = new Map<SupportedExchange, number>();

    for (const exchange of exchanges) {
      const balanceResult = allBalances.find(
        (b) => b.exchange.toLowerCase() === exchange.toLowerCase(),
      );

      if (!balanceResult) {
        logger.warn({ userId, exchange }, 'Balance result not found for exchange');
        balanceMap.set(exchange, 0);
        continue;
      }

      if (balanceResult.status === 'no_api_key') {
        throw new ApiKeyNotFoundError(userId, exchange);
      }

      if (balanceResult.status === 'api_error' || balanceResult.status === 'rate_limited') {
        throw new ExchangeApiError(
          exchange,
          'getBalance',
          balanceResult.errorMessage || 'Unknown error',
          undefined,
          balanceResult.status === 'rate_limited',
        );
      }

      balanceMap.set(exchange, balanceResult.balanceUSD ?? 0);
    }

    logger.info({ userId, balances: Object.fromEntries(balanceMap) }, 'User balances fetched');

    return balanceMap;
  }

  /**
   * 驗證餘額是否足夠進行開倉
   *
   * @param userId 用戶 ID
   * @param longExchange 做多交易所
   * @param shortExchange 做空交易所
   * @param quantity 開倉數量（幣本位）
   * @param longPrice 做多交易所價格
   * @param shortPrice 做空交易所價格
   * @param leverage 槓桿倍數
   * @returns 驗證結果
   * @throws InsufficientBalanceError 如果餘額不足
   */
  async validateBalance(
    userId: string,
    longExchange: SupportedExchange,
    shortExchange: SupportedExchange,
    quantity: Decimal,
    longPrice: Decimal,
    shortPrice: Decimal,
    leverage: LeverageOption,
  ): Promise<BalanceValidationResult> {
    logger.info(
      {
        userId,
        longExchange,
        shortExchange,
        quantity: quantity.toString(),
        longPrice: longPrice.toString(),
        shortPrice: shortPrice.toString(),
        leverage,
      },
      'Validating balance for position opening',
    );

    // 計算所需保證金
    const requiredMarginLong = this.calculateRequiredMargin(quantity, longPrice, leverage);
    const requiredMarginShort = this.calculateRequiredMargin(quantity, shortPrice, leverage);

    // 獲取餘額
    const balances = await this.getBalances(userId, [longExchange, shortExchange]);
    const longExchangeBalance = balances.get(longExchange) ?? 0;
    const shortExchangeBalance = balances.get(shortExchange) ?? 0;

    // 驗證做多交易所餘額
    if (longExchangeBalance < requiredMarginLong.toNumber()) {
      logger.warn(
        {
          userId,
          exchange: longExchange,
          required: requiredMarginLong.toNumber(),
          available: longExchangeBalance,
        },
        'Insufficient balance on long exchange',
      );

      throw new InsufficientBalanceError(
        longExchange,
        requiredMarginLong.toNumber(),
        longExchangeBalance,
      );
    }

    // 驗證做空交易所餘額
    if (shortExchangeBalance < requiredMarginShort.toNumber()) {
      logger.warn(
        {
          userId,
          exchange: shortExchange,
          required: requiredMarginShort.toNumber(),
          available: shortExchangeBalance,
        },
        'Insufficient balance on short exchange',
      );

      throw new InsufficientBalanceError(
        shortExchange,
        requiredMarginShort.toNumber(),
        shortExchangeBalance,
      );
    }

    const result: BalanceValidationResult = {
      isValid: true,
      longExchangeBalance,
      shortExchangeBalance,
      requiredMarginLong: requiredMarginLong.toNumber(),
      requiredMarginShort: requiredMarginShort.toNumber(),
    };

    logger.info(
      {
        userId,
        ...result,
      },
      'Balance validation passed',
    );

    return result;
  }

  /**
   * 快速檢查餘額是否足夠（不拋出錯誤）
   *
   * @param userId 用戶 ID
   * @param longExchange 做多交易所
   * @param shortExchange 做空交易所
   * @param quantity 開倉數量（幣本位）
   * @param longPrice 做多交易所價格
   * @param shortPrice 做空交易所價格
   * @param leverage 槓桿倍數
   * @returns 驗證結果（包含是否有效及不足資訊）
   */
  async checkBalance(
    userId: string,
    longExchange: SupportedExchange,
    shortExchange: SupportedExchange,
    quantity: Decimal,
    longPrice: Decimal,
    shortPrice: Decimal,
    leverage: LeverageOption,
  ): Promise<BalanceValidationResult> {
    try {
      return await this.validateBalance(
        userId,
        longExchange,
        shortExchange,
        quantity,
        longPrice,
        shortPrice,
        leverage,
      );
    } catch (error) {
      if (error instanceof InsufficientBalanceError) {
        // 計算所需保證金
        const requiredMarginLong = this.calculateRequiredMargin(quantity, longPrice, leverage);
        const requiredMarginShort = this.calculateRequiredMargin(quantity, shortPrice, leverage);

        // 嘗試獲取餘額（可能會失敗）
        let longBalance = 0;
        let shortBalance = 0;
        try {
          const balances = await this.getBalances(userId, [longExchange, shortExchange]);
          longBalance = balances.get(longExchange) ?? 0;
          shortBalance = balances.get(shortExchange) ?? 0;
        } catch {
          // 忽略餘額獲取錯誤
        }

        return {
          isValid: false,
          longExchangeBalance: longBalance,
          shortExchangeBalance: shortBalance,
          requiredMarginLong: requiredMarginLong.toNumber(),
          requiredMarginShort: requiredMarginShort.toNumber(),
          insufficientExchange: error.exchange,
          insufficientAmount: error.required - error.available,
        };
      }

      // 其他錯誤重新拋出
      throw error;
    }
  }
}

export default BalanceValidator;
