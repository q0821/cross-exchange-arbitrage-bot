/**
 * ClosePositionDialog - 平倉確認對話框
 *
 * 顯示市價、預估損益，讓用戶確認平倉操作
 * Feature: 035-close-position (T020)
 */

'use client';

import React from 'react';
import { X, Loader2, AlertTriangle, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import type { PositionInfo } from '@/src/types/trading';
import type { MarketData } from '../hooks/useClosePosition';

interface ClosePositionDialogProps {
  position: PositionInfo;
  marketData: MarketData | null;
  isLoading: boolean;
  isClosing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 格式化數字
 */
function formatNumber(value: number | string, decimals: number = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return num.toFixed(decimals);
}

/**
 * 格式化持倉時間
 */
function formatDuration(openedAt: string): string {
  const opened = new Date(openedAt);
  const now = new Date();
  const diffMs = now.getTime() - opened.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  const days = Math.floor(diffSeconds / 86400);
  const hours = Math.floor((diffSeconds % 86400) / 3600);
  const minutes = Math.floor((diffSeconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} 天`);
  if (hours > 0) parts.push(`${hours} 小時`);
  if (minutes > 0) parts.push(`${minutes} 分`);

  return parts.length > 0 ? parts.join(' ') : '少於 1 分鐘';
}

export function ClosePositionDialog({
  position,
  marketData,
  isLoading,
  isClosing,
  onConfirm,
  onCancel,
}: ClosePositionDialogProps) {
  const isProfitable = marketData ? marketData.estimatedPnL.netPnL >= 0 : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={!isClosing ? onCancel : undefined}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">平倉確認</h2>
          {!isClosing && (
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
              <p className="text-sm text-gray-600">載入市場數據...</p>
            </div>
          ) : marketData ? (
            <div className="space-y-4">
              {/* Symbol */}
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900">{position.symbol}</h3>
                <div className="flex items-center justify-center gap-1 text-sm text-gray-500 mt-1">
                  <Clock className="w-4 h-4" />
                  持倉時間: {formatDuration(position.createdAt)}
                </div>
              </div>

              {/* Long Side */}
              <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                <div className="flex items-center gap-1 text-green-600 font-medium mb-2">
                  <TrendingUp className="w-4 h-4" />
                  多頭 ({marketData.longExchange.name})
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">開倉價:</span>
                    <span className="ml-1 font-medium">
                      ${formatNumber(marketData.longExchange.entryPrice)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">現價:</span>
                    <span className="ml-1 font-medium">
                      ${formatNumber(marketData.longExchange.currentPrice)}
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-sm">
                  <span className="text-gray-500">未實現損益:</span>
                  <span
                    className={`ml-1 font-medium ${
                      marketData.longExchange.unrealizedPnL >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {marketData.longExchange.unrealizedPnL >= 0 ? '+' : ''}
                    {formatNumber(marketData.longExchange.unrealizedPnL)} USDT
                  </span>
                </div>
              </div>

              {/* Short Side */}
              <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                <div className="flex items-center gap-1 text-red-600 font-medium mb-2">
                  <TrendingDown className="w-4 h-4" />
                  空頭 ({marketData.shortExchange.name})
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">開倉價:</span>
                    <span className="ml-1 font-medium">
                      ${formatNumber(marketData.shortExchange.entryPrice)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">現價:</span>
                    <span className="ml-1 font-medium">
                      ${formatNumber(marketData.shortExchange.currentPrice)}
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-sm">
                  <span className="text-gray-500">未實現損益:</span>
                  <span
                    className={`ml-1 font-medium ${
                      marketData.shortExchange.unrealizedPnL >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {marketData.shortExchange.unrealizedPnL >= 0 ? '+' : ''}
                    {formatNumber(marketData.shortExchange.unrealizedPnL)} USDT
                  </span>
                </div>
              </div>

              {/* Estimated PnL */}
              <div
                className={`rounded-lg p-4 ${
                  isProfitable
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <h4 className="text-sm font-medium text-gray-600 mb-2">預估損益</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">價差損益:</span>
                    <span
                      className={
                        marketData.estimatedPnL.priceDiffPnL >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }
                    >
                      {marketData.estimatedPnL.priceDiffPnL >= 0 ? '+' : ''}
                      {formatNumber(marketData.estimatedPnL.priceDiffPnL)} USDT
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">預估手續費:</span>
                    <span className="text-gray-700">
                      -{formatNumber(marketData.estimatedPnL.fees)} USDT
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-200 font-medium">
                    <span className="text-gray-700">淨損益:</span>
                    <span
                      className={`text-lg ${isProfitable ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {isProfitable ? '+' : ''}
                      {formatNumber(marketData.estimatedPnL.netPnL)} USDT
                    </span>
                  </div>
                </div>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-700">
                  平倉將使用市價單執行，實際成交價格可能與預估有所差異。確認平倉後操作無法取消。
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
              <p className="text-sm text-gray-600">無法載入市場數據</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onCancel}
            disabled={isClosing}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading || isClosing || !marketData}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isClosing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                平倉中...
              </>
            ) : (
              '確認平倉'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ClosePositionDialog;
