import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { NotificationWebhookRepository } from '@/src/repositories/NotificationWebhookRepository';
import { CreateWebhookSchema, validateWebhookUrl } from '@/src/models/NotificationWebhook';
import { handleError } from '@/src/middleware/errorHandler';
import { authenticate } from '@/src/middleware/authMiddleware';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';
import type { NotificationPlatform } from '@/src/services/notification/types';

const prisma = new PrismaClient();
const webhookRepository = new NotificationWebhookRepository(prisma);

/**
 * GET /api/notifications/webhooks
 * 查詢當前用戶的所有 Webhooks
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
      'Get webhooks request received'
    );

    // 2. 查詢 Webhooks
    const webhooks = await webhookRepository.findByUserId(user.userId);

    // 3. 轉換為回應格式（不包含加密的 URL）
    const webhooksDTO = webhooks.map((webhook) => ({
      id: webhook.id,
      platform: webhook.platform,
      name: webhook.name,
      isEnabled: webhook.isEnabled,
      threshold: webhook.threshold,
      notifyOnDisappear: webhook.notifyOnDisappear, // Feature 027
      createdAt: new Date().toISOString(), // Repository 不返回日期，使用當前時間
      updatedAt: new Date().toISOString(),
    }));

    // 4. 返回結果
    const response = NextResponse.json(
      {
        success: true,
        data: {
          webhooks: webhooksDTO,
        },
      },
      { status: 200 }
    );

    response.headers.set('X-Correlation-Id', correlationId);

    return response;
  } catch (error) {
    return handleError(error, correlationId);
  }
}

/**
 * POST /api/notifications/webhooks
 * 新增 Webhook
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    // 1. 驗證用戶身份
    const user = await authenticate(request);

    // 2. 解析請求 body
    const body = await request.json();

    // 3. 驗證請求資料
    const validatedData = CreateWebhookSchema.parse(body);

    // 4. 驗證 Webhook URL 格式
    const urlValidation = validateWebhookUrl(
      validatedData.platform as NotificationPlatform,
      validatedData.webhookUrl
    );

    if (!urlValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Bad Request',
          message: urlValidation.error,
        },
        { status: 400 }
      );
    }

    logger.info(
      {
        correlationId,
        userId: user.userId,
        platform: validatedData.platform,
        name: validatedData.name,
      },
      'Create webhook request received'
    );

    // 5. 建立 Webhook
    const webhook = await webhookRepository.create(user.userId, {
      platform: validatedData.platform as NotificationPlatform,
      webhookUrl: validatedData.webhookUrl,
      name: validatedData.name,
      threshold: validatedData.threshold,
      notifyOnDisappear: validatedData.notifyOnDisappear, // Feature 027
    });

    // 6. 返回結果
    const response = NextResponse.json(
      {
        success: true,
        data: {
          webhook: {
            id: webhook.id,
            platform: webhook.platform,
            name: webhook.name,
            isEnabled: webhook.isEnabled,
            threshold: webhook.threshold,
            notifyOnDisappear: webhook.notifyOnDisappear, // Feature 027
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      },
      { status: 201 }
    );

    response.headers.set('X-Correlation-Id', correlationId);

    logger.info(
      {
        correlationId,
        userId: user.userId,
        webhookId: webhook.id,
      },
      'Webhook created successfully'
    );

    return response;
  } catch (error) {
    return handleError(error, correlationId);
  }
}
