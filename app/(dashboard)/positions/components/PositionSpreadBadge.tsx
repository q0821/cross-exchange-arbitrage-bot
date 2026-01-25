/**
 * PositionSpreadBadge - 費率差徽章
 * 顯示做多/做空之間的費率差，指示是否有利
 *
 * Feature: 持倉管理頁面顯示即時資金費率
 */

'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PositionSpreadBadgeProps {
  /** 費率差百分比（做空費率 - 做多費率） */
  spreadPercent: number | null;
  /** 是否有利 */
  isFavorable: boolean | null;
  /** 緊湊模式 */
  compact?: boolean;
}

export function PositionSpreadBadge({
  spreadPercent,
  isFavorable,
  compact = false,
}: PositionSpreadBadgeProps) {
  // 沒有數據時的顯示
  if (spreadPercent === null || isFavorable === null) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted text-xs text-muted-foreground">
        <Minus className="w-3 h-3" />
        <span>費率差: 無數據</span>
      </span>
    );
  }

  // 根據有利/不利決定顏色和圖示
  const isPositive = spreadPercent > 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const color = isFavorable ? 'text-profit' : 'text-loss';
  const bgColor = isFavorable ? 'bg-profit/10' : 'bg-loss/10';
  const label = isFavorable ? '有利' : '不利';

  // 格式化費率差
  const formattedSpread = Math.abs(spreadPercent).toFixed(4);
  const sign = spreadPercent >= 0 ? '+' : '-';

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${bgColor}`}>
        <Icon className={`w-3 h-3 ${color}`} />
        <span className={`font-mono ${color}`}>{sign}{formattedSpread}%</span>
      </span>
    );
  }

  return (
    <div className={`flex items-center justify-between px-2 py-1.5 rounded-md ${bgColor} border border-border/50`}>
      <span className="text-xs text-muted-foreground">費率差:</span>
      <div className="flex items-center gap-1.5">
        <span className={`text-xs font-mono ${color}`}>
          {sign}{formattedSpread}%
        </span>
        <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${color}`}>
          {label}
          <Icon className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
}
