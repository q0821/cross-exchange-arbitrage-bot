/**
 * Exchange URL Builder
 *
 * Feature: 008-specify-scripts-bash
 * Purpose: Generate exchange contract page URLs with proper symbol formatting
 */

import type {
  UrlBuilderResult,
  SymbolValidationResult,
} from '@/types/exchange-links';
import {
  SYMBOL_FORMAT_REGEX,
  isSupportedExchange,
  ExchangeLinkError,
  ExchangeLinkErrorCode,
} from '@/types/exchange-links';
import { EXCHANGE_CONFIGS } from './constants';

/**
 * Validate symbol format
 *
 * @param symbol - Trading pair symbol (e.g., "BTC/USDT" or "BTCUSDT")
 * @returns Validation result with base and quote currencies
 *
 * @example
 * ```typescript
 * validateSymbol('BTC/USDT');
 * // Returns: { isValid: true, base: 'BTC', quote: 'USDT' }
 *
 * validateSymbol('BTCUSDT');
 * // Returns: { isValid: true, base: 'BTC', quote: 'USDT' }
 * ```
 */
export function validateSymbol(symbol: string): SymbolValidationResult {
  if (!symbol || symbol.trim() === '') {
    return {
      isValid: false,
      error: 'Symbol cannot be empty',
    };
  }

  // If symbol already has the correct format (BASE/QUOTE)
  if (SYMBOL_FORMAT_REGEX.test(symbol)) {
    const [base, quote] = symbol.split('/');
    return {
      isValid: true,
      base,
      quote,
    };
  }

  // Try to parse format without slash (e.g., "BTCUSDT" -> "BTC/USDT")
  // Common quote currencies in order of priority
  const commonQuotes = ['USDT', 'USDC', 'BUSD', 'USD', 'BTC', 'ETH', 'BNB'];

  for (const quote of commonQuotes) {
    if (symbol.endsWith(quote)) {
      const base = symbol.slice(0, -quote.length);
      if (base.length > 0) {
        // Validate the constructed symbol
        const constructedSymbol = `${base}/${quote}`;
        if (SYMBOL_FORMAT_REGEX.test(constructedSymbol)) {
          return {
            isValid: true,
            base,
            quote,
          };
        }
      }
    }
  }

  return {
    isValid: false,
    error: `Invalid symbol format: ${symbol}. Expected format: BASE/QUOTE (e.g., BTC/USDT) or BASEQUOTE (e.g., BTCUSDT)`,
  };
}

/**
 * Generate exchange contract page URL
 *
 * @param exchange - Exchange identifier (e.g., 'binance', 'okx')
 * @param symbol - Trading pair symbol in "BASE/QUOTE" or "BASEQUOTE" format
 * @returns URL builder result with URL and metadata
 *
 * @example
 * ```typescript
 * const result = getExchangeContractUrl('binance', 'BTC/USDT');
 * // Returns: {
 * //   url: 'https://www.binance.com/zh-TC/futures/BTCUSDT',
 * //   formattedSymbol: 'BTCUSDT',
 * //   isValid: true
 * // }
 *
 * // Also accepts format without slash
 * const result2 = getExchangeContractUrl('binance', 'BTCUSDT');
 * // Returns: {
 * //   url: 'https://www.binance.com/zh-TC/futures/BTCUSDT',
 * //   formattedSymbol: 'BTCUSDT',
 * //   isValid: true
 * // }
 * ```
 */
export function getExchangeContractUrl(
  exchange: string,
  symbol: string
): UrlBuilderResult {
  // Validate exchange
  if (!isSupportedExchange(exchange)) {
    return {
      url: '',
      formattedSymbol: '',
      isValid: false,
      error: `Unsupported exchange: ${exchange}`,
    };
  }

  // Validate symbol (handles both "BTC/USDT" and "BTCUSDT" formats)
  const symbolValidation = validateSymbol(symbol);
  if (!symbolValidation.isValid) {
    return {
      url: '',
      formattedSymbol: '',
      isValid: false,
      error: symbolValidation.error,
    };
  }

  // Get exchange configuration
  const config = EXCHANGE_CONFIGS[exchange];
  if (!config) {
    return {
      url: '',
      formattedSymbol: '',
      isValid: false,
      error: `Configuration not found for exchange: ${exchange}`,
    };
  }

  // Format symbol and build URL
  try {
    // Construct normalized symbol in "BASE/QUOTE" format
    const normalizedSymbol = `${symbolValidation.base}/${symbolValidation.quote}`;
    const formattedSymbol = config.formatSymbol(normalizedSymbol);
    const url = config.urlTemplate.replace('{symbol}', formattedSymbol);

    return {
      url,
      formattedSymbol,
      isValid: true,
    };
  } catch (error) {
    return {
      url: '',
      formattedSymbol: '',
      isValid: false,
      error: `Failed to generate URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Build multiple exchange URLs for a single symbol
 *
 * @param symbol - Trading pair symbol
 * @param exchanges - Array of exchange identifiers (defaults to all supported exchanges)
 * @returns Map of exchange to URL builder results
 *
 * @example
 * ```typescript
 * const urls = buildExchangeUrls('BTC/USDT', ['binance', 'okx']);
 * // Returns: {
 * //   binance: { url: 'https://...', formattedSymbol: 'BTCUSDT', isValid: true },
 * //   okx: { url: 'https://...', formattedSymbol: 'BTC-USDT-SWAP', isValid: true }
 * // }
 * ```
 */
export function buildExchangeUrls(
  symbol: string,
  exchanges: string[] = ['binance', 'okx', 'mexc', 'gateio']
): Record<string, UrlBuilderResult> {
  const results: Record<string, UrlBuilderResult> = {};

  for (const exchange of exchanges) {
    results[exchange] = getExchangeContractUrl(exchange, symbol);
  }

  return results;
}
