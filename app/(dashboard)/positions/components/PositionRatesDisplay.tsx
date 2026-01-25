/**
 * PositionRatesDisplay - 持倉即時費率顯示區塊
 * 組合顯示做多/做空交易所的費率和費率差
 *
 * Feature: 持倉管理頁面顯示即時資金費率
 */

'use client';

import { Activity, WifiOff } from 'lucide-react';
import { PositionRateBadge } from './PositionRateBadge';
import { PositionSpreadBadge } from './PositionSpreadBadge';
import type { PositionRateInfo } from '../types/position-rates';

interface PositionRatesDisplayProps {
  /** 持倉費率資訊（從 usePositionRates hook 獲取） */
  rateInfo: PositionRateInfo | null;
  /** 是否已連線 */
  isConnected: boolean;
  /** 當前時間（用於倒計時計算） */
  currentTime: Date;
  /** 緊湊模式（用於組合持倉卡片） */
  compact?: boolean;
}

export function PositionRatesDisplay({
  rateInfo,
  isConnected,
  currentTime,
  compact = false,
}: PositionRatesDisplayProps) {
  // 未連線時的顯示
  if (!isConnected) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted border border-border/50">
        <WifiOff className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          即時費率連線中...
        </span>
      </div>
    );
  }

  // 沒有費率數據時的顯示
  if (!rateInfo) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted border border-border/50">
        <Activity className="w-4 h-4 text-muted-foreground animate-pulse" />
        <span className="text-xs text-muted-foreground">
          載入即時費率...
        </span>
      </div>
    );
  }

  // 緊湊模式：一行顯示
  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {rateInfo.longExchange && (
          <PositionRateBadge
            exchange={rateInfo.longExchange.name}
            rate={rateInfo.longExchange.rate}
            nextFundingTime={rateInfo.longExchange.nextFundingTime}
            side="long"
            currentTime={currentTime}
            compact
            originalInterval={rateInfo.longExchange.originalInterval}
            normalized1hPercent={rateInfo.longExchange.normalized1hPercent}
          />
        )}
        {rateInfo.shortExchange && (
          <PositionRateBadge
            exchange={rateInfo.shortExchange.name}
            rate={rateInfo.shortExchange.rate}
            nextFundingTime={rateInfo.shortExchange.nextFundingTime}
            side="short"
            currentTime={currentTime}
            compact
            originalInterval={rateInfo.shortExchange.originalInterval}
            normalized1hPercent={rateInfo.shortExchange.normalized1hPercent}
          />
        )}
        <PositionSpreadBadge
          spreadPercent={rateInfo.spreadPercent}
          isFavorable={rateInfo.isFavorable}
          compact
        />
      </div>
    );
  }

  // 標準模式：區塊顯示
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Activity className="w-3.5 h-3.5" />
        <span>即時資金費率</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {rateInfo.longExchange && (
          <PositionRateBadge
            exchange={rateInfo.longExchange.name}
            rate={rateInfo.longExchange.rate}
            nextFundingTime={rateInfo.longExchange.nextFundingTime}
            side="long"
            currentTime={currentTime}
            originalInterval={rateInfo.longExchange.originalInterval}
            normalized1hPercent={rateInfo.longExchange.normalized1hPercent}
          />
        )}
        {rateInfo.shortExchange && (
          <PositionRateBadge
            exchange={rateInfo.shortExchange.name}
            rate={rateInfo.shortExchange.rate}
            nextFundingTime={rateInfo.shortExchange.nextFundingTime}
            side="short"
            currentTime={currentTime}
            originalInterval={rateInfo.shortExchange.originalInterval}
            normalized1hPercent={rateInfo.shortExchange.normalized1hPercent}
          />
        )}
      </div>
      <PositionSpreadBadge
        spreadPercent={rateInfo.spreadPercent}
        isFavorable={rateInfo.isFavorable}
      />
    </div>
  );
}
