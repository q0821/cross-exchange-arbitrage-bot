/**
 * PositionGroupService
 * Feature 069: 分單持倉合併顯示與批量平倉
 *
 * 提供組合持倉的查詢和聚合服務
 */

import { randomUUID } from 'crypto';
import type { PrismaClient, Position, PositionWebStatus } from '@/generated/prisma/client';
import {
  toGroupedPositionsResponse,
  calculatePositionGroupAggregate,
  type PositionForGroup,
} from '@/lib/position-group';
import type {
  GroupedPositionsResponse,
  PositionGroupAggregate,
  PositionStatusFilter,
} from '@/types/position-group';

/**
 * 組合持倉服務
 */
export class PositionGroupService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * 取得用戶的分組持倉
   *
   * @param userId - 用戶 ID
   * @param status - 狀態篩選（單一狀態、狀態陣列、或 'ALL'）
   * @returns 分組後的持倉回應
   */
  async getPositionsGrouped(
    userId: string,
    status?: PositionStatusFilter
  ): Promise<GroupedPositionsResponse> {
    const where: {
      userId: string;
      status?: PositionWebStatus | { in: PositionWebStatus[] };
    } = { userId };

    if (status) {
      if (Array.isArray(status)) {
        // 多狀態過濾
        where.status = { in: status };
      } else if (status !== 'ALL') {
        // 單一狀態過濾
        where.status = status as PositionWebStatus;
      }
      // status === 'ALL' 時不加過濾條件
    }

    const positions = await this.prisma.position.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    return toGroupedPositionsResponse(positions);
  }

  /**
   * 取得特定組別的持倉
   *
   * @param groupId - 組別 ID
   * @param userId - 用戶 ID
   * @returns 該組的持倉列表
   */
  async getPositionsByGroupId(
    groupId: string,
    userId: string
  ): Promise<Position[]> {
    return this.prisma.position.findMany({
      where: {
        groupId,
        userId,
        status: 'OPEN',
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * 驗證用戶是否擁有該組別
   *
   * @param groupId - 組別 ID
   * @param userId - 用戶 ID
   * @returns 是否擁有
   */
  async validateGroupOwnership(
    groupId: string,
    userId: string
  ): Promise<boolean> {
    const position = await this.prisma.position.findFirst({
      where: {
        groupId,
        userId,
      },
    });

    return position !== null;
  }

  /**
   * 取得組別的聚合統計
   *
   * @param groupId - 組別 ID
   * @param userId - 用戶 ID
   * @returns 聚合統計（如果組別存在）
   */
  async getGroupAggregate(
    groupId: string,
    userId: string
  ): Promise<PositionGroupAggregate | null> {
    const positions = await this.getPositionsByGroupId(groupId, userId);

    if (positions.length === 0) {
      return null;
    }

    const positionsForGroup: PositionForGroup[] = positions.map((pos) => ({
      id: pos.id,
      // Feature 070: groupId 現為必填
      groupId: pos.groupId!,
      symbol: pos.symbol,
      longExchange: pos.longExchange,
      shortExchange: pos.shortExchange,
      longPositionSize: pos.longPositionSize,
      longEntryPrice: pos.longEntryPrice,
      shortPositionSize: pos.shortPositionSize,
      shortEntryPrice: pos.shortEntryPrice,
      status: pos.status,
      openedAt: pos.openedAt,
      cachedFundingPnL: pos.cachedFundingPnL,
      unrealizedPnL: pos.unrealizedPnL,
      stopLossPercent: pos.stopLossPercent,
      takeProfitPercent: pos.takeProfitPercent,
    }));

    return calculatePositionGroupAggregate(positionsForGroup);
  }

  /**
   * 生成新的組別 ID
   *
   * @returns UUID v4 格式的組別 ID
   */
  static generateGroupId(): string {
    return randomUUID();
  }
}
