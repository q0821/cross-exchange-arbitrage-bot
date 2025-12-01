import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { NotificationWebhookRepository } from '@/src/repositories/NotificationWebhookRepository';
import { UpdateWebhookSchema, validateWebhookUrl } from '@/src/models/NotificationWebhook';
import { handleError } from '@/src/middleware/errorHandler';
import { authenticate } from '@/src/middleware/authMiddleware';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';
import type { NotificationPlatform } from '@/src/services/notification/types';

const prisma = new PrismaClient();
const webhookRepository = new NotificationWebhookRepository(prisma);

/**
 * GET /api/notifications/webhooks/[id]
 * 取得單一 Webhook
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);
  const { id: webhookId } = await context.params;

  try {
    // 1. 驗證用戶身份
    const user = await authenticate(request);

    logger.info(
      {
        correlationId,
        userId: user.userId,
        webhookId,
      },
      'Get webhook request received'
    );

    // 2. 查詢 Webhook
    const webhook = await webhookRepository.findById(webhookId);

    if (!webhook) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not Found',
          message: '找不到指定的 Webhook',
        },
        { status: 404 }
      );
    }

    // 3. 驗證 Webhook 所有權
    if (webhook.userId !== user.userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden',
          message: '無權存取此 Webhook',
        },
        { status: 403 }
      );
    }

    // 4. 返回結果（不包含加密的 URL）
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
            notificationMinutes: webhook.notificationMinutes, // 通知時間
          },
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
 * PUT /api/notifications/webhooks/[id]
 * 更新 Webhook
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);
  const { id: webhookId } = await context.params;

  try {
    // 1. 驗證用戶身份
    const user = await authenticate(request);

    // 2. 解析請求 body
    const body = await request.json();

    // 3. 驗證請求資料
    const validatedData = UpdateWebhookSchema.parse(body);

    // 4. 查詢 Webhook
    const existingWebhook = await webhookRepository.findById(webhookId);

    if (!existingWebhook) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not Found',
          message: '找不到指定的 Webhook',
        },
        { status: 404 }
      );
    }

    // 5. 驗證 Webhook 所有權
    if (existingWebhook.userId !== user.userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden',
          message: '無權修改此 Webhook',
        },
        { status: 403 }
      );
    }

    // 6. 驗證 Webhook URL 格式（如果有更新 URL）
    if (validatedData.webhookUrl) {
      const urlValidation = validateWebhookUrl(
        existingWebhook.platform as NotificationPlatform,
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
    }

    logger.info(
      {
        correlationId,
        userId: user.userId,
        webhookId,
        updates: Object.keys(validatedData),
      },
      'Update webhook request received'
    );

    // 7. 更新 Webhook
    const updatedWebhook = await webhookRepository.update(webhookId, user.userId, validatedData);

    // 8. 返回結果
    const response = NextResponse.json(
      {
        success: true,
        data: {
          webhook: {
            id: updatedWebhook.id,
            platform: updatedWebhook.platform,
            name: updatedWebhook.name,
            isEnabled: updatedWebhook.isEnabled,
            threshold: updatedWebhook.threshold,
            notifyOnDisappear: updatedWebhook.notifyOnDisappear, // Feature 027
            notificationMinutes: updatedWebhook.notificationMinutes, // 通知時間
          },
        },
      },
      { status: 200 }
    );

    response.headers.set('X-Correlation-Id', correlationId);

    logger.info(
      {
        correlationId,
        userId: user.userId,
        webhookId,
      },
      'Webhook updated successfully'
    );

    return response;
  } catch (error) {
    return handleError(error, correlationId);
  }
}

/**
 * DELETE /api/notifications/webhooks/[id]
 * 刪除 Webhook
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);
  const { id: webhookId } = await context.params;

  try {
    // 1. 驗證用戶身份
    const user = await authenticate(request);

    logger.info(
      {
        correlationId,
        userId: user.userId,
        webhookId,
      },
      'Delete webhook request received'
    );

    // 2. 查詢 Webhook
    const webhook = await webhookRepository.findById(webhookId);

    if (!webhook) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not Found',
          message: '找不到指定的 Webhook',
        },
        { status: 404 }
      );
    }

    // 3. 驗證 Webhook 所有權
    if (webhook.userId !== user.userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden',
          message: '無權刪除此 Webhook',
        },
        { status: 403 }
      );
    }

    // 4. 刪除 Webhook
    await webhookRepository.delete(webhookId, user.userId);

    // 5. 返回結果
    const response = NextResponse.json(
      {
        success: true,
        data: {
          message: 'Webhook 已成功刪除',
        },
      },
      { status: 200 }
    );

    response.headers.set('X-Correlation-Id', correlationId);

    logger.info(
      {
        correlationId,
        userId: user.userId,
        webhookId,
      },
      'Webhook deleted successfully'
    );

    return response;
  } catch (error) {
    return handleError(error, correlationId);
  }
}
