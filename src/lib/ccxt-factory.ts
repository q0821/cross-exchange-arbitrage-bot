/**
 * CCXT Exchange Factory
 *
 * 統一管理 CCXT 實例創建，自動包含 proxy 配置
 * 避免每次創建實例都要手動設定 proxy
 */

import ccxt from 'ccxt';
import { getCcxtHttpsProxyConfig, getProxyUrl } from './env';
import { logger } from './logger';

export type SupportedExchange = 'binance' | 'okx' | 'gateio' | 'mexc' | 'bingx';

export interface ExchangeConfig {
  apiKey?: string;
  secret?: string;
  password?: string; // OKX passphrase
  sandbox?: boolean;
  enableRateLimit?: boolean;
  timeout?: number; // 連線超時（毫秒），預設 30000
  options?: Record<string, unknown>;
}

/**
 * 創建 CCXT Exchange 實例
 */
export function createCcxtExchange(
  exchangeId: SupportedExchange,
  config: ExchangeConfig = {}
): ccxt.Exchange {
  const proxyConfig = getCcxtHttpsProxyConfig();
  const proxyUrl = getProxyUrl();

  // Binance 統一帳戶（Portfolio Margin）支援
  const binancePortfolioMargin = process.env.BINANCE_PORTFOLIO_MARGIN === 'true';

  const fullConfig: any = {
    enableRateLimit: config.enableRateLimit ?? true,
    timeout: config.timeout ?? 30000, // 預設 30 秒超時（透過代理需要較長時間）
    ...proxyConfig,
    ...config,
    options: {
      defaultType: 'swap', // 永續合約
      // 啟用 Binance 統一帳戶模式
      ...(exchangeId === 'binance' && binancePortfolioMargin ? { portfolioMargin: true } : {}),
      ...config.options,
    },
  };

  // 移除 undefined 值
  if (!fullConfig.apiKey) delete fullConfig.apiKey;
  if (!fullConfig.secret) delete fullConfig.secret;
  if (!fullConfig.password) delete fullConfig.password;

  const ExchangeClass = (ccxt as any)[exchangeId];
  if (!ExchangeClass) {
    throw new Error(`Unsupported exchange: ${exchangeId}`);
  }

  const exchange = new ExchangeClass(fullConfig);

  if (proxyUrl) {
    logger.debug({ exchange: exchangeId, proxy: proxyUrl }, 'CCXT exchange created with proxy');
  }

  return exchange;
}

/**
 * 創建帶認證的 CCXT Exchange 實例
 */
export function createAuthenticatedExchange(
  exchangeId: SupportedExchange,
  credentials: {
    apiKey: string;
    apiSecret: string;
    passphrase?: string; // OKX only
  },
  options: {
    sandbox?: boolean;
    enableRateLimit?: boolean;
  } = {}
): ccxt.Exchange {
  return createCcxtExchange(exchangeId, {
    apiKey: credentials.apiKey,
    secret: credentials.apiSecret,
    password: credentials.passphrase,
    sandbox: options.sandbox,
    enableRateLimit: options.enableRateLimit,
  });
}

/**
 * 創建公開 API 的 CCXT Exchange 實例（不需要認證）
 */
export function createPublicExchange(
  exchangeId: SupportedExchange,
  options: {
    sandbox?: boolean;
    enableRateLimit?: boolean;
  } = {}
): ccxt.Exchange {
  return createCcxtExchange(exchangeId, {
    sandbox: options.sandbox,
    enableRateLimit: options.enableRateLimit,
  });
}
