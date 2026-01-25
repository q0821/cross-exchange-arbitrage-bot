/**
 * 交易所查詢服務
 * 封裝 CCXT 交易所連接，用於查詢持倉和條件單
 * Feature: 049-trading-validation-script
 */

import type * as ccxt from 'ccxt';
import { logger } from '../../lib/logger';
import { createCcxtExchange, type SupportedExchange } from '../../lib/ccxt-factory';
import type {
  ExchangeName,
  ExchangePosition,
  ExchangeConditionalOrder,
  DecryptedApiKey,
} from './types';
import { convertToCcxtSymbol, retry } from './utils';

/**
 * 交易所查詢服務
 */
export class ExchangeQueryService {
  private exchange: ccxt.Exchange | null = null;
  private exchangeName: ExchangeName;
  private marketsLoaded = false;
  private apiKey: DecryptedApiKey | null = null;
  private isPortfolioMargin = false;

  constructor(exchangeName: ExchangeName) {
    this.exchangeName = exchangeName;
  }

  /**
   * 建立交易所連接
   */
  async connect(apiKey: DecryptedApiKey): Promise<void> {
    this.apiKey = apiKey;


    this.exchange = createCcxtExchange(this.exchangeName as SupportedExchange, {
      apiKey: apiKey.apiKey,
      secret: apiKey.secret,
      password: this.exchangeName === 'okx' ? apiKey.passphrase : undefined,
      enableRateLimit: true,
      options: {
        defaultType: 'swap',
        adjustForTimeDifference: true,
      },
    });

    // Binance 需要檢測是否為 Portfolio Margin 帳戶
    if (this.exchangeName === 'binance') {
      await this.detectBinanceAccountType();
    }
  }

  /**
   * 檢測 Binance 帳戶類型（標準期貨 vs Portfolio Margin）
   */
  private async detectBinanceAccountType(): Promise<void> {
    if (!this.exchange || !this.apiKey) return;

    try {
      // 嘗試標準期貨 API
      await this.exchange.fapiPrivateGetPositionRisk();
      this.isPortfolioMargin = false;
      logger.info({ exchange: 'binance', isPortfolioMargin: false }, 'Binance standard futures account detected (ExchangeQueryService)');
    } catch (error: any) {
      const errorStr = String(error.message || error);
      const isAuthError = errorStr.includes('-2015') || errorStr.includes('404') || errorStr.includes('Not Found');

      logger.info({ exchange: 'binance', errorStr, isAuthError }, 'Standard Futures API failed (ExchangeQueryService)');

      // 如果標準 API 失敗（-2015 權限錯誤或 404），嘗試 Portfolio Margin
      if (isAuthError) {
        logger.info({ exchange: 'binance' }, 'Trying Portfolio Margin API (ExchangeQueryService)');

        try {
          // 檢查 Portfolio Margin 帳戶
          const papiResponse = await (this.exchange as any).papiGetUmAccount();
          if (papiResponse) {
            this.isPortfolioMargin = true;
            logger.info({ exchange: 'binance', isPortfolioMargin: true }, 'Binance Portfolio Margin account detected (ExchangeQueryService)');

            // 重新建立 exchange 以啟用 Portfolio Margin
            await this.recreateWithPortfolioMargin();
          }
        } catch (papiError) {
          logger.error({ error: papiError }, 'Failed to detect Binance account type (ExchangeQueryService)');
          throw error;
        }
      } else {
        throw error;
      }
    }
  }

  /**
   * 重新建立 Binance exchange 並啟用 Portfolio Margin
   */
  private async recreateWithPortfolioMargin(): Promise<void> {
    if (!this.apiKey) return;


    this.exchange = createCcxtExchange('binance', {
      apiKey: this.apiKey.apiKey,
      secret: this.apiKey.secret,
      enableRateLimit: true,
      options: {
        defaultType: 'swap',
        adjustForTimeDifference: true,
        portfolioMargin: true,
      },
    });
    this.marketsLoaded = false;
  }

  /**
   * 確保市場資料已載入
   */
  private async ensureMarketsLoaded(): Promise<void> {
    if (!this.exchange) {
      throw new Error('交易所未連接');
    }

    if (!this.marketsLoaded) {
      await this.exchange.loadMarkets();
      this.marketsLoaded = true;
    }
  }

