/**
 * PositionDetailsService
 *
 * 持倉詳情查詢服務：整合即時價格、資金費率歷史和損益計算
 * Feature: 045-position-details-view
 */

import { PrismaClient, Trade } from '@prisma/client';
import * as ccxt from 'ccxt';
import { Decimal } from 'decimal.js';
import { logger } from '../../lib/logger';
import { decrypt } from '../../lib/encryption';
import { FundingFeeQueryService } from './FundingFeeQueryService';
import type {
  SupportedExchange,
  PositionDetailsInfo,
  FundingFeeDetailsInfo,
  FeeDetailsInfo,
  AnnualizedReturnInfo,
} from '../../types/trading';

/**
 * 價格查詢結果
 */
interface PriceQueryResult {
  longCurrentPrice?: number;
  shortCurrentPrice?: number;
  success: boolean;
  error?: string;
}

/**
 * 持倉詳情查詢服務
 */
export class PositionDetailsService {
  private prisma: PrismaClient;
  private fundingFeeQueryService: FundingFeeQueryService;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
    this.fundingFeeQueryService = new FundingFeeQueryService(this.prisma);
  }

  /**
   * 查詢持倉詳情
   */
  async getPositionDetails(
    positionId: string,
    userId: string,
  ): Promise<PositionDetailsInfo> {
    const startTime = Date.now();

    // 1. 查詢 Position 基本資訊
    const position = await this.prisma.position.findUnique({
      where: { id: positionId },
      include: { trade: true },
    });

    if (!position) {
      throw new Error('Position not found');
    }

    if (position.userId !== userId) {
      throw new Error('Forbidden: Position belongs to another user');
    }

    if (position.status !== 'OPEN') {
      throw new Error('Invalid status: Only OPEN positions can view details');
    }

    const leverage = position.longLeverage || position.shortLeverage || 1;

    // 2. 並行查詢即時價格和資金費率
    const [priceResult, fundingFeeResult] = await Promise.all([
      this.fetchCurrentPrices(
        position.symbol,
        position.longExchange as SupportedExchange,
        position.shortExchange as SupportedExchange,
        userId,
      ),
      this.queryFundingFees(
        position.longExchange as SupportedExchange,
        position.shortExchange as SupportedExchange,
        position.symbol,
        position.openedAt || position.createdAt,
        userId,
      ),
    ]);

    // 3. 計算未實現損益
    let pnlResult: {
      longUnrealizedPnL?: number;
      shortUnrealizedPnL?: number;
      totalUnrealizedPnL?: number;
    } = {};

    if (priceResult.success && priceResult.longCurrentPrice && priceResult.shortCurrentPrice) {
      pnlResult = this.calculateUnrealizedPnL(
        new Decimal(position.longEntryPrice),
        new Decimal(position.shortEntryPrice),
        new Decimal(position.longPositionSize),
        new Decimal(position.shortPositionSize),
        priceResult.longCurrentPrice,
        priceResult.shortCurrentPrice,
      );
    }

    // 4. 計算年化報酬率
    let annualizedReturn: AnnualizedReturnInfo | undefined;
    let annualizedReturnError: string | undefined;

    const openedAt = position.openedAt || position.createdAt;
    const holdingMs = Date.now() - openedAt.getTime();
    const holdingHours = holdingMs / 3600000;

    if (holdingMs < 60000 && !fundingFeeResult && !pnlResult.totalUnrealizedPnL) {
      // 持倉時間少於 1 分鐘且無任何損益
      annualizedReturnError = '資料不足，無法計算年化';
    } else if (!priceResult.success) {
      annualizedReturnError = '無法計算：當前價格查詢失敗';
    } else {
      annualizedReturn = this.calculateAnnualizedReturn(
        pnlResult.totalUnrealizedPnL || 0,
        fundingFeeResult?.netTotal ? parseFloat(fundingFeeResult.netTotal) : 0,
        new Decimal(position.longEntryPrice),
        new Decimal(position.shortEntryPrice),
        new Decimal(position.longPositionSize),
        new Decimal(position.shortPositionSize),
        leverage,
        holdingHours,
      );
    }

    // 5. 取得手續費資訊
    const fees = this.extractFees(position.trade);

    const elapsedMs = Date.now() - startTime;
    logger.info(
      {
        positionId,
        symbol: position.symbol,
        elapsedMs,
        priceQuerySuccess: priceResult.success,
        fundingFeeQuerySuccess: !!fundingFeeResult,
      },
      'Position details query completed',
    );

    return {
      positionId: position.id,
      symbol: position.symbol,
      longExchange: position.longExchange,
      shortExchange: position.shortExchange,
      longEntryPrice: position.longEntryPrice.toString(),
      shortEntryPrice: position.shortEntryPrice.toString(),
      longPositionSize: position.longPositionSize.toString(),
      shortPositionSize: position.shortPositionSize.toString(),
      leverage,
      openedAt: openedAt.toISOString(),
      longCurrentPrice: priceResult.longCurrentPrice,
      shortCurrentPrice: priceResult.shortCurrentPrice,
      priceQuerySuccess: priceResult.success,
      priceQueryError: priceResult.error,
      ...pnlResult,
      fundingFees: fundingFeeResult ?? undefined,
      fundingFeeQuerySuccess: !!fundingFeeResult,
      fundingFeeQueryError: fundingFeeResult ? undefined : '資金費率查詢失敗',
      fees,
      annualizedReturn,
      annualizedReturnError,
      queriedAt: new Date().toISOString(),
    };
  }

  /**
   * 查詢即時價格
   */
  async fetchCurrentPrices(
    symbol: string,
    longExchange: SupportedExchange,
    shortExchange: SupportedExchange,
    userId: string,
  ): Promise<PriceQueryResult> {
    try {
      const ccxtSymbol = this.convertToCcxtSymbol(symbol);

      // 並行查詢兩個交易所的價格
      const [longPrice, shortPrice] = await Promise.all([
        this.fetchSinglePrice(longExchange, ccxtSymbol, userId),
        this.fetchSinglePrice(shortExchange, ccxtSymbol, userId),
      ]);

      if (longPrice === null || shortPrice === null) {
        return {
          success: false,
          error: `無法取得${longPrice === null ? longExchange : shortExchange}即時價格`,
        };
      }

      return {
        longCurrentPrice: longPrice,
        shortCurrentPrice: shortPrice,
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage, symbol, longExchange, shortExchange }, 'Failed to fetch current prices');
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 查詢單一交易所價格（含超時處理）
   */
  private async fetchSinglePrice(
    exchange: SupportedExchange,
    ccxtSymbol: string,
    userId: string,
  ): Promise<number | null> {
    try {
      const ccxtExchange = await this.createCcxtExchange(exchange, userId);

      // 使用 AbortController 實作 3 秒超時
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      try {
        const ticker = await ccxtExchange.fetchTicker(ccxtSymbol);
        clearTimeout(timeoutId);
        return ticker.last || null;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isTimeout = errorMessage.includes('abort') || errorMessage.includes('timeout');
      logger.warn(
        { error: errorMessage, exchange, ccxtSymbol, isTimeout },
        isTimeout ? 'Price fetch timeout' : 'Failed to fetch price from exchange',
      );
      return null;
    }
  }

  /**
   * 計算未實現損益
   */
  calculateUnrealizedPnL(
    longEntryPrice: Decimal,
    shortEntryPrice: Decimal,
    longPositionSize: Decimal,
    shortPositionSize: Decimal,
    longCurrentPrice: number,
    shortCurrentPrice: number,
  ): {
    longUnrealizedPnL: number;
    shortUnrealizedPnL: number;
    totalUnrealizedPnL: number;
  } {
    // Long P&L = (當前價格 - 開倉價格) × 持倉數量
    const longPnL = new Decimal(longCurrentPrice)
      .minus(longEntryPrice)
      .times(longPositionSize);

    // Short P&L = (開倉價格 - 當前價格) × 持倉數量
    const shortPnL = shortEntryPrice
      .minus(new Decimal(shortCurrentPrice))
      .times(shortPositionSize);

    const totalPnL = longPnL.plus(shortPnL);

    return {
      longUnrealizedPnL: longPnL.toNumber(),
      shortUnrealizedPnL: shortPnL.toNumber(),
      totalUnrealizedPnL: totalPnL.toNumber(),
    };
  }

  /**
   * 查詢資金費率歷史
   */
  private async queryFundingFees(
    longExchange: SupportedExchange,
    shortExchange: SupportedExchange,
    symbol: string,
    startTime: Date,
    userId: string,
  ): Promise<FundingFeeDetailsInfo | null> {
    try {
      const endTime = new Date();

      const result = await this.fundingFeeQueryService.queryBilateralFundingFees(
        longExchange,
        shortExchange,
        symbol,
        startTime,
        endTime,
        userId,
      );

      // 轉換為前端友好的格式
      return {
        longEntries: result.longResult.entries.map((e) => ({
          timestamp: e.timestamp,
          datetime: e.datetime,
          amount: e.amount.toString(),
          symbol: e.symbol,
          id: e.id,
        })),
        shortEntries: result.shortResult.entries.map((e) => ({
          timestamp: e.timestamp,
          datetime: e.datetime,
          amount: e.amount.toString(),
          symbol: e.symbol,
          id: e.id,
        })),
        longTotal: result.longResult.totalAmount.toString(),
        shortTotal: result.shortResult.totalAmount.toString(),
        netTotal: result.totalFundingFee.toString(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn({ error: errorMessage, longExchange, shortExchange, symbol }, 'Failed to query funding fees');
      return null;
    }
  }

  /**
   * 計算年化報酬率
   */
  calculateAnnualizedReturn(
    unrealizedPnL: number,
    fundingFeePnL: number,
    longEntryPrice: Decimal,
    shortEntryPrice: Decimal,
    longPositionSize: Decimal,
    shortPositionSize: Decimal,
    leverage: number,
    holdingHours: number,
  ): AnnualizedReturnInfo {
    // 總損益
    const totalPnL = unrealizedPnL + fundingFeePnL;

    // 保證金 = (多頭持倉價值 + 空頭持倉價值) / 槓桿倍數
    const longValue = longEntryPrice.times(longPositionSize);
    const shortValue = shortEntryPrice.times(shortPositionSize);
    const margin = longValue.plus(shortValue).dividedBy(leverage).toNumber();

    // 年化報酬率 = (總損益 / 保證金) × (365 × 24 / 持倉小時數) × 100%
    const hoursInYear = 365 * 24;
    const annualizedReturn = holdingHours > 0 && margin > 0
      ? (totalPnL / margin) * (hoursInYear / holdingHours) * 100
      : 0;

    return {
      value: annualizedReturn,
      totalPnL,
      margin,
      holdingHours,
    };
  }

  /**
   * 提取手續費資訊
   * 注意：Trade 模型使用 longFee/shortFee 欄位記錄手續費
   */
  private extractFees(trade: Trade | null): FeeDetailsInfo | undefined {
    if (!trade) {
      return undefined;
    }

    // Trade 模型使用 longFee/shortFee 記錄手續費
    const longOpenFee = trade.longFee ? trade.longFee.toString() : undefined;
    const shortOpenFee = trade.shortFee ? trade.shortFee.toString() : undefined;

    let totalFees: string | undefined;
    if (longOpenFee || shortOpenFee) {
      const total = new Decimal(longOpenFee || 0).plus(new Decimal(shortOpenFee || 0));
      totalFees = total.toString();
    }

    return {
      longOpenFee,
      shortOpenFee,
      totalFees,
    };
  }

  /**
   * 轉換 symbol 為 CCXT 格式
   */
  private convertToCcxtSymbol(symbol: string): string {
    const quoteAssets = ['USDT', 'USDC', 'BUSD', 'USD'];
    for (const quote of quoteAssets) {
      if (symbol.endsWith(quote)) {
        const base = symbol.slice(0, -quote.length);
        return `${base}/${quote}:${quote}`;
      }
    }
    return symbol;
  }

  /**
   * 創建已認證的 CCXT 交易所實例
   */
  private async createCcxtExchange(
    exchange: SupportedExchange,
    userId: string,
  ): Promise<ccxt.Exchange> {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        userId,
        exchange,
        isActive: true,
      },
    });

    if (!apiKey) {
      throw new Error(`No active API key found for ${exchange}`);
    }

    const decryptedKey = decrypt(apiKey.encryptedKey);
    const decryptedSecret = decrypt(apiKey.encryptedSecret);
    const decryptedPassphrase = apiKey.encryptedPassphrase
      ? decrypt(apiKey.encryptedPassphrase)
      : undefined;

    const exchangeMap: Record<SupportedExchange, string> = {
      binance: 'binance',
      okx: 'okx',
      mexc: 'mexc',
      gateio: 'gateio',
      bingx: 'bingx',
    };

    const exchangeId = exchangeMap[exchange];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ExchangeClass = (ccxt as any)[exchangeId];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = {
      apiKey: decryptedKey,
      secret: decryptedSecret,
      password: decryptedPassphrase,
      sandbox: apiKey.environment === 'TESTNET',
      enableRateLimit: true,
      options: {
        defaultType: exchange === 'binance' ? 'future' : 'swap',
      },
    };

    return new ExchangeClass(config);
  }
}

// Export singleton instance
export const positionDetailsService = new PositionDetailsService();
