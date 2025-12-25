/**
 * Trading Error Types
 *
 * 交易相關錯誤類型定義
 * Feature: 033-manual-open-position
 */

export type SupportedExchange = 'binance' | 'okx' | 'mexc' | 'gateio' | 'bingx';

/**
 * 基礎交易錯誤
 */
export class TradingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'TradingError';
  }
}

/**
 * 餘額不足錯誤
 */
export class InsufficientBalanceError extends TradingError {
  constructor(
    public readonly exchange: SupportedExchange,
    public readonly required: number,
    public readonly available: number,
    public readonly currency: string = 'USDT',
  ) {
    super(
      `${exchange} 餘額不足：需要 ${required.toFixed(2)} ${currency}，可用 ${available.toFixed(2)} ${currency}`,
      'INSUFFICIENT_BALANCE',
      false,
      { exchange, required, available, currency },
    );
    this.name = 'InsufficientBalanceError';
  }
}

/**
 * 並發衝突錯誤 (分散式鎖)
 */
export class LockConflictError extends TradingError {
  constructor(
    public readonly userId: string,
    public readonly symbol: string,
  ) {
    super(
      `${symbol} 正在開倉中，請稍後再試`,
      'LOCK_CONFLICT',
      true,
      { userId, symbol },
    );
    this.name = 'LockConflictError';
  }
}

/**
 * 交易所 API 錯誤
 */
export class ExchangeApiError extends TradingError {
  constructor(
    public readonly exchange: SupportedExchange,
    public readonly endpoint: string,
    public readonly originalMessage: string,
    public readonly statusCode?: number,
    retryable: boolean = false,
  ) {
    super(
      `${exchange} API 錯誤 (${endpoint}): ${originalMessage}`,
      'API_ERROR',
      retryable,
      { exchange, endpoint, statusCode, originalMessage },
    );
    this.name = 'ExchangeApiError';
  }
}

/**
 * 網路超時錯誤
 */
export class NetworkTimeoutError extends TradingError {
  constructor(
    public readonly exchange: SupportedExchange,
    public readonly timeoutMs: number,
  ) {
    super(
      `${exchange} 網路超時 (${timeoutMs}ms)`,
      'NETWORK_TIMEOUT',
      true,
      { exchange, timeoutMs },
    );
    this.name = 'NetworkTimeoutError';
  }
}

/**
 * 請求頻率限制錯誤
 */
export class RateLimitedError extends TradingError {
  constructor(
    public readonly exchange: SupportedExchange,
    public readonly retryAfterMs?: number,
  ) {
    super(
      `${exchange} 請求頻率限制${retryAfterMs ? `，請等待 ${retryAfterMs}ms 後重試` : ''}`,
      'RATE_LIMITED',
      true,
      { exchange, retryAfterMs },
    );
    this.name = 'RateLimitedError';
  }
}

/**
 * 回滾失敗錯誤
 */
export class RollbackFailedError extends TradingError {
  constructor(
    public readonly exchange: SupportedExchange,
    public readonly orderId: string,
    public readonly side: 'LONG' | 'SHORT',
    public readonly quantity: string,
    public readonly attempts: number,
  ) {
    super(
      `無法自動回滾 ${exchange} ${side} 倉位，請手動處理`,
      'ROLLBACK_FAILED',
      false,
      { exchange, orderId, side, quantity, attempts },
    );
    this.name = 'RollbackFailedError';
  }
}

/**
 * 輸入驗證錯誤
 */
export class ValidationError extends TradingError {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown,
  ) {
    super(
      message,
      'VALIDATION_ERROR',
      false,
      { field, value },
    );
    this.name = 'ValidationError';
  }
}

/**
 * 持倉不存在錯誤
 */
export class PositionNotFoundError extends TradingError {
  constructor(
    public readonly positionId: string,
  ) {
    super(
      `持倉不存在: ${positionId}`,
      'POSITION_NOT_FOUND',
      false,
      { positionId },
    );
    this.name = 'PositionNotFoundError';
  }
}

/**
 * API Key 不存在錯誤
 */
export class ApiKeyNotFoundError extends TradingError {
  constructor(
    public readonly userId: string,
    public readonly exchange: SupportedExchange,
  ) {
    super(
      `用戶 ${exchange} API Key 不存在`,
      'API_KEY_NOT_FOUND',
      false,
      { userId, exchange },
    );
    this.name = 'ApiKeyNotFoundError';
  }
}

/**
 * 錯誤類型守衛
 */
export function isTradingError(error: unknown): error is TradingError {
  return error instanceof TradingError;
}

export function isInsufficientBalanceError(error: unknown): error is InsufficientBalanceError {
  return error instanceof InsufficientBalanceError;
}

export function isLockConflictError(error: unknown): error is LockConflictError {
  return error instanceof LockConflictError;
}

export function isExchangeApiError(error: unknown): error is ExchangeApiError {
  return error instanceof ExchangeApiError;
}

export function isRollbackFailedError(error: unknown): error is RollbackFailedError {
  return error instanceof RollbackFailedError;
}

/**
 * 判斷錯誤是否可重試
 */
export function isRetryableError(error: unknown): boolean {
  if (isTradingError(error)) {
    return error.retryable;
  }
  return false;
}

/**
 * 從未知錯誤中提取訊息
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}

/**
 * 格式化錯誤用於 API 回應
 */
export function formatErrorForResponse(error: unknown): {
  error: string;
  message: string;
  details?: Record<string, unknown>;
} {
  if (isTradingError(error)) {
    return {
      error: error.code,
      message: error.message,
      details: error.details,
    };
  }

  return {
    error: 'INTERNAL_ERROR',
    message: getErrorMessage(error),
  };
}
