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
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    icon: Clock,
  },
  OPENING: {
    label: '開倉中',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    icon: Loader2,
  },
  OPEN: {
    label: '持倉中',
    color: 'text-profit',
    bgColor: 'bg-profit/10',
    icon: CheckCircle,
  },
  CLOSING: {
    label: '平倉中',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    icon: Loader2,
  },
  CLOSED: {
    label: '已平倉',
    color: 'text-foreground',
    bgColor: 'bg-muted',
    icon: CheckCircle,
  },
  FAILED: {
    label: '失敗',
    color: 'text-loss',
    bgColor: 'bg-loss/10',
    icon: XCircle,
  },
  PARTIAL: {
    label: '需手動處理',
    color: 'text-warning',
    bgColor: 'bg-warning/10',
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
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
  },
  SETTING: {
    label: '設定中',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  SET: {
    label: '已設定',
    color: 'text-profit',
    bgColor: 'bg-profit/10',
  },
  PARTIAL: {
    label: '部分設定',
    color: 'text-warning',
    bgColor: 'bg-warning/10',
  },
  FAILED: {
    label: '設定失敗',
    color: 'text-loss',
    bgColor: 'bg-loss/10',
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
    <div className="glass-card border border-border shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">{position.symbol}</h3>
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
          >
            <StatusIcon className={`w-3 h-3 ${position.status === 'OPENING' || position.status === 'CLOSING' ? 'animate-spin' : ''}`} />
            {statusConfig.label}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {timeAgo} · {createdDate.toLocaleString()}
        </p>
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Long Side */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-profit">
              <ArrowUpCircle className="w-4 h-4" />
              <span className="text-sm font-medium">做多</span>
            </div>
            <p className="text-sm text-foreground capitalize">{position.longExchange}</p>
          </div>

          {/* Short Side */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-loss">
              <ArrowDownCircle className="w-4 h-4" />
              <span className="text-sm font-medium">做空</span>
            </div>
            <p className="text-sm text-foreground capitalize">{position.shortExchange}</p>
          </div>
        </div>

        {/* Leverage */}
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">槓桿倍數</span>
            <span className="font-medium text-foreground">{position.leverage}x</span>
          </div>
        </div>

        {/* Stop Loss / Take Profit Info (Feature 038) */}
        {(position.stopLossEnabled || position.takeProfitEnabled) && (
          <div className="mt-3 pt-3 border-t border-border space-y-2">
            {/* Conditional Order Status Badge */}
            {position.conditionalOrderStatus && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">條件單狀態</span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    CONDITIONAL_ORDER_STATUS_CONFIG[position.conditionalOrderStatus]?.bgColor || 'bg-muted'
                  } ${
                    CONDITIONAL_ORDER_STATUS_CONFIG[position.conditionalOrderStatus]?.color || 'text-muted-foreground'
                  }`}
                >
                  {CONDITIONAL_ORDER_STATUS_CONFIG[position.conditionalOrderStatus]?.label || position.conditionalOrderStatus}
                </span>
              </div>
            )}

            {/* Stop Loss Info */}
            {position.stopLossEnabled && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1 text-warning">
                  <Shield className="w-3 h-3" />
                  <span className="text-xs">停損</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {position.stopLossPercent}%
                  {position.longStopLossPrice && (
                    <span className="ml-1 text-muted-foreground">
                      (L: ${Number(position.longStopLossPrice).toFixed(2)})
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* Take Profit Info */}
            {position.takeProfitEnabled && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1 text-profit">
                  <Target className="w-3 h-3" />
                  <span className="text-xs">停利</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {position.takeProfitPercent}%
                  {position.longTakeProfitPrice && (
                    <span className="ml-1 text-muted-foreground">
                      (L: ${Number(position.longTakeProfitPrice).toFixed(2)})
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* Conditional Order Error */}
            {position.conditionalOrderError && (
              <div className="p-2 bg-loss/10 border border-loss/30 rounded text-xs text-loss">
                {position.conditionalOrderError}
              </div>
            )}
          </div>
        )}

        {/* Partial Warning */}
        {position.status === 'PARTIAL' && (
          <div className="mt-3 p-2 bg-warning/10 border border-warning/30 rounded-md">
            <p className="text-xs text-warning">
              ⚠️ 此持倉只有一邊開倉成功，需要手動處理。
            </p>
          </div>
        )}

        {/* View Details Button (Feature 045) */}
        {canViewDetails && (
          <div className="mt-3 pt-3 border-t border-border">
            <button
              onClick={handleToggleDetails}
              disabled={isLoading}
              className="w-full py-2 text-sm font-medium text-primary bg-primary/10 rounded-md hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
              className="w-full py-2 text-sm font-medium text-loss bg-loss/10 rounded-md hover:bg-loss/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
              className="w-full py-2 text-sm font-medium text-muted-foreground bg-muted rounded-md hover:bg-muted/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
