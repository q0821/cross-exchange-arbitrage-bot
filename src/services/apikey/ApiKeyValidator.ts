/**
 * API Key Validator Service
 *
 * Validates API keys with exchange APIs (FR-010, FR-012)
 * Checks connectivity and permissions before storing
 */

import { logger } from '../../lib/logger.js';
import ccxt from 'ccxt';

export interface ValidationResult {
  isValid: boolean;
  hasReadPermission: boolean;
  hasTradePermission: boolean;
  error?: string;
  details?: any;
}

export class ApiKeyValidator {
  /**
   * Validate Binance API Key (FR-010, FR-012)
   *
   * Checks:
   * 1. API connectivity
   * 2. Read permission (account info)
   * 3. Trade permission (futures trading)
   */
  async validateBinanceKey(
    apiKey: string,
    apiSecret: string,
    environment: 'MAINNET' | 'TESTNET' = 'MAINNET',
  ): Promise<ValidationResult> {
    try {
      const config: any = {
        apiKey,
        secret: apiSecret,
        enableRateLimit: true,
        options: {
          defaultType: 'future', // 永續合約
        },
      };

      // Binance Testnet configuration
      if (environment === 'TESTNET') {
        config.options.testnet = true;
        config.hostname = 'testnet.binancefuture.com';
      }

      const exchange = new (ccxt as any).binance(config);

      // Test 1: Fetch account info (read permission)
      const account = await exchange.fapiPrivateV2GetAccount();

      if (!account) {
        return {
          isValid: false,
          hasReadPermission: false,
          hasTradePermission: false,
          error: 'Failed to fetch account info',
        };
      }

      // Test 2: Check if API key has trade permission
      // Binance returns permission info in account response
      const permissions = account.permissions || [];
      const hasTradePermission = permissions.includes('TRADE') || permissions.includes('TRADING');

      logger.info(
        {
          exchange: 'binance',
          environment,
          permissions,
          hasTradePermission,
        },
        'Binance API key validated',
      );

      return {
        isValid: true,
        hasReadPermission: true,
        hasTradePermission,
        details: {
          totalWalletBalance: account.totalWalletBalance,
          availableBalance: account.availableBalance,
          permissions,
        },
      };
    } catch (error: any) {
      logger.error(
        { error: error.message, exchange: 'binance', environment },
        'Binance API key validation failed',
      );

      return {
        isValid: false,
        hasReadPermission: false,
        hasTradePermission: false,
        error: this.parseExchangeError(error),
      };
    }
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
    try {
      const config: any = {
        apiKey,
        secret: apiSecret,
        password: passphrase,
        enableRateLimit: true,
        options: {
          defaultType: 'swap', // 永續合約
        },
      };

      // OKX Sandbox configuration
      if (environment === 'TESTNET') {
        config.options.sandboxMode = true;
      }

      const exchange = new (ccxt as any).okx(config);

      // Test 1: Fetch account balance (read permission)
      const balance = await exchange.fetchBalance();

      if (!balance) {
        return {
          isValid: false,
          hasReadPermission: false,
          hasTradePermission: false,
          error: 'Failed to fetch account balance',
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
          'OKX API key validated',
        );
      } catch (permError) {
        logger.warn(
          { error: permError },
          'OKX API key lacks trade permission',
        );
      }

      return {
        isValid: true,
        hasReadPermission: true,
        hasTradePermission,
        details: {
          totalBalance: balance.total?.USDT || 0,
          freeBalance: balance.free?.USDT || 0,
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
      };
    }
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
