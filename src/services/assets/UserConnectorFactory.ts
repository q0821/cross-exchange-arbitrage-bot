import { PrismaClient } from '@prisma/client';
import { ApiKeyService } from '../apikey/ApiKeyService';
import { logger } from '@lib/logger';
import { decrypt } from '@lib/encryption';
import {
  IExchangeConnector,
  ExchangeName,
  AccountBalance,
  PositionInfo,
} from '../../connectors/types';

/**
 * 交易所連線狀態
 */
export type ConnectionStatus = 'success' | 'no_api_key' | 'api_error' | 'rate_limited';

/**
 * 單一交易所的餘額查詢結果
 */
export interface ExchangeBalanceResult {
  exchange: ExchangeName;
  status: ConnectionStatus;
  balanceUSD: number | null;
  errorMessage?: string;
}

/**
 * 單一交易所的持倉查詢結果
 */
export interface ExchangePositionsResult {
  exchange: ExchangeName;
  status: ConnectionStatus;
  positions: PositionInfo['positions'];
  errorMessage?: string;
}

/**
 * 用戶的交易所連接器資訊
 */
interface UserApiKeyInfo {
  exchange: string;
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
  environment: 'MAINNET' | 'TESTNET';
}

/**
 * UserConnectorFactory
 * 為指定用戶建立交易所連接器並查詢餘額/持倉
 * Feature 031: Asset Tracking History
 */
export class UserConnectorFactory {
  private readonly apiKeyService: ApiKeyService;

  constructor(_prisma: PrismaClient) {
    this.apiKeyService = new ApiKeyService(_prisma);
  }

  /**
   * 獲取用戶的所有有效 API Key（解密後）
   */
  private async getUserApiKeys(userId: string): Promise<UserApiKeyInfo[]> {
    const apiKeys = await this.apiKeyService.getUserApiKeys(userId);
    const activeKeys = apiKeys.filter((key) => key.isActive);

    const decryptedKeys: UserApiKeyInfo[] = [];

    for (const key of activeKeys) {
      try {
        const decryptedKey = decrypt(key.encryptedKey);
        const decryptedSecret = decrypt(key.encryptedSecret);
        const decryptedPassphrase = key.encryptedPassphrase
          ? decrypt(key.encryptedPassphrase)
          : undefined;

        decryptedKeys.push({
          exchange: key.exchange,
          apiKey: decryptedKey,
          apiSecret: decryptedSecret,
          passphrase: decryptedPassphrase,
          environment: key.environment as 'MAINNET' | 'TESTNET',
        });
      } catch (error) {
        logger.error(
          { error, userId, exchange: key.exchange },
          'Failed to decrypt API key'
        );
        // 跳過解密失敗的 key
      }
    }

    return decryptedKeys;
  }

  /**
   * 為單一交易所建立連接器
   */
  private createConnector(
    exchange: string,
    apiKey: string,
    apiSecret: string,
    passphrase?: string,
    isTestnet: boolean = false
  ): IExchangeConnector | null {
    switch (exchange.toLowerCase()) {
      case 'binance':
        // BinanceConnector 使用環境變數或傳入的 apiKey
        // 為用戶特定查詢，我們需要用不同方式建立
        return new BinanceUserConnector(apiKey, apiSecret, isTestnet);

      case 'okx':
        return new OkxUserConnector(apiKey, apiSecret, passphrase || '', isTestnet);

      case 'mexc':
        return new MexcUserConnector(apiKey, apiSecret, isTestnet);

      case 'gateio':
      case 'gate':
        return new GateioUserConnector(apiKey, apiSecret, isTestnet);

      default:
        logger.warn({ exchange }, 'Unknown exchange');
        return null;
    }
  }

