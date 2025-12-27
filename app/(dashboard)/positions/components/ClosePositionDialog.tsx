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
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={!isClosing ? onCancel : undefined}
      />

      {/* Dialog */}
      <div className="relative bg-card rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">平倉確認</h2>
          {!isClosing && (
            <button
              onClick={onCancel}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
              <p className="text-sm text-muted-foreground">載入市場數據...</p>
            </div>
          ) : marketData ? (
            <div className="space-y-4">
              {/* Symbol */}
              <div className="text-center">
                <h3 className="text-xl font-bold text-foreground">{position.symbol}</h3>
                <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mt-1">
                  <Clock className="w-4 h-4" />
                  持倉時間: {formatDuration(position.createdAt)}
                </div>
              </div>

              {/* Long Side */}
              <div className="bg-profit/10 rounded-lg p-3 border border-profit/30">
                <div className="flex items-center gap-1 text-profit font-medium mb-2">
                  <TrendingUp className="w-4 h-4" />
                  多頭 ({marketData.longExchange.name})
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">開倉價:</span>
                    <span className="ml-1 font-medium">
                      ${formatNumber(marketData.longExchange.entryPrice)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">現價:</span>
                    <span className="ml-1 font-medium">
                      ${formatNumber(marketData.longExchange.currentPrice)}
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-sm">
                  <span className="text-muted-foreground">未實現損益:</span>
                  <span
                    className={`ml-1 font-medium ${
                      marketData.longExchange.unrealizedPnL >= 0
                        ? 'text-profit'
                        : 'text-loss'
                    }`}
                  >
                    {marketData.longExchange.unrealizedPnL >= 0 ? '+' : ''}
                    {formatNumber(marketData.longExchange.unrealizedPnL)} USDT
                  </span>
                </div>
              </div>

              {/* Short Side */}
              <div className="bg-loss/10 rounded-lg p-3 border border-loss/30">
                <div className="flex items-center gap-1 text-loss font-medium mb-2">
                  <TrendingDown className="w-4 h-4" />
                  空頭 ({marketData.shortExchange.name})
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">開倉價:</span>
                    <span className="ml-1 font-medium">
                      ${formatNumber(marketData.shortExchange.entryPrice)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">現價:</span>
                    <span className="ml-1 font-medium">
                      ${formatNumber(marketData.shortExchange.currentPrice)}
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-sm">
                  <span className="text-muted-foreground">未實現損益:</span>
                  <span
                    className={`ml-1 font-medium ${
                      marketData.shortExchange.unrealizedPnL >= 0
                        ? 'text-profit'
                        : 'text-loss'
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
                    ? 'bg-profit/10 border border-profit/30'
                    : 'bg-loss/10 border border-loss/30'
                }`}
              >
                <h4 className="text-sm font-medium text-muted-foreground mb-2">預估損益</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">價差損益:</span>
                    <span
                      className={
                        marketData.estimatedPnL.priceDiffPnL >= 0
                          ? 'text-profit'
                          : 'text-loss'
                      }
                    >
                      {marketData.estimatedPnL.priceDiffPnL >= 0 ? '+' : ''}
                      {formatNumber(marketData.estimatedPnL.priceDiffPnL)} USDT
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">預估手續費:</span>
                    <span className="text-foreground">
                      -{formatNumber(marketData.estimatedPnL.fees)} USDT
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-border font-medium">
                    <span className="text-foreground">淨損益:</span>
                    <span
                      className={`text-lg ${isProfitable ? 'text-profit' : 'text-loss'}`}
                    >
                      {isProfitable ? '+' : ''}
                      {formatNumber(marketData.estimatedPnL.netPnL)} USDT
                    </span>
                  </div>
                </div>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <p className="text-sm text-warning">
                  平倉將使用市價單執行，實際成交價格可能與預估有所差異。確認平倉後操作無法取消。
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">無法載入市場數據</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted">
          <button
            onClick={onCancel}
            disabled={isClosing}
            className="px-4 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading || isClosing || !marketData}
            className="px-4 py-2 text-sm font-medium text-white bg-loss rounded-md hover:bg-loss/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
