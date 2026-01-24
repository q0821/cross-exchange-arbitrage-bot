'use client';

/**
 * Position Detail Card Component (Feature 068)
 *
 * 顯示持倉詳細資訊，包含開倉時資金費率
 */

import { useTranslations, useLocale } from 'next-intl';
import type { AdminPositionDetail } from '@/src/types/admin';

interface PositionDetailCardProps {
  position: AdminPositionDetail;
}

export function PositionDetailCard({ position }: PositionDetailCardProps) {
  const t = useTranslations('positions');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const formatDate = (date: Date | undefined) => {
    if (!date) return tCommon('na');
    const d = new Date(date);

    if (locale === 'zh-TW') {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${year}/${month}/${day} ${hours}:${minutes}`;
    }

    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFundingRate = (rate: string) => {
    const value = parseFloat(rate);
    return `${(value * 100).toFixed(4)}%`;
  };

  const isOpen = position.status === 'OPEN' || position.status === 'OPENING';
  const isClosed = position.status === 'CLOSED' || position.status === 'CLOSING';

  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-xl p-5 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-slate-900 dark:text-white font-medium text-lg">{position.symbol}</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              isOpen
                ? 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400'
                : isClosed
                  ? 'bg-slate-100 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400'
                  : 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
            }`}
          >
            {t(`status.${position.status}`)}
          </span>
        </div>
        <span className="text-slate-500 dark:text-slate-400 text-sm">{formatDate(position.openedAt)}</span>
      </div>

      {/* Exchange Info */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Long Side */}
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
          <div className="text-green-600 dark:text-green-400 text-xs uppercase mb-2">
            {t('card.long')} ({position.longExchange})
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">{t('card.entry')}</span>
              <span className="text-slate-900 dark:text-white">${position.longEntryPrice}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">{t('card.size')}</span>
              <span className="text-slate-900 dark:text-white">{position.longPositionSize}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">{t('card.leverage')}</span>
              <span className="text-slate-900 dark:text-white">{position.longLeverage}x</span>
            </div>
          </div>
        </div>

        {/* Short Side */}
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
          <div className="text-red-600 dark:text-red-400 text-xs uppercase mb-2">
            {t('card.short')} ({position.shortExchange})
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">{t('card.entry')}</span>
              <span className="text-slate-900 dark:text-white">${position.shortEntryPrice}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">{t('card.size')}</span>
              <span className="text-slate-900 dark:text-white">{position.shortPositionSize}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">{t('card.leverage')}</span>
              <span className="text-slate-900 dark:text-white">{position.shortLeverage}x</span>
            </div>
          </div>
        </div>
      </div>

      {/* Open Funding Rates (spec requirement) */}
      <div className="bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20 rounded-lg p-3 mb-4">
        <div className="text-blue-600 dark:text-blue-400 text-xs uppercase mb-2">{t('card.openFundingRates')}</div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">{t('card.long')}</span>
            <span
              className={
                parseFloat(position.openFundingRateLong) >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }
            >
              {formatFundingRate(position.openFundingRateLong)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">{t('card.short')}</span>
            <span
              className={
                parseFloat(position.openFundingRateShort) >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }
            >
              {formatFundingRate(position.openFundingRateShort)}
            </span>
          </div>
        </div>
      </div>

      {/* Stop Loss / Take Profit */}
      {(position.stopLossEnabled || position.takeProfitEnabled) && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          {position.stopLossEnabled && (
            <div className="bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-lg p-2 text-center">
              <div className="text-red-600 dark:text-red-400 text-xs">{t('card.stopLoss')}</div>
              <div className="text-slate-900 dark:text-white text-sm">{position.stopLossPercent}%</div>
            </div>
          )}
          {position.takeProfitEnabled && (
            <div className="bg-green-50 dark:bg-green-500/5 border border-green-200 dark:border-green-500/20 rounded-lg p-2 text-center">
              <div className="text-green-600 dark:text-green-400 text-xs">{t('card.takeProfit')}</div>
              <div className="text-slate-900 dark:text-white text-sm">{position.takeProfitPercent}%</div>
            </div>
          )}
        </div>
      )}

      {/* Trade Result (if closed) */}
      {position.trade && (
        <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
          <div className="text-slate-500 dark:text-slate-400 text-xs uppercase mb-2">{t('card.tradeResult')}</div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">{t('card.pricePnl')}</span>
              <span
                className={
                  parseFloat(position.trade.priceDiffPnL) >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }
              >
                ${position.trade.priceDiffPnL}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">{t('card.fundingPnl')}</span>
              <span
                className={
                  parseFloat(position.trade.fundingRatePnL) >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }
              >
                ${position.trade.fundingRatePnL}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">{t('card.totalPnl')}</span>
              <span
                className={`font-medium ${
                  parseFloat(position.trade.totalPnL) >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                ${position.trade.totalPnL}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">{t('card.roi')}</span>
              <span
                className={
                  parseFloat(position.trade.roi) >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }
              >
                {position.trade.roi}%
              </span>
            </div>
          </div>
          {position.closedAt && (
            <div className="text-slate-400 dark:text-slate-500 text-xs mt-2">
              {t('card.closedAt')} {formatDate(position.closedAt)} ({t('card.duration', { hours: Math.round(position.trade.holdingDuration / 3600) })})
            </div>
          )}
        </div>
      )}
    </div>
  );
}
