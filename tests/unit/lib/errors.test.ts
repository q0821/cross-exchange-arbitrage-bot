/**
 * Test: Error Classes Library
 *
 * 測試錯誤類別：錯誤建構、屬性、工具函式
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  },
}));

// Import after mocks
import {
  BaseError,
  ExchangeError,
  ExchangeConnectionError,
  ExchangeApiError,
  ExchangeRateLimitError,
  TradingError,
  InsufficientBalanceError,
  OrderFailedError,
  SlippageExceededError,
  ArbitrageError,
  OpportunityExpiredError,
  HedgePositionError,
  RiskError,
  RiskLimitExceededError,
  StopLossTriggeredError,
  ConfigError,
  DatabaseError,
  ValidationError,
  AuthError,
  UnauthorizedError,
  InvalidCredentialsError,
  TokenExpiredError,
  InvalidTokenError,
  AccountLockedError,
  TokenVersionMismatchError,
  NotFoundError,
  ForbiddenError,
  DuplicateError,
  BadRequestError,
  TooManyRequestsError,
  PositionError,
  PositionOpenError,
  PositionCloseError,
  PositionNotFoundError,
  InvalidPositionStateError,
  RateLimitError,
  isAppError,
  toAppError,
  ErrorHandler,
} from '@/lib/errors';

describe('Error Classes Library', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('BaseError', () => {
    it('should create error with all properties', () => {
      const error = new BaseError('Test error', 'TEST_CODE', 400, true, { key: 'value' });

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
      expect(error.context).toEqual({ key: 'value' });
      expect(error.name).toBe('BaseError');
    });

    it('should use default values', () => {
      const error = new BaseError('Test error', 'TEST_CODE');

      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
      expect(error.context).toBeUndefined();
    });

    it('should be instance of Error', () => {
      const error = new BaseError('Test error', 'TEST_CODE');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BaseError);
    });

    it('should have stack trace', () => {
      const error = new BaseError('Test error', 'TEST_CODE');

      expect(error.stack).toBeDefined();
    });
  });

  describe('Exchange Errors', () => {
    describe('ExchangeError', () => {
      it('should create exchange error with exchange name', () => {
        const error = new ExchangeError('Exchange failed', 'binance', { symbol: 'BTCUSDT' });

        expect(error.message).toBe('Exchange failed');
        expect(error.exchange).toBe('binance');
        expect(error.code).toBe('EXCHANGE_ERROR');
        expect(error.context).toEqual({ symbol: 'BTCUSDT', exchange: 'binance' });
      });
    });

    describe('ExchangeConnectionError', () => {
      it('should create connection error', () => {
        const error = new ExchangeConnectionError('okx', { retryCount: 3 });

        expect(error.message).toBe('Failed to connect to okx');
        expect(error.exchange).toBe('okx');
        expect(error.code).toBe('EXCHANGE_CONNECTION_ERROR');
        expect(error.context?.retryCount).toBe(3);
      });
    });

    describe('ExchangeApiError', () => {
      it('should create API error with code', () => {
        const error = new ExchangeApiError('gateio', -1001, 'Invalid API key');

        expect(error.message).toBe('Invalid API key');
        expect(error.exchange).toBe('gateio');
        expect(error.apiCode).toBe(-1001);
        expect(error.code).toBe('EXCHANGE_API_ERROR');
      });

      it('should handle string API code', () => {
        const error = new ExchangeApiError('mexc', 'INVALID_PARAM', 'Invalid parameter');

        expect(error.apiCode).toBe('INVALID_PARAM');
      });
    });

    describe('ExchangeRateLimitError', () => {
      it('should create rate limit error with 429 status', () => {
        const error = new ExchangeRateLimitError('binance');

        expect(error.message).toBe('Rate limit exceeded for binance');
        expect(error.code).toBe('EXCHANGE_RATE_LIMIT_ERROR');
        expect(error.statusCode).toBe(429);
      });
    });
  });

  describe('Trading Errors', () => {
    describe('TradingError', () => {
      it('should create trading error', () => {
        const error = new TradingError('Trading failed', { orderId: '123' });

        expect(error.message).toBe('Trading failed');
        expect(error.code).toBe('TRADING_ERROR');
        expect(error.context?.orderId).toBe('123');
      });
    });

    describe('InsufficientBalanceError', () => {
      it('should create balance error with amounts', () => {
        const error = new InsufficientBalanceError('binance', 1000, 500);

        expect(error.message).toBe('Insufficient balance on binance: required 1000, available 500');
        expect(error.exchange).toBe('binance');
        expect(error.required).toBe(1000);
        expect(error.available).toBe(500);
        expect(error.code).toBe('INSUFFICIENT_BALANCE');
      });
    });

    describe('OrderFailedError', () => {
      it('should create order failed error', () => {
        const error = new OrderFailedError('okx', 'order-123', 'Order rejected');

        expect(error.message).toBe('Order rejected');
        expect(error.exchange).toBe('okx');
        expect(error.orderId).toBe('order-123');
        expect(error.code).toBe('ORDER_FAILED');
      });
    });

    describe('SlippageExceededError', () => {
      it('should create slippage error with prices', () => {
        const error = new SlippageExceededError(100, 105, 5);

        expect(error.message).toBe('Slippage exceeded: expected 100, actual 105, slippage 5%');
        expect(error.expectedPrice).toBe(100);
        expect(error.actualPrice).toBe(105);
        expect(error.slippage).toBe(5);
        expect(error.code).toBe('SLIPPAGE_EXCEEDED');
      });
    });
  });

  describe('Arbitrage Errors', () => {
    describe('ArbitrageError', () => {
      it('should create arbitrage error', () => {
        const error = new ArbitrageError('Arbitrage failed');

        expect(error.message).toBe('Arbitrage failed');
        expect(error.code).toBe('ARBITRAGE_ERROR');
      });
    });

    describe('OpportunityExpiredError', () => {
      it('should create opportunity expired error', () => {
        const error = new OpportunityExpiredError('opp-123');

        expect(error.message).toBe('Arbitrage opportunity expired: opp-123');
        expect(error.opportunityId).toBe('opp-123');
        expect(error.code).toBe('OPPORTUNITY_EXPIRED');
      });
    });

    describe('HedgePositionError', () => {
      it('should create hedge position error', () => {
        const error = new HedgePositionError('Hedge failed', 'pos-456');

        expect(error.message).toBe('Hedge failed');
        expect(error.positionId).toBe('pos-456');
        expect(error.code).toBe('HEDGE_POSITION_ERROR');
      });
    });
  });

  describe('Risk Errors', () => {
    describe('RiskError', () => {
      it('should create risk error', () => {
        const error = new RiskError('Risk check failed');

        expect(error.message).toBe('Risk check failed');
        expect(error.code).toBe('RISK_ERROR');
      });
    });

    describe('RiskLimitExceededError', () => {
      it('should create risk limit error', () => {
        const error = new RiskLimitExceededError('daily_loss', 100, 150);

        expect(error.message).toBe('Risk limit exceeded: daily_loss limit 100, current 150');
        expect(error.limitType).toBe('daily_loss');
        expect(error.limit).toBe(100);
        expect(error.current).toBe(150);
        expect(error.code).toBe('RISK_LIMIT_EXCEEDED');
      });
    });

    describe('StopLossTriggeredError', () => {
      it('should create stop loss error', () => {
        const error = new StopLossTriggeredError('pos-789', 50, 25);

        expect(error.message).toBe('Stop loss triggered for position pos-789: loss 50, threshold 25');
        expect(error.positionId).toBe('pos-789');
        expect(error.loss).toBe(50);
        expect(error.threshold).toBe(25);
        expect(error.code).toBe('STOP_LOSS_TRIGGERED');
      });
    });
  });

  describe('Config and Database Errors', () => {
    describe('ConfigError', () => {
      it('should create config error as non-operational', () => {
        const error = new ConfigError('Invalid config');

        expect(error.message).toBe('Invalid config');
        expect(error.code).toBe('CONFIG_ERROR');
        expect(error.isOperational).toBe(false);
      });
    });

    describe('DatabaseError', () => {
      it('should create database error', () => {
        const error = new DatabaseError('DB connection failed');

        expect(error.message).toBe('DB connection failed');
        expect(error.code).toBe('DATABASE_ERROR');
        expect(error.isOperational).toBe(true);
      });
    });
  });

  describe('Validation Errors', () => {
    describe('ValidationError', () => {
      it('should create validation error with field', () => {
        const error = new ValidationError('Invalid email', 'email');

        expect(error.message).toBe('Invalid email');
        expect(error.field).toBe('email');
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.statusCode).toBe(400);
        expect(error.isOperational).toBe(false);
      });

      it('should create validation error without field', () => {
        const error = new ValidationError('Invalid data');

        expect(error.field).toBeUndefined();
      });
    });

    describe('DuplicateError', () => {
      it('should create duplicate error with 409 status', () => {
        const error = new DuplicateError('Email already exists', 'email');

        expect(error.message).toBe('Email already exists');
        expect(error.field).toBe('email');
        expect(error.code).toBe('DUPLICATE_ERROR');
        expect(error.statusCode).toBe(409);
      });
    });
  });

  describe('Auth Errors', () => {
    describe('AuthError', () => {
      it('should create auth error with 401 status', () => {
        const error = new AuthError('Authentication failed');

        expect(error.message).toBe('Authentication failed');
        expect(error.code).toBe('AUTH_ERROR');
        expect(error.statusCode).toBe(401);
      });
    });

    describe('UnauthorizedError', () => {
      it('should use default message', () => {
        const error = new UnauthorizedError();

        expect(error.message).toBe('Unauthorized');
        expect(error.code).toBe('UNAUTHORIZED');
      });

      it('should use custom message', () => {
        const error = new UnauthorizedError('Custom unauthorized');

        expect(error.message).toBe('Custom unauthorized');
      });
    });

    describe('InvalidCredentialsError', () => {
      it('should use default message', () => {
        const error = new InvalidCredentialsError();

        expect(error.message).toBe('Invalid email or password');
        expect(error.code).toBe('INVALID_CREDENTIALS');
      });
    });

    describe('TokenExpiredError', () => {
      it('should create token expired error', () => {
        const error = new TokenExpiredError();

        expect(error.message).toBe('Token has expired');
        expect(error.code).toBe('TOKEN_EXPIRED');
      });
    });

    describe('InvalidTokenError', () => {
      it('should create invalid token error', () => {
        const error = new InvalidTokenError();

        expect(error.message).toBe('Invalid token');
        expect(error.code).toBe('INVALID_TOKEN');
      });
    });

    describe('AccountLockedError', () => {
      it('should create account locked error with 423 status', () => {
        const lockedUntil = new Date();
        const error = new AccountLockedError('帳戶已被暫時鎖定', lockedUntil, 300);

        expect(error.message).toBe('帳戶已被暫時鎖定');
        expect(error.code).toBe('ACCOUNT_LOCKED');
        expect(error.statusCode).toBe(423);
        expect(error.lockedUntil).toBe(lockedUntil);
        expect(error.remainingSeconds).toBe(300);
      });
    });

    describe('TokenVersionMismatchError', () => {
      it('should create token version mismatch error', () => {
        const error = new TokenVersionMismatchError();

        expect(error.message).toBe('登入已過期，請重新登入');
        expect(error.code).toBe('TOKEN_VERSION_MISMATCH');
      });
    });
  });

  describe('Resource Errors', () => {
    describe('NotFoundError', () => {
      it('should create not found error with identifier', () => {
        const error = new NotFoundError('User', 'user-123');

        expect(error.message).toBe('User with identifier user-123 not found');
        expect(error.code).toBe('NOT_FOUND');
        expect(error.statusCode).toBe(404);
      });

      it('should create not found error without identifier', () => {
        const error = new NotFoundError('User');

        expect(error.message).toBe('User not found');
      });
    });

    describe('ForbiddenError', () => {
      it('should create forbidden error with 403 status', () => {
        const error = new ForbiddenError();

        expect(error.message).toBe('Forbidden');
        expect(error.code).toBe('FORBIDDEN');
        expect(error.statusCode).toBe(403);
      });
    });

    describe('BadRequestError', () => {
      it('should create bad request error with 400 status', () => {
        const error = new BadRequestError('Invalid request');

        expect(error.message).toBe('Invalid request');
        expect(error.code).toBe('BAD_REQUEST');
        expect(error.statusCode).toBe(400);
      });
    });

    describe('TooManyRequestsError', () => {
      it('should create too many requests error with 429 status', () => {
        const error = new TooManyRequestsError();

        expect(error.message).toBe('Too many requests');
        expect(error.code).toBe('TOO_MANY_REQUESTS');
        expect(error.statusCode).toBe(429);
      });
    });
  });

  describe('Position Errors', () => {
    describe('PositionError', () => {
      it('should create position error', () => {
        const error = new PositionError('Position failed');

        expect(error.message).toBe('Position failed');
        expect(error.code).toBe('POSITION_ERROR');
      });
    });

    describe('PositionOpenError', () => {
      it('should create position open error', () => {
        const error = new PositionOpenError('Failed to open position');

        expect(error.message).toBe('Failed to open position');
        expect(error.code).toBe('POSITION_OPEN_ERROR');
      });
    });

    describe('PositionCloseError', () => {
      it('should create position close error', () => {
        const error = new PositionCloseError('Failed to close position');

        expect(error.message).toBe('Failed to close position');
        expect(error.code).toBe('POSITION_CLOSE_ERROR');
      });
    });

    describe('PositionNotFoundError', () => {
      it('should create position not found error', () => {
        const error = new PositionNotFoundError('pos-abc');

        expect(error.message).toBe('Position with identifier pos-abc not found');
        expect(error.code).toBe('POSITION_NOT_FOUND');
        expect(error.statusCode).toBe(404);
      });
    });

    describe('InvalidPositionStateError', () => {
      it('should create invalid position state error', () => {
        const error = new InvalidPositionStateError('CLOSED', 'OPEN');

        expect(error.message).toBe('Invalid position state: expected OPEN, got CLOSED');
        expect(error.code).toBe('INVALID_POSITION_STATE');
        expect(error.statusCode).toBe(400);
      });
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error with 429 status', () => {
      const error = new RateLimitError('Rate limit exceeded', 60);

      expect(error.message).toBe('Rate limit exceeded');
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.statusCode).toBe(429);
      expect(error.context?.retryAfter).toBe(60);
    });
  });

  describe('Utility Functions', () => {
    describe('isAppError', () => {
      it('should return true for BaseError', () => {
        const error = new BaseError('Test', 'TEST');

        expect(isAppError(error)).toBe(true);
      });

      it('should return true for derived errors', () => {
        expect(isAppError(new ExchangeError('Test', 'binance'))).toBe(true);
        expect(isAppError(new TradingError('Test'))).toBe(true);
        expect(isAppError(new AuthError('Test'))).toBe(true);
      });

      it('should return false for native Error', () => {
        const error = new Error('Test');

        expect(isAppError(error)).toBe(false);
      });

      it('should return false for non-error values', () => {
        expect(isAppError('string')).toBe(false);
        expect(isAppError(123)).toBe(false);
        expect(isAppError(null)).toBe(false);
        expect(isAppError(undefined)).toBe(false);
        expect(isAppError({ message: 'fake error' })).toBe(false);
      });
    });

    describe('toAppError', () => {
      it('should return same error for BaseError', () => {
        const error = new BaseError('Test', 'TEST');

        const result = toAppError(error);

        expect(result).toBe(error);
      });

      it('should convert native Error to BaseError', () => {
        const error = new Error('Native error');

        const result = toAppError(error);

        expect(result).toBeInstanceOf(BaseError);
        expect(result.message).toBe('Native error');
        expect(result.code).toBe('INTERNAL_ERROR');
        expect(result.statusCode).toBe(500);
        expect(result.context?.originalError).toBe('Native error');
      });

      it('should convert string to BaseError', () => {
        const result = toAppError('String error');

        expect(result).toBeInstanceOf(BaseError);
        expect(result.message).toBe('An unknown error occurred');
        expect(result.code).toBe('UNKNOWN_ERROR');
        expect(result.context?.originalError).toBe('String error');
      });

      it('should convert number to BaseError', () => {
        const result = toAppError(404);

        expect(result).toBeInstanceOf(BaseError);
        expect(result.context?.originalError).toBe('404');
      });

      it('should convert null to BaseError', () => {
        const result = toAppError(null);

        expect(result).toBeInstanceOf(BaseError);
        expect(result.context?.originalError).toBe('null');
      });
    });
  });

  describe('ErrorHandler', () => {
    describe('isTrustedError', () => {
      it('should return true for operational errors', () => {
        const error = new BaseError('Test', 'TEST', 500, true);

        expect(ErrorHandler.isTrustedError(error)).toBe(true);
      });

      it('should return false for non-operational errors', () => {
        const error = new ConfigError('Config error');

        expect(ErrorHandler.isTrustedError(error)).toBe(false);
      });

      it('should return false for native errors', () => {
        const error = new Error('Native error');

        expect(ErrorHandler.isTrustedError(error)).toBe(false);
      });
    });
  });

  describe('Error Inheritance', () => {
    it('should maintain proper prototype chain', () => {
      const exchangeError = new ExchangeError('Test', 'binance');

      expect(exchangeError).toBeInstanceOf(Error);
      expect(exchangeError).toBeInstanceOf(BaseError);
      expect(exchangeError).toBeInstanceOf(ExchangeError);
    });

    it('should maintain prototype chain for deeply nested errors', () => {
      const connectionError = new ExchangeConnectionError('okx');

      expect(connectionError).toBeInstanceOf(Error);
      expect(connectionError).toBeInstanceOf(BaseError);
      expect(connectionError).toBeInstanceOf(ExchangeError);
      expect(connectionError).toBeInstanceOf(ExchangeConnectionError);
    });

    it('should maintain prototype chain for position errors', () => {
      const positionNotFound = new PositionNotFoundError('pos-123');

      expect(positionNotFound).toBeInstanceOf(Error);
      expect(positionNotFound).toBeInstanceOf(BaseError);
      expect(positionNotFound).toBeInstanceOf(NotFoundError);
      expect(positionNotFound).toBeInstanceOf(PositionNotFoundError);
    });
  });
});
