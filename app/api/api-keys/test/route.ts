/**
 * API Key Connection Test Endpoint
 *
 * POST /api/api-keys/test
 * Test API key connectivity before saving (FR-010, FR-012)
 *
 * Feature: 042-api-key-connection-test
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate } from '@/src/middleware/authMiddleware';
import { handleError } from '@/src/middleware/errorHandler';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';
import { apiKeyValidator } from '@/src/services/apikey/ApiKeyValidator';
import type { ConnectionTestResponse, ValidationErrorCode } from '@/src/types/api-key-validation';

// Request validation schema (T017)
const connectionTestSchema = z.object({
  exchange: z.enum(['binance', 'okx', 'gateio', 'mexc']),
  environment: z.enum(['MAINNET', 'TESTNET']),
  apiKey: z.string().min(1, 'API Key is required'),
  apiSecret: z.string().min(1, 'API Secret is required'),
  passphrase: z.string().optional(),
});

// Timeout configuration: 15 seconds for backend (T017)
const VALIDATION_TIMEOUT_MS = 15000;

/**
 * POST /api/api-keys/test
 * Test API key connection without saving
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);
  const startTime = Date.now();

  try {
    // 1. Authenticate user
    const user = await authenticate(request);

    // 2. Parse and validate request body
    const body = await request.json();
    const validationResult = connectionTestSchema.safeParse(body);

    if (!validationResult.success) {
      logger.warn(
        {
          correlationId,
          userId: user.userId,
          errors: validationResult.error.errors,
        },
        'Invalid connection test request',
      );

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: validationResult.error.errors[0]?.message || 'Invalid request body',
          },
        },
        { status: 400 },
      );
    }

    const { exchange, environment, apiKey, apiSecret, passphrase } = validationResult.data;

    // 3. OKX requires passphrase
    if (exchange === 'okx' && !passphrase) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PASSPHRASE' as ValidationErrorCode,
            message: 'OKX requires a passphrase',
          },
        },
        { status: 400 },
      );
    }

    logger.info(
      {
        correlationId,
        userId: user.userId,
        exchange,
        environment,
      },
      'API key validation started',
    );

    // 4. Execute validation with timeout (T017)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Validation timeout'));
      }, VALIDATION_TIMEOUT_MS);
    });

    const validationPromise = apiKeyValidator.validateApiKey({
      exchange,
      apiKey,
      apiSecret,
      passphrase,
      environment,
    });

    const result = await Promise.race([validationPromise, timeoutPromise]);

    const responseTime = Date.now() - startTime;

    // 5. Build response (T018)
    const response: ConnectionTestResponse = {
      success: true,
      data: {
        isValid: result.isValid,
        hasReadPermission: result.hasReadPermission,
        hasTradePermission: result.hasTradePermission,
        details: result.details
          ? {
              balance: result.details.balance,
              permissions: result.details.permissions,
              responseTime,
            }
          : undefined,
      },
    };

    // Include error info if validation failed
    if (!result.isValid && result.error) {
      response.error = {
        code: result.errorCode || 'UNKNOWN_ERROR',
        message: result.error,
      };
    }

    logger.info(
      {
        correlationId,
        userId: user.userId,
        exchange,
        environment,
        isValid: result.isValid,
        hasReadPermission: result.hasReadPermission,
        hasTradePermission: result.hasTradePermission,
        responseTime,
      },
      'API key validation completed',
    );

    const nextResponse = NextResponse.json(response, { status: 200 });
    nextResponse.headers.set('X-Correlation-Id', correlationId);

    return nextResponse;
  } catch (error: any) {
    const responseTime = Date.now() - startTime;

    // Handle timeout specifically
    if (error.message === 'Validation timeout') {
      logger.error(
        {
          correlationId,
          responseTime,
        },
        'API key validation timeout',
      );

      const response: ConnectionTestResponse = {
        success: true,
        data: {
          isValid: false,
          hasReadPermission: false,
          hasTradePermission: false,
        },
        error: {
          code: 'TIMEOUT',
          message: 'Connection test timed out. Please try again.',
        },
      };

      return NextResponse.json(response, { status: 408 });
    }

    return handleError(error, correlationId);
  }
}
