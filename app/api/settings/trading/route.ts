/**
 * Trading Settings API
 *
 * GET /api/settings/trading - 獲取交易設定
 * PATCH /api/settings/trading - 更新交易設定
 *
 * Feature: 038-specify-scripts-bash (T028, T029)
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '@/src/middleware/errorHandler';
import { authenticate } from '@/src/middleware/authMiddleware';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';
import { tradingSettingsRepository } from '@/src/repositories/TradingSettingsRepository';
import { UpdateTradingSettingsSchema } from '@/src/types/trading';

/**
 * GET /api/settings/trading
 *
 * 獲取用戶的交易設定
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     defaultStopLossEnabled: true,
 *     defaultStopLossPercent: 5.0,
 *     defaultTakeProfitEnabled: false,
 *     defaultTakeProfitPercent: 3.0,
 *     defaultLeverage: 1,
 *     maxPositionSizeUSD: 10000
 *   }
 * }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    const user = await authenticate(request);

    logger.info(
      { correlationId, userId: user.userId },
      'Get trading settings request received',
    );

    const settings = await tradingSettingsRepository.getOrCreate(user.userId);
    const apiSettings = tradingSettingsRepository.toApiType(settings);

    logger.info(
      { correlationId, userId: user.userId },
      'Get trading settings request completed',
    );

    return NextResponse.json(
      {
        success: true,
        data: apiSettings,
      },
      { status: 200 },
    );
  } catch (error) {
    return handleError(error, correlationId);
  }
}

/**
 * PATCH /api/settings/trading
 *
 * 更新用戶的交易設定
 *
 * Request Body:
 * {
 *   defaultStopLossEnabled?: boolean,
 *   defaultStopLossPercent?: number,
 *   defaultTakeProfitEnabled?: boolean,
 *   defaultTakeProfitPercent?: number
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     defaultStopLossEnabled: true,
 *     defaultStopLossPercent: 5.0,
 *     ...
 *   }
 * }
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    const user = await authenticate(request);
    const body = await request.json();

    // 驗證請求體
    const validatedInput = UpdateTradingSettingsSchema.parse(body);

    logger.info(
      {
        correlationId,
        userId: user.userId,
        updates: Object.keys(validatedInput),
      },
      'Update trading settings request received',
    );

    const updatedSettings = await tradingSettingsRepository.update(
      user.userId,
      validatedInput,
    );
    const apiSettings = tradingSettingsRepository.toApiType(updatedSettings);

    logger.info(
      { correlationId, userId: user.userId },
      'Update trading settings request completed',
    );

    return NextResponse.json(
      {
        success: true,
        data: apiSettings,
      },
      { status: 200 },
    );
  } catch (error) {
    return handleError(error, correlationId);
  }
}
