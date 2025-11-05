import { NextResponse } from 'next/server';
import { BaseError, toAppError } from '@lib/errors';
import { logger } from '@lib/logger';
import { ZodError } from 'zod';

/**
 * 錯誤處理中介軟體
 * 統一處理錯誤並回傳標準格式
 */

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    correlationId?: string;
  };
}

/**
 * 處理 Zod 驗證錯誤
 */
function handleZodError(error: ZodError, correlationId?: string): NextResponse<ErrorResponse> {
  const details = error.errors.map((err) => ({
    path: err.path.join('.'),
    message: err.message,
  }));

  logger.warn(
    {
      correlationId,
      code: 'VALIDATION_ERROR',
      details,
    },
    'Validation error',
  );

  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details,
        correlationId,
      },
    },
    { status: 400 },
  );
}

/**
 * 處理應用錯誤
 */
function handleAppError(error: BaseError, correlationId?: string): NextResponse<ErrorResponse> {
  // 記錄錯誤
  const logContext = {
    correlationId,
    code: error.code,
    statusCode: error.statusCode,
    context: error.context,
  };

  if (error.statusCode >= 500) {
    logger.error(logContext, error.message);
  } else {
    logger.warn(logContext, error.message);
  }

  return NextResponse.json(
    {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.context,
        correlationId,
      },
    },
    { status: error.statusCode },
  );
}

/**
 * 處理未知錯誤
 */
function handleUnknownError(error: unknown, correlationId?: string): NextResponse<ErrorResponse> {
  const appError = toAppError(error);

  logger.error(
    {
      correlationId,
      code: appError.code,
      context: appError.context,
      stack: error instanceof Error ? error.stack : undefined,
    },
    appError.message,
  );

  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        correlationId,
      },
    },
    { status: 500 },
  );
}

/**
 * 統一錯誤處理函式
 */
export function handleError(error: unknown, correlationId?: string): NextResponse<ErrorResponse> {
  // Zod 驗證錯誤
  if (error instanceof ZodError) {
    return handleZodError(error, correlationId);
  }

  // 應用錯誤
  if (error instanceof BaseError) {
    return handleAppError(error, correlationId);
  }

  // 未知錯誤
  return handleUnknownError(error, correlationId);
}

/**
 * 錯誤處理中介軟體包裝函式
 */
export function withErrorHandler<T>(
  handler: (...args: unknown[]) => Promise<T>,
  correlationId?: string,
): (...args: unknown[]) => Promise<T | NextResponse<ErrorResponse>> {
  return async (...args: unknown[]): Promise<T | NextResponse<ErrorResponse>> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleError(error, correlationId);
    }
  };
}
