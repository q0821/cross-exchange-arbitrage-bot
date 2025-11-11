/**
 * TypeScript Type Definitions for Exchange Quick Links Feature
 *
 * Feature: 008-specify-scripts-bash
 * Purpose: Define all types, interfaces, and constants for the exchange link functionality
 *
 * This file serves as the contract between components and utility functions.
 * Copy this file to src/types/exchange-links.ts during implementation.
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Supported exchange names
 * These correspond to the exchanges supported in the arbitrage platform
 */
export type SupportedExchange = 'binance' | 'okx' | 'mexc' | 'gateio';

/**
 * Symbol format: "BASE/QUOTE" (e.g., "BTC/USDT")
 * This is the standardized format used throughout the application
 */
export type SymbolFormat = string;

// ============================================================================
// Configuration Interfaces
// ============================================================================

/**
 * Exchange URL Configuration
 *
 * Defines how to construct URLs for each exchange
 */
export interface ExchangeUrlConfig {
  /** Exchange identifier */
  exchange: SupportedExchange;

  /** Display name (e.g., "Binance", "OKX") */
  displayName: string;

  /** URL template with {symbol} placeholder */
  urlTemplate: string;

  /** Function to format symbol for this exchange's URL format */
  formatSymbol: (symbol: SymbolFormat) => string;
}

/**
 * Complete exchange configuration map
 */
export type ExchangeConfigMap = Record<SupportedExchange, ExchangeUrlConfig>;

// ============================================================================
// Function Result Types
// ============================================================================

/**
 * Result of URL generation
 *
 * Provides both the URL and metadata about the operation
 */
export interface UrlBuilderResult {
  /** The generated URL */
  url: string;

  /** The formatted symbol used in the URL */
  formattedSymbol: string;

  /** Whether the URL generation was successful */
  isValid: boolean;

  /** Error message if isValid is false */
  error?: string;
}

/**
 * Symbol validation result
 */
export interface SymbolValidationResult {
  /** Whether the symbol is valid */
  isValid: boolean;

  /** The base currency (e.g., "BTC") */
  base?: string;

  /** The quote currency (e.g., "USDT") */
  quote?: string;

  /** Error message if invalid */
  error?: string;
}

// ============================================================================
// Component Props
// ============================================================================

/**
 * Props for the ExchangeLink component
 *
 * This component renders a clickable icon that links to an exchange's contract page
 */
export interface ExchangeLinkProps {
  /** Exchange to link to */
  exchange: SupportedExchange;

  /** Trading pair symbol in "BASE/QUOTE" format */
  symbol: SymbolFormat;

  /** Whether the link should be enabled (default: true) */
  isAvailable?: boolean;

  /** Additional CSS classes */
  className?: string;

  /** Custom aria-label (if not provided, will be auto-generated) */
  ariaLabel?: string;

  /** Callback when link is clicked (for analytics) */
  onClick?: (exchange: SupportedExchange, symbol: SymbolFormat) => void;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Array of all supported exchanges
 * Use this for iteration or validation
 */
export const SUPPORTED_EXCHANGES: readonly SupportedExchange[] = [
  'binance',
  'okx',
  'mexc',
  'gateio',
] as const;

/**
 * Display names for exchanges
 */
export const EXCHANGE_DISPLAY_NAMES: Record<SupportedExchange, string> = {
  binance: 'Binance',
  okx: 'OKX',
  mexc: 'MEXC',
  gateio: 'Gate.io',
};

/**
 * Regular expression for validating symbol format
 * Matches "BASE/QUOTE" where BASE is 1-10 uppercase alphanumeric characters
 * and QUOTE is 3-10 uppercase letters
 *
 * Examples:
 * - BTC/USDT ✓
 * - 1000PEPE/USDT ✓
 * - BTCUSDT ✗ (missing slash)
 * - btc/usdt ✗ (lowercase)
 */
export const SYMBOL_FORMAT_REGEX = /^[A-Z0-9]{1,10}\/[A-Z]{3,10}$/;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a string is a supported exchange
 *
 * @param value - Value to check
 * @returns True if value is a supported exchange
 *
 * @example
 * ```typescript
 * if (isSupportedExchange(userInput)) {
 *   // TypeScript now knows userInput is SupportedExchange
 *   const url = getExchangeContractUrl(userInput, 'BTC/USDT');
 * }
 * ```
 */
export function isSupportedExchange(value: unknown): value is SupportedExchange {
  return (
    typeof value === 'string' &&
    SUPPORTED_EXCHANGES.includes(value as SupportedExchange)
  );
}

/**
 * Type guard to check if a string is a valid symbol format
 *
 * @param value - Value to check
 * @returns True if value matches symbol format pattern
 *
 * @example
 * ```typescript
 * if (isValidSymbolFormat(input)) {
 *   // Safe to use input as SymbolFormat
 *   const url = buildExchangeUrl(exchange, input);
 * }
 * ```
 */
export function isValidSymbolFormat(value: unknown): value is SymbolFormat {
  return typeof value === 'string' && SYMBOL_FORMAT_REGEX.test(value);
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Options for URL builder function
 */
export interface UrlBuilderOptions {
  /** Whether to validate inputs before building URL */
  validate?: boolean;

  /** Whether to throw errors or return error in result */
  throwOnError?: boolean;
}

/**
 * Test fixtures for unit testing
 */
export interface ExchangeLinkTestCase {
  /** Test case name/description */
  description: string;

  /** Input exchange */
  exchange: SupportedExchange;

  /** Input symbol */
  symbol: SymbolFormat;

  /** Expected URL output */
  expectedUrl: string;

  /** Expected formatted symbol */
  expectedFormattedSymbol: string;

  /** Whether this test case should pass */
  shouldPass: boolean;

  /** Expected error message (if shouldPass is false) */
  expectedError?: string;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Custom error class for exchange link operations
 */
export class ExchangeLinkError extends Error {
  constructor(
    message: string,
    public readonly code: ExchangeLinkErrorCode,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ExchangeLinkError';
  }
}

/**
 * Error codes for exchange link operations
 */
export enum ExchangeLinkErrorCode {
  UNSUPPORTED_EXCHANGE = 'UNSUPPORTED_EXCHANGE',
  INVALID_SYMBOL_FORMAT = 'INVALID_SYMBOL_FORMAT',
  EMPTY_SYMBOL = 'EMPTY_SYMBOL',
  URL_GENERATION_FAILED = 'URL_GENERATION_FAILED',
}

// ============================================================================
// Export All
// ============================================================================
// All exports are declared inline above, no need to re-export here