  /**
   * 查詢用戶在所有交易所的餘額
   */
  async getBalancesForUser(userId: string): Promise<ExchangeBalanceResult[]> {
    const results: ExchangeBalanceResult[] = [];
    const supportedExchanges: ExchangeName[] = ['binance', 'okx', 'mexc', 'gateio'];
    const userApiKeys = await this.getUserApiKeys(userId);

    for (const exchange of supportedExchanges) {
      const apiKeyInfo = userApiKeys.find(
        (k) => k.exchange.toLowerCase() === exchange.toLowerCase()
      );

      if (!apiKeyInfo) {
        results.push({
          exchange,
          status: 'no_api_key',
          balanceUSD: null,
        });
        continue;
      }

      try {
        const connector = this.createConnector(
          apiKeyInfo.exchange,
          apiKeyInfo.apiKey,
          apiKeyInfo.apiSecret,
          apiKeyInfo.passphrase,
          apiKeyInfo.environment === 'TESTNET'
        );

        if (!connector) {
          results.push({
            exchange,
            status: 'no_api_key',
            balanceUSD: null,
            errorMessage: 'Connector not implemented',
          });
          continue;
        }

        await connector.connect();
        const balance = await connector.getBalance();
        await connector.disconnect();

        results.push({
          exchange,
          status: 'success',
          balanceUSD: balance.totalEquityUSD,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ error, userId, exchange }, 'Failed to get balance');

        // 判斷是否為 rate limit 錯誤
        const isRateLimit =
          errorMessage.includes('rate limit') ||
          errorMessage.includes('429') ||
          errorMessage.includes('Too Many');

        results.push({
          exchange,
          status: isRateLimit ? 'rate_limited' : 'api_error',
          balanceUSD: null,
          errorMessage,
        });
      }
    }

    return results;
  }

  /**
   * 查詢用戶在所有交易所的持倉
   */
  async getPositionsForUser(userId: string): Promise<ExchangePositionsResult[]> {
    const results: ExchangePositionsResult[] = [];
    const supportedExchanges: ExchangeName[] = ['binance', 'okx', 'mexc', 'gateio'];
    const userApiKeys = await this.getUserApiKeys(userId);

    for (const exchange of supportedExchanges) {
      const apiKeyInfo = userApiKeys.find(
        (k) => k.exchange.toLowerCase() === exchange.toLowerCase()
      );

      if (!apiKeyInfo) {
        results.push({
          exchange,
          status: 'no_api_key',
          positions: [],
        });
        continue;
      }

      try {
        const connector = this.createConnector(
          apiKeyInfo.exchange,
          apiKeyInfo.apiKey,
          apiKeyInfo.apiSecret,
          apiKeyInfo.passphrase,
          apiKeyInfo.environment === 'TESTNET'
        );

        if (!connector) {
          results.push({
            exchange,
            status: 'no_api_key',
            positions: [],
            errorMessage: 'Connector not implemented',
          });
          continue;
        }

        await connector.connect();
        const positionInfo = await connector.getPositions();
        await connector.disconnect();

        results.push({
          exchange,
          status: 'success',
          positions: positionInfo.positions,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ error, userId, exchange }, 'Failed to get positions');

        const isRateLimit =
          errorMessage.includes('rate limit') ||
          errorMessage.includes('429') ||
          errorMessage.includes('Too Many');

        results.push({
          exchange,
          status: isRateLimit ? 'rate_limited' : 'api_error',
          positions: [],
          errorMessage,
        });
      }
    }

    return results;
  }
}

/**
 * 用戶特定的 Binance 連接器
 * 使用用戶提供的 API Key 而非環境變數
 */
class BinanceUserConnector implements IExchangeConnector {
  readonly name: ExchangeName = 'binance';
  private connected: boolean = false;
  private readonly spotBaseUrl: string;
  private readonly futuresBaseUrl: string;
  private readonly portfolioMarginBaseUrl: string;