  /**
   * 查詢持倉
   */
  async fetchPosition(symbol: string): Promise<ExchangePosition | null> {
    if (!this.exchange) {
      throw new Error('交易所未連接');
    }

    await this.ensureMarketsLoaded();
    const ccxtSymbol = convertToCcxtSymbol(symbol);

    try {
      let positions: any[];

      // Binance Portfolio Margin 需要使用特殊 API
      if (this.exchangeName === 'binance' && this.isPortfolioMargin) {
        positions = await this.fetchBinancePortfolioMarginPositions(ccxtSymbol);
      } else {
        positions = await retry(async () => {
          return await this.exchange!.fetchPositions([ccxtSymbol]);
        });
      }

      // 找到有持倉的記錄
      for (const pos of positions) {
        const contracts = Math.abs(pos.contracts || 0);
        if (contracts > 0 && pos.symbol === ccxtSymbol) {
          const market = this.exchange.markets[ccxtSymbol];
          const contractSize = market?.contractSize || 1;

          return {
            symbol: pos.symbol,
            side: pos.side as 'long' | 'short',
            contracts,
            contractSize,
            quantity: contracts * contractSize,
            entryPrice: pos.entryPrice || 0,
            unrealizedPnl: pos.unrealizedPnl || 0,
          };
        }
      }

      return null;
    } catch (error) {
      logger.error(
        { error, exchange: this.exchangeName, symbol },
        'Failed to fetch position',
      );
      throw error;
    }
  }

  /**
   * 查詢 Binance Portfolio Margin 持倉
   */
  private async fetchBinancePortfolioMarginPositions(ccxtSymbol: string): Promise<any[]> {
    const binanceExchange = this.exchange as any;
    const exchangeSymbol = ccxtSymbol.replace('/', '').replace(':USDT', '');

    const response = await retry(async () => {
      return await binanceExchange.papiGetUmPositionRisk({
        symbol: exchangeSymbol,
      });
    });

    logger.info({ exchange: 'binance', isPortfolioMargin: true, symbol: exchangeSymbol, responseCount: response?.length || 0 }, 'Binance Portfolio Margin positions query');

    // 轉換為 CCXT 格式
    return (response || []).map((pos: any) => ({
      symbol: ccxtSymbol,
      side: parseFloat(pos.positionAmt || '0') >= 0 ? 'long' : 'short',
      contracts: Math.abs(parseFloat(pos.positionAmt || '0')),
      entryPrice: parseFloat(pos.entryPrice || '0'),
      unrealizedPnl: parseFloat(pos.unRealizedProfit || '0'),
    }));
  }

  /**
   * 查詢雙向持倉（多空兩邊）
   */
  async fetchPositions(symbol: string): Promise<{
    long: ExchangePosition | null;
    short: ExchangePosition | null;
  }> {
    if (!this.exchange) {
      throw new Error('交易所未連接');
    }

    await this.ensureMarketsLoaded();
    const ccxtSymbol = convertToCcxtSymbol(symbol);

    try {
      let positions: any[];

      // Binance Portfolio Margin 需要使用特殊 API
      if (this.exchangeName === 'binance' && this.isPortfolioMargin) {
        positions = await this.fetchBinancePortfolioMarginPositions(ccxtSymbol);
      } else {
        positions = await retry(async () => {
          return await this.exchange!.fetchPositions([ccxtSymbol]);
        });
      }

      let longPos: ExchangePosition | null = null;
      let shortPos: ExchangePosition | null = null;

      for (const pos of positions) {
        const contracts = Math.abs(pos.contracts || 0);
        if (contracts > 0 && pos.symbol === ccxtSymbol) {
          const market = this.exchange.markets[ccxtSymbol];
          const contractSize = market?.contractSize || 1;

          const position: ExchangePosition = {
            symbol: pos.symbol,
            side: pos.side as 'long' | 'short',
            contracts,
            contractSize,
            quantity: contracts * contractSize,
            entryPrice: pos.entryPrice || 0,
            unrealizedPnl: pos.unrealizedPnl || 0,
          };

          if (pos.side === 'long') {
            longPos = position;
          } else if (pos.side === 'short') {
            shortPos = position;
          }
        }
      }

      return { long: longPos, short: shortPos };
    } catch (error) {
      logger.error(
        { error, exchange: this.exchangeName, symbol },
        'Failed to fetch positions',
      );
      throw error;
    }
  }

