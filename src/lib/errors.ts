import { logger } from './logger';

// 基礎錯誤類別
export class BaseError extends Error {
  public code: string;
  public statusCode: number;
  public isOperational: boolean;
  public context?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;
    Error.captureStackTrace(this, this.constructor);
  }
}

// 交易所相關錯誤
export class ExchangeError extends BaseError {
  constructor(
    message: string,
    public readonly exchange: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'EXCHANGE_ERROR', 500, true, { ...context, exchange });
  }
}

export class ExchangeConnectionError extends ExchangeError {
  constructor(exchange: string, context?: Record<string, unknown>) {
    // 在訊息中包含原始錯誤訊息，讓重試機制能識別可重試的錯誤（如 timeout）
    const originalError = context?.originalError || context?.message;
    const message = originalError
      ? `Failed to connect to ${exchange}: ${originalError}`
      : `Failed to connect to ${exchange}`;
    super(message, exchange, context);
    this.code = 'EXCHANGE_CONNECTION_ERROR';
  }
}

export class ExchangeApiError extends ExchangeError {
  constructor(
    exchange: string,
    public readonly apiCode: string | number,
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message, exchange, { ...context, apiCode });
    this.code = 'EXCHANGE_API_ERROR';
  }
}

export class ExchangeRateLimitError extends ExchangeError {
  constructor(exchange: string, context?: Record<string, unknown>) {
    super(`Rate limit exceeded for ${exchange}`, exchange, context);
    this.code = 'EXCHANGE_RATE_LIMIT_ERROR';
    this.statusCode = 429;
  }
}

// 交易相關錯誤
export class TradingError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'TRADING_ERROR', 500, true, context);
  }
}

export class InsufficientBalanceError extends TradingError {
  constructor(
    public readonly exchange: string,
    public readonly required: number,
    public readonly available: number
  ) {
    super(
      `Insufficient balance on ${exchange}: required ${required}, available ${available}`,
      { exchange, required, available }
    );
    this.code = 'INSUFFICIENT_BALANCE';
  }
}

export class OrderFailedError extends TradingError {
  constructor(
    public readonly exchange: string,
    public readonly orderId: string,
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message, { ...context, exchange, orderId });
    this.code = 'ORDER_FAILED';
  }
}

export class SlippageExceededError extends TradingError {
  constructor(
    public readonly expectedPrice: number,
    public readonly actualPrice: number,
    public readonly slippage: number
  ) {
    super(
      `Slippage exceeded: expected ${expectedPrice}, actual ${actualPrice}, slippage ${slippage}%`,
      { expectedPrice, actualPrice, slippage }
    );
    this.code = 'SLIPPAGE_EXCEEDED';
  }
}

// 套利相關錯誤
export class ArbitrageError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'ARBITRAGE_ERROR', 500, true, context);
  }
}

export class OpportunityExpiredError extends ArbitrageError {
  constructor(public readonly opportunityId: string) {
    super(`Arbitrage opportunity expired: ${opportunityId}`, { opportunityId });
    this.code = 'OPPORTUNITY_EXPIRED';
  }
}

export class HedgePositionError extends ArbitrageError {
  constructor(message: string, public readonly positionId: string, context?: Record<string, unknown>) {
    super(message, { ...context, positionId });
    this.code = 'HEDGE_POSITION_ERROR';
  }
}

// 風險管理錯誤
export class RiskError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'RISK_ERROR', 500, true, context);
  }
}

export class RiskLimitExceededError extends RiskError {
  constructor(
    public readonly limitType: string,
    public readonly limit: number,
    public readonly current: number
  ) {
    super(`Risk limit exceeded: ${limitType} limit ${limit}, current ${current}`, {
      limitType,
      limit,
      current,
    });
    this.code = 'RISK_LIMIT_EXCEEDED';
  }
}

export class StopLossTriggeredError extends RiskError {
  constructor(
    public readonly positionId: string,
    public readonly loss: number,
    public readonly threshold: number
  ) {
    super(`Stop loss triggered for position ${positionId}: loss ${loss}, threshold ${threshold}`, {
      positionId,
      loss,
      threshold,
    });
    this.code = 'STOP_LOSS_TRIGGERED';
  }
}

// 配置錯誤
export class ConfigError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONFIG_ERROR', 500, false, context);
  }
}

// 資料庫錯誤
export class DatabaseError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'DATABASE_ERROR', 500, true, context);
  }
}

// 驗證錯誤
export class ValidationError extends BaseError {
  constructor(message: string, public readonly field?: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, false, { ...context, field });
  }
}

// ===== Web 平台錯誤 (Feature 006) =====

// 認證錯誤
export class AuthError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'AUTH_ERROR', 401, true, context);
  }
}

export class UnauthorizedError extends AuthError {
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.code = 'UNAUTHORIZED';
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor(message: string = 'Invalid email or password') {
    super(message);
    this.code = 'INVALID_CREDENTIALS';
  }
}

