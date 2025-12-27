/**
 * PositionCard - 持倉卡片組件
 * 顯示單一持倉的詳細資訊
 *
 * Feature 033: Manual Open Position (T019)
 * Feature 037: Mark Position Closed (T005)
 * Feature 045: Position Details View
 */

'use client';

import React, { useState, useCallback } from 'react';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Shield,
  Target,
  ChevronUp,
  Eye,
} from 'lucide-react';
import type { PositionInfo, PositionStatus, ConditionalOrderStatus } from '@/src/types/trading';
import { usePositionDetails } from '../hooks/usePositionDetails';
import { PositionDetailsPanel } from './PositionDetailsPanel';

interface PositionCardProps {
  position: PositionInfo;
  onClose?: (positionId: string) => void;
  isClosing?: boolean;
  onMarkAsClosed?: (positionId: string) => void;
  isMarkingAsClosed?: boolean;
}

const STATUS_CONFIG: Record<PositionStatus, {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ElementType;
}> = {
  PENDING: {
    label: '待處理',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    icon: Clock,
  },
  OPENING: {
    label: '開倉中',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    icon: Loader2,
  },
  OPEN: {
    label: '持倉中',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    icon: CheckCircle,
  },
  CLOSING: {
    label: '平倉中',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    icon: Loader2,
  },
  CLOSED: {
    label: '已平倉',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    icon: CheckCircle,
  },
  FAILED: {
    label: '失敗',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    icon: XCircle,
  },
  PARTIAL: {
    label: '需手動處理',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    icon: AlertTriangle,
  },
};

/**
 * 可以手動標記為已平倉的狀態
 */
const MARKABLE_STATUSES: PositionStatus[] = ['OPEN', 'PARTIAL', 'FAILED'];

/**
 * 條件單狀態配置 (Feature 038)
 */
