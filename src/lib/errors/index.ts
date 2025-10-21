/**
 * Error Types
 *
 * 自訂錯誤類型定義
 * Feature: 004-fix-okx-add-price-display
 */

import {
  Exchange,
  FundingRateValidationResult,
  APIError as IAPIError,
  WebSocketError as IWebSocketError,
  ValidationError as IValidationError,
} from '../../types/service-interfaces';

// Re-export the error classes from service-interfaces
export { APIError, WebSocketError, ValidationError } from '../../types/service-interfaces';

// ============================================================================
// Additional Error Utilities
// ============================================================================

/**
 * 判斷是否為 API 錯誤
 */
export function isAPIError(error: unknown): error is IAPIError {
  return error instanceof Error && error.name === 'APIError';
}

/**
 * 判斷是否為 WebSocket 錯誤
 */
export function isWebSocketError(error: unknown): error is IWebSocketError {
  return error instanceof Error && error.name === 'WebSocketError';
}

/**
 * 判斷是否為驗證錯誤
 */
export function isValidationError(error: unknown): error is IValidationError {
  return error instanceof Error && error.name === 'ValidationError';
}

/**
 * 格式化錯誤訊息以供記錄
 */
export function formatErrorForLogging(error: Error): {
  name: string;
  message: string;
  stack?: string;
  exchange?: Exchange;
  endpoint?: string;
  statusCode?: number;
  reconnectAttempt?: number;
  symbol?: string;
  validationResult?: FundingRateValidationResult;
} {
  const baseError = {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };

  if (isAPIError(error)) {
    return {
      ...baseError,
      exchange: error.exchange,
      endpoint: error.endpoint,
      statusCode: error.statusCode,
    };
  }

  if (isWebSocketError(error)) {
    return {
      ...baseError,
      exchange: error.exchange,
      reconnectAttempt: error.reconnectAttempt,
    };
  }

  if (isValidationError(error)) {
    return {
      ...baseError,
      symbol: error.symbol,
      validationResult: error.validationResult,
    };
  }

  return baseError;
}

/**
 * 包裝原始錯誤為 API 錯誤
 */
export function wrapAsAPIError(
  error: unknown,
  exchange: Exchange,
  endpoint: string,
  statusCode?: number
): IAPIError {
  const originalError = error instanceof Error ? error : new Error(String(error));
  const message = `${exchange} API 錯誤 (${endpoint}): ${originalError.message}`;

  // Import the class from service-interfaces
  const { APIError } = require('../../types/service-interfaces');
  return new APIError(message, exchange, endpoint, statusCode, originalError);
}

/**
 * 包裝原始錯誤為 WebSocket 錯誤
 */
export function wrapAsWebSocketError(
  error: unknown,
  exchange: Exchange,
  reconnectAttempt?: number
): IWebSocketError {
  const originalError = error instanceof Error ? error : new Error(String(error));
  const message = `${exchange} WebSocket 錯誤: ${originalError.message}`;

  const { WebSocketError } = require('../../types/service-interfaces');
  return new WebSocketError(message, exchange, reconnectAttempt, originalError);
}

/**
 * 包裝原始錯誤為驗證錯誤
 */
export function wrapAsValidationError(
  error: unknown,
  symbol: string,
  validationResult: FundingRateValidationResult
): IValidationError {
  const originalError = error instanceof Error ? error : new Error(String(error));
  const message = `資金費率驗證錯誤 (${symbol}): ${originalError.message}`;

  const { ValidationError } = require('../../types/service-interfaces');
  return new ValidationError(message, symbol, validationResult, originalError);
}

/**
 * 安全取得錯誤訊息
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'Unknown error';
}

/**
 * 安全取得錯誤堆疊
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  return undefined;
}
