/**
 * User Preferences API
 *
 * GET /api/settings/preferences - 獲取用戶偏好設定
 * PATCH /api/settings/preferences - 更新用戶偏好設定
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '@/src/middleware/errorHandler';
import { authenticate } from '@/src/middleware/authMiddleware';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';
import { z } from 'zod';
import { prisma } from '@/src/lib/db';

// 有效的 timeBasis 值
const VALID_TIME_BASIS = [1, 4, 8, 24] as const;

// 更新偏好設定的驗證 Schema
const UpdatePreferencesSchema = z.object({
  timeBasisPreference: z.number().refine(
    (val) => VALID_TIME_BASIS.includes(val as typeof VALID_TIME_BASIS[number]),
    { message: 'timeBasisPreference must be 1, 4, 8, or 24' }
  ).optional(),
});

/**
 * GET /api/settings/preferences
 *
 * 獲取用戶的偏好設定
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     timeBasisPreference: 8
 *   }
 * }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    const user = await authenticate(request);

    logger.info(
      { correlationId, userId: user.userId },
      'Get user preferences request received',
    );

    const userData = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { timeBasisPreference: true },
    });

    if (!userData) {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'User not found' },
        },
        { status: 404 },
      );
    }

    logger.info(
      { correlationId, userId: user.userId },
      'Get user preferences request completed',
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          timeBasisPreference: userData.timeBasisPreference,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return handleError(error, correlationId);
  }
}

/**
 * PATCH /api/settings/preferences
 *
 * 更新用戶的偏好設定
 *
 * Request Body:
 * {
 *   timeBasisPreference?: number  // 1, 4, 8, or 24
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     timeBasisPreference: 8
 *   }
 * }
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    const user = await authenticate(request);
    const body = await request.json();

    // 驗證請求體
    const validatedInput = UpdatePreferencesSchema.parse(body);

    // 如果沒有任何更新，直接返回當前值
    if (Object.keys(validatedInput).length === 0) {
      const userData = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { timeBasisPreference: true },
      });

      return NextResponse.json(
        {
          success: true,
          data: {
            timeBasisPreference: userData?.timeBasisPreference ?? 8,
          },
        },
        { status: 200 },
      );
    }

    logger.info(
      {
        correlationId,
        userId: user.userId,
        updates: validatedInput,
      },
      'Update user preferences request received',
    );

    const updatedUser = await prisma.user.update({
      where: { id: user.userId },
      data: validatedInput,
      select: { timeBasisPreference: true },
    });

    logger.info(
      { correlationId, userId: user.userId },
      'Update user preferences request completed',
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          timeBasisPreference: updatedUser.timeBasisPreference,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return handleError(error, correlationId);
  }
}
