/**
 * Test: Retry Utilities
 *
 * 重試機制單元測試
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  retry,
  retryApiCall,
  retryBatch,
  retryWithTimeout,
  retryUntil,
} from '@/lib/retry';
import { ExchangeRateLimitError } from '@/lib/errors';

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

describe('Retry Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('retry', () => {
    it('should return result on first successful attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const resultPromise = retry(fn);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on ExchangeRateLimitError', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new ExchangeRateLimitError('binance', 'Rate limit exceeded'))
        .mockResolvedValue('success');

      const resultPromise = retry(fn);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on retryable error messages', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue('success');

      const resultPromise = retry(fn);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on timeout error message', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Request timeout'))
        .mockResolvedValue('success');

      const resultPromise = retry(fn);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on rate limit error message', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Too many requests'))
        .mockResolvedValue('success');

      const resultPromise = retry(fn);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw immediately for non-retryable errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Invalid API key'));

      await expect(retry(fn)).rejects.toThrow('Invalid API key');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should throw after max attempts', async () => {
      const fn = vi.fn().mockRejectedValue(new ExchangeRateLimitError('okx', 'Rate limit'));

      const promise = retry(fn, { maxAttempts: 3 });
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow('Rate limit');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new ExchangeRateLimitError('binance', 'Rate limit'))
        .mockRejectedValueOnce(new ExchangeRateLimitError('binance', 'Rate limit'))
        .mockResolvedValue('success');

      const promise = retry(fn, {
        initialDelayMs: 100,
        backoffMultiplier: 2,
        maxAttempts: 3,
      });

      // First attempt fails immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);

      // Wait for first delay (100ms)
      await vi.advanceTimersByTimeAsync(100);
      expect(fn).toHaveBeenCalledTimes(2);

      // Wait for second delay (200ms)
      await vi.advanceTimersByTimeAsync(200);
      expect(fn).toHaveBeenCalledTimes(3);

      const result = await promise;
      expect(result).toBe('success');
    });

    it('should respect maxDelayMs', async () => {
      const { logger } = await import('@/lib/logger');
      const fn = vi.fn()
        .mockRejectedValueOnce(new ExchangeRateLimitError('binance', 'Rate limit'))
        .mockRejectedValueOnce(new ExchangeRateLimitError('binance', 'Rate limit'))
        .mockResolvedValue('success');

      const promise = retry(fn, {
        initialDelayMs: 1000,
        maxDelayMs: 1500,
        backoffMultiplier: 2,
        maxAttempts: 3,
      });

      await vi.runAllTimersAsync();
      await promise;

      // Second delay would be 2000ms but capped at 1500ms
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          delayMs: expect.any(Number),
        }),
        expect.any(String)
      );
    });

    it('should call onRetry callback', async () => {
      const onRetry = vi.fn();
      const fn = vi.fn()
        .mockRejectedValueOnce(new ExchangeRateLimitError('binance', 'Rate limit'))
        .mockResolvedValue('success');

      const promise = retry(fn, { onRetry });
      await vi.runAllTimersAsync();
      await promise;

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        expect.any(ExchangeRateLimitError),
        1
      );
    });

    it('should handle non-Error thrown values', async () => {
      const fn = vi.fn().mockRejectedValue('string error');

      await expect(retry(fn)).rejects.toThrow('string error');
    });

    it('should use custom retryableErrors', async () => {
      class CustomError extends Error {}

      const fn = vi.fn()
        .mockRejectedValueOnce(new CustomError('Custom error'))
        .mockResolvedValue('success');

      const promise = retry(fn, {
        retryableErrors: [CustomError],
      });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should log warning on retry', async () => {
      const { logger } = await import('@/lib/logger');
      const fn = vi.fn()
        .mockRejectedValueOnce(new ExchangeRateLimitError('binance', 'Rate limit'))
        .mockResolvedValue('success');

      const promise = retry(fn);
      await vi.runAllTimersAsync();
      await promise;

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Rate limit'),
          attempt: 1,
          maxAttempts: 3,
        }),
        expect.stringContaining('Retrying')
      );
    });
  });

  describe('retryApiCall', () => {
    it('should wrap API call with retry', async () => {
      const apiCall = vi.fn().mockResolvedValue({ data: 'test' });

      const resultPromise = retryApiCall(apiCall, 'binance', 'getBalance');
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toEqual({ data: 'test' });
      expect(apiCall).toHaveBeenCalledTimes(1);
    });

    it('should log with exchange and operation on retry', async () => {
      const { logger } = await import('@/lib/logger');
      const apiCall = vi.fn()
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValue({ data: 'test' });

      const promise = retryApiCall(apiCall, 'okx', 'fetchTicker');
      await vi.runAllTimersAsync();
      await promise;

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          exchange: 'okx',
          operation: 'fetchTicker',
          attempt: 1,
        }),
        expect.stringContaining('Retrying okx API call')
      );
    });

    it('should throw after max attempts', async () => {
      const apiCall = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const promise = retryApiCall(apiCall, 'gateio', 'getOrders');
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow('ECONNREFUSED');
      expect(apiCall).toHaveBeenCalledTimes(3);
    });
  });

  describe('retryBatch', () => {
    it('should execute all operations and return results', async () => {
      const operations = [
        vi.fn().mockResolvedValue('result1'),
        vi.fn().mockResolvedValue('result2'),
        vi.fn().mockResolvedValue('result3'),
      ];

      const resultsPromise = retryBatch(operations);
      await vi.runAllTimersAsync();
      const results = await resultsPromise;

      expect(results).toEqual(['result1', 'result2', 'result3']);
    });

    it('should return errors for failed operations', async () => {
      const operations = [
        vi.fn().mockResolvedValue('success'),
        vi.fn().mockRejectedValue(new Error('Failed')),
        vi.fn().mockResolvedValue('success2'),
      ];

      const resultsPromise = retryBatch(operations);
      await vi.runAllTimersAsync();
      const results = await resultsPromise;

      expect(results[0]).toBe('success');
      expect(results[1]).toBeInstanceOf(Error);
      expect((results[1] as Error).message).toBe('Failed');
      expect(results[2]).toBe('success2');
    });

    it('should retry individual operations', async () => {
      const op1 = vi.fn()
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValue('result1');
      const op2 = vi.fn().mockResolvedValue('result2');

      const resultsPromise = retryBatch([op1, op2]);
      await vi.runAllTimersAsync();
      const results = await resultsPromise;

      expect(results).toEqual(['result1', 'result2']);
      expect(op1).toHaveBeenCalledTimes(2);
      expect(op2).toHaveBeenCalledTimes(1);
    });

    it('should handle non-Error rejections', async () => {
      const operations = [
        vi.fn().mockRejectedValue('string error'),
      ];

      const resultsPromise = retryBatch(operations);
      await vi.runAllTimersAsync();
      const results = await resultsPromise;

      expect(results[0]).toBeInstanceOf(Error);
      expect((results[0] as Error).message).toBe('string error');
    });

    it('should use provided options', async () => {
      const op = vi.fn()
        .mockRejectedValueOnce(new ExchangeRateLimitError('binance', 'Rate limit'))
        .mockResolvedValue('success');

      const resultsPromise = retryBatch([op], { maxAttempts: 2 });
      await vi.runAllTimersAsync();
      const results = await resultsPromise;

      expect(results[0]).toBe('success');
      expect(op).toHaveBeenCalledTimes(2);
    });
  });

  describe('retryWithTimeout', () => {
    it('should return result before timeout', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const resultPromise = retryWithTimeout(fn, 5000);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('success');
    });

    it('should timeout if operation takes too long', async () => {
      const fn = vi.fn().mockImplementation(() => new Promise((resolve) => {
        setTimeout(() => resolve('success'), 10000);
      }));

      const promise = retryWithTimeout(fn, 1000);

      // Advance past timeout
      await vi.advanceTimersByTimeAsync(1001);

      await expect(promise).rejects.toThrow('Operation timed out after 1000ms');
    });

    it('should retry within timeout window', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue('success');

      const promise = retryWithTimeout(fn, 10000, { initialDelayMs: 100 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw original error if retry fails before timeout', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Non-retryable error'));

      const promise = retryWithTimeout(fn, 10000);
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow('Non-retryable error');
    });
  });

  describe('retryUntil', () => {
    it('should return when condition is met on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue(10);
      const condition = (result: number) => result > 5;

      const resultPromise = retryUntil(fn, condition);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe(10);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry until condition is met', async () => {
      let counter = 0;
      const fn = vi.fn().mockImplementation(() => Promise.resolve(++counter));
      const condition = (result: number) => result >= 3;

      const promise = retryUntil(fn, condition, { maxAttempts: 5, initialDelayMs: 100 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe(3);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max attempts if condition never met', async () => {
      const fn = vi.fn().mockResolvedValue(1);
      const condition = (result: number) => result > 100;

      const promise = retryUntil(fn, condition, { maxAttempts: 3, initialDelayMs: 100 });
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow('Condition not met after 3 attempts');
    });

    it('should throw immediately on error', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('API Error'));
      const condition = () => true;

      const promise = retryUntil(fn, condition);
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow('API Error');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should use exponential backoff', async () => {
      let counter = 0;
      const fn = vi.fn().mockImplementation(() => Promise.resolve(++counter));
      const condition = (result: number) => result >= 3;

      const promise = retryUntil(fn, condition, {
        maxAttempts: 5,
        initialDelayMs: 100,
        backoffMultiplier: 2,
      });

      // First attempt
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);

      // Wait for first delay (100ms)
      await vi.advanceTimersByTimeAsync(100);
      expect(fn).toHaveBeenCalledTimes(2);

      // Wait for second delay (200ms)
      await vi.advanceTimersByTimeAsync(200);
      expect(fn).toHaveBeenCalledTimes(3);

      const result = await promise;
      expect(result).toBe(3);
    });

    it('should log debug message when condition not met', async () => {
      const { logger } = await import('@/lib/logger');
      let counter = 0;
      const fn = vi.fn().mockImplementation(() => Promise.resolve(++counter));
      const condition = (result: number) => result >= 2;

      const promise = retryUntil(fn, condition, { maxAttempts: 3, initialDelayMs: 100 });
      await vi.runAllTimersAsync();
      await promise;

      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          attempt: 1,
          maxAttempts: 3,
        }),
        expect.stringContaining('Condition not met')
      );
    });

    it('should include last result in error message', async () => {
      const fn = vi.fn().mockResolvedValue({ status: 'pending' });
      const condition = (result: { status: string }) => result.status === 'done';

      const promise = retryUntil(fn, condition, { maxAttempts: 2, initialDelayMs: 100 });
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow('{"status":"pending"}');
    });

    it('should handle non-Error thrown values', async () => {
      const fn = vi.fn().mockRejectedValue('string error');
      const condition = () => true;

      const promise = retryUntil(fn, condition);
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow('string error');
    });
  });

  describe('Retryable Error Messages', () => {
    const retryableMessages = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNREFUSED',
      'Request timeout',
      'rate limit exceeded',
      'Too Many Requests',
    ];

    retryableMessages.forEach((message) => {
      it(`should retry on "${message}" error`, async () => {
        const fn = vi.fn()
          .mockRejectedValueOnce(new Error(message))
          .mockResolvedValue('success');

        const promise = retry(fn);
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
      });
    });
  });
});
