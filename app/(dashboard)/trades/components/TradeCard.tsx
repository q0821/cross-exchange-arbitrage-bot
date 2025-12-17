/**
 * TradeCard - 交易記錄卡片組件
 *
 * 顯示單筆交易的績效資訊
 * Feature: 035-close-position (T018)
 */

'use client';

import React, { useState } from 'react';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { TradePerformanceInfo } from '@/src/types/trading';

interface TradeCardProps {
  trade: TradePerformanceInfo;
}

/**
 * 格式化持倉時間
 */
function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} 天`);
  if (hours > 0) parts.push(`${hours} 小時`);
  if (minutes > 0) parts.push(`${minutes} 分`);

  return parts.length > 0 ? parts.join(' ') : '少於 1 分鐘';
}

/**
 * 格式化數字
 */
function formatNumber(value: string | number, decimals: number = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return num.toFixed(decimals);
}

export function TradeCard({ trade }: TradeCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const totalPnL = parseFloat(trade.totalPnL);
  const roi = parseFloat(trade.roi);
  const isProfitable = totalPnL >= 0;

  const closedDate = new Date(trade.closedAt);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">{trade.symbol}</h3>
            {trade.status === 'PARTIAL' && (
              <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
                部分成功
              </span>
            )}
          </div>
          <div
            className={`text-right ${isProfitable ? 'text-green-600' : 'text-red-600'}`}
          >
            <p className="text-lg font-bold">
              {isProfitable ? '+' : ''}
              {formatNumber(totalPnL)} USDT
            </p>
            <p className="text-sm">
              {isProfitable ? '+' : ''}
              {formatNumber(roi)}%
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {closedDate.toLocaleDateString()} {closedDate.toLocaleTimeString()}
        </p>
      </div>

      {/* Summary */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4 mb-3">
          {/* Long Side */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-green-600">
              <ArrowUpCircle className="w-4 h-4" />
              <span className="text-sm font-medium">做多</span>
            </div>
            <p className="text-sm text-gray-900 capitalize">{trade.longExchange}</p>
          </div>

          {/* Short Side */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-red-600">
              <ArrowDownCircle className="w-4 h-4" />
              <span className="text-sm font-medium">做空</span>
            </div>
            <p className="text-sm text-gray-900 capitalize">{trade.shortExchange}</p>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="text-center p-2 bg-gray-50 rounded">
            <p className="text-xs text-gray-500 mb-1">價差損益</p>
            <p
              className={`font-medium ${
                parseFloat(trade.priceDiffPnL) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {parseFloat(trade.priceDiffPnL) >= 0 ? '+' : ''}
              {formatNumber(trade.priceDiffPnL)}
            </p>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded">
            <p className="text-xs text-gray-500 mb-1">資金費率</p>
            <p
              className={`font-medium ${
                parseFloat(trade.fundingRatePnL) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {parseFloat(trade.fundingRatePnL) >= 0 ? '+' : ''}
              {formatNumber(trade.fundingRatePnL)}
            </p>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded">
            <div className="flex items-center justify-center gap-1 text-xs text-gray-500 mb-1">
              <Clock className="w-3 h-3" />
              持倉時間
            </div>
            <p className="font-medium text-gray-900 text-xs">
              {formatDuration(trade.holdingDuration)}
            </p>
          </div>
        </div>

        {/* Expand Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full mt-3 pt-3 border-t border-gray-100 flex items-center justify-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              收起詳情
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              查看詳情
            </>
          )}
        </button>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
            {/* Long Side Details */}
            <div className="text-sm">
              <h4 className="flex items-center gap-1 font-medium text-green-600 mb-2">
                <TrendingUp className="w-4 h-4" />
                多頭詳情 ({trade.longExchange})
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">開倉價:</span>
                  <span className="ml-1 text-gray-900">
                    ${formatNumber(trade.longEntryPrice)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">平倉價:</span>
                  <span className="ml-1 text-gray-900">
                    ${formatNumber(trade.longExitPrice)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">數量:</span>
                  <span className="ml-1 text-gray-900">
                    {formatNumber(trade.longPositionSize, 4)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">損益:</span>
                  <span
                    className={`ml-1 ${
                      parseFloat(trade.longExitPrice) >= parseFloat(trade.longEntryPrice)
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {(
                      (parseFloat(trade.longExitPrice) - parseFloat(trade.longEntryPrice)) *
                      parseFloat(trade.longPositionSize)
                    ).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Short Side Details */}
            <div className="text-sm">
              <h4 className="flex items-center gap-1 font-medium text-red-600 mb-2">
                <TrendingDown className="w-4 h-4" />
                空頭詳情 ({trade.shortExchange})
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">開倉價:</span>
                  <span className="ml-1 text-gray-900">
                    ${formatNumber(trade.shortEntryPrice)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">平倉價:</span>
                  <span className="ml-1 text-gray-900">
                    ${formatNumber(trade.shortExitPrice)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">數量:</span>
                  <span className="ml-1 text-gray-900">
                    {formatNumber(trade.shortPositionSize, 4)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">損益:</span>
                  <span
                    className={`ml-1 ${
                      parseFloat(trade.shortEntryPrice) >= parseFloat(trade.shortExitPrice)
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {(
                      (parseFloat(trade.shortEntryPrice) - parseFloat(trade.shortExitPrice)) *
                      parseFloat(trade.shortPositionSize)
                    ).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Timestamps */}
            <div className="text-xs text-gray-400">
              <p>開倉時間: {new Date(trade.openedAt).toLocaleString()}</p>
              <p>平倉時間: {new Date(trade.closedAt).toLocaleString()}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TradeCard;