  /**
   * 查詢條件單
   * 各交易所有不同的 API
   */
  async fetchConditionalOrders(symbol: string): Promise<ExchangeConditionalOrder[]> {
    if (!this.exchange) {
      throw new Error('交易所未連接');
    }

    await this.ensureMarketsLoaded();
    const ccxtSymbol = convertToCcxtSymbol(symbol);
    const market = this.exchange.markets[ccxtSymbol];
    const contractSize = market?.contractSize || 1;

    try {
      switch (this.exchangeName) {
        case 'binance':
          return await this.fetchBinanceConditionalOrders(ccxtSymbol, contractSize);
        case 'okx':
          return await this.fetchOkxConditionalOrders(ccxtSymbol, contractSize);
        case 'gateio':
          return await this.fetchGateioConditionalOrders(ccxtSymbol, contractSize);
        case 'bingx':
          return await this.fetchBingxConditionalOrders(ccxtSymbol, contractSize);
        default:
          return [];
      }
    } catch (error) {
      logger.error(
        { error, exchange: this.exchangeName, symbol },
        'Failed to fetch conditional orders',
      );
      throw error;
    }
  }

  /**
   * Binance 條件單查詢
   */
  private async fetchBinanceConditionalOrders(
    symbol: string,
    contractSize: number,
  ): Promise<ExchangeConditionalOrder[]> {
    const conditionalOrders: ExchangeConditionalOrder[] = [];

    // 轉換 symbol 格式 (ETH/USDT:USDT -> ETHUSDT)
    const exchangeSymbol = symbol.replace('/', '').replace(':USDT', '');

    if (this.isPortfolioMargin) {
      // Portfolio Margin 使用 papi API: /papi/v1/um/conditional/openOrders
      try {
        const response = await retry(async () => {
          return await (this.exchange as any).papiGetUmConditionalOpenOrders({
            symbol: exchangeSymbol,
          });
        });

        logger.info({
          exchange: 'binance',
          isPortfolioMargin: true,
          symbol: exchangeSymbol,
          responseCount: response?.length || 0,
          responseData: JSON.stringify(response || []).slice(0, 500),
        }, 'Binance Portfolio Margin conditional orders query');

        for (const order of response || []) {
          // Portfolio Margin 條件單使用 strategyType 而非 type
          const strategyType = (order.strategyType || order.type || '').toUpperCase();
          if (strategyType === 'STOP_MARKET' || strategyType === 'TAKE_PROFIT_MARKET') {
            const quantity = parseFloat(order.origQty || '0');
            conditionalOrders.push({
              orderId: order.strategyId?.toString() || order.orderId?.toString() || '',
              type: strategyType === 'STOP_MARKET' ? 'stop_loss' : 'take_profit',
              symbol,
              triggerPrice: parseFloat(order.stopPrice || '0'),
              contracts: quantity,
              contractSize,
              quantity: quantity * contractSize,
              status: 'open',
            });

            logger.info({
              exchange: 'binance',
              orderId: order.strategyId || order.orderId,
              strategyType,
              parsedType: strategyType === 'STOP_MARKET' ? 'stop_loss' : 'take_profit',
              quantity,
              stopPrice: order.stopPrice,
            }, 'Binance Portfolio Margin conditional order parsed');
          }
        }
      } catch (error) {
        logger.error({ error, symbol }, 'Failed to fetch Binance Portfolio Margin conditional orders');
      }
    } else {
      // 標準期貨使用 fetchOpenOrders
      const orders = await retry(async () => {
        return await this.exchange!.fetchOpenOrders(symbol);
      });

      for (const order of orders) {
        const type = order.type?.toUpperCase() || '';
        if (type === 'STOP_MARKET' || type === 'TAKE_PROFIT_MARKET') {
          conditionalOrders.push({
            orderId: order.id,
            type: type === 'STOP_MARKET' ? 'stop_loss' : 'take_profit',
            symbol: order.symbol,
            triggerPrice: order.stopPrice || order.triggerPrice || 0,
            contracts: order.amount || 0,
            contractSize,
            quantity: (order.amount || 0) * contractSize,
            status: 'open',
          });
        }
      }
    }

    return conditionalOrders;
  }

