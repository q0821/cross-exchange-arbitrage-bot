/**
 * PositionRateBadge - 單一交易所費率徽章
 * 顯示交易所名稱、費率和倒計時
 *
 * Feature: 持倉管理頁面顯示即時資金費率
 */

'use client';

import { useMemo } from 'react';
import { ArrowUpCircle, ArrowDownCircle, Clock } from 'lucide-react';
import { formatRatePercent, formatCountdown } from '../types/position-rates';

interface PositionRateBadgeProps {
  /** 交易所名稱 */
  exchange: string;
  /** 費率（原始值，如 0.0001 表示 0.01%） */
  rate: number;
  /** 下次結算時間 */
  nextFundingTime: Date | null;
  /** 持倉方向：'long' 做多 或 'short' 做空 */
  side: 'long' | 'short';
  /** 當前時間（用於計算倒計時） */
  currentTime?: Date;
  /** 緊湊模式 */
  compact?: boolean;
  /** 原始費率週期（小時），如 8 表示每 8 小時結算一次 */
  originalInterval?: number | null;
  /** 標準化為 1 小時的費率（百分比），如 -0.0211 */
  normalized1hPercent?: number | null;
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
 * 格式化標準化費率顯示
 * @param percent 百分比值（如 -0.0211 表示 -0.0211%）
 * @returns 格式化字串，如 "-0.0211%/h"
 */
function formatNormalized1h(percent: number): string {
  const sign = percent >= 0 ? '+' : '';
  return `${sign}${percent.toFixed(4)}%/h`;
}

export function PositionRateBadge({
  exchange,
  rate,
  nextFundingTime,
  side,
  currentTime = new Date(),
  compact = false,
  originalInterval,
  normalized1hPercent,
}: PositionRateBadgeProps) {
  // 計算倒計時
  const timeUntilNext = useMemo(() => {
    if (!nextFundingTime) return null;
    return nextFundingTime.getTime() - currentTime.getTime();
  }, [nextFundingTime, currentTime]);

  // 費率顏色：正費率（收取）綠色，負費率（支付）紅色
  const rateColor = rate >= 0 ? 'text-profit' : 'text-loss';
  const bgColor = rate >= 0 ? 'bg-profit/10' : 'bg-loss/10';

  // 方向圖示和顏色
  const SideIcon = side === 'long' ? ArrowUpCircle : ArrowDownCircle;
  const sideColor = side === 'long' ? 'text-profit' : 'text-loss';
  const sideLabel = side === 'long' ? '做多' : '做空';

  // 是否有週期資訊可顯示
  const hasIntervalInfo = originalInterval != null && originalInterval > 0;
  const hasNormalized1h = normalized1hPercent != null;

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${bgColor}`}>
        <SideIcon className={`w-3 h-3 ${sideColor}`} />
        <span className="text-muted-foreground">{formatExchange(exchange)}</span>
        <span className={`font-mono ${rateColor}`}>
          {formatRatePercent(rate)}
          {hasIntervalInfo && <span className="text-muted-foreground">/{originalInterval}h</span>}
        </span>
        {hasNormalized1h && (
          <span className={`font-mono text-[10px] ${normalized1hPercent >= 0 ? 'text-profit' : 'text-loss'}`}>
            = {formatNormalized1h(normalized1hPercent)}
          </span>
        )}
      </span>
    );
  }

  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 rounded-md ${bgColor} border border-border/50`}>
      <div className="flex items-center gap-1">
        <SideIcon className={`w-4 h-4 ${sideColor}`} />
        <span className="text-xs text-muted-foreground">{sideLabel}</span>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-foreground">
            {formatExchange(exchange)}
          </span>
          <span className={`text-xs font-mono ${rateColor}`}>
            {formatRatePercent(rate)}
            {hasIntervalInfo && (
              <span className="text-muted-foreground"> / {originalInterval}h</span>
            )}
          </span>
        </div>
        {/* 標準化費率顯示 */}
        {hasNormalized1h && (
          <div className={`text-[10px] font-mono mt-0.5 ${normalized1hPercent >= 0 ? 'text-profit' : 'text-loss'}`}>
            = {formatNormalized1h(normalized1hPercent)}
          </div>
        )}
        {/* 倒計時顯示 */}
        {timeUntilNext !== null && (
          <div className="flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              {formatCountdown(timeUntilNext)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
