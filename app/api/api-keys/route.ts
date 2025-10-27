import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { ApiKeyService } from '@/src/services/apikey/ApiKeyService';
import { createApiKeySchema } from '@/src/lib/validation';
import { handleError } from '@/src/middleware/errorHandler';
import { authenticate } from '@/src/middleware/authMiddleware';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';
import { decrypt } from '@/src/lib/encryption';

const prisma = new PrismaClient();
const apiKeyService = new ApiKeyService(prisma);

/**
 * GET /api/api-keys
 * 查詢當前用戶的所有 API Keys
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    // 1. 驗證用戶身份
    const user = await authenticate(request);

    logger.info(
      {
        correlationId,
        userId: user.userId,
      },
      'Get API keys request received',
    );

    // 2. 查詢 API Keys
    const apiKeys = await apiKeyService.getUserApiKeys(user.userId);

    // 3. 轉換為 DTO（包含遮罩後的 Key）
    const apiKeysDTO = await Promise.all(
      apiKeys.map(async (apiKey) => {
        try {
          const decryptedKey = decrypt(apiKey.encryptedKey);
          return apiKey.toDTO(decryptedKey);
        } catch (error) {
          logger.error(
            {
              error,
              apiKeyId: apiKey.id,
            },
            'Failed to decrypt API key for DTO',
          );
          return apiKey.toDTO(); // 返回預設遮罩
        }
      }),
    );

    // 4. 返回結果
    const response = NextResponse.json(
      {
        success: true,
        data: {
          apiKeys: apiKeysDTO,
        },
      },
      { status: 200 },
    );

    response.headers.set('X-Correlation-Id', correlationId);

    return response;
  } catch (error) {
    return handleError(error, correlationId);
  }
}

/**
 * POST /api/api-keys
 * 新增 API Key
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    // 1. 驗證用戶身份
    const user = await authenticate(request);

    // 2. 解析請求 body
    const body = await request.json();

    // 3. 驗證請求資料
    const validatedData = createApiKeySchema.parse(body);

    logger.info(
      {
        correlationId,
        userId: user.userId,
        exchange: validatedData.exchange,
        label: validatedData.label,
      },
      'Create API key request received',
    );

    // 4. 建立 API Key
    const apiKey = await apiKeyService.createApiKey({
      userId: user.userId,
      exchange: validatedData.exchange,
      label: validatedData.label,
      apiKey: validatedData.apiKey,
      apiSecret: validatedData.apiSecret,
      passphrase: validatedData.passphrase,
    });

    // 5. 返回結果（包含遮罩後的 Key）
    const decryptedKey = decrypt(apiKey.encryptedKey);

    const response = NextResponse.json(
      {
        success: true,
        data: {
          apiKey: apiKey.toDTO(decryptedKey),
        },
      },
      { status: 201 },
    );

    response.headers.set('X-Correlation-Id', correlationId);

    logger.info(
      {
        correlationId,
        userId: user.userId,
        apiKeyId: apiKey.id,
      },
      'API key created successfully',
    );

    return response;
  } catch (error) {
    return handleError(error, correlationId);
  }
}
