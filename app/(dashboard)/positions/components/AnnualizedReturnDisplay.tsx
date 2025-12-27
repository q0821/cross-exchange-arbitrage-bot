/**
 * AnnualizedReturnDisplay - 年化報酬率顯示組件
 *
 * 顯示預估年化報酬率及計算依據
 * Feature: 045-position-details-view
 */

'use client';

import React from 'react';
import { Percent, TrendingUp, TrendingDown, Info } from 'lucide-react';
import type { AnnualizedReturnInfo } from '@/src/types/trading';

interface AnnualizedReturnDisplayProps {
  annualizedReturn?: AnnualizedReturnInfo;
  error?: string;
}

/**
 * 格式化時間為可讀格式
 */
function formatHoldingTime(hours: number): string {
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes} 分鐘`;
  }
  if (hours < 24) {
    return `${hours.toFixed(1)} 小時`;
  }
  const days = hours / 24;
  return `${days.toFixed(1)} 天`;
}

export function AnnualizedReturnDisplay({
  annualizedReturn,
  error,
}: AnnualizedReturnDisplayProps) {
  // 無法計算的情況
  if (error) {
    return (
      <div className="pt-3 border-t border-border">
        <div className="flex items-center gap-1 text-foreground font-medium text-sm mb-2">
          <Percent className="w-4 h-4" />
          <span>預估年化報酬率</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground italic">
          <Info className="w-3 h-3" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  // 無資料
  if (!annualizedReturn) {
    return null;
  }

  const { value, totalPnL, margin, holdingHours } = annualizedReturn;
  const isPositive = value >= 0;
  const colorClass = isPositive ? 'text-profit' : 'text-loss';
  const bgColorClass = isPositive ? 'bg-profit/10' : 'bg-loss/10';
  const borderColorClass = isPositive ? 'border-profit/30' : 'border-loss/30';
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <div className="pt-3 border-t border-border">
      <div className="flex items-center gap-1 text-foreground font-medium text-sm mb-2">
        <Percent className="w-4 h-4" />
        <span>預估年化報酬率</span>
      </div>

      {/* 年化報酬率大數字顯示 */}
      <div className={`p-3 rounded-lg border ${bgColorClass} ${borderColorClass}`}>
        <div className="flex items-center justify-center gap-2">
          <TrendIcon className={`w-6 h-6 ${colorClass}`} />
          <span className={`text-2xl font-bold ${colorClass}`}>
            {isPositive ? '+' : ''}{value.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* 計算依據 */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="text-center p-2 bg-muted rounded">
          <div className="text-muted-foreground">總損益</div>
          <div className={`font-medium ${totalPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(4)}
          </div>
        </div>
        <div className="text-center p-2 bg-muted rounded">
          <div className="text-muted-foreground">保證金</div>
          <div className="font-medium text-foreground">
            ${margin.toFixed(2)}
          </div>
        </div>
        <div className="text-center p-2 bg-muted rounded">
          <div className="text-muted-foreground">持倉時間</div>
          <div className="font-medium text-foreground">
            {formatHoldingTime(holdingHours)}
          </div>
        </div>
      </div>

      {/* 計算公式說明 */}
      <div className="mt-2 text-xs text-muted-foreground italic">
        公式: (總損益 ÷ 保證金) × (365 × 24 ÷ 持倉小時數) × 100%
      </div>
    </div>
  );
}