  /**
   * OKX 條件單查詢
   */
  private async fetchOkxConditionalOrders(
    symbol: string,
    contractSize: number,
  ): Promise<ExchangeConditionalOrder[]> {
    const okxExchange = this.exchange as any;

    // OKX 使用 algo orders API
    // ordType: 'trigger' 對應 OkxConditionalOrderAdapter 創建的觸發單
    const response = await retry(async () => {
      return await okxExchange.privateGetTradeOrdersAlgoPending({
        instType: 'SWAP',
        ordType: 'trigger',
      });
    });

    const conditionalOrders: ExchangeConditionalOrder[] = [];
    const data = response?.data || [];

    // 轉換 symbol 格式用於比對
    const okxInstId = symbol.replace('/', '-').replace(':USDT', '-SWAP');

    logger.info(
      {
        exchange: 'okx',
        symbol,
        okxInstId,
        responseCount: data.length,
        responseData: JSON.stringify(data).slice(0, 1000),
      },
      'OKX conditional orders query',
    );

    // 收集該 symbol 的所有 trigger 訂單
    const symbolOrders: Array<{ order: any; triggerPrice: number }> = [];

    for (const order of data) {
      if (order.instId !== okxInstId) continue;

      // trigger 單的觸發價格欄位是 triggerPx
      const triggerPrice = parseFloat(order.triggerPx || '0');
      if (triggerPrice > 0) {
        symbolOrders.push({ order, triggerPrice });
      }
    }

    // 依觸發價排序，較低價為停損（做空），較高價為停利（做空）
    // 或較低價為停利（做多），較高價為停損（做多）
    // 需要根據 posSide 判斷
    for (const { order, triggerPrice } of symbolOrders) {
      const posSide = order.posSide?.toLowerCase() || '';
      const contracts = parseFloat(order.sz || '0');

      // 對於 trigger 單，無法直接區分 SL 和 TP
      // 我們需要根據 posSide 和觸發價格的相對位置判斷
      // 這裡簡化處理：如果有兩個訂單，較低價為一個類型，較高價為另一類型
      // 實際區分需要知道開倉價格
      const type: 'stop_loss' | 'take_profit' = 'stop_loss';

      // 先收集所有訂單，稍後會根據價格排序來區分
      conditionalOrders.push({
        orderId: order.algoId,
        type, // 暫時設為 stop_loss，後面再修正
        symbol,
        triggerPrice,
        contracts,
        contractSize,
        quantity: contracts * contractSize,
        status: 'open',
        posSide, // 保存 posSide 以便後續判斷
      } as ExchangeConditionalOrder & { posSide?: string });
    }

    // 根據 posSide 和價格區分 SL 和 TP
    // 對於同一 posSide 的訂單，根據價格高低區分
    const longOrders = conditionalOrders.filter((o: any) => o.posSide === 'long');
    const shortOrders = conditionalOrders.filter((o: any) => o.posSide === 'short');

    // Long position: 低價 = SL, 高價 = TP
    if (longOrders.length === 2) {
      longOrders.sort((a, b) => a.triggerPrice - b.triggerPrice);
      longOrders[0].type = 'stop_loss';
      longOrders[1].type = 'take_profit';
    }

    // Short position: 高價 = SL, 低價 = TP
    if (shortOrders.length === 2) {
      shortOrders.sort((a, b) => b.triggerPrice - a.triggerPrice);
      shortOrders[0].type = 'stop_loss';
      shortOrders[1].type = 'take_profit';
    }

    // 清理 posSide 欄位
    conditionalOrders.forEach((o: any) => delete o.posSide);

    return conditionalOrders;
  }

  /**
   * Gate.io 條件單查詢
   */
  private async fetchGateioConditionalOrders(
    symbol: string,
    contractSize: number,
  ): Promise<ExchangeConditionalOrder[]> {
    const gateExchange = this.exchange as any;

    // Gate.io 使用 price_orders API
    const response = await retry(async () => {
      return await gateExchange.privateFuturesGetSettlePriceOrders({
        settle: 'usdt',
        status: 'open',
      });
    });

    const conditionalOrders: ExchangeConditionalOrder[] = [];

    // 轉換 symbol 格式用於比對 (SUI/USDT:USDT -> SUI_USDT)
    const gateContract = symbol.replace('/', '_').replace(':USDT', '');

    logger.info({ exchange: 'gateio', symbol, gateContract, responseCount: response?.length || 0 }, 'Gate.io conditional orders query');

    for (const order of response || []) {
      // Gate.io 的合約在 order.initial.contract
      const orderContract = order.initial?.contract || order.contract;
      const orderSize = order.initial?.size || order.size;

      logger.info({
        exchange: 'gateio',
        orderId: order.id,
        contract: orderContract,
        expectedContract: gateContract,
        triggerRule: order.trigger?.rule,
        triggerPrice: order.trigger?.price,
        size: orderSize,
      }, 'Gate.io order details');

      if (orderContract !== gateContract) continue;

      // Gate.io 使用 trigger.rule 判斷類型
      // rule: 1 = >=（價格上漲觸發）, 2 = <=（價格下跌觸發）
      const rule = parseInt(order.trigger?.rule || '0', 10);
      const size = parseFloat(orderSize || '0');
      let type: 'stop_loss' | 'take_profit' = 'stop_loss';

      // 根據 size 和 rule 判斷類型：
      // 多方停損：size < 0（賣出平倉）, rule = 2（價格下跌觸發）
      // 多方停利：size < 0（賣出平倉）, rule = 1（價格上漲觸發）
      // 空方停損：size > 0（買入平倉）, rule = 1（價格上漲觸發）
      // 空方停利：size > 0（買入平倉）, rule = 2（價格下跌觸發）
      if (size < 0) {
        // 賣出平倉 = 平多方
        type = rule === 1 ? 'take_profit' : 'stop_loss';
      } else {
        // 買入平倉 = 平空方
        type = rule === 1 ? 'stop_loss' : 'take_profit';
      }

      const contracts = Math.abs(size);
      conditionalOrders.push({
        orderId: order.id?.toString() || '',
        type,
        symbol,
        triggerPrice: parseFloat(order.trigger?.price || '0'),
        contracts,
        contractSize,
        quantity: contracts * contractSize,
        status: 'open',
      });

      logger.info({ exchange: 'gateio', orderId: order.id, determinedType: type, contracts }, 'Gate.io order parsed');
    }

    return conditionalOrders;
  }

