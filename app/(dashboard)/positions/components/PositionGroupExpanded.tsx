/**
 * PositionGroupExpanded - 組合持倉展開檢視組件
 * 顯示組內所有持倉的詳細資訊
 *
 * Feature 069: 分單持倉合併顯示與批量平倉
 */

'use client';

import { useMemo } from 'react';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Clock,
  Shield,
  Target,
  TrendingUp,
  TrendingDown,
  DollarSign,
} from 'lucide-react';
import type { Position, PositionGroup } from '@/hooks/queries/usePositionsQuery';

interface PositionGroupExpandedProps {
  group: PositionGroup;
  onClose?: () => void;
  onClosePosition?: (positionId: string) => void;
}

/**
 * 格式化交易所名稱
 */
function formatExchange(exchange: string): string {
  const exchangeMap: Record<string, string> = {
    binance: 'Binance',
    okx: 'OKX',
    gateio: 'Gate.io',
    mexc: 'MEXC',
    bingx: 'BingX',
  };
  return exchangeMap[exchange] || exchange;
}

/**
 * 格式化數字
 */
function formatNumber(value: string | number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * 格式化價格
 */
function formatPrice(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  if (num >= 1000) {
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 8,
  });
}

/**
 * 單一持倉行
 */
function PositionRow({
  position,
  index,
  onClosePosition,
}: {
  position: Position;
  index: number;
  onClosePosition?: (positionId: string) => void;
}) {
  return (
    <tr className="border-b border-border hover:bg-muted/50">
      <td className="px-3 py-2 text-sm text-muted-foreground">#{index + 1}</td>
      <td className="px-3 py-2 text-sm font-mono">{position.id.slice(0, 12)}...</td>
      <td className="px-3 py-2 text-sm text-center">{position.leverage}x</td>
      <td className="px-3 py-2 text-sm text-right">
        {position.stopLossPercent ? (
          <span className="inline-flex items-center gap-1 text-loss">
            <Shield className="w-3 h-3" />
            {position.stopLossPercent}%
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>
      <td className="px-3 py-2 text-sm text-right">
        {position.takeProfitPercent ? (
          <span className="inline-flex items-center gap-1 text-profit">
            <Target className="w-3 h-3" />
            {position.takeProfitPercent}%
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>
      <td className="px-3 py-2 text-sm text-right text-muted-foreground">
        {new Date(position.createdAt).toLocaleString()}
      </td>
      <td className="px-3 py-2 text-sm text-right">
        {onClosePosition && position.status === 'OPEN' && (
          <button
            onClick={() => onClosePosition(position.id)}
            className="text-loss hover:underline text-xs"
          >
            平倉
          </button>
        )}
      </td>
    </tr>
  );
}

export function PositionGroupExpanded({
  group,
  onClose,
  onClosePosition,
}: PositionGroupExpandedProps) {
  const { aggregate, positions } = group;

  // 計算匯總統計
  const stats = useMemo(() => {
    const totalPnL = aggregate.totalFundingPnL
      ? parseFloat(aggregate.totalFundingPnL)
      : null;
    const unrealizedPnL = aggregate.totalUnrealizedPnL
      ? parseFloat(aggregate.totalUnrealizedPnL)
      : null;

    return {
      totalPnL,
      unrealizedPnL,
      totalQuantity: parseFloat(aggregate.totalQuantity),
      avgLongPrice: parseFloat(aggregate.avgLongEntryPrice),
      avgShortPrice: parseFloat(aggregate.avgShortEntryPrice),
      positionCount: aggregate.positionCount,
    };
  }, [aggregate]);

  return (
    <div className="glass-card border border-border">
      {/* Header */}
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {group.symbol} 組合持倉詳情
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Group ID: {group.groupId.slice(0, 8)}... · {stats.positionCount} 組持倉
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted transition-colors"
            >
              返回
            </button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="p-4 border-b border-border">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 總數量 */}
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs">總數量</span>
            </div>
            <p className="text-lg font-semibold">
              {formatNumber(stats.totalQuantity, 4)}
            </p>
          </div>

          {/* 資金費率收益 */}
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              {stats.totalPnL !== null && stats.totalPnL >= 0 ? (
                <TrendingUp className="w-4 h-4 text-profit" />
              ) : (
                <TrendingDown className="w-4 h-4 text-loss" />
              )}
              <span className="text-xs">資金費率收益</span>
            </div>
            <p
              className={`text-lg font-semibold ${
                stats.totalPnL !== null
                  ? stats.totalPnL >= 0
                    ? 'text-profit'
                    : 'text-loss'
                  : 'text-muted-foreground'
              }`}
            >
              {stats.totalPnL !== null
                ? `${stats.totalPnL >= 0 ? '+' : ''}$${formatNumber(stats.totalPnL)}`
                : '-'}
            </p>
          </div>

          {/* 平均做多價格 */}
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-profit mb-1">
              <ArrowUpCircle className="w-4 h-4" />
              <span className="text-xs">平均做多價格</span>
            </div>
            <p className="text-lg font-semibold">
              ${formatPrice(stats.avgLongPrice)}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatExchange(group.longExchange)}
            </p>
          </div>

          {/* 平均做空價格 */}
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-loss mb-1">
              <ArrowDownCircle className="w-4 h-4" />
              <span className="text-xs">平均做空價格</span>
            </div>
            <p className="text-lg font-semibold">
              ${formatPrice(stats.avgShortPrice)}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatExchange(group.shortExchange)}
            </p>
          </div>
        </div>
      </div>

      {/* Positions Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr className="text-xs text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">#</th>
              <th className="px-3 py-2 text-left font-medium">Position ID</th>
              <th className="px-3 py-2 text-center font-medium">槓桿</th>
              <th className="px-3 py-2 text-right font-medium">停損</th>
              <th className="px-3 py-2 text-right font-medium">停利</th>
              <th className="px-3 py-2 text-right font-medium">開倉時間</th>
              <th className="px-3 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position, index) => (
              <PositionRow
                key={position.id}
                position={position}
                index={index}
                onClosePosition={onClosePosition}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border bg-muted/30">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>
              首次開倉:{' '}
              {aggregate.firstOpenedAt
                ? new Date(aggregate.firstOpenedAt).toLocaleString()
                : '-'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {aggregate.stopLossPercent && (
              <span className="flex items-center gap-1 text-loss">
                <Shield className="w-4 h-4" />
                統一停損: {aggregate.stopLossPercent}%
              </span>
            )}
            {aggregate.takeProfitPercent && (
              <span className="flex items-center gap-1 text-profit">
                <Target className="w-4 h-4" />
                統一停利: {aggregate.takeProfitPercent}%
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
