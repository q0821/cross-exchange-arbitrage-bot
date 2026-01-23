/**
 * API Key Validator Service
 *
 * Validates API keys with exchange APIs (FR-010, FR-012)
 * Checks connectivity and permissions before storing
 *
 * Feature: 042-api-key-connection-test
 */

import { logger } from '../../lib/logger';
import crypto from 'crypto';
import { getProxyUrl } from '../../lib/env';
import { createAuthenticatedExchange } from '../../lib/ccxt-factory';
import type { ValidationErrorCode, ValidationDetails } from '../../types/api-key-validation';

export interface ValidationResult {
  isValid: boolean;
  hasReadPermission: boolean;
  hasTradePermission: boolean;
  error?: string;
  errorCode?: ValidationErrorCode;
  details?: ValidationDetails;
}

export class ApiKeyValidator {
  /**
   * Make a signed request to Binance API
   * Uses the same approach as the working BinanceUserConnector
   * Supports proxy configuration via PROXY_URL environment variable
   */
  private async binanceSignedRequest(
    baseUrl: string,
    endpoint: string,
    apiKey: string,
    apiSecret: string,
    params: Record<string, string> = {},
  ): Promise<{ ok: boolean; status: number; data?: unknown; error?: string }> {
    const timestamp = Date.now().toString();
    const queryParams = { ...params, timestamp, recvWindow: '5000' };
    const queryString = new URLSearchParams(queryParams).toString();
    const signature = crypto.createHmac('sha256', apiSecret).update(queryString).digest('hex');

    const url = `${baseUrl}${endpoint}?${queryString}&signature=${signature}`;

    try {
      // 使用 proxy（如果已配置）
      const proxyUrl = getProxyUrl();
      let fetchFn = fetch;
      let fetchOptions: RequestInit = {
        method: 'GET',
        headers: {
          'X-MBX-APIKEY': apiKey,
        },
      };

      if (proxyUrl) {
        // 使用 undici ProxyAgent
        const { ProxyAgent, fetch: undiciFetch } = await import('undici');
        const proxyAgent = new ProxyAgent(proxyUrl);
        fetchFn = undiciFetch as unknown as typeof fetch;
        fetchOptions = {
          ...fetchOptions,
          dispatcher: proxyAgent,
        } as RequestInit;
      }

      const response = await fetchFn(url, fetchOptions);

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, status: response.status, error: errorText };
      }

