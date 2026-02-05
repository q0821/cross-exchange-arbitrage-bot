/**
 * POST /api/positions/open
 *
 * 執行雙邊開倉操作
 * Feature: 033-manual-open-position (T010)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { Decimal } from 'decimal.js';
import { handleError } from '@/src/middleware/errorHandler';
import { authenticate } from '@/src/middleware/authMiddleware';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';
import { PositionOrchestrator } from '@/src/services/trading/PositionOrchestrator';
import { AuditLogger } from '@/src/services/trading/AuditLogger';
import { positionProgressEmitter } from '@/src/services/websocket/PositionProgressEmitter';
import {
  OpenPositionRequestSchema,
  StopLossTakeProfitSchema,
  type OpenPositionResponse,
  type PositionInfo,
} from '@/src/types/trading';
import {
  TradingError,
  LockConflictError,
  InsufficientBalanceError,
  RollbackFailedError,
  formatErrorForResponse,
} from '@/src/lib/errors/trading-errors';

/**
 * POST /api/positions/open
 *
 * Request Body:
 * {
 *   symbol: "BTCUSDT",
 *   longExchange: "binance",
 *   shortExchange: "okx",
 *   quantity: 0.1,
 *   leverage: 1
 * }
 *
 * Response (Success):
 * {
 *   success: true,
 *   data: {
 *     position: { ... },
 *     trades: [ ... ],
 *     message: "開倉成功"
 *   }
 * }
 *
 * Response (Error):
 * {
 *   success: false,
 *   error: {
 *     code: "INSUFFICIENT_BALANCE",
 *     message: "餘額不足",
 *     details: { ... }
 *   }
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);
  const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;

  try {
    // 1. 驗證用戶身份
    const user = await authenticate(request);

    // 2. 解析並驗證請求體
    const body = await request.json();
    const validatedInput = OpenPositionRequestSchema.parse(body);

    // 驗證停損停利參數 (Feature 038)
    const stopLossTakeProfitInput = StopLossTakeProfitSchema.parse({
      stopLossEnabled: body.stopLossEnabled ?? false,
      stopLossPercent: body.stopLossPercent,
      takeProfitEnabled: body.takeProfitEnabled ?? false,
      takeProfitPercent: body.takeProfitPercent,
    });

    const { symbol, longExchange, shortExchange, quantity, leverage, groupId } = validatedInput;
    const { stopLossEnabled, stopLossPercent, takeProfitEnabled, takeProfitPercent } =
      stopLossTakeProfitInput;

    logger.info(
      {
        correlationId,
        userId: user.userId,
        symbol,
        longExchange,
        shortExchange,
        quantity,
        leverage,
        stopLossEnabled,
        stopLossPercent,
        takeProfitEnabled,
        takeProfitPercent,
        groupId,
      },
      'Open position request received',
    );

    // 3. 記錄審計日誌 - 開始
    const auditLogger = new AuditLogger(prisma);
    // Note: positionId 會在 orchestrator 中創建後更新

    // 4. 執行開倉 (含停損停利設定)
    const orchestrator = new PositionOrchestrator(prisma);

    const position = await orchestrator.openPosition({
      userId: user.userId,
      symbol,
      longExchange,
      shortExchange,
      quantity: new Decimal(quantity),
      leverage,
      // 停損停利參數 (Feature 038)
      stopLossEnabled,
      stopLossPercent,
      takeProfitEnabled,
      takeProfitPercent,
      // 分單開倉組別 ID (Feature 069)
      groupId,
    });

    // 5. 記錄審計日誌 - 成功
    await auditLogger.logPositionOpenSuccess(
      user.userId,
      position.id,
      symbol,
      longExchange,
      shortExchange,
      quantity.toString(),
      position.longOrderId || '',
      position.shortOrderId || '',
      position.longEntryPrice.toString(),
      position.shortEntryPrice.toString(),
      '0', // fee - 需要從 trade 記錄獲取
      '0',
      ipAddress || undefined,
    );

    // 6. 發送 WebSocket 成功事件
    if (positionProgressEmitter.isInitialized()) {
      positionProgressEmitter.emitSuccess(
        position.id,
        {
          exchange: longExchange,
          orderId: position.longOrderId || '',
          price: position.longEntryPrice.toString(),
          quantity: position.longPositionSize.toString(),
          fee: '0',
        },
        {
          exchange: shortExchange,
          orderId: position.shortOrderId || '',
          price: position.shortEntryPrice.toString(),
          quantity: position.shortPositionSize.toString(),
          fee: '0',
        },
      );
    }

    // 7. 格式化回應（含停損停利資訊 Feature 038, 分單開倉 Feature 069）
    const positionInfo: PositionInfo = {
      id: position.id,
      userId: position.userId,
      symbol: position.symbol,
      longExchange: position.longExchange as any,
      shortExchange: position.shortExchange as any,
      leverage: position.longLeverage,
      status: position.status as any,
      createdAt: position.createdAt.toISOString(),
      updatedAt: position.updatedAt.toISOString(),
      // 停損停利資訊 (Feature 038)
      stopLossEnabled: position.stopLossEnabled,
      stopLossPercent: position.stopLossPercent ? Number(position.stopLossPercent) : undefined,
      takeProfitEnabled: position.takeProfitEnabled,
      takeProfitPercent: position.takeProfitPercent ? Number(position.takeProfitPercent) : undefined,
      conditionalOrderStatus: position.conditionalOrderStatus as any,
      conditionalOrderError: position.conditionalOrderError,
      longStopLossPrice: position.longStopLossPrice ? Number(position.longStopLossPrice) : null,
      shortStopLossPrice: position.shortStopLossPrice ? Number(position.shortStopLossPrice) : null,
      longTakeProfitPrice: position.longTakeProfitPrice ? Number(position.longTakeProfitPrice) : null,
      shortTakeProfitPrice: position.shortTakeProfitPrice ? Number(position.shortTakeProfitPrice) : null,
      // 分單開倉組別 (Feature 069)
      groupId: position.groupId ?? position.id,
    };

    const response: OpenPositionResponse = {
      success: true,
      position: positionInfo,
      trades: [], // 目前不返回單獨的 trade 記錄
      message: '開倉成功',
    };

    logger.info(
      {
        correlationId,
        userId: user.userId,
        positionId: position.id,
        status: position.status,
      },
      'Open position request completed successfully',
    );

    return NextResponse.json(
      {
        success: true,
        data: response,
      },
      { status: 201 },
    );
  } catch (error) {
    // 處理特定錯誤類型
    if (error instanceof LockConflictError) {
      logger.warn(
        { correlationId, error: error.message },
        'Position lock conflict',
      );

      return NextResponse.json(
        {
          success: false,
          error: formatErrorForResponse(error),
        },
        { status: 409 }, // Conflict
      );
    }

    if (error instanceof InsufficientBalanceError) {
      logger.warn(
        { correlationId, error: error.message, details: error.details },
        'Insufficient balance',
      );

      return NextResponse.json(
        {
          success: false,
          error: formatErrorForResponse(error),
        },
        { status: 400 },
      );
    }

    if (error instanceof RollbackFailedError) {
      logger.error(
        { correlationId, error: error.message, details: error.details },
        'Rollback failed - manual intervention required',
      );

      // 發送 WebSocket 回滾失敗事件
      if (positionProgressEmitter.isInitialized()) {
        positionProgressEmitter.emitRollbackFailed(
          (error.details as any)?.positionId || 'unknown',
          error.exchange,
          error.orderId,
          error.side,
          error.quantity,
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: {
            ...formatErrorForResponse(error),
            requiresManualIntervention: true,
          },
        },
        { status: 500 },
      );
    }

    if (error instanceof TradingError) {
      logger.warn(
        { correlationId, error: error.message, code: error.code },
        'Trading error',
      );

      return NextResponse.json(
        {
          success: false,
          error: formatErrorForResponse(error),
        },
        { status: 400 },
      );
    }

    // 其他錯誤 - 詳細記錄以便調試
    logger.error(
      {
        correlationId,
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      },
      'Open position failed with unexpected error',
    );
    return handleError(error, correlationId);
  }
}
