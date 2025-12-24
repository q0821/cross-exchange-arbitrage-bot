/**
 * Revalidate Saved API Key Endpoint
 *
 * POST /api/api-keys/[id]/test
 * Revalidate an existing saved API key (T029-T032)
 *
 * Feature: 042-api-key-connection-test
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { authenticate } from '@/src/middleware/authMiddleware';
import { handleError } from '@/src/middleware/errorHandler';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';
import { ApiKeyService } from '@/src/services/apikey/ApiKeyService';
import { apiKeyValidator } from '@/src/services/apikey/ApiKeyValidator';
import type { ConnectionTestResponse } from '@/src/types/api-key-validation';

const apiKeyService = new ApiKeyService(prisma);

// Timeout configuration: 15 seconds for backend
const VALIDATION_TIMEOUT_MS = 15000;

/**
 * POST /api/api-keys/[id]/test
 * Revalidate an existing saved API key
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);
  const startTime = Date.now();
  const apiKeyId = params.id;

  try {
    // 1. Authenticate user
    const user = await authenticate(request);

    logger.info(
      {
        correlationId,
        userId: user.userId,
        apiKeyId,
      },
      'Revalidate API key request received',
    );

    // 2. Get API key with permission check (T027)
    const apiKey = await apiKeyService.getApiKeyById(apiKeyId, user.userId);

    // 3. Decrypt API key credentials
    const decrypted = await apiKeyService.decryptApiKey(apiKeyId, user.userId);

    // 4. Validate exchange type
    const exchange = apiKey.exchange as 'binance' | 'okx' | 'gateio' | 'mexc';
    const supportedExchanges = ['binance', 'okx', 'gateio', 'mexc'];

    if (!supportedExchanges.includes(exchange)) {
      return NextResponse.json(
        {
          success: true,
          data: {
            isValid: false,
            hasReadPermission: false,
            hasTradePermission: false,
          },
          error: {
            code: 'EXCHANGE_ERROR',
            message: `Exchange ${exchange} is not supported for validation`,
          },
        },
        { status: 200 },
      );
    }

    logger.info(
      {
        correlationId,
        userId: user.userId,
        apiKeyId,
        exchange,
        environment: apiKey.environment,
      },
      'API key revalidation started',
    );

    // 5. Execute validation with timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Validation timeout'));
      }, VALIDATION_TIMEOUT_MS);
    });

    const validationPromise = apiKeyValidator.validateApiKey({
      exchange,
      apiKey: decrypted.apiKey,
      apiSecret: decrypted.apiSecret,
      passphrase: decrypted.passphrase,
      environment: apiKey.environment as 'MAINNET' | 'TESTNET',
    });

    const result = await Promise.race([validationPromise, timeoutPromise]);

    const responseTime = Date.now() - startTime;

    // 6. Update lastValidatedAt if validation succeeded (T026, T031)
    if (result.isValid) {
      await apiKeyService.markAsValidated(apiKeyId, user.userId);
    }

    // 7. Build response
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
        apiKeyId,
        exchange,
        isValid: result.isValid,
        hasReadPermission: result.hasReadPermission,
        hasTradePermission: result.hasTradePermission,
        responseTime,
      },
      'API key revalidation completed',
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
          apiKeyId,
          responseTime,
        },
        'API key revalidation timeout',
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