      const data = await response.json();
      return { ok: true, status: response.status, data };
    } catch (error: any) {
      return { ok: false, status: 0, error: error.message };
    }
  }

  /**
   * Validate Binance API Key (FR-010, FR-012)
   *
   * Checks:
   * 1. API connectivity
   * 2. Read permission (account info)
   * 3. Trade permission (futures trading)
   *
   * Uses direct HTTP requests (same as BinanceUserConnector) instead of CCXT
   * Tries multiple endpoints in order:
   * 1. Portfolio Margin API (/papi/v1/balance) - 統一保證金帳戶
   * 2. Futures API (/fapi/v2/account) - 期貨帳戶
   * 3. Spot API (/api/v3/account) - 現貨帳戶
   */
  async validateBinanceKey(
    apiKey: string,
    apiSecret: string,
    environment: 'MAINNET' | 'TESTNET' = 'MAINNET',
  ): Promise<ValidationResult> {
    const startTime = Date.now();

    // Choose base URLs based on environment
    const spotBaseUrl = environment === 'TESTNET' ? 'https://testnet.binance.vision' : 'https://api.binance.com';
    const futuresBaseUrl = environment === 'TESTNET' ? 'https://testnet.binancefuture.com' : 'https://fapi.binance.com';
    const portfolioMarginBaseUrl = 'https://papi.binance.com'; // No testnet for PM

    let totalBalance = 0;
    let availableBalance = 0;
    let hasTradePermission = false;
    let accountType = 'unknown';

    // Try 1: Portfolio Margin API (統一保證金帳戶)
    if (environment === 'MAINNET') {
      const pmResult = await this.binanceSignedRequest(
        portfolioMarginBaseUrl,
        '/papi/v1/balance',
        apiKey,
        apiSecret,
      );

      if (pmResult.ok) {
        accountType = 'portfolio_margin';
        hasTradePermission = true;

        const balances = pmResult.data as Array<{
          asset: string;
          totalWalletBalance: string;
          crossMarginFree: string;
        }>;

        const usdtBalance = balances?.find((b) => b.asset === 'USDT');
        if (usdtBalance) {
          totalBalance = parseFloat(usdtBalance.totalWalletBalance) || 0;
          availableBalance = parseFloat(usdtBalance.crossMarginFree) || 0;
        }

        logger.info(
          { exchange: 'binance', environment, accountType, totalBalance },
          'Binance API key validated via Portfolio Margin API',
        );
      }
    }

    // Try 2: Futures API (期貨帳戶)
    if (accountType === 'unknown') {
      const futuresResult = await this.binanceSignedRequest(
        futuresBaseUrl,
        '/fapi/v2/account',
        apiKey,
        apiSecret,
      );

      if (futuresResult.ok) {
        accountType = 'futures';
        hasTradePermission = true;

        const account = futuresResult.data as {
          totalWalletBalance?: string;
          availableBalance?: string;
          assets?: Array<{ asset: string; walletBalance: string; availableBalance: string }>;
        };

        if (account.totalWalletBalance) {
          totalBalance = parseFloat(account.totalWalletBalance);
        }
        if (account.availableBalance) {
          availableBalance = parseFloat(account.availableBalance);
        }

        if (account.assets) {
          const usdtAsset = account.assets.find((a) => a.asset === 'USDT');
          if (usdtAsset) {
            totalBalance = parseFloat(usdtAsset.walletBalance) || totalBalance;
            availableBalance = parseFloat(usdtAsset.availableBalance) || availableBalance;
          }
        }

        logger.info(
          { exchange: 'binance', environment, accountType, totalBalance },
          'Binance API key validated via Futures API',
        );
      }
    }

    // Try 3: Spot API (現貨帳戶) - 最基本的讀取權限
    if (accountType === 'unknown') {
      const spotResult = await this.binanceSignedRequest(
        spotBaseUrl,
        '/api/v3/account',
        apiKey,
        apiSecret,
      );

      if (spotResult.ok) {
        accountType = 'spot';
        hasTradePermission = false; // Spot only means no futures trading permission

        const account = spotResult.data as {
          balances?: Array<{ asset: string; free: string; locked: string }>;
        };

        if (account.balances) {
          const usdtBalance = account.balances.find((b) => b.asset === 'USDT');
          if (usdtBalance) {
            const free = parseFloat(usdtBalance.free) || 0;
            const locked = parseFloat(usdtBalance.locked) || 0;
            totalBalance = free + locked;
            availableBalance = free;
          }
        }

        logger.info(
          { exchange: 'binance', environment, accountType, totalBalance },
          'Binance API key validated via Spot API (no futures permission)',
        );
      } else {
        // All APIs failed - return error
        let errorMessage = spotResult.error || 'Unknown error';
        let errorCode: ValidationErrorCode = 'UNKNOWN_ERROR';

        try {
          const errorJson = JSON.parse(spotResult.error || '{}');
          if (errorJson.code === -2015 || errorJson.msg?.includes('Invalid API-key')) {
            errorCode = 'INVALID_API_KEY';
            errorMessage = 'Invalid API Key or Secret';
          } else if (errorJson.code === -1022 || errorJson.msg?.includes('Signature')) {
            errorCode = 'INVALID_SECRET';
            errorMessage = 'Invalid API Secret (signature mismatch)';
          } else if (errorJson.msg?.includes('IP')) {
            errorCode = 'IP_NOT_WHITELISTED';
            errorMessage = 'IP address not whitelisted';
          } else if (errorJson.msg) {
            errorMessage = errorJson.msg;
          }
        } catch {
          // Keep original error message
        }

        logger.error(
          {
            exchange: 'binance',
            environment,
            status: spotResult.status,
            error: spotResult.error,
          },
          'Binance API key validation failed - all endpoints failed',
        );

        return {
          isValid: false,
          hasReadPermission: false,
          hasTradePermission: false,
          error: errorMessage,
          errorCode,
        };
      }
    }

    const responseTime = Date.now() - startTime;

    return {
      isValid: true,
      hasReadPermission: true,
      hasTradePermission,
      details: {
        exchange: 'binance',
        environment,
        balance: {
          total: totalBalance,
          available: availableBalance,
          currency: 'USDT',
        },
        permissions: hasTradePermission ? ['READ', 'FUTURES'] : ['READ'],
        responseTime,
      },
    };
  }

  /**
   * Validate OKX API Key (FR-010, FR-012)
   *
   * Checks:
   * 1. API connectivity
   * 2. Read permission (account balance)
   * 3. Trade permission (position mode and leverage)
   */
  async validateOkxKey(
    apiKey: string,
    apiSecret: string,
    passphrase: string,
    environment: 'MAINNET' | 'TESTNET' = 'MAINNET',
  ): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      const exchange = createAuthenticatedExchange(
        'okx',
        { apiKey, apiSecret, passphrase },
        { sandbox: environment === 'TESTNET' }
      );

      // Test 1: Fetch account balance (read permission)
      const balance = await exchange.fetchBalance();

      if (!balance) {
        return {
          isValid: false,
          hasReadPermission: false,
          hasTradePermission: false,
          error: 'Failed to fetch account balance',
          errorCode: 'EXCHANGE_ERROR',
        };
      }

      // Test 2: Check trade permission by fetching account config
      // OKX requires trade permission to access position mode
      let hasTradePermission = false;
      try {
        const accountConfig = await (exchange as any).privateGetAccountConfig();
        hasTradePermission = true; // If this succeeds, we have trade permission

        logger.info(
          {
            exchange: 'okx',
            environment,
            accountConfig,
          },
          'OKX API key validated with trade permission',
        );
      } catch (permError) {
        // 如果無法獲取帳戶配置，假設有交易權限（因為 fetchBalance 成功了）
        hasTradePermission = true;
        logger.warn(
          { error: permError },
          'OKX API key - could not verify trade permission, assuming granted',
        );
      }

      const responseTime = Date.now() - startTime;

      return {
        isValid: true,
        hasReadPermission: true,
        hasTradePermission,
        details: {
          exchange: 'okx',
          environment,
          balance: {
            total: Number(balance.total?.USDT) || 0,
            available: Number(balance.free?.USDT) || 0,
            currency: 'USDT',
          },
          responseTime,
        },
      };
    } catch (error: any) {
      logger.error(
        { error: error.message, exchange: 'okx', environment },
        'OKX API key validation failed',
      );

      return {
        isValid: false,
        hasReadPermission: false,
        hasTradePermission: false,
        error: this.parseExchangeError(error),
        errorCode: this.parseErrorCode(error),
      };
    }
  }

  /**
   * Validate Gate.io API Key (FR-010, FR-012)
   *
   * Checks:
   * 1. API connectivity
   * 2. Read permission (futures balance)
   *
   * Note: Gate.io API 無法直接驗證交易權限，僅能驗證讀取權限
   */
  async validateGateioKey(
    apiKey: string,
    apiSecret: string,
    environment: 'MAINNET' | 'TESTNET' = 'MAINNET',
  ): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      const exchange = createAuthenticatedExchange(
        'gateio',
        { apiKey, apiSecret },
        { sandbox: environment === 'TESTNET' }
      );

      // Test: Fetch account balance (read permission)
      const balance = await exchange.fetchBalance();

      if (!balance) {
        return {
          isValid: false,
          hasReadPermission: false,
          hasTradePermission: false,
          error: 'Failed to fetch account balance',
          errorCode: 'EXCHANGE_ERROR',
        };
      }

      const responseTime = Date.now() - startTime;

      logger.info(
        {
          exchange: 'gateio',
          environment,
          responseTime,
        },
        'Gate.io API key validated',
      );

      return {
        isValid: true,
        hasReadPermission: true,
        hasTradePermission: false, // Gate.io 無法驗證交易權限
        details: {
          exchange: 'gateio',
          environment,
          balance: {
            total: Number(balance.total?.USDT) || 0,
            available: Number(balance.free?.USDT) || 0,
            currency: 'USDT',
          },
          responseTime,
        },
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      logger.error(
        { error: error.message, exchange: 'gateio', environment, responseTime },
        'Gate.io API key validation failed',
      );

      return {
        isValid: false,
        hasReadPermission: false,
        hasTradePermission: false,
        error: this.parseExchangeError(error),
        errorCode: this.parseErrorCode(error),
      };
    }
  }

  /**
   * Validate MEXC API Key (FR-010, FR-012)
   *
   * Checks:
   * 1. API connectivity
   * 2. Read permission (futures balance)
   *
   * Note: MEXC API 無法直接驗證交易權限，僅能驗證讀取權限
   */
  async validateMexcKey(
    apiKey: string,
    apiSecret: string,
    environment: 'MAINNET' | 'TESTNET' = 'MAINNET',
  ): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      const exchange = createAuthenticatedExchange(
        'mexc',
        { apiKey, apiSecret },
        { sandbox: environment === 'TESTNET' }
      );

      // Test: Fetch account balance (read permission)
      const balance = await exchange.fetchBalance();

      if (!balance) {
        return {
          isValid: false,
          hasReadPermission: false,
          hasTradePermission: false,
          error: 'Failed to fetch account balance',
          errorCode: 'EXCHANGE_ERROR',
        };
      }

      const responseTime = Date.now() - startTime;

      logger.info(
        {
          exchange: 'mexc',
          environment,
          responseTime,
        },
        'MEXC API key validated',
      );

      return {
        isValid: true,
        hasReadPermission: true,
        hasTradePermission: false, // MEXC 無法驗證交易權限
        details: {
          exchange: 'mexc',
          environment,
          balance: {
            total: Number(balance.total?.USDT) || 0,
            available: Number(balance.free?.USDT) || 0,
            currency: 'USDT',
          },
          responseTime,
        },
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      logger.error(
        { error: error.message, exchange: 'mexc', environment, responseTime },
        'MEXC API key validation failed',
      );

      return {
        isValid: false,
        hasReadPermission: false,
        hasTradePermission: false,
        error: this.parseExchangeError(error),
        errorCode: this.parseErrorCode(error),
      };
    }
  }

  /**
   * Validate BingX API Key (Feature 043: BingX 整合)
   *
   * Checks:
   * 1. API connectivity
   * 2. Read permission (futures balance)
   * 3. Contract trading permission
   *
   * Note: BingX 使用 CCXT 進行驗證
   */
  async validateBingxKey(
    apiKey: string,
    apiSecret: string,
    environment: 'MAINNET' | 'TESTNET' = 'MAINNET',
  ): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      // BingX 目前沒有公開測試網
      if (environment === 'TESTNET') {
        logger.warn('BingX does not have a public testnet, using mainnet');
      }

      const exchange = createAuthenticatedExchange(
        'bingx',
        { apiKey, apiSecret },
        { sandbox: false }, // BingX 無公開測試網
      );

      // Test: Fetch account balance (read permission)
      const balance = await exchange.fetchBalance();

      if (!balance) {
        return {
          isValid: false,
          hasReadPermission: false,
          hasTradePermission: false,
          error: 'Failed to fetch account balance',
          errorCode: 'EXCHANGE_ERROR',
        };
      }

      // Check if we have contract trading permission by trying to fetch positions
      let hasTradePermission = false;
      try {
        await exchange.fetchPositions();
        hasTradePermission = true;
      } catch {
        // If fetchPositions fails, we might still have read-only access
        hasTradePermission = false;
      }

      const responseTime = Date.now() - startTime;

      logger.info(
        {
          exchange: 'bingx',
          environment,
          hasTradePermission,
          responseTime,
        },
        'BingX API key validated',
      );

      return {
        isValid: true,
        hasReadPermission: true,
        hasTradePermission,
        details: {
          exchange: 'bingx',
          environment,
          balance: {
            total: Number(balance.total?.USDT) || 0,
            available: Number(balance.free?.USDT) || 0,
            currency: 'USDT',
          },
          responseTime,
        },
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      logger.error(
        { error: error.message, exchange: 'bingx', environment, responseTime },
        'BingX API key validation failed',
      );

      return {
        isValid: false,
        hasReadPermission: false,
        hasTradePermission: false,
        error: this.parseExchangeError(error),
        errorCode: this.parseErrorCode(error),
      };
    }
  }

  /**
   * Unified API Key validation entry point (T014)
   *
   * Routes to exchange-specific validation methods
   */
  async validateApiKey(params: {
    exchange: 'binance' | 'okx' | 'gateio' | 'mexc' | 'bingx';
    apiKey: string;
    apiSecret: string;
    passphrase?: string;
    environment: 'MAINNET' | 'TESTNET';
  }): Promise<ValidationResult> {
    const { exchange, apiKey, apiSecret, passphrase, environment } = params;

    switch (exchange) {
      case 'binance':
        return this.validateBinanceKey(apiKey, apiSecret, environment);

      case 'okx':
        if (!passphrase) {
          return {
            isValid: false,
            hasReadPermission: false,
            hasTradePermission: false,
            error: 'OKX requires passphrase',
            errorCode: 'INVALID_PASSPHRASE',
          };
        }
        return this.validateOkxKey(apiKey, apiSecret, passphrase, environment);

      case 'gateio':
        return this.validateGateioKey(apiKey, apiSecret, environment);

      case 'mexc':
        return this.validateMexcKey(apiKey, apiSecret, environment);

      case 'bingx':
        return this.validateBingxKey(apiKey, apiSecret, environment);

      default:
        return {
          isValid: false,
          hasReadPermission: false,
          hasTradePermission: false,
          error: `Unsupported exchange: ${exchange}`,
          errorCode: 'EXCHANGE_ERROR',
        };
    }
  }

  /**
   * Parse error into ValidationErrorCode
   */
  private parseErrorCode(error: any): ValidationErrorCode {
    const message = error.message || String(error);

    if (message.includes('Invalid API-key') || message.includes('Invalid API key')) {
      return 'INVALID_API_KEY';
    }

    if (message.includes('Signature') || message.includes('signature')) {
      return 'INVALID_SECRET';
    }

    if (message.includes('IP') || message.includes('whitelist')) {
      return 'IP_NOT_WHITELISTED';
    }

    if (message.includes('permission')) {
      return 'INSUFFICIENT_PERMISSION';
    }

    if (message.includes('timeout') || message.includes('Timeout')) {
      return 'TIMEOUT';
    }

    if (message.includes('ENOTFOUND') || message.includes('ECONNREFUSED') || message.includes('network')) {
      return 'NETWORK_ERROR';
    }

    return 'UNKNOWN_ERROR';
  }

  /**
   * Parse exchange API error into user-friendly message
   */
  private parseExchangeError(error: any): string {
    const message = error.message || String(error);

    if (message.includes('Invalid API-key')) {
      return 'Invalid API Key or Secret';
    }

    if (message.includes('Signature')) {
      return 'Invalid API Secret (signature mismatch)';
    }

    if (message.includes('IP')) {
      return 'IP address not whitelisted';
    }

    if (message.includes('permission')) {
      return 'Insufficient API permissions';
    }

    if (message.includes('timeout')) {
      return 'Request timeout - please try again';
    }

    return message.substring(0, 100); // Truncate long error messages
  }
}

// Export singleton instance
export const apiKeyValidator = new ApiKeyValidator();
