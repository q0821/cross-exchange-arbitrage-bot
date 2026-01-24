/**
 * Admin Trade Service (Feature 068)
 *
 * 管理員查看用戶持倉和交易記錄的服務
 */

import { prisma } from '@lib/db';
import { logger } from '@lib/logger';
import { BaseError } from '@lib/errors';
import type {
  AdminPositionDetail,
  AdminUserPositionsQuery,
  AdminUserPositionsResponse,
  AdminTradeListQuery,
  AdminTradeListItem,
  AdminTradeListResponse,
} from '@/src/types/admin';
import type { Prisma } from '@/generated/prisma/client';

// ===== Error Classes =====

export class UserNotFoundError extends BaseError {
  constructor(userId: string) {
    super(`User not found: ${userId}`, 'USER_NOT_FOUND', 404);
  }
}

// ===== Service =====

export class AdminTradeService {
  /**
   * T044: 獲取用戶持倉列表
   */
  async getUserPositions(
    userId: string,
    query: AdminUserPositionsQuery
  ): Promise<AdminUserPositionsResponse> {
    // 驗證用戶存在
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new UserNotFoundError(userId);
    }

    const { page = 1, limit = 20, status = 'all', startDate, endDate } = query;
    const skip = (page - 1) * limit;

    // 建立查詢條件
    const where: Prisma.PositionWhereInput = {
      userId,
    };

    // 狀態過濾
    if (status === 'open') {
      where.status = { in: ['OPEN', 'OPENING'] };
    } else if (status === 'closed') {
      where.status = { in: ['CLOSED', 'CLOSING'] };
    }

