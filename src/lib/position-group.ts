/**
 * Position Group Utilities
 * Feature 069: 分單持倉合併顯示與批量平倉
 *
 * 提供組合持倉的聚合計算工具
 */

import { Decimal } from 'decimal.js';
import type { Position, PositionWebStatus } from '@/generated/prisma/client';
import type {
  PositionGroup,
  PositionGroupAggregate,
  GroupedPositionsResponse,
} from '@/types/position-group';

/**
 * 用於分組計算的 Position 子集類型
 * Feature 070: groupId 現為必填
 */
export interface PositionForGroup {
  id: string;
  groupId: string;  // Feature 070: 所有持倉必須有 groupId
  symbol: string;
  longExchange: string;
  shortExchange: string;
  longPositionSize: Decimal;
  longEntryPrice: Decimal;
  shortPositionSize: Decimal;
  shortEntryPrice: Decimal;
  status: PositionWebStatus | string;
  openedAt: Date | null;
  cachedFundingPnL: Decimal | null;
  unrealizedPnL: Decimal | null;
  stopLossPercent: Decimal | null;
  takeProfitPercent: Decimal | null;
}

/**
 * 加權平均計算的輸入
 */
interface WeightedValue {
  value: Decimal;
  weight: Decimal;
}

/**
 * 計算加權平均
 *
 * @param values - 值與權重的陣列
 * @returns 加權平均結果
 */
export function calculateWeightedAverage(values: WeightedValue[]): Decimal {
  if (values.length === 0) {
    return new Decimal(0);
  }

  let totalWeight = new Decimal(0);
  let weightedSum = new Decimal(0);

  for (const { value, weight } of values) {
    weightedSum = weightedSum.plus(value.times(weight));
    totalWeight = totalWeight.plus(weight);
  }

  if (totalWeight.isZero()) {
    return new Decimal(0);
  }

  return weightedSum.dividedBy(totalWeight);
}

/**
 * 將持倉按 groupId 分組
 * Feature 070: 所有持倉都有 groupId，不再有 ungrouped 概念
 *
 * @param positions - 持倉列表
 * @returns 分組結果（groups 陣列）
 */
export function groupPositionsByGroupId(
  positions: PositionForGroup[]
): { groups: Array<{ groupId: string; positions: PositionForGroup[] }> } {
  const groupMap = new Map<string, PositionForGroup[]>();

  for (const position of positions) {
    const existing = groupMap.get(position.groupId) || [];
    existing.push(position);
    groupMap.set(position.groupId, existing);
  }

  const groups = Array.from(groupMap.entries()).map(([groupId, positions]) => ({
    groupId,
    positions,
  }));

  return { groups };
}

/**
 * 計算組合持倉的聚合統計
 *
 * @param positions - 同一組的持倉列表
 * @returns 聚合統計
 */