  constructor(
    private readonly apiKey: string,
    private readonly apiSecret: string,
    readonly isTestnet: boolean = false
  ) {
    // Spot API - 只需要「啟用讀取」權限
    this.spotBaseUrl = isTestnet
      ? 'https://testnet.binance.vision'
      : 'https://api.binance.com';
    // Futures API - 需要 Futures 權限
    this.futuresBaseUrl = isTestnet
      ? 'https://testnet.binancefuture.com'
      : 'https://fapi.binance.com';
    // Portfolio Margin API - 統一保證金帳戶
    this.portfolioMarginBaseUrl = 'https://papi.binance.com';
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  private async signedRequest(
    baseUrl: string,
    endpoint: string,
    params: Record<string, string> = {}
  ): Promise<unknown> {
    const crypto = await import('crypto');
    const timestamp = Date.now().toString();
    const queryParams = { ...params, timestamp, recvWindow: '5000' };
    const queryString = new URLSearchParams(queryParams).toString();
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');

    const url = `${baseUrl}${endpoint}?${queryString}&signature=${signature}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': this.apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Binance API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * 取得現貨價格（用於計算 USD 總值）
   */
  private async getSpotPrices(): Promise<Record<string, number>> {
    try {
      const response = await fetch(`${this.spotBaseUrl}/api/v3/ticker/price`);
      if (!response.ok) return {};

      const data = (await response.json()) as Array<{ symbol: string; price: string }>;
      const prices: Record<string, number> = {};
      for (const item of data) {
        prices[item.symbol] = parseFloat(item.price);
      }
      return prices;
    } catch {
      return {};
    }
  }

  async getBalance(): Promise<AccountBalance> {
    // 優先使用 Portfolio Margin API（統一保證金帳戶）
    try {
      const pmData = (await this.signedRequest(
        this.portfolioMarginBaseUrl,
        '/papi/v1/balance'
      )) as Array<{
        asset: string;
        totalWalletBalance: string;
        crossMarginAsset: string;
        crossMarginFree: string;
        crossMarginLocked: string;
        umWalletBalance: string;
        cmWalletBalance: string;
      }>;

      let totalEquityUSD = 0;
      const prices = await this.getSpotPrices();

      const balances = pmData
        .filter((b) => parseFloat(b.totalWalletBalance) > 0)
        .map((b) => {
          const total = parseFloat(b.totalWalletBalance);
          const free = parseFloat(b.crossMarginFree) || 0;
          const locked = parseFloat(b.crossMarginLocked) || 0;

          // 計算 USD 價值
          let usdValue = 0;
          if (b.asset === 'USDT' || b.asset === 'BUSD' || b.asset === 'USDC' || b.asset === 'USD') {
            usdValue = total;
          } else {
            const price = prices[`${b.asset}USDT`];
            if (price) usdValue = total * price;
          }
          totalEquityUSD += usdValue;

          return { asset: b.asset, free, locked, total };
        });

      return {
        exchange: 'binance',
        balances,
        totalEquityUSD,
        timestamp: new Date(),
      };
    } catch {
      // Fallback 到 Spot API
    }

    // Fallback: 使用 Spot API（只需要「啟用讀取」權限）
    const data = (await this.signedRequest(this.spotBaseUrl, '/api/v3/account')) as {
      balances: Array<{
        asset: string;
        free: string;
        locked: string;
      }>;
    };

    // 取得價格用於計算 USD 總值
    const prices = await this.getSpotPrices();

    let totalEquityUSD = 0;
    const balances = data.balances
      .filter((b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
      .map((b) => {
        const free = parseFloat(b.free);
        const locked = parseFloat(b.locked);
        const total = free + locked;

        // 計算 USD 價值
        let usdValue = 0;
        if (b.asset === 'USDT' || b.asset === 'BUSD' || b.asset === 'USDC' || b.asset === 'USD') {
          usdValue = total;
        } else {
          const priceUsdt = prices[`${b.asset}USDT`];
          const priceBusd = prices[`${b.asset}BUSD`];
          if (priceUsdt) usdValue = total * priceUsdt;
          else if (priceBusd) usdValue = total * priceBusd;
        }
        totalEquityUSD += usdValue;

        return { asset: b.asset, free, locked, total };
      });

    return {
      exchange: 'binance',
      balances,
      totalEquityUSD,
      timestamp: new Date(),
    };
  }

  async getPositions(): Promise<PositionInfo> {
    // 優先使用 Portfolio Margin API（統一保證金帳戶）
    try {
      const data = (await this.signedRequest(
        this.portfolioMarginBaseUrl,
        '/papi/v1/um/positionRisk'
      )) as Array<{
        symbol: string;
        positionAmt: string;
        entryPrice: string;
        markPrice: string;
        unRealizedProfit: string;
        liquidationPrice: string;
        leverage: string;
        isolatedMargin: string;
        positionSide: string;
        updateTime: number;
      }>;

      const positions = data
        .filter((p) => Math.abs(parseFloat(p.positionAmt)) > 0)
        .map((p) => {
          const positionAmt = parseFloat(p.positionAmt);
          return {
            symbol: p.symbol,
            side: (positionAmt > 0 ? 'LONG' : 'SHORT') as 'LONG' | 'SHORT',
            quantity: Math.abs(positionAmt),
            entryPrice: parseFloat(p.entryPrice),
            markPrice: parseFloat(p.markPrice),
            leverage: parseInt(p.leverage),
            marginUsed: parseFloat(p.isolatedMargin),
            unrealizedPnl: parseFloat(p.unRealizedProfit),
            liquidationPrice: parseFloat(p.liquidationPrice) || undefined,
            timestamp: new Date(p.updateTime),
          };
        });

      return {
        exchange: 'binance',
        positions,
        timestamp: new Date(),
      };
    } catch {
      // Fallback 到傳統 Futures API
    }

    // Fallback: 嘗試使用 Futures API
    try {
      const data = (await this.signedRequest(this.futuresBaseUrl, '/fapi/v2/positionRisk')) as Array<{
        symbol: string;
        positionAmt: string;
        entryPrice: string;
        markPrice: string;
        unRealizedProfit: string;
        liquidationPrice: string;
        leverage: string;
        isolatedMargin: string;
        positionSide: string;
        updateTime: number;
      }>;

      const positions = data
        .filter((p) => Math.abs(parseFloat(p.positionAmt)) > 0)
        .map((p) => {
          const positionAmt = parseFloat(p.positionAmt);
          return {
            symbol: p.symbol,
            side: (positionAmt > 0 ? 'LONG' : 'SHORT') as 'LONG' | 'SHORT',
            quantity: Math.abs(positionAmt),
            entryPrice: parseFloat(p.entryPrice),
            markPrice: parseFloat(p.markPrice),
            leverage: parseInt(p.leverage),
            marginUsed: parseFloat(p.isolatedMargin),
            unrealizedPnl: parseFloat(p.unRealizedProfit),
            liquidationPrice: parseFloat(p.liquidationPrice) || undefined,
            timestamp: new Date(p.updateTime),
          };
        });

      return {
        exchange: 'binance',
        positions,
        timestamp: new Date(),
      };
    } catch {
      // 都沒權限，返回空持倉
      return {
        exchange: 'binance',
        positions: [],
        timestamp: new Date(),
      };
    }
  }

  // 以下方法不需要實作（資產追蹤不需要）
  async getFundingRate(): Promise<never> {
    throw new Error('Not implemented');
  }
  async getFundingRates(): Promise<never> {
    throw new Error('Not implemented');
  }
  async getPrice(): Promise<never> {
    throw new Error('Not implemented');
  }
  async getPrices(): Promise<never> {
    throw new Error('Not implemented');
  }
  async getSymbolInfo(): Promise<never> {
    throw new Error('Not implemented');
  }
  async getPosition(): Promise<never> {
    throw new Error('Not implemented');
  }
  async createOrder(): Promise<never> {
    throw new Error('Not implemented');
  }
  async cancelOrder(): Promise<never> {
    throw new Error('Not implemented');
  }
  async getOrder(): Promise<never> {
    throw new Error('Not implemented');
  }
  async subscribeWS(): Promise<never> {
    throw new Error('Not implemented');
  }
  async unsubscribeWS(): Promise<never> {
    throw new Error('Not implemented');
  }
  async validateSymbol(): Promise<boolean> {
    throw new Error('Not implemented');
  }
  async formatQuantity(): Promise<number> {
    throw new Error('Not implemented');
  }
  async formatPrice(): Promise<number> {
    throw new Error('Not implemented');
  }
}

/**
 * 用戶特定的 OKX 連接器
 */
class OkxUserConnector implements IExchangeConnector {
  readonly name: ExchangeName = 'okx';
  private connected: boolean = false;
  private ccxt: typeof import('ccxt') | null = null;
  private exchange: InstanceType<typeof import('ccxt').okx> | null = null;

  constructor(
    private readonly apiKey: string,
    private readonly apiSecret: string,
    private readonly passphrase: string,
    readonly isTestnet: boolean = false
  ) {}

  async connect(): Promise<void> {
    this.ccxt = await import('ccxt');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.exchange = new this.ccxt.okx({
      apiKey: this.apiKey,
      secret: this.apiSecret,
      password: this.passphrase,
      sandbox: this.isTestnet,
      timeout: 30000, // 30 秒超時
      options: {
        defaultType: 'swap',
      },
    } as any);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.exchange = null;
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getBalance(): Promise<AccountBalance> {
    if (!this.exchange) throw new Error('Not connected');

    // Set default type for swap market
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.exchange as any).options['defaultType'] = 'swap';
    const balance = await this.exchange.fetchBalance();
    const totalUSD = balance.total?.USDT || balance.total?.USD || 0;

    const balances = Object.entries(balance.total || {})
      .filter(([_, value]) => (value as number) > 0)
      .map(([asset, total]) => ({
        asset,
        free: (balance.free?.[asset] as number) || 0,
        locked: ((total as number) - ((balance.free?.[asset] as number) || 0)),
        total: total as number,
      }));

    return {
      exchange: 'okx',
      balances,
      totalEquityUSD: totalUSD as number,
      timestamp: new Date(),
    };
  }

  async getPositions(): Promise<PositionInfo> {
    if (!this.exchange) throw new Error('Not connected');

    const positions = await this.exchange.fetchPositions();

    const filteredPositions = positions
      .filter((p) => parseFloat(p.contracts?.toString() || '0') > 0)
      .map((p) => ({
        symbol: p.symbol,
        side: (p.side === 'long' ? 'LONG' : 'SHORT') as 'LONG' | 'SHORT',
        quantity: parseFloat(p.contracts?.toString() || '0'),
        entryPrice: parseFloat(p.entryPrice?.toString() || '0'),
        markPrice: parseFloat(p.markPrice?.toString() || '0'),
        leverage: parseFloat(p.leverage?.toString() || '1'),
        marginUsed: parseFloat(p.initialMargin?.toString() || '0'),
        unrealizedPnl: parseFloat(p.unrealizedPnl?.toString() || '0'),
        liquidationPrice: p.liquidationPrice
          ? parseFloat(p.liquidationPrice.toString())
          : undefined,
        timestamp: p.timestamp ? new Date(p.timestamp) : new Date(),
      }));

    return {
      exchange: 'okx',
      positions: filteredPositions,
      timestamp: new Date(),
    };
  }

  // 以下方法不需要實作
  async getFundingRate(): Promise<never> {
    throw new Error('Not implemented');
  }
  async getFundingRates(): Promise<never> {
    throw new Error('Not implemented');
  }
  async getPrice(): Promise<never> {
    throw new Error('Not implemented');
  }
  async getPrices(): Promise<never> {
    throw new Error('Not implemented');
  }
  async getSymbolInfo(): Promise<never> {
    throw new Error('Not implemented');
  }
  async getPosition(): Promise<never> {
    throw new Error('Not implemented');
  }
  async createOrder(): Promise<never> {
    throw new Error('Not implemented');
  }
  async cancelOrder(): Promise<never> {
    throw new Error('Not implemented');
  }
  async getOrder(): Promise<never> {
    throw new Error('Not implemented');
  }
  async subscribeWS(): Promise<never> {
    throw new Error('Not implemented');
  }
  async unsubscribeWS(): Promise<never> {
    throw new Error('Not implemented');
  }
  async validateSymbol(): Promise<boolean> {
    throw new Error('Not implemented');
  }
  async formatQuantity(): Promise<number> {
    throw new Error('Not implemented');
  }
  async formatPrice(): Promise<number> {
    throw new Error('Not implemented');
  }
}

/**
 * 用戶特定的 MEXC 連接器
 * Feature 032: MEXC 和 Gate.io 資產追蹤
 */
class MexcUserConnector implements IExchangeConnector {
  readonly name: ExchangeName = 'mexc';
  private connected: boolean = false;
  private ccxt: typeof import('ccxt') | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private exchange: any = null;

  constructor(
    private readonly apiKey: string,
    private readonly apiSecret: string,
    readonly isTestnet: boolean = false
  ) {}

  async connect(): Promise<void> {
    this.ccxt = await import('ccxt');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.exchange = new (this.ccxt as any).mexc({
      apiKey: this.apiKey,
      secret: this.apiSecret,
      enableRateLimit: true,
      timeout: 30000, // 30 秒超時
      options: {
        defaultType: 'swap',
      },
    });
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.exchange = null;
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getBalance(): Promise<AccountBalance> {
    if (!this.exchange) throw new Error('Not connected');

    // 使用 swap 模式查詢合約帳戶餘額
    const balance = await this.exchange.fetchBalance({ type: 'swap' });
    const totalUSD = balance.total?.USDT || balance.total?.USD || 0;

    const balances = Object.entries(balance.total || {})
      .filter(([_, value]) => (value as number) > 0)
      .map(([asset, total]) => ({
        asset,
        free: (balance.free?.[asset] as number) || 0,
        locked: (total as number) - ((balance.free?.[asset] as number) || 0),
        total: total as number,
      }));

    return {
      exchange: 'mexc',
      balances,
      totalEquityUSD: totalUSD as number,
      timestamp: new Date(),
    };
  }

  async getPositions(): Promise<PositionInfo> {
    if (!this.exchange) throw new Error('Not connected');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const positions: any[] = await this.exchange.fetchPositions();

    const filteredPositions = positions
      .filter((p) => parseFloat(p.contracts?.toString() || '0') > 0)
      .map((p) => ({
        symbol: p.symbol,
        side: (p.side === 'long' ? 'LONG' : 'SHORT') as 'LONG' | 'SHORT',
        quantity: parseFloat(p.contracts?.toString() || '0'),
        entryPrice: parseFloat(p.entryPrice?.toString() || '0'),
        markPrice: parseFloat(p.markPrice?.toString() || '0'),
        leverage: parseFloat(p.leverage?.toString() || '1'),
        marginUsed: parseFloat(p.initialMargin?.toString() || '0'),
        unrealizedPnl: parseFloat(p.unrealizedPnl?.toString() || '0'),
        liquidationPrice: p.liquidationPrice
          ? parseFloat(p.liquidationPrice.toString())
          : undefined,
        timestamp: p.timestamp ? new Date(p.timestamp) : new Date(),
      }));

    return {
      exchange: 'mexc',
      positions: filteredPositions,
      timestamp: new Date(),
    };
  }

  // 以下方法不需要實作（資產追蹤不需要）
  async getFundingRate(): Promise<never> {
    throw new Error('Not implemented');
  }
  async getFundingRates(): Promise<never> {
    throw new Error('Not implemented');
  }
  async getPrice(): Promise<never> {
    throw new Error('Not implemented');
  }
  async getPrices(): Promise<never> {
    throw new Error('Not implemented');
  }
  async getSymbolInfo(): Promise<never> {
    throw new Error('Not implemented');
  }
  async getPosition(): Promise<never> {
    throw new Error('Not implemented');
  }
  async createOrder(): Promise<never> {
    throw new Error('Not implemented');
  }
  async cancelOrder(): Promise<never> {
    throw new Error('Not implemented');
  }
  async getOrder(): Promise<never> {
    throw new Error('Not implemented');
  }
  async subscribeWS(): Promise<never> {
    throw new Error('Not implemented');
  }
  async unsubscribeWS(): Promise<never> {
    throw new Error('Not implemented');
  }
  async validateSymbol(): Promise<boolean> {
    throw new Error('Not implemented');
  }
  async formatQuantity(): Promise<number> {
    throw new Error('Not implemented');
  }
  async formatPrice(): Promise<number> {
    throw new Error('Not implemented');
  }
}

/**
 * 用戶特定的 Gate.io 連接器
 * Feature 032: MEXC 和 Gate.io 資產追蹤
 */
class GateioUserConnector implements IExchangeConnector {
  readonly name: ExchangeName = 'gateio';
  private connected: boolean = false;
  private ccxt: typeof import('ccxt') | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private exchange: any = null;

  constructor(
    private readonly apiKey: string,
    private readonly apiSecret: string,
    readonly isTestnet: boolean = false
  ) {}

  async connect(): Promise<void> {
    this.ccxt = await import('ccxt');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.exchange = new (this.ccxt as any).gateio({
      apiKey: this.apiKey,
      secret: this.apiSecret,
      enableRateLimit: true,
      timeout: 30000, // 30 秒超時
      options: {
        defaultType: 'swap',
      },
    });
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.exchange = null;
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getBalance(): Promise<AccountBalance> {
    if (!this.exchange) throw new Error('Not connected');

    // 優先使用統一帳戶 API (跨幣種保證金模式)
    try {
      const unifiedBalance = await this.fetchUnifiedAccountBalance();
      if (unifiedBalance && unifiedBalance.totalEquityUSD > 0) {
        return unifiedBalance;
      }
    } catch (error) {
      // 統一帳戶 API 失敗，fallback 到 swap
      logger.debug({ error }, 'Gate.io unified account API failed, falling back to swap');
    }

    // Fallback: 使用 swap 帳戶
    const balance = await this.exchange.fetchBalance({ type: 'swap' });
    const totalUSD = balance.total?.USDT || balance.total?.USD || 0;

    const balances = Object.entries(balance.total || {})
      .filter(([_, value]) => (value as number) > 0)
      .map(([asset, total]) => ({
        asset,
        free: (balance.free?.[asset] as number) || 0,
        locked: (total as number) - ((balance.free?.[asset] as number) || 0),
        total: total as number,
      }));

    return {
      exchange: 'gateio',
      balances,
      totalEquityUSD: totalUSD as number,
      timestamp: new Date(),
    };
  }

  /**
   * 查詢 Gate.io 統一帳戶餘額 (跨幣種保證金模式)
   */
  private async fetchUnifiedAccountBalance(): Promise<AccountBalance | null> {
    const crypto = await import('crypto');
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const method = 'GET';
    const url = '/api/v4/unified/accounts';
    const queryString = '';
    const bodyHash = crypto.createHash('sha512').update('').digest('hex');

    const signString = `${method}\n${url}\n${queryString}\n${bodyHash}\n${timestamp}`;
    const signature = crypto.createHmac('sha512', this.apiSecret).update(signString).digest('hex');

    const response = await fetch(`https://api.gateio.ws${url}`, {
      method,
      headers: {
        KEY: this.apiKey,
        Timestamp: timestamp,
        SIGN: signature,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // 檢查是否有錯誤
    if (data.label || data.message) {
      return null;
    }

    // 解析統一帳戶餘額
    const totalEquityUSD = parseFloat(data.unified_account_total_equity || '0');
    const balancesData = data.balances || {};

    const balances = Object.entries(balancesData)
      .filter(([_, v]) => {
        const val = v as { equity?: string };
        return parseFloat(val.equity || '0') > 0;
      })
      .map(([asset, v]) => {
        const val = v as { available?: string; freeze?: string; equity?: string };
        const available = parseFloat(val.available || '0');
        const freeze = parseFloat(val.freeze || '0');
        const equity = parseFloat(val.equity || '0');
        return {
          asset,
          free: available,
          locked: freeze,
          total: equity,
        };
      });

    return {
      exchange: 'gateio',
      balances,
      totalEquityUSD,
      timestamp: new Date(),
    };
  }

  async getPositions(): Promise<PositionInfo> {
    if (!this.exchange) throw new Error('Not connected');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const positions: any[] = await this.exchange.fetchPositions();

    const filteredPositions = positions
      .filter((p) => parseFloat(p.contracts?.toString() || '0') > 0)
      .map((p) => ({
        symbol: p.symbol,
        side: (p.side === 'long' ? 'LONG' : 'SHORT') as 'LONG' | 'SHORT',
        quantity: parseFloat(p.contracts?.toString() || '0'),
        entryPrice: parseFloat(p.entryPrice?.toString() || '0'),
        markPrice: parseFloat(p.markPrice?.toString() || '0'),
        leverage: parseFloat(p.leverage?.toString() || '1'),
        marginUsed: parseFloat(p.initialMargin?.toString() || '0'),
        unrealizedPnl: parseFloat(p.unrealizedPnl?.toString() || '0'),
        liquidationPrice: p.liquidationPrice
          ? parseFloat(p.liquidationPrice.toString())
          : undefined,
        timestamp: p.timestamp ? new Date(p.timestamp) : new Date(),
      }));

    return {
      exchange: 'gateio',
      positions: filteredPositions,
      timestamp: new Date(),
    };
  }

  // 以下方法不需要實作（資產追蹤不需要）
  async getFundingRate(): Promise<never> {
    throw new Error('Not implemented');
  }
  async getFundingRates(): Promise<never> {
    throw new Error('Not implemented');
  }
  async getPrice(): Promise<never> {
    throw new Error('Not implemented');
  }
  async getPrices(): Promise<never> {
    throw new Error('Not implemented');
  }
  async getSymbolInfo(): Promise<never> {
    throw new Error('Not implemented');
  }
  async getPosition(): Promise<never> {
    throw new Error('Not implemented');
  }
  async createOrder(): Promise<never> {
    throw new Error('Not implemented');
  }
  async cancelOrder(): Promise<never> {
    throw new Error('Not implemented');
  }
  async getOrder(): Promise<never> {
    throw new Error('Not implemented');
  }
  async subscribeWS(): Promise<never> {
    throw new Error('Not implemented');
  }
  async unsubscribeWS(): Promise<never> {
    throw new Error('Not implemented');
  }
  async validateSymbol(): Promise<boolean> {
    throw new Error('Not implemented');
  }
  async formatQuantity(): Promise<number> {
    throw new Error('Not implemented');
  }
  async formatPrice(): Promise<number> {
    throw new Error('Not implemented');
  }
}
