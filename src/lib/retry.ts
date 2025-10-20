import { logger } from './logger.js';
import { ExchangeRateLimitError } from './errors.js';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: Array<{ new (...args: never[]): Error }>;
  onRetry?: (error: Error, attempt: number) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: [ExchangeRateLimitError],
};

/**
 * 重試執行函式，支援指數退避策略
 * @param fn 要執行的非同步函式
 * @param options 重試選項
 * @returns 函式執行結果
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 檢查是否為可重試的錯誤
      const isRetryable = isRetryableError(lastError, opts.retryableErrors);

      if (!isRetryable || attempt === opts.maxAttempts) {
        throw lastError;
      }

      // 計算延遲時間 (指數退避)
      const delayMs = Math.min(
        opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1),
        opts.maxDelayMs
      );

      logger.warn({
        error: lastError.message,
        delayMs,
        attempt,
        maxAttempts: opts.maxAttempts,
      }, `Retrying after error (attempt ${attempt}/${opts.maxAttempts})`);

      // 執行重試回調
      if (options.onRetry) {
        options.onRetry(lastError, attempt);
      }

      // 等待後重試
      await sleep(delayMs);
    }
  }

  throw lastError;
}

/**
 * 檢查錯誤是否可重試
 */
function isRetryableError(
  error: Error,
  retryableErrors: Array<{ new (...args: never[]): Error }>
): boolean {
  // 檢查是否為指定的可重試錯誤類型
  for (const ErrorClass of retryableErrors) {
    if (error instanceof ErrorClass) {
      return true;
    }
  }

  // 檢查常見的可重試錯誤訊息
  const retryableMessages = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ECONNREFUSED',
    'timeout',
    'rate limit',
    'too many requests',
  ];

  return retryableMessages.some((msg) =>
    error.message.toLowerCase().includes(msg.toLowerCase())
  );
}

/**
 * 延遲執行
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 帶重試的 API 請求包裝器
 */
export async function retryApiCall<T>(
  apiCall: () => Promise<T>,
  exchange: string,
  operation: string
): Promise<T> {
  return retry(apiCall, {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    onRetry: (error, attempt) => {
      logger.warn({
        exchange,
        operation,
        attempt,
        error: error.message,
      }, `Retrying ${exchange} API call: ${operation}`);
    },
  });
}

/**
 * 批次重試 (適用於多個獨立的操作)
 */
export async function retryBatch<T>(
  operations: Array<() => Promise<T>>,
  options: RetryOptions = {}
): Promise<Array<T | Error>> {
  const results = await Promise.allSettled(
    operations.map((op) => retry(op, options))
  );

  return results.map((result) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return result.reason instanceof Error
        ? result.reason
        : new Error(String(result.reason));
    }
  });
}

/**
 * 帶超時的重試
 */
export async function retryWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  options: RetryOptions = {}
): Promise<T> {
  return Promise.race([
    retry(fn, options),
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Operation timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}

/**
 * 條件式重試 (根據回傳結果決定是否重試)
 */
export async function retryUntil<T>(
  fn: () => Promise<T>,
  condition: (result: T) => boolean,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastResult: T | undefined;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      lastResult = await fn();

      if (condition(lastResult)) {
        return lastResult;
      }

      if (attempt < opts.maxAttempts) {
        const delayMs = Math.min(
          opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1),
          opts.maxDelayMs
        );

        logger.debug({
          delayMs,
          attempt,
          maxAttempts: opts.maxAttempts,
        }, `Condition not met, retrying (attempt ${attempt}/${opts.maxAttempts})`);

        await sleep(delayMs);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw err;
    }
  }

  throw new Error(
    `Condition not met after ${opts.maxAttempts} attempts. Last result: ${JSON.stringify(lastResult)}`
  );
}

export default retry;
