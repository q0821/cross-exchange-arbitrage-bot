import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { ApiKeyService } from '@/src/services/apikey/ApiKeyService';
import { updateApiKeySchema } from '@/src/lib/validation';
import { handleError } from '@/src/middleware/errorHandler';
import { authenticate } from '@/src/middleware/authMiddleware';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';
import { decrypt } from '@/src/lib/encryption';

const apiKeyService = new ApiKeyService(prisma);

/**
 * GET /api/api-keys/[id]
 * 查詢特定 API Key 詳情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    // 1. 驗證用戶身份
    const user = await authenticate(request);

    const apiKeyId = params.id;

    logger.info(
      {
        correlationId,
        userId: user.userId,
        apiKeyId,
      },
      'Get API key details request received',
    );

    // 2. 查詢 API Key（會自動驗證權限）
    const apiKey = await apiKeyService.getApiKeyById(apiKeyId, user.userId);

    // 3. 轉換為 DTO
    const decryptedKey = decrypt(apiKey.encryptedKey);

    const response = NextResponse.json(
      {
        success: true,
        data: {
          apiKey: apiKey.toDTO(decryptedKey),
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
 * PATCH /api/api-keys/[id]
 * 更新 API Key（label 和啟用/停用狀態）
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    // 1. 驗證用戶身份
    const user = await authenticate(request);

    const apiKeyId = params.id;

    // 2. 解析並驗證請求 body
    const body = await request.json();
    const validatedData = updateApiKeySchema.parse(body);

    logger.info(
      {
        correlationId,
        userId: user.userId,
        apiKeyId,
        updates: validatedData,
      },
      'Update API key request received',
    );

    // 3. 更新 API Key
    const apiKey = await apiKeyService.updateApiKey(apiKeyId, user.userId, validatedData);

    // 4. 返回結果
    const decryptedKey = decrypt(apiKey.encryptedKey);

    const response = NextResponse.json(
      {
        success: true,
        data: {
          apiKey: apiKey.toDTO(decryptedKey),
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
 * DELETE /api/api-keys/[id]
 * 刪除 API Key
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    // 1. 驗證用戶身份
    const user = await authenticate(request);

    const apiKeyId = params.id;

    logger.info(
      {
        correlationId,
        userId: user.userId,
        apiKeyId,
      },
      'Delete API key request received',
    );

    // 2. 刪除 API Key（會自動驗證權限）
    await apiKeyService.deleteApiKey(apiKeyId, user.userId);

    // 3. 返回結果
    const response = NextResponse.json(
      {
        success: true,
        data: {
          message: 'API key deleted successfully',
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
