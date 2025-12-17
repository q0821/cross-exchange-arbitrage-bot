/**
 * PositionCard - 持倉卡片組件
 * 顯示單一持倉的詳細資訊
 *
 * Feature 033: Manual Open Position (T019)
 */

'use client';

import React from 'react';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import type { PositionInfo, PositionStatus } from '@/src/types/trading';

interface PositionCardProps {
  position: PositionInfo;
  onClose?: (positionId: string) => void;
  isClosing?: boolean;
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

export function PositionCard({ position, onClose, isClosing = false }: PositionCardProps) {
  const statusConfig = STATUS_CONFIG[position.status] || STATUS_CONFIG.PENDING;
  const StatusIcon = statusConfig.icon;

  const createdDate = new Date(position.createdAt);
  const timeAgo = getTimeAgo(createdDate);

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

        {/* Partial Warning */}
        {position.status === 'PARTIAL' && (
          <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded-md">
            <p className="text-xs text-orange-700">
              ⚠️ 此持倉只有一邊開倉成功，需要手動處理。
            </p>
          </div>
        )}
      </div>

      {/* Actions (if applicable) */}
      {position.status === 'OPEN' && onClose && (
        <div className="px-4 pb-4">
          <button
            onClick={() => onClose(position.id)}
            disabled={isClosing}
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
        </div>
      )}
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
