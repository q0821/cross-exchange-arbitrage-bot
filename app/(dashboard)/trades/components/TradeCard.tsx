/**
 * TradeCard - 交易記錄卡片組件
 *
 * 顯示單筆交易的績效資訊
 * Feature: 035-close-position (T018)
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Loader2,
  DollarSign,
} from 'lucide-react';
import type { TradePerformanceInfo } from '@/src/types/trading';

interface FundingFeeEntry {
  timestamp: number;
  datetime: string;
  amount: string;
  symbol: string;
  id: string;
}

interface FundingDetails {
  tradeId: string;
  symbol: string;
  longExchange: string;
  shortExchange: string;
  openedAt: string;
  closedAt: string;
  longEntries: FundingFeeEntry[];
  shortEntries: FundingFeeEntry[];
  longTotal: string;
  shortTotal: string;
  total: string;
}

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
  const [fundingDetails, setFundingDetails] = useState<FundingDetails | null>(null);
  const [fundingLoading, setFundingLoading] = useState(false);
  const [fundingError, setFundingError] = useState<string | null>(null);

  const totalPnL = parseFloat(trade.totalPnL);
  const roi = parseFloat(trade.roi);
  const isProfitable = totalPnL >= 0;

  const closedDate = new Date(trade.closedAt);

  // 獲取資金費率明細
  const fetchFundingDetails = useCallback(async () => {
    if (fundingDetails || fundingLoading) return;

    setFundingLoading(true);
    setFundingError(null);

    try {
      const response = await fetch(`/api/trades/${trade.id}/funding-details`);
      const data = await response.json();

      if (data.success) {
        setFundingDetails(data.data);
      } else {
        setFundingError(data.error?.message || '無法獲取資金費率明細');
      }
    } catch {
      setFundingError('網路錯誤，無法獲取資金費率明細');
    } finally {
      setFundingLoading(false);
    }
  }, [trade.id, fundingDetails, fundingLoading]);

  // 展開時獲取資金費率明細
  useEffect(() => {
    if (isExpanded && !fundingDetails && !fundingLoading) {
      fetchFundingDetails();
    }
  }, [isExpanded, fundingDetails, fundingLoading, fetchFundingDetails]);

  return (
    <div className="glass-card rounded-lg border border-border shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-foreground">{trade.symbol}</h3>
            {trade.status === 'PARTIAL' && (
              <span className="px-2 py-0.5 text-xs font-medium bg-warning/10 text-warning rounded-full">
                部分成功
              </span>
            )}
          </div>
          <div
            className={`text-right ${isProfitable ? 'text-profit' : 'text-loss'}`}
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
        <p className="text-xs text-muted-foreground mt-1">
          {closedDate.toLocaleDateString()} {closedDate.toLocaleTimeString()}
        </p>
      </div>

      {/* Summary */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4 mb-3">
          {/* Long Side */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-profit">
              <ArrowUpCircle className="w-4 h-4" />
              <span className="text-sm font-medium">做多</span>
            </div>
            <p className="text-sm text-foreground capitalize">{trade.longExchange}</p>
          </div>

          {/* Short Side */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-loss">
              <ArrowDownCircle className="w-4 h-4" />
              <span className="text-sm font-medium">做空</span>
            </div>
            <p className="text-sm text-foreground capitalize">{trade.shortExchange}</p>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="text-center p-2 bg-muted rounded">
            <p className="text-xs text-muted-foreground mb-1">價差損益</p>
            <p
              className={`font-medium ${
                parseFloat(trade.priceDiffPnL) >= 0 ? 'text-profit' : 'text-loss'
              }`}
            >
              {parseFloat(trade.priceDiffPnL) >= 0 ? '+' : ''}
              {formatNumber(trade.priceDiffPnL)}
            </p>
          </div>
          <div className="text-center p-2 bg-muted rounded">
            <p className="text-xs text-muted-foreground mb-1">資金費率</p>
            <p
              className={`font-medium ${
                parseFloat(trade.fundingRatePnL) >= 0 ? 'text-profit' : 'text-loss'
              }`}
            >
              {parseFloat(trade.fundingRatePnL) >= 0 ? '+' : ''}
              {formatNumber(trade.fundingRatePnL)}
            </p>
          </div>
          <div className="text-center p-2 bg-muted rounded">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
              <Clock className="w-3 h-3" />
              持倉時間
            </div>
            <p className="font-medium text-foreground text-xs">
              {formatDuration(trade.holdingDuration)}
            </p>
          </div>
        </div>

        {/* Expand Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full mt-3 pt-3 border-t border-border flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"
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
          <div className="mt-3 pt-3 border-t border-border space-y-3">
            {/* Long Side Details */}
            <div className="text-sm">
              <h4 className="flex items-center gap-1 font-medium text-profit mb-2">
                <TrendingUp className="w-4 h-4" />
                多頭詳情 ({trade.longExchange})
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">開倉價:</span>
                  <span className="ml-1 text-foreground">
                    ${formatNumber(trade.longEntryPrice)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">平倉價:</span>
                  <span className="ml-1 text-foreground">
                    ${formatNumber(trade.longExitPrice)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">數量:</span>
                  <span className="ml-1 text-foreground">
                    {formatNumber(trade.longPositionSize, 4)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">損益:</span>
                  <span
                    className={`ml-1 ${
                      parseFloat(trade.longExitPrice) >= parseFloat(trade.longEntryPrice)
                        ? 'text-profit'
                        : 'text-loss'
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
              <h4 className="flex items-center gap-1 font-medium text-loss mb-2">
                <TrendingDown className="w-4 h-4" />
                空頭詳情 ({trade.shortExchange})
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">開倉價:</span>
                  <span className="ml-1 text-foreground">
                    ${formatNumber(trade.shortEntryPrice)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">平倉價:</span>
                  <span className="ml-1 text-foreground">
                    ${formatNumber(trade.shortExitPrice)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">數量:</span>
                  <span className="ml-1 text-foreground">
                    {formatNumber(trade.shortPositionSize, 4)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">損益:</span>
                  <span
                    className={`ml-1 ${
                      parseFloat(trade.shortEntryPrice) >= parseFloat(trade.shortExitPrice)
                        ? 'text-profit'
                        : 'text-loss'
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

            {/* Funding Fee Details */}
            <div className="text-sm">
              <h4 className="flex items-center gap-1 font-medium text-primary mb-2">
                <DollarSign className="w-4 h-4" />
                資金費率明細
              </h4>

              {fundingLoading && (
                <div className="flex items-center justify-center py-4 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  載入中...
                </div>
              )}

              {fundingError && (
                <div className="text-xs text-loss py-2">{fundingError}</div>
              )}

              {fundingDetails && (
                <div className="space-y-3">
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-2 text-xs bg-primary/10 p-2 rounded">
                    <div className="text-center">
                      <p className="text-muted-foreground">多頭 ({fundingDetails.longExchange})</p>
                      <p className={`font-medium ${parseFloat(fundingDetails.longTotal) >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {parseFloat(fundingDetails.longTotal) >= 0 ? '+' : ''}{parseFloat(fundingDetails.longTotal).toFixed(4)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground">空頭 ({fundingDetails.shortExchange})</p>
                      <p className={`font-medium ${parseFloat(fundingDetails.shortTotal) >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {parseFloat(fundingDetails.shortTotal) >= 0 ? '+' : ''}{parseFloat(fundingDetails.shortTotal).toFixed(4)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground">總計</p>
                      <p className={`font-medium ${parseFloat(fundingDetails.total) >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {parseFloat(fundingDetails.total) >= 0 ? '+' : ''}{parseFloat(fundingDetails.total).toFixed(4)}
                      </p>
                    </div>
                  </div>

                  {/* Long Entries */}
                  {fundingDetails.longEntries.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">多頭結算記錄 ({fundingDetails.longEntries.length} 筆)</p>
                      <div className="max-h-32 overflow-y-auto border border-border rounded">
                        <table className="w-full text-xs">
                          <thead className="bg-muted sticky top-0">
                            <tr>
                              <th className="px-2 py-1 text-left">時間</th>
                              <th className="px-2 py-1 text-right">金額</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...fundingDetails.longEntries]
                              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                              .map((entry) => (
                              <tr key={entry.id} className="border-t border-border">
                                <td className="px-2 py-1">{new Date(entry.timestamp).toLocaleString()}</td>
                                <td className={`px-2 py-1 text-right ${parseFloat(entry.amount) >= 0 ? 'text-profit' : 'text-loss'}`}>
                                  {parseFloat(entry.amount) >= 0 ? '+' : ''}{parseFloat(entry.amount).toFixed(6)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Short Entries */}
                  {fundingDetails.shortEntries.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">空頭結算記錄 ({fundingDetails.shortEntries.length} 筆)</p>
                      <div className="max-h-32 overflow-y-auto border border-border rounded">
                        <table className="w-full text-xs">
                          <thead className="bg-muted sticky top-0">
                            <tr>
                              <th className="px-2 py-1 text-left">時間</th>
                              <th className="px-2 py-1 text-right">金額</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...fundingDetails.shortEntries]
                              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                              .map((entry) => (
                              <tr key={entry.id} className="border-t border-border">
                                <td className="px-2 py-1">{new Date(entry.timestamp).toLocaleString()}</td>
                                <td className={`px-2 py-1 text-right ${parseFloat(entry.amount) >= 0 ? 'text-profit' : 'text-loss'}`}>
                                  {parseFloat(entry.amount) >= 0 ? '+' : ''}{parseFloat(entry.amount).toFixed(6)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* No entries */}
                  {fundingDetails.longEntries.length === 0 && fundingDetails.shortEntries.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">無資金費率結算記錄</p>
                  )}
                </div>
              )}
            </div>

            {/* Timestamps */}
            <div className="text-xs text-muted-foreground">
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