    // 日期過濾
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    // 查詢持倉
    const [positions, total] = await Promise.all([
      prisma.position.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { email: true },
          },
          trade: {
            select: {
              id: true,
              longExitPrice: true,
              shortExitPrice: true,
              priceDiffPnL: true,
              fundingRatePnL: true,
              totalPnL: true,
              roi: true,
              holdingDuration: true,
            },
          },
        },
      }),
      prisma.position.count({ where }),
    ]);

    // 轉換為 API 格式
    const positionDetails: AdminPositionDetail[] = positions.map((pos) => ({
      id: pos.id,
      userId: pos.userId,
      userEmail: pos.user.email,
      symbol: pos.symbol,
      status: pos.status,

      // 開倉資訊
      longExchange: pos.longExchange,
      longEntryPrice: pos.longEntryPrice.toString(),
      longPositionSize: pos.longPositionSize.toString(),
      longLeverage: pos.longLeverage,
      shortExchange: pos.shortExchange,
      shortEntryPrice: pos.shortEntryPrice.toString(),
      shortPositionSize: pos.shortPositionSize.toString(),
      shortLeverage: pos.shortLeverage,

      // 開倉時資金費率
      openFundingRateLong: pos.openFundingRateLong.toString(),
      openFundingRateShort: pos.openFundingRateShort.toString(),

      // 停損停利
      stopLossEnabled: pos.stopLossEnabled,
      stopLossPercent: pos.stopLossPercent?.toString(),
      takeProfitEnabled: pos.takeProfitEnabled,
      takeProfitPercent: pos.takeProfitPercent?.toString(),

      // 時間
      openedAt: pos.openedAt ?? undefined,
      closedAt: pos.closedAt ?? undefined,
      createdAt: pos.createdAt,

      // 平倉資訊
      trade: pos.trade
        ? {
            longExitPrice: pos.trade.longExitPrice.toString(),
            shortExitPrice: pos.trade.shortExitPrice.toString(),
            priceDiffPnL: pos.trade.priceDiffPnL.toString(),
            fundingRatePnL: pos.trade.fundingRatePnL.toString(),
            totalPnL: pos.trade.totalPnL.toString(),
            roi: pos.trade.roi.toString(),
            holdingDuration: pos.trade.holdingDuration,
          }
        : undefined,
    }));

    const totalPages = Math.ceil(total / limit);

    logger.info(
      { userId, total, page, status },
      'Admin fetched user positions'
    );

    return {
      positions: positionDetails,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * T045: 匯出用戶交易記錄為 CSV
   */
  async exportUserTrades(
    userId: string,
    query: Pick<AdminTradeListQuery, 'startDate' | 'endDate' | 'symbol'>
  ): Promise<string> {
    // 驗證用戶存在
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new UserNotFoundError(userId);
    }

    const { startDate, endDate, symbol } = query;

    // 建立查詢條件
    const where: Prisma.TradeWhereInput = {
      userId,
    };

    if (symbol) {
      where.symbol = symbol;
    }

    if (startDate || endDate) {
      where.closedAt = {};
      if (startDate) where.closedAt.gte = startDate;
      if (endDate) where.closedAt.lte = endDate;
    }

    // 查詢交易記錄（包含開倉資金費率）
    const trades = await prisma.trade.findMany({
      where,
      orderBy: { closedAt: 'desc' },
      include: {
        position: {
          select: {
            openFundingRateLong: true,
            openFundingRateShort: true,
          },
        },
      },
    });

    // CSV 標題
    const headers = [
      'Trade ID',
      'Symbol',
      'Long Exchange',
      'Short Exchange',
      'Long Entry Price',
      'Short Entry Price',
      'Long Exit Price',
      'Short Exit Price',
      'Long Position Size',
      'Short Position Size',
      'Open Funding Rate Long',
      'Open Funding Rate Short',
      'Price Diff PnL',
      'Funding Rate PnL',
      'Total PnL',
      'ROI (%)',
      'Holding Duration (hours)',
      'Opened At',
      'Closed At',
      'Status',
    ];

    // CSV 資料列
    const rows = trades.map((trade) => [
      trade.id,
      trade.symbol,
      trade.longExchange,
      trade.shortExchange,
      trade.longEntryPrice.toString(),
      trade.shortEntryPrice.toString(),
      trade.longExitPrice.toString(),
      trade.shortExitPrice.toString(),
      trade.longPositionSize.toString(),
      trade.shortPositionSize.toString(),
      trade.position?.openFundingRateLong?.toString() ?? '',
      trade.position?.openFundingRateShort?.toString() ?? '',
      trade.priceDiffPnL.toString(),
      trade.fundingRatePnL.toString(),
      trade.totalPnL.toString(),
      trade.roi.toString(),
      Math.round(trade.holdingDuration / 3600).toString(), // 轉換為小時
      trade.openedAt?.toISOString() ?? '',
      trade.closedAt?.toISOString() ?? '',
      trade.status,
    ]);

    // 組合 CSV
    const csvLines = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ];

    logger.info(
      { userId, tradeCount: trades.length },
      'Admin exported user trades'
    );

    return csvLines.join('\n');
  }

  /**
   * T087: 獲取平台所有交易列表（支援篩選）
   */
  async listAllTrades(
    query: AdminTradeListQuery
  ): Promise<AdminTradeListResponse> {
    const {
      page = 1,
      limit = 20,
      userId,
      symbol,
      startDate,
      endDate,
      sortBy = 'closedAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    // 建立查詢條件
    const where: Prisma.TradeWhereInput = {};

    if (userId) {
      where.userId = userId;
    }

    if (symbol) {
      where.symbol = symbol;
    }

    if (startDate || endDate) {
      where.closedAt = {};
      if (startDate) where.closedAt.gte = startDate;
      if (endDate) where.closedAt.lte = endDate;
    }

    // 查詢交易
    const [trades, total] = await Promise.all([
      prisma.trade.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          user: {
            select: { id: true, email: true },
          },
        },
      }),
      prisma.trade.count({ where }),
    ]);

    // 轉換為 API 格式
    const items: AdminTradeListItem[] = trades.map((trade) => ({
      id: trade.id,
      userId: trade.userId,
      userEmail: trade.user.email,
      symbol: trade.symbol,
      longExchange: trade.longExchange,
      shortExchange: trade.shortExchange,
      openedAt: trade.openedAt ?? new Date(),
      closedAt: trade.closedAt ?? new Date(),
      holdingDuration: trade.holdingDuration,
      priceDiffPnL: trade.priceDiffPnL.toString(),
      fundingRatePnL: trade.fundingRatePnL.toString(),
      totalPnL: trade.totalPnL.toString(),
      roi: trade.roi.toString(),
      status: trade.status,
    }));

    const totalPages = Math.ceil(total / limit);

    logger.info(
      { total, page, filters: { userId, symbol } },
      'Admin fetched all trades'
    );

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  }
}
