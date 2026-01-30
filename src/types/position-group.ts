/**
 * Position Group Types
 * Feature 069: 分單持倉合併顯示與批量平倉
 */

import type { Decimal } from 'decimal.js';
import type { Position, PositionWebStatus } from '@/generated/prisma/client';

/**
 * 組合持倉聚合統計
 */
export interface PositionGroupAggregate {
  /** 總數量（以做多方為準） */
  totalQuantity: Decimal;

  /** 加權平均做多開倉價格 */
  avgLongEntryPrice: Decimal;

  /** 加權平均做空開倉價格 */
  avgShortEntryPrice: Decimal;

  /** 總資金費率收益（快取值） */
  totalFundingPnL: Decimal | null;

  /** 總未實現損益 */
  totalUnrealizedPnL: Decimal | null;

  /** 組內持倉數量 */
  positionCount: number;

  /** 最早開倉時間 */
  firstOpenedAt: Date | null;

  /** 停損設定（如果所有持倉設定相同） */
  stopLossPercent: Decimal | null;

  /** 停利設定（如果所有持倉設定相同） */
  takeProfitPercent: Decimal | null;
}

/**
 * 組合持倉資料結構（前端/API 使用）
 */
export interface PositionGroup {
  /** 組別 ID */
  groupId: string;

  /** 交易對符號 */
  symbol: string;

  /** 做多交易所 */
  longExchange: string;

  /** 做空交易所 */
  shortExchange: string;

  /** 組內持倉列表 */
  positions: Position[];

  /** 聚合統計 */
  aggregate: PositionGroupAggregate;
}

/**
 * 分組後的持倉回應
 * Feature 070: 統一 groupId 架構 - 所有持倉都在 groups 陣列中
 */
export interface GroupedPositionsResponse {
  /** 所有持倉組（每個 group 包含 1+ 個持倉） */
  groups: PositionGroup[];
}

/**
 * 批量平倉請求
 */
export interface BatchCloseRequest {
  /** 平倉原因（可選） */
  reason?: 'MANUAL';
}

/**
 * 單組平倉結果
 */
export interface BatchClosePositionResult {
  /** Position ID */
  positionId: string;

  /** 是否成功 */
  success: boolean;

  /** 成功時的 Trade ID */
  tradeId?: string;

  /** 失敗原因 */
  error?: string;

  /** 該組損益 */
  pnL?: Decimal;
}

/**
 * 批量平倉回應
 */
export interface BatchCloseResponse {
  /** 總體狀態 */
  status: 'success' | 'partial' | 'failed';

  /** 成功平倉數量 */
  successCount: number;

  /** 失敗平倉數量 */
  failedCount: number;

  /** 各組平倉結果 */
  results: BatchClosePositionResult[];

  /** 總損益（成功平倉的部分） */
  totalPnL: Decimal | null;
}

/**
 * 批量平倉進度事件
 */
export interface BatchCloseProgressEvent {
  /** 組別 ID */
  groupId: string;

  /** 當前處理的位置 */
  current: number;

  /** 總數 */
  total: number;

  /** 當前處理的 Position ID */
  currentPositionId: string;

  /** 狀態 */
  status: 'closing';
}

/**
 * 批量平倉成功事件
 */
export interface BatchCloseSuccessEvent {
  /** 組別 ID */
  groupId: string;

  /** 成功數量 */
  successCount: number;

  /** 失敗數量 */
  failedCount: number;

  /** 總損益 */
  totalPnL: string;
}

/**
 * 批量平倉部分成功事件
 */
export interface BatchClosePartialEvent {
  /** 組別 ID */
  groupId: string;

  /** 成功數量 */
  successCount: number;

  /** 失敗數量 */
  failedCount: number;

  /** 總損益（成功部分） */
  totalPnL: string;

  /** 失敗的持倉 */
  failedPositions: Array<{
    positionId: string;
    error: string;
  }>;
}

/**
 * 開倉參數擴展（支援 groupId）
 */
export interface OpenPositionWithGroupParams {
  /** 分單開倉組別 ID（可選） */
  groupId?: string;
}

/**
 * Position 狀態篩選
 * - 單一狀態：'OPEN', 'CLOSED', etc.
 * - 多狀態陣列：['OPEN', 'PARTIAL']
 * - 'ALL'：不過濾狀態
 */
export type PositionStatusFilter = PositionWebStatus | PositionWebStatus[] | 'ALL';
