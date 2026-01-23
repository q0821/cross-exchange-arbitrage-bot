/**
 * Admin Dashboard Service (Feature 068)
 *
 * 平台統計儀表板服務
 */

import { prisma } from '@lib/db';
import type { DashboardStats, UserStats, PositionStats, TradeStats } from '@/src/types/admin';

export class AdminDashboardService {
  /**
   * 獲取用戶統計資料
   */
  async getUserStats(): Promise<UserStats> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 基本用戶統計
    const [total, active, inactive, todayNew] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isActive: false } }),
      prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    ]);

    // 活躍用戶統計（從審計日誌查詢登入記錄）
    const [weekActive, monthActive] = await Promise.all([
      prisma.auditLog.count({
        where: {
          action: 'LOGIN',
          createdAt: { gte: weekAgo },
        },
      }),
      prisma.auditLog.count({
        where: {
          action: 'LOGIN',
          createdAt: { gte: monthAgo },
        },
      }),
    ]);

    return {
      total,
      active,
      inactive,
      todayNew,
      weekActive,
      monthActive,
    };
  }

  /**
   * 獲取持倉統計資料
   */
  async getPositionStats(): Promise<PositionStats> {
    // 活躍持倉數量（OPEN 或 OPENING 狀態）
    const activeCount = await prisma.position.count({
      where: { status: { in: ['OPEN', 'OPENING'] } },
    });

    // 按交易所分組統計
    const byExchangeRaw = await prisma.position.groupBy({
      by: ['longExchange'],
      where: { status: { in: ['OPEN', 'OPENING'] } },
      _count: { _all: true },
    });

    const byExchange: Record<string, number> = {};
    for (const item of byExchangeRaw) {
      byExchange[item.longExchange] = item._count._all;
    }

    return {
      activeCount,
      byExchange,
    };
  }

  /**
   * 獲取交易統計資料
   */
  async getTradeStats(): Promise<TradeStats> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 基本交易統計
    const [closedCount, todayCount] = await Promise.all([
      prisma.trade.count(),
      prisma.trade.count({ where: { closedAt: { gte: todayStart } } }),
    ]);

    // 聚合統計
    const [allTradeAgg, todayTradeAgg] = await Promise.all([
      prisma.trade.aggregate({
        _sum: { totalPnL: true },
        _avg: { roi: true },
      }),
      prisma.trade.aggregate({
        where: { closedAt: { gte: todayStart } },
        _sum: { totalPnL: true },
      }),
    ]);

    // 處理 Decimal 類型
    const totalPnL = allTradeAgg._sum.totalPnL
      ? (typeof allTradeAgg._sum.totalPnL === 'object' && 'toNumber' in allTradeAgg._sum.totalPnL
          ? (allTradeAgg._sum.totalPnL as { toNumber: () => number }).toNumber()
          : Number(allTradeAgg._sum.totalPnL))
      : 0;

    const averageROI = allTradeAgg._avg.roi
      ? (typeof allTradeAgg._avg.roi === 'object' && 'toNumber' in allTradeAgg._avg.roi
          ? (allTradeAgg._avg.roi as { toNumber: () => number }).toNumber()
          : Number(allTradeAgg._avg.roi))
      : 0;

    const todayPnL = todayTradeAgg._sum.totalPnL
      ? (typeof todayTradeAgg._sum.totalPnL === 'object' && 'toNumber' in todayTradeAgg._sum.totalPnL
          ? (todayTradeAgg._sum.totalPnL as { toNumber: () => number }).toNumber()
          : Number(todayTradeAgg._sum.totalPnL))
      : 0;

    return {
      closedCount,
      totalPnL: totalPnL.toFixed(2),
      averageROI: averageROI.toFixed(2),
      todayCount,
      todayPnL: todayPnL.toFixed(2),
    };
  }

  /**
   * 獲取完整儀表板統計資料
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const [users, positions, trades] = await Promise.all([
      this.getUserStats(),
      this.getPositionStats(),
      this.getTradeStats(),
    ]);

    return {
      users,
      positions,
      trades,
    };
  }
}
