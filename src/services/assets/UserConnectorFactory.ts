import { PrismaClient } from '@/generated/prisma/client';
import { ApiKeyService } from '../apikey/ApiKeyService';
import { logger } from '@lib/logger';
import { decrypt } from '@lib/encryption';
import { createCcxtExchange } from '@lib/ccxt-factory';
import { injectCachedMarkets, cacheMarketsFromExchange } from '@lib/ccxt-markets-cache';
import { getSharedProxyAgent } from '@lib/shared-proxy-agent';
import { ProxyAgent } from 'undici';
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
  /** 總權益（用於資產總覽）：包含持倉價值 */
  balanceUSD: number | null;
  /** 可用餘額（用於開倉驗證）：可自由使用的餘額 */
  availableBalanceUSD: number | null;
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

      case 'bingx':
        return new BingxUserConnector(apiKey, apiSecret, isTestnet);

      default:
        logger.warn({ exchange }, 'Unknown exchange');
        return null;
    }
  }

  /**
   * 查詢用戶在指定交易所的餘額（平行查詢）
   *
   * @param userId - 用戶 ID
   * @param targetExchanges - 要查詢的交易所列表（可選，預設查詢所有）
   * @returns 餘額查詢結果
   */
  async getBalancesForUser(
    userId: string,
    targetExchanges?: ExchangeName[]
  ): Promise<ExchangeBalanceResult[]> {
    const supportedExchanges: ExchangeName[] = ['binance', 'okx', 'mexc', 'gateio', 'bingx'];
    // 如果有指定交易所，只查詢指定的；否則查詢所有
    const exchangesToQuery = targetExchanges
      ? targetExchanges.filter((e) => supportedExchanges.includes(e))
      : supportedExchanges;

    const userApiKeys = await this.getUserApiKeys(userId);

    // 使用 Promise.allSettled 平行查詢所有交易所
    const promises = exchangesToQuery.map(async (exchange): Promise<ExchangeBalanceResult> => {
      const apiKeyInfo = userApiKeys.find(
        (k) => k.exchange.toLowerCase() === exchange.toLowerCase()
      );

      if (!apiKeyInfo) {
        return {
          exchange,
          status: 'no_api_key',
          balanceUSD: null,
          availableBalanceUSD: null,
        };
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
          return {
            exchange,
            status: 'no_api_key',
            balanceUSD: null,
            availableBalanceUSD: null,
            errorMessage: 'Connector not implemented',
          };
        }

        await connector.connect();
        const balance = await connector.getBalance();
        await connector.disconnect();

        return {
          exchange,
          status: 'success',
          balanceUSD: balance.totalEquityUSD,
          availableBalanceUSD: balance.availableBalanceUSD,
        };
      } catch (error) {
        // 提取詳細錯誤資訊
        const errorName = error instanceof Error ? error.name : 'Unknown';
        const errorMessage = error instanceof Error ? error.message : String(error);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errorDetails = (error as any)?.response?.data || (error as any)?.body || null;

        // 判斷錯誤類型以決定日誌等級
        const isAuthError = errorName === 'AuthenticationError' ||
          errorMessage.includes('Invalid OK-ACCESS-KEY') ||
          errorMessage.includes('Invalid API-key') ||
          errorMessage.includes('API key') ||
          errorMessage.includes('50111');

        // 判斷是否為 rate limit 錯誤
        const isRateLimit =
          errorMessage.includes('rate limit') ||
          errorMessage.includes('429') ||
          errorMessage.includes('Too Many');

        // AuthenticationError 降級為 warn（API 金鑰無效是預期中的用戶配置問題）
        if (isAuthError) {
          logger.warn(
            { errorName, errorMessage, userId, exchange },
            'Failed to get balance - API key invalid or expired'
          );
        } else {
          logger.error(
            { errorName, errorMessage, errorDetails, userId, exchange },
            'Failed to get balance'
          );
        }

        return {
          exchange,
          status: isRateLimit ? 'rate_limited' : 'api_error',
          balanceUSD: null,
          availableBalanceUSD: null,
          errorMessage: `${errorName}: ${errorMessage}`,
        };
      }
    });

    const settledResults = await Promise.allSettled(promises);

    // 處理 Promise.allSettled 結果
    return settledResults.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      // Promise rejected（理論上不應發生，因為內部已 catch）
      // index 一定有效，因為 settledResults 和 exchangesToQuery 長度相同
      const exchange = exchangesToQuery[index]!;
      logger.error(
        { exchange, reason: result.reason },
        'Unexpected promise rejection in getBalancesForUser'
      );
      return {
        exchange,
        status: 'api_error' as const,
        balanceUSD: null,
        availableBalanceUSD: null,
        errorMessage: String(result.reason),
      };
    });
  }

  /**
   * 查詢用戶在所有交易所的持倉（平行查詢）
   *
   * @param userId - 用戶 ID
   * @param targetExchanges - 要查詢的交易所列表（可選，預設查詢所有）
   * @returns 持倉查詢結果
   */
  async getPositionsForUser(
    userId: string,
    targetExchanges?: ExchangeName[]
  ): Promise<ExchangePositionsResult[]> {
    const supportedExchanges: ExchangeName[] = ['binance', 'okx', 'mexc', 'gateio', 'bingx'];
    // 如果有指定交易所，只查詢指定的；否則查詢所有
    const exchangesToQuery = targetExchanges
      ? targetExchanges.filter((e) => supportedExchanges.includes(e))
      : supportedExchanges;

    const userApiKeys = await this.getUserApiKeys(userId);

    // 使用 Promise.allSettled 平行查詢所有交易所
    const promises = exchangesToQuery.map(async (exchange): Promise<ExchangePositionsResult> => {
      const apiKeyInfo = userApiKeys.find(
        (k) => k.exchange.toLowerCase() === exchange.toLowerCase()
      );

      if (!apiKeyInfo) {
        return {
          exchange,
          status: 'no_api_key',
          positions: [],
        };
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
          return {
            exchange,
            status: 'no_api_key',
            positions: [],
            errorMessage: 'Connector not implemented',
          };
        }

        await connector.connect();
        const positionInfo = await connector.getPositions();
        await connector.disconnect();

        return {
          exchange,
          status: 'success',
          positions: positionInfo.positions,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ error, userId, exchange }, 'Failed to get positions');

        const isRateLimit =
          errorMessage.includes('rate limit') ||
          errorMessage.includes('429') ||
          errorMessage.includes('Too Many');

        return {
          exchange,
          status: isRateLimit ? 'rate_limited' : 'api_error',
          positions: [],
          errorMessage,
        };
      }
    });

    const settledResults = await Promise.allSettled(promises);

    // 處理 Promise.allSettled 結果
    return settledResults.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      // Promise rejected（理論上不應發生，因為內部已 catch）
      const exchange = exchangesToQuery[index]!;
      logger.error(
        { exchange, reason: result.reason },
        'Unexpected promise rejection in getPositionsForUser'
      );
      return {
        exchange,
        status: 'api_error' as const,
        positions: [],
        errorMessage: String(result.reason),
      };
    });
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
    // 注意：ProxyAgent 改用共享單例 (getSharedProxyAgent())，不在此創建
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

    // 準備 fetch 選項，使用共享的 ProxyAgent
    const fetchOptions: RequestInit & { dispatcher?: ProxyAgent } = {
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': this.apiKey,
      },
    };

    const proxyAgent = getSharedProxyAgent();
    if (proxyAgent) {
      fetchOptions.dispatcher = proxyAgent;
    }

    const response = await fetch(url, fetchOptions);

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
      const fetchOptions: RequestInit & { dispatcher?: ProxyAgent } = {};
      const proxyAgent = getSharedProxyAgent();
      if (proxyAgent) {
        fetchOptions.dispatcher = proxyAgent;
      }

      const response = await fetch(`${this.spotBaseUrl}/api/v3/ticker/price`, fetchOptions);
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
    logger.info(
      { apiKey: this.apiKey.slice(0, 8) + '...' },
      'BinanceUserConnector.getBalance() called'
    );

    // 使用 Futures API 獲取合約帳戶餘額
    try {
      logger.info('Attempting Binance Futures API /fapi/v2/account');
      const futuresData = (await this.signedRequest(
        this.futuresBaseUrl,
        '/fapi/v2/account'
      )) as {
        totalWalletBalance: string;      // 總錢包餘額
        totalMarginBalance: string;      // 總保證金餘額
        totalUnrealizedProfit: string;   // 未實現損益
        availableBalance: string;        // 可用餘額（扣除保證金後）
        assets: Array<{
          asset: string;
          walletBalance: string;
          availableBalance: string;
          marginBalance: string;
        }>;
      };

      // 總權益 = 錢包餘額 + 未實現損益
      const totalEquityUSD = parseFloat(futuresData.totalMarginBalance) || 0;
      // 可用餘額 = 可自由使用的餘額（已扣除持倉保證金）
      const availableBalanceUSD = parseFloat(futuresData.availableBalance) || 0;

      const balances = futuresData.assets
        .filter((a) => parseFloat(a.walletBalance) > 0)
        .map((a) => ({
          asset: a.asset,
          free: parseFloat(a.availableBalance) || 0,
          locked: parseFloat(a.walletBalance) - parseFloat(a.availableBalance),
          total: parseFloat(a.marginBalance) || parseFloat(a.walletBalance),
        }));

      logger.info(
        {
          totalEquityUSD,
          availableBalanceUSD,
          totalWalletBalance: futuresData.totalWalletBalance,
          totalMarginBalance: futuresData.totalMarginBalance,
          rawAvailableBalance: futuresData.availableBalance,
        },
        'Binance Futures API SUCCESS'
      );

      // 如果 Futures 餘額大於閾值（1 USDT），直接返回
      // 否則可能是 Portfolio Margin 模式，繼續嘗試 PM API
      if (availableBalanceUSD > 1) {
        logger.info(
          { availableBalanceUSD },
          'Binance Futures balance sufficient, returning result'
        );
        return {
          exchange: 'binance',
          balances,
          totalEquityUSD,
          availableBalanceUSD,
          timestamp: new Date(),
        };
      }

      // Futures 餘額接近 0，可能是 PM 模式，繼續嘗試 PM API
      logger.info(
        { availableBalanceUSD },
        'Binance Futures balance near zero, trying Portfolio Margin API (user may be in PM mode)'
      );
    } catch (futuresError) {
      // Futures API 失敗，記錄錯誤後 fallback 到 Portfolio Margin API
      logger.warn(
        {
          error: futuresError instanceof Error ? futuresError.message : String(futuresError),
          errorName: futuresError instanceof Error ? futuresError.name : 'Unknown',
          apiKey: this.apiKey.slice(0, 8) + '...',
        },
        'Binance Futures API FAILED - falling back to Portfolio Margin API'
      );
    }

    // Fallback 1: 使用 Portfolio Margin Account Info API（統一保證金帳戶資訊）
    try {
      logger.info('Attempting Binance Portfolio Margin Account Info API /papi/v1/account');
      const pmAccountData = (await this.signedRequest(
        this.portfolioMarginBaseUrl,
        '/papi/v1/account'
      )) as {
        uniMMR: string;                    // 統一維持保證金率
        accountEquity: string;             // 帳戶權益
        actualEquity: string;              // 實際權益
        accountInitialMargin: string;      // 初始保證金
        accountMaintMargin: string;        // 維持保證金
        accountStatus: string;
        virtualMaxWithdrawAmount: string;  // 可提領金額（這就是可用餘額）
        totalAvailableBalance: string;     // 總可用餘額
        totalMarginOpenLoss: string;       // 未實現損失
        updateTime: number;
      };

      // 記錄完整的 API 回應以便調試
      logger.info(
        { rawResponse: pmAccountData },
        'Binance Portfolio Margin Account Info raw response'
      );

      // 總權益 = 帳戶權益
      const totalEquityUSD = parseFloat(pmAccountData.accountEquity) || 0;
      // 可用餘額 = totalAvailableBalance 或 virtualMaxWithdrawAmount
      const availableBalanceUSD = parseFloat(pmAccountData.totalAvailableBalance) ||
                                   parseFloat(pmAccountData.virtualMaxWithdrawAmount) || 0;

      logger.info(
        {
          totalEquityUSD,
          availableBalanceUSD,
          accountEquity: pmAccountData.accountEquity,
          totalAvailableBalance: pmAccountData.totalAvailableBalance,
          virtualMaxWithdrawAmount: pmAccountData.virtualMaxWithdrawAmount,
        },
        'Binance Portfolio Margin Account Info SUCCESS'
      );

      return {
        exchange: 'binance',
        balances: [],
        totalEquityUSD,
        availableBalanceUSD,
        timestamp: new Date(),
      };
    } catch (pmError) {
      // Portfolio Margin Account Info API 失敗，記錄錯誤後 fallback 到 Spot API
      logger.warn(
        {
          error: pmError instanceof Error ? pmError.message : String(pmError),
          apiKey: this.apiKey.slice(0, 8) + '...',
        },
        'Binance Portfolio Margin Account Info API FAILED - falling back to Spot API'
      );
    }

    // Fallback 2: 使用 Spot API（只需要「啟用讀取」權限）
    logger.info('Attempting Binance Spot API /api/v3/account');
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

    // 計算可用餘額（USDT 的 free）
    const usdtBalance = balances.find(b => b.asset === 'USDT');
    const availableBalanceUSD = usdtBalance?.free || 0;

    logger.info(
      { totalEquityUSD, availableBalanceUSD },
      'Binance Spot API SUCCESS - using USDT free as available (WARNING: This is SPOT balance, not FUTURES!)'
    );

    return {
      exchange: 'binance',
      balances,
      totalEquityUSD,
      availableBalanceUSD,
      timestamp: new Date(),
    };
  }

  async getPositions(): Promise<PositionInfo> {
    logger.info(
      { apiKey: this.apiKey.slice(0, 8) + '...' },
      'BinanceUserConnector.getPositions() called'
    );

    // 嘗試使用 Futures API
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
    } catch (futuresError) {
      // Futures API 也失敗，記錄錯誤並返回空持倉
      logger.debug(
        { error: futuresError instanceof Error ? futuresError.message : String(futuresError) },
        'Binance Futures positions API also failed, returning empty positions'
      );
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private exchange: any = null;

  constructor(
    private readonly apiKey: string,
    private readonly apiSecret: string,
    private readonly passphrase: string,
    readonly isTestnet: boolean = false
  ) {}

  async connect(): Promise<void> {

    this.exchange = createCcxtExchange('okx', {
      apiKey: this.apiKey,
      secret: this.apiSecret,
      password: this.passphrase,
      sandbox: this.isTestnet,
      timeout: 60000, // 60 秒超時（UserConnector 需要較長時間）
    });
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.exchange) {
      // 關閉 CCXT 內部連線池
      if ('close' in this.exchange && typeof this.exchange.close === 'function') {
        try {
          await this.exchange.close();
        } catch (error) {
          logger.warn(
            { error: error instanceof Error ? error.message : String(error) },
            'Error closing OKX CCXT exchange (non-blocking)'
          );
        }
      }
      this.exchange = null;
    }
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
    // 可用餘額：使用 free.USDT
    const availableUSD = balance.free?.USDT || balance.free?.USD || 0;

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
      availableBalanceUSD: availableUSD as number,
      timestamp: new Date(),
    };
  }

  async getPositions(): Promise<PositionInfo> {
    if (!this.exchange) throw new Error('Not connected');

    // 嘗試注入快取的 markets，避免 fetchPositions 內部調用 loadMarkets
    const cacheHit = injectCachedMarkets(this.exchange, 'okx');
    if (cacheHit) {
      logger.debug('OKX markets injected from cache');
    }

    const positions = await this.exchange.fetchPositions();

    // 如果沒有命中快取，儲存 markets 供下次使用
    if (!cacheHit) {
      cacheMarketsFromExchange(this.exchange, 'okx');
    }

    const filteredPositions = positions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((p: any) => parseFloat(p.contracts?.toString() || '0') > 0)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((p: any) => ({
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private exchange: any = null;

  constructor(
    private readonly apiKey: string,
    private readonly apiSecret: string,
    readonly isTestnet: boolean = false
  ) {}

  async connect(): Promise<void> {

    this.exchange = createCcxtExchange('mexc', {
      apiKey: this.apiKey,
      secret: this.apiSecret,
      enableRateLimit: true,
      timeout: 60000, // 60 秒超時（UserConnector 需要較長時間）
    });
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.exchange) {
      // 關閉 CCXT 內部連線池
      if ('close' in this.exchange && typeof this.exchange.close === 'function') {
        try {
          await this.exchange.close();
        } catch (error) {
          logger.warn(
            { error: error instanceof Error ? error.message : String(error) },
            'Error closing MEXC CCXT exchange (non-blocking)'
          );
        }
      }
      this.exchange = null;
    }
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
    // 可用餘額：使用 free.USDT
    const availableUSD = balance.free?.USDT || balance.free?.USD || 0;

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
      availableBalanceUSD: availableUSD as number,
      timestamp: new Date(),
    };
  }

  async getPositions(): Promise<PositionInfo> {
    if (!this.exchange) throw new Error('Not connected');

    // 嘗試注入快取的 markets，避免 fetchPositions 內部調用 loadMarkets
    const cacheHit = injectCachedMarkets(this.exchange, 'mexc');
    if (cacheHit) {
      logger.debug('MEXC markets injected from cache');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const positions: any[] = await this.exchange.fetchPositions();

    // 如果沒有命中快取，儲存 markets 供下次使用
    if (!cacheHit) {
      cacheMarketsFromExchange(this.exchange, 'mexc');
    }

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
 * Feature 056: 修復餘額顯示 - totalEquityUSD 納入持倉價值
 */
class GateioUserConnector implements IExchangeConnector {
  readonly name: ExchangeName = 'gateio';
  private connected: boolean = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private exchange: any = null;

  constructor(
    private readonly apiKey: string,
    private readonly apiSecret: string,
    readonly isTestnet: boolean = false
  ) {
    // 注意：ProxyAgent 改用共享單例 (getSharedProxyAgent())，不在此創建
  }

  async connect(): Promise<void> {

    this.exchange = createCcxtExchange('gateio', {
      apiKey: this.apiKey,
      secret: this.apiSecret,
      enableRateLimit: true,
      timeout: 60000, // 60 秒超時（UserConnector 需要較長時間）
    });
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.exchange) {
      // 關閉 CCXT 內部連線池
      if ('close' in this.exchange && typeof this.exchange.close === 'function') {
        try {
          await this.exchange.close();
        } catch (error) {
          logger.warn(
            { error: error instanceof Error ? error.message : String(error) },
            'Error closing Gate.io CCXT exchange (non-blocking)'
          );
        }
      }
      this.exchange = null;
    }
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
    const availableUSD = (balance.free?.USDT || balance.free?.USD || 0) as number;

    // Gate.io CCXT swap 帳戶的 total 可能返回錯誤值（接近 0）
    // 改用 fetchPositions 獲取未實現盈虧，然後計算總權益
    let unrealizedPnl = 0;
    try {
      const positions = await this.exchange.fetchPositions();
      unrealizedPnl = positions
        .filter((p: { contracts?: number }) => (p.contracts || 0) > 0)
        .reduce((sum: number, p: { unrealizedPnl?: number }) => sum + (p.unrealizedPnl || 0), 0);
    } catch {
      // 忽略錯誤，使用 0
    }

    // 總權益 = 可用餘額 + 未實現盈虧
    const totalEquityUSD = availableUSD + unrealizedPnl;

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
      totalEquityUSD,
      availableBalanceUSD: availableUSD as number,
      timestamp: new Date(),
    };
  }

  /**
   * 查詢 Gate.io 統一帳戶餘額 (跨幣種保證金模式)
   * Feature 059: 修正重複計算問題，unified_account_total_equity 已包含持倉價值
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

    // 準備 fetch 選項，使用共享的 ProxyAgent
    const fetchOptions: RequestInit & { dispatcher?: ProxyAgent } = {
      method,
      headers: {
        KEY: this.apiKey,
        Timestamp: timestamp,
        SIGN: signature,
        'Content-Type': 'application/json',
      },
    };

    const proxyAgent = getSharedProxyAgent();
    if (proxyAgent) {
      fetchOptions.dispatcher = proxyAgent;
    }

    const response = await fetch(`https://api.gateio.ws${url}`, fetchOptions);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // 檢查是否有錯誤
    if (data.label || data.message) {
      return null;
    }

    // 解析統一帳戶餘額
    // Gate.io 統一帳戶 API：
    // - unified_account_total: 統一帳戶總資產（包含隔離保證金）
    // - unified_account_total_equity: 統一帳戶總權益（不含隔離保證金佔用）
    // - total_available_margin: 可用保證金
    // 使用 unified_account_total 作為總資產，因為它包含被持倉佔用的保證金
    const totalEquityUSD = parseFloat(data.unified_account_total || data.unified_account_total_equity || '0');
    const availableBalanceUSD = parseFloat(data.total_available_margin || data.unified_account_total_equity || '0');
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
      availableBalanceUSD,
      timestamp: new Date(),
    };
  }

  async getPositions(): Promise<PositionInfo> {
    if (!this.exchange) throw new Error('Not connected');

    // 嘗試注入快取的 markets，避免 fetchPositions 內部調用 loadMarkets
    const cacheHit = injectCachedMarkets(this.exchange, 'gateio');
    if (cacheHit) {
      logger.debug('Gate.io markets injected from cache');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const positions: any[] = await this.exchange.fetchPositions();

    // 如果沒有命中快取，儲存 markets 供下次使用
    if (!cacheHit) {
      cacheMarketsFromExchange(this.exchange, 'gateio');
    }

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

/**
 * 用戶特定的 BingX 連接器
 * Feature 043: BingX 交易所整合
 */
class BingxUserConnector implements IExchangeConnector {
  readonly name: ExchangeName = 'bingx';
  private connected: boolean = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private exchange: any = null;

  constructor(
    private readonly apiKey: string,
    private readonly apiSecret: string,
    readonly isTestnet: boolean = false
  ) {}

  async connect(): Promise<void> {

    this.exchange = createCcxtExchange('bingx', {
      apiKey: this.apiKey,
      secret: this.apiSecret,
      enableRateLimit: true,
      timeout: 60000, // 60 秒超時（UserConnector 需要較長時間）
      options: {
        defaultType: 'swap',
      },
    });
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.exchange) {
      // 關閉 CCXT 內部連線池
      if ('close' in this.exchange && typeof this.exchange.close === 'function') {
        try {
          await this.exchange.close();
        } catch (error) {
          logger.warn(
            { error: error instanceof Error ? error.message : String(error) },
            'Error closing BingX CCXT exchange (non-blocking)'
          );
        }
      }
      this.exchange = null;
    }
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
    // 可用餘額：使用 free.USDT
    const availableUSD = balance.free?.USDT || balance.free?.USD || 0;

    const balances = Object.entries(balance.total || {})
      .filter(([_, value]) => (value as number) > 0)
      .map(([asset, total]) => ({
        asset,
        free: (balance.free?.[asset] as number) || 0,
        locked: (total as number) - ((balance.free?.[asset] as number) || 0),
        total: total as number,
      }));

    return {
      exchange: 'bingx',
      balances,
      totalEquityUSD: totalUSD as number,
      availableBalanceUSD: availableUSD as number,
      timestamp: new Date(),
    };
  }

  async getPositions(): Promise<PositionInfo> {
    if (!this.exchange) throw new Error('Not connected');

    // 嘗試注入快取的 markets，避免 fetchPositions 內部調用 loadMarkets
    const cacheHit = injectCachedMarkets(this.exchange, 'bingx');
    if (cacheHit) {
      logger.debug('BingX markets injected from cache');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const positions: any[] = await this.exchange.fetchPositions();

    // 如果沒有命中快取，儲存 markets 供下次使用
    if (!cacheHit) {
      cacheMarketsFromExchange(this.exchange, 'bingx');
    }

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
      exchange: 'bingx',
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
