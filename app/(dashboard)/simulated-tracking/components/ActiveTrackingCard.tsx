/**
 * ActiveTrackingCard - 活躍追蹤卡片組件
 * 顯示單個追蹤的即時狀態和累計收益
 *
 * Feature 029: Simulated APY Tracking (T021)
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Clock, DollarSign, Target, Square, Layers, Calendar } from 'lucide-react';

interface TrackingData {
  id: string;
  symbol: string;
  longExchange: string;
  shortExchange: string;
  simulatedCapital: number;
  initialAPY: number;
  // 開倉價格和固定顆數
  initialLongPrice: number | null;
  initialShortPrice: number | null;
  positionQuantity: number | null;
  status: string;
  startedAt: string;
  totalFundingProfit: number;
  totalSettlements: number;
  durationFormatted?: string;
  currentAPY?: number;
}

interface ActiveTrackingCardProps {
  tracking: TrackingData;
  onStop?: (id: string) => void;
  isStopLoading?: boolean;
}

export function ActiveTrackingCard({
  tracking,
  onStop,
  isStopLoading,
}: ActiveTrackingCardProps) {
  const profitPercentage = (tracking.totalFundingProfit / tracking.simulatedCapital) * 100;
  const isPositive = tracking.totalFundingProfit >= 0;

  // 幣種名稱
  const coinSymbol = tracking.symbol.replace('USDT', '');

  // 格式化日期時間
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <Link
            href={`/simulated-tracking/${tracking.id}`}
            className="text-lg font-semibold text-blue-600 hover:text-blue-800 hover:underline"
          >
            {tracking.symbol}
          </Link>
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
              tracking.status === 'ACTIVE'
                ? 'bg-green-100 text-green-700'
                : tracking.status === 'STOPPED'
                ? 'bg-gray-100 text-gray-700'
                : 'bg-orange-100 text-orange-700'
            }`}
          >
            <Target className="w-3 h-3" />
            {tracking.status === 'ACTIVE'
              ? '追蹤中'
              : tracking.status === 'STOPPED'
              ? '已停止'
              : '已過期'}
          </span>
        </div>

        {/* Exchange Pair */}
        <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded">
            <TrendingUp className="w-3 h-3" />
            <span className="capitalize">{tracking.longExchange}</span>
          </span>
          <span className="text-gray-400">→</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 rounded">
            <TrendingDown className="w-3 h-3" />
            <span className="capitalize">{tracking.shortExchange}</span>
          </span>
        </div>

        {/* Opening Time */}
        <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
          <Calendar className="w-3 h-3" />
          開倉時間: {formatDateTime(tracking.startedAt)}
        </div>
      </div>

      {/* Stats */}
      <div className="p-4 grid grid-cols-2 gap-4">
        {/* Position Quantity & Entry Prices */}
        {tracking.positionQuantity ? (
          <div className="col-span-2 p-2 bg-cyan-50 rounded-md border border-cyan-200">
            <div className="flex items-center gap-1 text-xs text-cyan-600 mb-1">
              <Layers className="w-3 h-3" />
              倉位資訊
            </div>
            <div className="text-sm text-cyan-700 mb-1">
              <span className="font-medium">{tracking.positionQuantity.toFixed(4)}</span>{' '}
              <span className="text-xs">{coinSymbol}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-cyan-600">
              <div>
                <span className="capitalize">{tracking.longExchange}</span>:{' '}
                {tracking.initialLongPrice ? (
                  <span className="font-mono">${tracking.initialLongPrice.toFixed(4)}</span>
                ) : (
                  <span className="text-gray-400">N/A</span>
                )}
              </div>
              <div>
                <span className="capitalize">{tracking.shortExchange}</span>:{' '}
                {tracking.initialShortPrice ? (
                  <span className="font-mono">${tracking.initialShortPrice.toFixed(4)}</span>
                ) : (
                  <span className="text-gray-400">N/A</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Simulated Capital - 舊版資金模式 */
          <div className="col-span-2">
            <div className="text-xs text-gray-500 mb-1">模擬資金</div>
            <div className="text-sm font-medium flex items-center gap-1">
              <DollarSign className="w-4 h-4 text-gray-400" />
              {tracking.simulatedCapital.toLocaleString()} USDT
            </div>
          </div>
        )}

        {/* Total Profit */}
        <div>
          <div className="text-xs text-gray-500 mb-1">累計收益</div>
          <div
            className={`text-sm font-medium ${
              isPositive ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {isPositive ? '+' : ''}
            {tracking.totalFundingProfit.toFixed(2)} USDT
            <span className="text-xs ml-1">
              ({isPositive ? '+' : ''}
              {profitPercentage.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* Initial APY */}
        <div>
          <div className="text-xs text-gray-500 mb-1">初始年化</div>
          <div className="text-sm font-medium text-gray-700">
            {tracking.initialAPY.toFixed(2)}%
          </div>
        </div>

        {/* Settlements */}
        <div>
          <div className="text-xs text-gray-500 mb-1">結算次數</div>
          <div className="text-sm font-medium text-gray-700">
            {tracking.totalSettlements} 次
          </div>
        </div>

        {/* Duration */}
        <div>
          <div className="text-xs text-gray-500 mb-1">追蹤時長</div>
          <div className="text-sm font-medium text-gray-700 flex items-center gap-1">
            <Clock className="w-4 h-4 text-gray-400" />
            {tracking.durationFormatted || '計算中...'}
          </div>
        </div>
      </div>

      {/* Actions */}
      {tracking.status === 'ACTIVE' && onStop && (
        <div className="px-4 pb-4">
          <button
            onClick={() => onStop(tracking.id)}
            disabled={isStopLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            <Square className="w-4 h-4" />
            {isStopLoading ? '處理中...' : '停止追蹤'}
          </button>
        </div>
      )}
    </div>
  );
}