  /**
   * BingX 條件單查詢
   */
  private async fetchBingxConditionalOrders(
    symbol: string,
    contractSize: number,
  ): Promise<ExchangeConditionalOrder[]> {
    const conditionalOrders: ExchangeConditionalOrder[] = [];

    try {
      // BingX 條件單需要使用專門的 API
      const bingxExchange = this.exchange as any;

      // 嘗試使用原生 API 查詢條件單
      const exchangeSymbol = symbol.replace('/', '-').replace(':USDT', '');

      const response = await retry(async () => {
        return await bingxExchange.swapV2PrivateGetTradeOpenOrders({
          symbol: exchangeSymbol,
        });
      });

      logger.info({ exchange: 'bingx', symbol, exchangeSymbol, responseData: response?.data?.orders?.length || 0 }, 'BingX conditional orders query');

      const orders = response?.data?.orders || [];
      for (const order of orders) {
        const type = order.type?.toUpperCase() || '';
        if (
          type === 'STOP_MARKET' ||
          type === 'TAKE_PROFIT_MARKET' ||
          type === 'STOP' ||
          type === 'TAKE_PROFIT' ||
          type === 'TRIGGER_MARKET'
        ) {
          const quantity = parseFloat(order.origQty || order.quantity || '0');
          conditionalOrders.push({
            orderId: order.orderId?.toString() || '',
            type: type.includes('STOP') ? 'stop_loss' : 'take_profit',
            symbol,
            triggerPrice: parseFloat(order.stopPrice || order.triggerPrice || '0'),
            contracts: quantity,
            contractSize,
            quantity: quantity * contractSize,
            status: 'open',
          });
        }
      }
    } catch (error) {
      logger.error({ error, exchange: 'bingx', symbol }, 'Failed to fetch BingX conditional orders');

      // 備用：嘗試 fetchOpenOrders
      try {
        const orders = await retry(async () => {
          return await this.exchange!.fetchOpenOrders(symbol);
        });

        logger.info({ exchange: 'bingx', symbol, fallbackCount: orders?.length || 0 }, 'BingX fetchOpenOrders fallback');

        for (const order of orders) {
          const type = order.type?.toUpperCase() || '';
          if (
            type === 'STOP_MARKET' ||
            type === 'TAKE_PROFIT_MARKET' ||
            type === 'STOP' ||
            type === 'TAKE_PROFIT'
          ) {
            conditionalOrders.push({
              orderId: order.id,
              type: type.includes('STOP') ? 'stop_loss' : 'take_profit',
              symbol: order.symbol,
              triggerPrice: order.stopPrice || order.triggerPrice || 0,
              contracts: order.amount || 0,
              contractSize,
              quantity: (order.amount || 0) * contractSize,
              status: 'open',
            });
          }
        }
      } catch (fallbackError) {
        logger.error({ error: fallbackError, exchange: 'bingx', symbol }, 'BingX fetchOpenOrders fallback also failed');
      }
    }

    return conditionalOrders;
  }

  /**
   * 取得市場資訊
   */
  async getMarket(symbol: string): Promise<ccxt.Market | null> {
    if (!this.exchange) {
      throw new Error('交易所未連接');
    }

    await this.ensureMarketsLoaded();
    const ccxtSymbol = convertToCcxtSymbol(symbol);
    return this.exchange.markets[ccxtSymbol] || null;
  }

  /**
   * 斷開連接
   */
  async disconnect(): Promise<void> {
    this.exchange = null;
    this.marketsLoaded = false;
  }
}
