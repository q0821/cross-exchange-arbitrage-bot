/**
 * CCXT Exchange Factory
 *
 * 提供類型安全的 CCXT 交易所實例創建
 * 解決 CCXT 類型定義不完整的問題
 */

import ccxt, { Exchange } from 'ccxt';

/**
 * 支援的交易所 ID
 */
export type SupportedExchangeId = 'binance' | 'okx' | 'mexc' | 'gateio' | 'bingx';

/**
 * 交易所配置選項
 */
export interface ExchangeOptions {
  apiKey?: string;
  secret?: string;
  password?: string;  // OKX passphrase
  enableRateLimit?: boolean;
  timeout?: number;
  options?: {
    defaultType?: 'spot' | 'swap' | 'future' | 'margin';
    sandboxMode?: boolean;
    [key: string]: unknown;
  };
}

// 支援的交易所列表
const SUPPORTED_EXCHANGES: SupportedExchangeId[] = ['binance', 'okx', 'mexc', 'gateio', 'bingx'];

/**
 * 創建 CCXT 交易所實例
 *
 * @param exchangeId 交易所 ID
 * @param options 配置選項
 * @returns CCXT Exchange 實例
 *
 * @example
 * ```typescript
 * const exchange = createCcxtExchange('mexc', {
 *   apiKey: 'xxx',
 *   secret: 'xxx',
 *   options: { defaultType: 'swap' }
 * });
 * ```
 */
export function createCcxtExchange(
  exchangeId: SupportedExchangeId,
  options: ExchangeOptions = {}
): Exchange {
  // 驗證交易所 ID
  if (!SUPPORTED_EXCHANGES.includes(exchangeId)) {
    throw new Error(`Unsupported exchange: ${exchangeId}`);
  }

  // 使用 CCXT 的動態創建方式（需要雙重斷言因為 CCXT 類型定義不完整）
  const ccxtModule = ccxt as unknown as Record<string, new (config: ExchangeOptions) => Exchange>;
  const ExchangeClass = ccxtModule[exchangeId];

  if (!ExchangeClass) {
    throw new Error(`Exchange class not found: ${exchangeId}`);
  }

  return new ExchangeClass({
    enableRateLimit: true,
    ...options,
  });
}

/**
 * 檢查交易所是否支援
 */
export function isSupportedExchange(exchangeId: string): exchangeId is SupportedExchangeId {
  return SUPPORTED_EXCHANGES.includes(exchangeId as SupportedExchangeId);
}
