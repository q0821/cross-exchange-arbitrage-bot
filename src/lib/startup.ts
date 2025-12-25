/**
 * Startup Service
 *
 * Handles application startup tasks including exchange connectivity checks
 *
 * Feature 043: BingX 整合 - US1 監控用 API Key 驗證
 */

import { logger } from './logger.js';
import { apiKeys } from './config.js';
import { createExchange } from '../connectors/factory.js';
import type { ExchangeName } from '../connectors/types.js';

export interface ExchangeConnectivityResult {
  exchange: ExchangeName;
  connected: boolean;
  error?: string;
  warning?: string;
}

export interface StartupResult {
  success: boolean;
  exchanges: ExchangeConnectivityResult[];
  warnings: string[];
  errors: string[];
}

/**
 * Check if an exchange has API keys configured in .env
 */
function hasApiKeyConfigured(exchange: ExchangeName): boolean {
  switch (exchange) {
    case 'binance':
      return !!apiKeys.binance.apiKey && !!apiKeys.binance.apiSecret;
    case 'okx':
      return !!apiKeys.okx.apiKey && !!apiKeys.okx.apiSecret && !!apiKeys.okx.passphrase;
    case 'mexc':
      return !!apiKeys.mexc.apiKey && !!apiKeys.mexc.apiSecret;
    case 'gateio':
      return !!apiKeys.gateio.apiKey && !!apiKeys.gateio.apiSecret;
    case 'bingx':
      return !!apiKeys.bingx.apiKey && !!apiKeys.bingx.apiSecret;
    default:
      return false;
  }
}

/**
 * Get testnet setting for an exchange
 */
function isTestnet(exchange: ExchangeName): boolean {
  switch (exchange) {
    case 'binance':
      return apiKeys.binance.testnet;
    case 'okx':
      return apiKeys.okx.testnet;
    case 'mexc':
      return apiKeys.mexc.testnet;
    case 'gateio':
      return apiKeys.gateio.testnet;
    case 'bingx':
      return apiKeys.bingx.testnet;
    default:
      return false;
  }
}

/**
 * Validate connectivity for a single exchange
 *
 * T022: Implement BingX connectivity check using connector.connect()
 * T023: Add warning log when BINGX_API_KEY is missing (non-blocking)
 * T024: Add error log when BINGX_API_KEY is invalid
 */
async function validateExchangeConnectivity(
  exchange: ExchangeName,
): Promise<ExchangeConnectivityResult> {
  // T023: Check if API key is configured
  if (!hasApiKeyConfigured(exchange)) {
    const warning = `${exchange.toUpperCase()} API key not configured - monitoring will not include this exchange`;
    logger.warn({ exchange }, warning);
    return {
      exchange,
      connected: false,
      warning,
    };
  }

  try {
    // T022: Create connector and test connectivity
    const connector = createExchange(exchange, isTestnet(exchange));
    await connector.connect();

    // Try to fetch a funding rate to verify API access
    try {
      await connector.getFundingRate('BTCUSDT');
      logger.info({ exchange, testnet: isTestnet(exchange) }, `${exchange.toUpperCase()} connected successfully`);
      return {
        exchange,
        connected: true,
      };
    } catch (rateError) {
      // Connected but couldn't fetch funding rate - might be a permission issue
      logger.warn(
        { exchange, error: rateError instanceof Error ? rateError.message : String(rateError) },
        `${exchange.toUpperCase()} connected but couldn't fetch funding rate`,
      );
      return {
        exchange,
        connected: true,
        warning: 'Connected but funding rate fetch failed',
      };
    }
  } catch (error) {
    // T024: Log error when API key is invalid
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { exchange, error: errorMessage },
      `${exchange.toUpperCase()} connection failed - API key may be invalid`,
    );
    return {
      exchange,
      connected: false,
      error: errorMessage,
    };
  }
}

/**
 * Validate BingX connectivity specifically
 *
 * T021: Add BingX API validation in startup sequence
 */
export async function validateBingxConnectivity(): Promise<ExchangeConnectivityResult> {
  return validateExchangeConnectivity('bingx');
}

/**
 * Validate all configured exchanges on startup
 *
 * This is non-blocking - missing or invalid API keys will generate warnings
 * but won't prevent the application from starting
 */
export async function validateAllExchangeConnectivity(
  exchanges: ExchangeName[] = ['binance', 'okx', 'mexc', 'gateio', 'bingx'],
): Promise<StartupResult> {
  const results: ExchangeConnectivityResult[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  logger.info({ exchanges }, 'Validating exchange connectivity...');

  // Validate each exchange concurrently
  const promises = exchanges.map((exchange) => validateExchangeConnectivity(exchange));
  const exchangeResults = await Promise.all(promises);

  for (const result of exchangeResults) {
    results.push(result);

    if (result.warning) {
      warnings.push(`${result.exchange}: ${result.warning}`);
    }

    if (result.error) {
      errors.push(`${result.exchange}: ${result.error}`);
    }
  }

  const connectedCount = results.filter((r) => r.connected).length;
  const totalCount = results.length;

  if (connectedCount === 0) {
    logger.error(
      { connectedCount, totalCount },
      'No exchanges connected - monitoring will not work',
    );
  } else if (connectedCount < totalCount) {
    logger.warn(
      { connectedCount, totalCount, warnings },
      'Some exchanges not connected',
    );
  } else {
    logger.info(
      { connectedCount, totalCount },
      'All exchanges connected successfully',
    );
  }

  return {
    success: connectedCount > 0,
    exchanges: results,
    warnings,
    errors,
  };
}

/**
 * Run all startup tasks
 */
export async function runStartupTasks(): Promise<StartupResult> {
  logger.info('Running startup tasks...');

  // Validate exchange connectivity
  const result = await validateAllExchangeConnectivity();

  logger.info(
    {
      success: result.success,
      connectedExchanges: result.exchanges.filter((e) => e.connected).map((e) => e.exchange),
      warnings: result.warnings.length,
      errors: result.errors.length,
    },
    'Startup tasks completed',
  );

  return result;
}
