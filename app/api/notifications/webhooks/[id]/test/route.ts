import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { NotificationWebhookRepository } from '@/src/repositories/NotificationWebhookRepository';
import { DiscordNotifier } from '@/src/services/notification/DiscordNotifier';
import { SlackNotifier } from '@/src/services/notification/SlackNotifier';
import { handleError } from '@/src/middleware/errorHandler';
import { authenticate } from '@/src/middleware/authMiddleware';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';

const prisma = new PrismaClient();
const webhookRepository = new NotificationWebhookRepository(prisma);
const discordNotifier = new DiscordNotifier();
const slackNotifier = new SlackNotifier();

/**
 * POST /api/notifications/webhooks/[id]/test
 * 測試 Webhook 連線
 */
export async function POST(
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
      'Test webhook request received'
    );

    // 2. 查詢 Webhook（需要解密 URL 用於發送測試）
    const webhook = await webhookRepository.findById(webhookId, true);

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

    // 4. 發送測試通知
    let result;
    if (webhook.platform === 'discord') {
      result = await discordNotifier.sendTestNotification(webhook.webhookUrl);
    } else if (webhook.platform === 'slack') {
      result = await slackNotifier.sendTestNotification(webhook.webhookUrl);
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Bad Request',
          message: `不支援的平台: ${webhook.platform}`,
        },
        { status: 400 }
      );
    }

    // 5. 返回結果
    if (result.success) {
      logger.info(
        {
          correlationId,
          userId: user.userId,
          webhookId,
          platform: webhook.platform,
        },
        'Test notification sent successfully'
      );

      const response = NextResponse.json(
        {
          success: true,
          data: {
            message: '測試通知已發送，請檢查您的頻道',
            timestamp: result.timestamp.toISOString(),
          },
        },
        { status: 200 }
      );

      response.headers.set('X-Correlation-Id', correlationId);
      return response;
    } else {
      logger.warn(
        {
          correlationId,
          userId: user.userId,
          webhookId,
          error: result.error,
        },
        'Test notification failed'
      );

      return NextResponse.json(
        {
          success: false,
          error: 'Service Unavailable',
          message: result.error || '發送測試通知失敗',
        },
        { status: 503 }
      );
    }
  } catch (error) {
    return handleError(error, correlationId);
  }
}