export class TokenExpiredError extends AuthError {
  constructor(message: string = 'Token has expired') {
    super(message);
    this.code = 'TOKEN_EXPIRED';
  }
}

export class InvalidTokenError extends AuthError {
  constructor(message: string = 'Invalid token') {
    super(message);
    this.code = 'INVALID_TOKEN';
  }
}

// Feature 061: 帳戶鎖定錯誤
export class AccountLockedError extends AuthError {
  constructor(
    message: string = '帳戶已被暫時鎖定',
    public readonly lockedUntil?: Date,
    public readonly remainingSeconds?: number
  ) {
    super(message, { lockedUntil, remainingSeconds });
    this.code = 'ACCOUNT_LOCKED';
    this.statusCode = 423; // Locked
  }
}

// Feature 061: Token 版本不匹配（密碼已變更）
export class TokenVersionMismatchError extends AuthError {
  constructor(message: string = '登入已過期，請重新登入') {
    super(message);
    this.code = 'TOKEN_VERSION_MISMATCH';
  }
}

// 資源錯誤
export class NotFoundError extends BaseError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with identifier ${identifier} not found`
      : `${resource} not found`;
    super(message, 'NOT_FOUND', 404, true, { resource, identifier });
  }
}

export class ForbiddenError extends BaseError {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', 403, true);
  }
}

export class DuplicateError extends ValidationError {
  constructor(message: string, field?: string) {
    super(message, field);
    this.code = 'DUPLICATE_ERROR';
    this.statusCode = 409;
  }
}

export class BadRequestError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'BAD_REQUEST', 400, true, context);
  }
}

export class TooManyRequestsError extends BaseError {
  constructor(message: string = 'Too many requests', context?: Record<string, unknown>) {
    super(message, 'TOO_MANY_REQUESTS', 429, true, context);
  }
}

// 持倉錯誤
export class PositionError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'POSITION_ERROR', 500, true, context);
  }
}

export class PositionOpenError extends PositionError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
    this.code = 'POSITION_OPEN_ERROR';
  }
}

export class PositionCloseError extends PositionError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
    this.code = 'POSITION_CLOSE_ERROR';
  }
}

export class PositionNotFoundError extends NotFoundError {
  constructor(positionId: string) {
    super('Position', positionId);
    this.code = 'POSITION_NOT_FOUND';
  }
}

export class InvalidPositionStateError extends PositionError {
  constructor(currentState: string, expectedState: string) {
    super(
      `Invalid position state: expected ${expectedState}, got ${currentState}`,
      { currentState, expectedState },
    );
    this.code = 'INVALID_POSITION_STATE';
    this.statusCode = 400;
  }
}

// 速率限制錯誤
export class RateLimitError extends BaseError {
  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, true, { retryAfter });
  }
}

// 錯誤工具函式
export function isAppError(error: unknown): error is BaseError {
  return error instanceof BaseError;
}

export function toAppError(error: unknown): BaseError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new BaseError(error.message, 'INTERNAL_ERROR', 500, true, {
      originalError: error.message,
      stack: error.stack,
    });
  }

  return new BaseError('An unknown error occurred', 'UNKNOWN_ERROR', 500, true, {
    originalError: String(error),
  });
}

// 錯誤處理器
export class ErrorHandler {
  static handle(error: Error): void {
    if (error instanceof BaseError) {
      this.handleBaseError(error);
    } else {
      this.handleUnknownError(error);
    }
  }

  private static handleBaseError(error: BaseError): void {
    const logContext = {
      code: error.code,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      ...error.context,
    };

    if (error.isOperational) {
      // 操作性錯誤 (預期的錯誤)
      if (error.statusCode >= 500) {
        logger.error(logContext, error.message);
      } else {
        logger.warn(logContext, error.message);
      }
    } else {
      // 程式錯誤 (未預期的錯誤)
      logger.fatal({
        ...logContext,
        stack: error.stack,
      }, error.message);

      // 程式錯誤應該終止程式
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    }
  }

  private static handleUnknownError(error: Error): void {
    logger.fatal({
      message: error.message,
      stack: error.stack,
    }, 'Unknown error occurred');

    // 未知錯誤應該終止程式
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }

  static isTrustedError(error: Error): boolean {
    if (error instanceof BaseError) {
      return error.isOperational;
    }
    return false;
  }
}

// 全域錯誤處理
// 使用 globalThis 標記防止 Next.js hot reload 時重複註冊 listeners
declare global {
  // eslint-disable-next-line no-var
  var __errorHandlersRegistered: boolean | undefined;
}

if (!globalThis.__errorHandlersRegistered) {
  globalThis.__errorHandlersRegistered = true;

  process.on('unhandledRejection', (reason: Error | unknown) => {
    logger.fatal({
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    }, 'Unhandled Promise Rejection');

    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });

  process.on('uncaughtException', (error: Error) => {
    logger.fatal({
      message: error.message,
      stack: error.stack,
    }, 'Uncaught Exception');

    // 給予一些時間讓 logger 完成寫入
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
}