const CONDITIONAL_ORDER_STATUS_CONFIG: Record<ConditionalOrderStatus, {
  label: string;
  color: string;
  bgColor: string;
}> = {
  PENDING: {
    label: '待設定',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  SETTING: {
    label: '設定中',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  SET: {
    label: '已設定',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  PARTIAL: {
    label: '部分設定',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
  },
  FAILED: {
    label: '設定失敗',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
};

export function PositionCard({
  position,
  onClose,
  isClosing = false,
  onMarkAsClosed,
  isMarkingAsClosed = false,
}: PositionCardProps) {
  const statusConfig = STATUS_CONFIG[position.status] || STATUS_CONFIG.PENDING;
  const StatusIcon = statusConfig.icon;

  const createdDate = new Date(position.createdAt);
  const timeAgo = getTimeAgo(createdDate);

  // Feature 045: Position Details View
  const [isExpanded, setIsExpanded] = useState(false);
  const { details, isLoading, error, fetchDetails, reset } = usePositionDetails();

  // 只有 OPEN 狀態才能查看詳情
  const canViewDetails = position.status === 'OPEN';

  const handleToggleDetails = useCallback(() => {
    if (isExpanded) {
      setIsExpanded(false);
      reset();
    } else {
      setIsExpanded(true);
      fetchDetails(position.id);
    }
  }, [isExpanded, position.id, fetchDetails, reset]);

  const handleRetry = useCallback(() => {
    fetchDetails(position.id);
  }, [position.id, fetchDetails]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{position.symbol}</h3>
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
          >
            <StatusIcon className={`w-3 h-3 ${position.status === 'OPENING' || position.status === 'CLOSING' ? 'animate-spin' : ''}`} />
            {statusConfig.label}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {timeAgo} · {createdDate.toLocaleString()}
        </p>
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Long Side */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-green-600">
              <ArrowUpCircle className="w-4 h-4" />
              <span className="text-sm font-medium">做多</span>
            </div>
            <p className="text-sm text-gray-900 capitalize">{position.longExchange}</p>
          </div>

          {/* Short Side */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-red-600">
              <ArrowDownCircle className="w-4 h-4" />
              <span className="text-sm font-medium">做空</span>
            </div>
            <p className="text-sm text-gray-900 capitalize">{position.shortExchange}</p>
          </div>
        </div>

        {/* Leverage */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">槓桿倍數</span>
            <span className="font-medium text-gray-900">{position.leverage}x</span>
          </div>
        </div>

        {/* Stop Loss / Take Profit Info (Feature 038) */}
        {(position.stopLossEnabled || position.takeProfitEnabled) && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
            {/* Conditional Order Status Badge */}
            {position.conditionalOrderStatus && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">條件單狀態</span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    CONDITIONAL_ORDER_STATUS_CONFIG[position.conditionalOrderStatus]?.bgColor || 'bg-gray-100'
                  } ${
                    CONDITIONAL_ORDER_STATUS_CONFIG[position.conditionalOrderStatus]?.color || 'text-gray-600'
                  }`}
                >
                  {CONDITIONAL_ORDER_STATUS_CONFIG[position.conditionalOrderStatus]?.label || position.conditionalOrderStatus}
                </span>
              </div>
            )}

            {/* Stop Loss Info */}
            {position.stopLossEnabled && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1 text-orange-600">
                  <Shield className="w-3 h-3" />
                  <span className="text-xs">停損</span>
                </div>
                <span className="text-xs text-gray-600">
                  {position.stopLossPercent}%
                  {position.longStopLossPrice && (
                    <span className="ml-1 text-gray-400">
                      (L: ${Number(position.longStopLossPrice).toFixed(2)})
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* Take Profit Info */}
            {position.takeProfitEnabled && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1 text-green-600">
                  <Target className="w-3 h-3" />
                  <span className="text-xs">停利</span>
                </div>
                <span className="text-xs text-gray-600">
                  {position.takeProfitPercent}%
                  {position.longTakeProfitPrice && (
                    <span className="ml-1 text-gray-400">
                      (L: ${Number(position.longTakeProfitPrice).toFixed(2)})
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* Conditional Order Error */}
            {position.conditionalOrderError && (
              <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                {position.conditionalOrderError}
              </div>
            )}
          </div>
        )}

        {/* Partial Warning */}
        {position.status === 'PARTIAL' && (
          <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded-md">
            <p className="text-xs text-orange-700">
              ⚠️ 此持倉只有一邊開倉成功，需要手動處理。
            </p>
          </div>
        )}

        {/* View Details Button (Feature 045) */}
        {canViewDetails && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <button
              onClick={handleToggleDetails}
              disabled={isLoading}
              className="w-full py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  查詢中...
                </>
              ) : isExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  收起詳情
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  查看詳情
                </>
              )}
            </button>
          </div>
        )}

        {/* Position Details Panel (Feature 045) */}
        {isExpanded && canViewDetails && (
          <PositionDetailsPanel
            details={details}
            isLoading={isLoading}
            error={error}
            onRetry={handleRetry}
          />
        )}
      </div>

      {/* Actions (if applicable) */}
      {(position.status === 'OPEN' && onClose) || (MARKABLE_STATUSES.includes(position.status) && onMarkAsClosed) ? (
        <div className="px-4 pb-4 space-y-2">
          {/* 平倉按鈕 - 僅 OPEN 狀態 */}
          {position.status === 'OPEN' && onClose && (
            <button
              onClick={() => onClose(position.id)}
              disabled={isClosing || isMarkingAsClosed}
              className="w-full py-2 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isClosing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  平倉中...
                </>
              ) : (
                '平倉'
              )}
            </button>
          )}

          {/* 標記已平倉按鈕 - OPEN、PARTIAL、FAILED 狀態 */}
          {MARKABLE_STATUSES.includes(position.status) && onMarkAsClosed && (
            <button
              onClick={() => onMarkAsClosed(position.id)}
              disabled={isClosing || isMarkingAsClosed}
              className="w-full py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isMarkingAsClosed ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  處理中...
                </>
              ) : (
                '標記已平倉'
              )}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * 計算時間距離
 */
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) {
    return '剛剛';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} 分鐘前`;
  } else if (diffHours < 24) {
    return `${diffHours} 小時前`;
  } else {
    return `${diffDays} 天前`;
  }
}
