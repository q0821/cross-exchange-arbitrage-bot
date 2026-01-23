/**
 * CCXT Exchange Factory
 *
 * 提供類型安全的 CCXT 交易所實例創建
 * 解決 CCXT 類型定義不完整的問題
 *
 * @deprecated 請使用 @/lib/ccxt-factory 統一工廠，該工廠已包含 proxy 配置
 */

import type { Exchange } from 'ccxt';
import { createCcxtExchange as createFromMainFactory, type SupportedExchange } from '../ccxt-factory';

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
 * 使用統一 CCXT 工廠確保 proxy 配置自動套用
 *
 * @param exchangeId 交易所 ID
 * @param options 配置選項
 * @returns CCXT Exchange 實例
 *
 * @deprecated 請直接使用 @/lib/ccxt-factory 的 createCcxtExchange
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

  // 使用統一工廠創建 CCXT 實例（自動套用 proxy 配置）
  return createFromMainFactory(exchangeId as SupportedExchange, {
    apiKey: options.apiKey,
    secret: options.secret,
    password: options.password,
    enableRateLimit: options.enableRateLimit ?? true,
    options: options.options,
  });
}

/**
 * 檢查交易所是否支援
 */
export function isSupportedExchange(exchangeId: string): exchangeId is SupportedExchangeId {
  return SUPPORTED_EXCHANGES.includes(exchangeId as SupportedExchangeId);
}
