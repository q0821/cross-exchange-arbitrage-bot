import { logger } from './logger.js';

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
    super(`Failed to connect to ${exchange}`, exchange, context);
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