export function calculatePositionGroupAggregate(
  positions: PositionForGroup[]
): PositionGroupAggregate {
  if (positions.length === 0) {
    return {
      totalQuantity: new Decimal(0),
      avgLongEntryPrice: new Decimal(0),
      avgShortEntryPrice: new Decimal(0),
      totalFundingPnL: null,
      totalUnrealizedPnL: null,
      positionCount: 0,
      firstOpenedAt: null,
      stopLossPercent: null,
      takeProfitPercent: null,
    };
  }

  // 計算總數量
  let totalQuantity = new Decimal(0);
  for (const pos of positions) {
    totalQuantity = totalQuantity.plus(pos.longPositionSize);
  }

  // 計算加權平均開倉價格
  const longPriceValues: WeightedValue[] = positions.map((pos) => ({
    value: pos.longEntryPrice,
    weight: pos.longPositionSize,
  }));
  const avgLongEntryPrice = calculateWeightedAverage(longPriceValues);

  const shortPriceValues: WeightedValue[] = positions.map((pos) => ({
    value: pos.shortEntryPrice,
    weight: pos.shortPositionSize,
  }));
  const avgShortEntryPrice = calculateWeightedAverage(shortPriceValues);

  // 計算總資金費率收益
  let totalFundingPnL: Decimal | null = null;
  let hasFundingPnL = false;
  for (const pos of positions) {
    if (pos.cachedFundingPnL !== null) {
      hasFundingPnL = true;
      if (totalFundingPnL === null) {
        totalFundingPnL = new Decimal(0);
      }
      totalFundingPnL = totalFundingPnL.plus(pos.cachedFundingPnL);
    }
  }
  if (!hasFundingPnL) {
    totalFundingPnL = null;
  }

  // 計算總未實現損益
  let totalUnrealizedPnL: Decimal | null = null;
  let hasUnrealizedPnL = false;
  for (const pos of positions) {
    if (pos.unrealizedPnL !== null) {
      hasUnrealizedPnL = true;
      if (totalUnrealizedPnL === null) {
        totalUnrealizedPnL = new Decimal(0);
      }
      totalUnrealizedPnL = totalUnrealizedPnL.plus(pos.unrealizedPnL);
    }
  }
  if (!hasUnrealizedPnL) {
    totalUnrealizedPnL = null;
  }

  // 找最早開倉時間
  let firstOpenedAt: Date | null = null;
  for (const pos of positions) {
    if (pos.openedAt !== null) {
      if (firstOpenedAt === null || pos.openedAt < firstOpenedAt) {
        firstOpenedAt = pos.openedAt;
      }
    }
  }

  // 檢查停損/停利是否一致
  let stopLossPercent: Decimal | null = null;
  let takeProfitPercent: Decimal | null = null;

  const firstStopLoss = positions[0]?.stopLossPercent ?? null;
  const firstTakeProfit = positions[0]?.takeProfitPercent ?? null;

  const allSameStopLoss = positions.every((pos) => {
    const posStopLoss = pos.stopLossPercent ?? null;
    if (firstStopLoss === null && posStopLoss === null) return true;
    if (firstStopLoss === null || posStopLoss === null) return false;
    return firstStopLoss.equals(posStopLoss);
  });

  const allSameTakeProfit = positions.every((pos) => {
    const posTakeProfit = pos.takeProfitPercent ?? null;
    if (firstTakeProfit === null && posTakeProfit === null) return true;
    if (firstTakeProfit === null || posTakeProfit === null) return false;
    return firstTakeProfit.equals(posTakeProfit);
  });

  if (allSameStopLoss && firstStopLoss !== null) {
    stopLossPercent = firstStopLoss;
  }

  if (allSameTakeProfit && firstTakeProfit !== null) {
    takeProfitPercent = firstTakeProfit;
  }

  return {
    totalQuantity,
    avgLongEntryPrice,
    avgShortEntryPrice,
    totalFundingPnL,
    totalUnrealizedPnL,
    positionCount: positions.length,
    firstOpenedAt,
    stopLossPercent,
    takeProfitPercent,
  };
}

/**
 * 將 Position 列表轉換為分組回應格式
 * Feature 070: 所有持倉都放入 groups（不再有獨立的 positions 陣列）
 *
 * @param positions - 原始持倉列表
 * @returns 分組後的回應（只有 groups）
 */
export function toGroupedPositionsResponse(
  positions: Position[]
): GroupedPositionsResponse {
  const positionsForGroup: PositionForGroup[] = positions.map((pos) => ({
    id: pos.id,
    // Feature 070: groupId 現為必填，使用非空斷言
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

  const { groups: rawGroups } = groupPositionsByGroupId(positionsForGroup);

  // 轉換為完整的 PositionGroup 結構
  const groups: PositionGroup[] = rawGroups.map((g) => {
    const fullPositions = positions.filter((p) => p.groupId === g.groupId);
    const aggregate = calculatePositionGroupAggregate(g.positions);
    const firstPos = fullPositions[0];

    return {
      groupId: g.groupId,
      symbol: firstPos?.symbol ?? '',
      longExchange: firstPos?.longExchange ?? '',
      shortExchange: firstPos?.shortExchange ?? '',
      positions: fullPositions,
      aggregate,
    };
  });

  return { groups };
}
