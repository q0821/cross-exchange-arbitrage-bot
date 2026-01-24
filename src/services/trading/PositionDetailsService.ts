/**
 * PositionDetailsService
 *
 * 持倉詳情查詢服務：整合即時價格、資金費率歷史和損益計算
 * Feature: 045-position-details-view
 */

import { PrismaClient, Trade } from '@/generated/prisma/client';
import { createPrismaClient } from '@/lib/prisma-factory';
import type * as ccxt from 'ccxt';
import { Decimal } from 'decimal.js';
import { logger } from '../../lib/logger';
import { CcxtInstanceManager } from '../../lib/ccxt-instance-manager';
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
    this.prisma = prisma || createPrismaClient();
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

    // 創建 CCXT 實例管理器（請求級別共享實例）
    const instanceManager = new CcxtInstanceManager(this.prisma);

    try {
      // 2. 並行查詢即時價格和資金費率（共享 CCXT 實例）
      const [priceResult, fundingFeeResult] = await Promise.all([
        this.fetchCurrentPricesWithManager(
          instanceManager,
          position.symbol,
          position.longExchange as SupportedExchange,
          position.shortExchange as SupportedExchange,
        ),
        this.queryFundingFeesWithManager(
          instanceManager,
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
    } finally {
      // 清理 CCXT 實例快取
      instanceManager.clear();
    }
  }

  /**
   * 查詢即時價格（使用共享 CCXT 實例）
   */
  private async fetchCurrentPricesWithManager(
    manager: CcxtInstanceManager,
    symbol: string,
    longExchange: SupportedExchange,
    shortExchange: SupportedExchange,
  ): Promise<PriceQueryResult> {
    try {
      const ccxtSymbol = this.convertToCcxtSymbol(symbol);

      // 並行獲取兩個交易所的公開實例（自動共享實例）
      const [longInstance, shortInstance] = await Promise.all([
        manager.getPublicExchange(longExchange),
        manager.getPublicExchange(shortExchange),
      ]);

      // 並行查詢價格（無需再次 loadMarkets）
      const [longTicker, shortTicker] = await Promise.all([
        this.fetchTickerWithTimeout(longInstance, ccxtSymbol, longExchange),
        this.fetchTickerWithTimeout(shortInstance, ccxtSymbol, shortExchange),
      ]);

      if (longTicker === null || shortTicker === null) {
        return {
          success: false,
          error: `無法取得${longTicker === null ? longExchange : shortExchange}即時價格`,
        };
      }

      // 提取價格（優先 mark price）
      const longPrice = this.extractPrice(longTicker);
      const shortPrice = this.extractPrice(shortTicker);

      if (longPrice === null || shortPrice === null) {
        return {
          success: false,
          error: `價格資料無效：${longPrice === null ? longExchange : shortExchange}`,
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
   * 使用超時控制查詢單一 ticker
   */
  private async fetchTickerWithTimeout(
    exchange: ccxt.Exchange,
    ccxtSymbol: string,
    exchangeName: SupportedExchange,
  ): Promise<ccxt.Ticker | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const ticker = await exchange.fetchTicker(ccxtSymbol);
        clearTimeout(timeoutId);
        return ticker;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isTimeout = errorMessage.includes('abort') || errorMessage.includes('timeout');
      logger.warn(
        { error: errorMessage, exchange: exchangeName, ccxtSymbol, isTimeout },
        isTimeout ? 'Ticker fetch timeout' : 'Failed to fetch ticker',
      );
      return null;
    }
  }

  /**
   * 從 ticker 提取價格（優先 mark price）
   */
  private extractPrice(ticker: ccxt.Ticker): number | null {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tickerInfo = (ticker as any).info as Record<string, unknown> | undefined;
    const price = tickerInfo?.markPrice
      ? parseFloat(String(tickerInfo.markPrice))
      : (ticker.last || null);

    logger.debug(
      { last: ticker.last, markPrice: tickerInfo?.markPrice, returnedPrice: price },
      'Price extracted from ticker',
    );

    return price;
  }

  /**
   * 查詢即時價格（舊版方法，保留向後相容）
   * @deprecated 改用 fetchCurrentPricesWithManager
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
      const ccxtExchange = await this.createUserCcxtExchange(exchange, userId);

      // 必須先載入市場資訊，CCXT 才能正確解析永續合約 symbol
      await ccxtExchange.loadMarkets();

      // 使用 AbortController 實作 5 秒超時（loadMarkets 後 fetchTicker 應該很快）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const ticker = await ccxtExchange.fetchTicker(ccxtSymbol);
        clearTimeout(timeoutId);

        // 優先使用 mark price，若無則使用 last price
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tickerInfo = (ticker as any).info as Record<string, unknown> | undefined;
        const price = tickerInfo?.markPrice
          ? parseFloat(String(tickerInfo.markPrice))
          : (ticker.last || null);

        logger.debug(
          { exchange, ccxtSymbol, last: ticker.last, markPrice: tickerInfo?.markPrice, returnedPrice: price },
          'Price fetched successfully',
        );

        return price;
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
   * 查詢資金費率歷史（使用共享 CCXT 實例）
   */
  private async queryFundingFeesWithManager(
    manager: CcxtInstanceManager,
    longExchange: SupportedExchange,
    shortExchange: SupportedExchange,
    symbol: string,
    startTime: Date,
    userId: string,
  ): Promise<FundingFeeDetailsInfo | null> {
    try {
      const endTime = new Date();

      // 並行獲取兩個交易所的認證實例
      const [longInstance, shortInstance] = await Promise.all([
        manager.getAuthenticatedExchange(longExchange, userId),
        manager.getAuthenticatedExchange(shortExchange, userId),
      ]);

      // 使用共享實例查詢資金費率
      const result = await this.fundingFeeQueryService.queryBilateralFundingFeesWithInstances(
        longExchange,
        shortExchange,
        symbol,
        startTime,
        endTime,
        longInstance,
        shortInstance,
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
   * 查詢資金費率歷史（舊版方法，保留向後相容）
   * @deprecated 改用 queryFundingFeesWithManager
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
   * 創建已認證的 CCXT 交易所實例（舊版方法，保留向後相容）
   * @deprecated 改用 CcxtInstanceManager.getAuthenticatedExchange
   *
   * 使用統一 CCXT 工廠確保 proxy 配置自動套用
   */
  private async createUserCcxtExchange(
    exchange: SupportedExchange,
    userId: string,
  ): Promise<ccxt.Exchange> {
    const manager = new CcxtInstanceManager(this.prisma);
    try {
      return await manager.getAuthenticatedExchange(exchange, userId);
    } finally {
      // 不清理快取，因為是單次調用
    }
  }
}

// Export singleton instance
export const positionDetailsService = new PositionDetailsService();
