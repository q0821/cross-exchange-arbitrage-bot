/**
 * RateRow - 費率表格行組件
 * 顯示單一交易對的完整資訊
 *
 * Feature: 006-web-trading-platform (User Story 2.5)
 * Feature: 012-specify-scripts-bash (User Story 1 - T021)
 */

'use client';

import { useState, useEffect, memo } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Copy, Check } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { ExchangeLink } from '@/components/market';
import { formatFundingInterval } from '../utils/formatters';
import { FeeEstimateTooltip } from './FeeEstimateTooltip';
import { PaybackTooltip } from './PaybackTooltip';
import { TrackButton } from './TrackButton';
import { OpenPositionButton } from './OpenPositionButton';
import { formatArbitrageMessage } from '../utils/formatArbitrageMessage';
import { calculatePaybackPeriods } from '../utils/rateCalculations';
import { getPriceRiskLevel, PRICE_DIFF_WARNING_THRESHOLD } from '@/lib/priceRisk';
import { isArbitragePairRestricted } from '@/lib/trading-restrictions';
import type { ExchangeName, MarketRate, TimeBasis } from '../types';

interface RateRowProps {
  rate: MarketRate;
  timeBasis: TimeBasis; // Feature 012: 用戶選擇的時間基準
  activeExchanges: ExchangeName[]; // 後端啟用的交易所列表
  onSymbolClick?: (symbol: string) => void;
  onQuickOpen?: (rate: MarketRate) => void;
  // Feature 029: 追蹤功能
  isTracking?: boolean;
  isTrackingLoading?: boolean;
  onTrackClick?: (rate: MarketRate) => void;
}

/**
 * RateRow 組件
 * 使用 React.memo 優化性能，避免不必要的重新渲染
 * Feature 012: 根據用戶選擇的 timeBasis 顯示對應的標準化費率
 */
export const RateRow = memo(function RateRow({
  rate,
  timeBasis,
  activeExchanges,
  onSymbolClick,
  onQuickOpen,
  isTracking = false,
  isTrackingLoading = false,
  onTrackClick,
}: RateRowProps) {
  // Feature 020: 複製狀態管理
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSymbolClick = () => {
    if (onSymbolClick) {
      onSymbolClick(rate.symbol);
    }
  };

  // 現在直接在 onClick 中調用 onQuickOpen，不需要單獨的處理函數

  // Feature 020 + Feature 023: 複製套利資訊到剪貼板
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // 如果沒有 bestPair，不執行複製
    if (!rate.bestPair) {
      return;
    }

    try {
      // Feature 023: 傳遞 timeBasis 參數以顯示正確的時間基準
      const message = formatArbitrageMessage(rate, timeBasis);
      await navigator.clipboard.writeText(message);
      setCopyStatus('success');
    } catch (_err) {
      console.error('Failed to copy to clipboard:', err);
      setCopyStatus('error');
    }
  };

  // Feature 020: 自動重置複製狀態（2 秒後）
  useEffect(() => {
    if (copyStatus !== 'idle') {
      const timer = setTimeout(() => {
        setCopyStatus('idle');
      }, 2000);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [copyStatus]);

  // 格式化費率為百分比顯示
  const formatRate = (rateValue: number) => {
    return (rateValue * 100).toFixed(4) + '%';
  };

  // 格式化價格顯示（根據價格大小自動調整精度）
  const formatPrice = (price?: number | null) => {
    if (!price) return '-';

    // 根據價格大小決定小數位數
    let decimals = 2;
    if (price >= 1000) {
      decimals = 2; // 高價幣：BTC, ETH 等，顯示 2 位小數
    } else if (price >= 1) {
      decimals = 4; // 中價幣：顯示 4 位小數
    } else if (price >= 0.01) {
      decimals = 6; // 低價幣：顯示 6 位小數
    } else {
      decimals = 8; // 極低價幣：顯示 8 位小數
    }

    return price.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  // 根據狀態決定行的背景色
  const getRowBgColor = () => {
    switch (rate.status) {
      case 'opportunity':
        return 'bg-profit/10 hover:bg-profit/20';
      case 'approaching':
        return 'bg-warning/10 hover:bg-warning/20';
      default:
        return 'hover:bg-muted';
    }
  };

  // 交易所列表（使用後端啟用的交易所）
  const exchangeList: ExchangeName[] = activeExchanges;

  // 渲染交易所費率單元格
  const renderExchangeCell = (exchangeName: ExchangeName) => {
    const exchangeData = rate.exchanges[exchangeName];

    // 如果沒有該交易所的數據，顯示 "-"
    if (!exchangeData) {
      return (
        <td key={exchangeName} className="px-4 py-3 text-right">
          <span className="text-muted-foreground">-</span>
        </td>
      );
    }

    // 判斷是否為做多或做空交易所
    const isLong = rate.bestPair?.longExchange === exchangeName;
    const isShort = rate.bestPair?.shortExchange === exchangeName;

    return (
      <td key={exchangeName} className="px-4 py-3 text-right">
        <div className="flex flex-col items-end gap-1">
          {/* 做多/做空標籤 */}
          {isLong && (
            <span className="inline-block px-2 py-0.5 text-xs font-medium text-background bg-profit rounded">
              做多
            </span>
          )}
          {isShort && (
            <span className="inline-block px-2 py-0.5 text-xs font-medium text-background bg-loss rounded">
              做空
            </span>
          )}

          {/* 費率與交易所連結 */}
          <div className="flex items-center gap-1 justify-end">
            {/* Feature 012: 根據 timeBasis 顯示對應的標準化費率 */}
            {(() => {
              const timeBasisKey = `${timeBasis}h` as '1h' | '4h' | '8h' | '24h';
              const normalizedRate = exchangeData.normalized?.[timeBasisKey];
              const originalInterval = exchangeData.originalInterval;

              // 如果有標準化費率且原始週期與目標不同，顯示標準化費率並加上 tooltip
              if (normalizedRate !== undefined && originalInterval && originalInterval !== timeBasis) {
                return (
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <span className="font-mono text-sm cursor-help underline decoration-dotted">
                        {formatRate(normalizedRate)}
                      </span>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="bg-foreground text-background text-xs rounded px-3 py-2 shadow-lg z-50"
                        sideOffset={5}
                      >
                        <div className="space-y-1">
                          <div className="font-semibold">原始資金費率：</div>
                          <div>{formatRate(exchangeData.rate)}</div>
                          <div className="text-muted-foreground text-[11px] mt-1">
                            原始結算週期：{formatFundingInterval(originalInterval)}
                          </div>
                          <div className="text-muted-foreground text-[11px]">
                            已標準化為：{formatFundingInterval(timeBasis)} 基準
                          </div>
                        </div>
                        <Tooltip.Arrow className="fill-foreground" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                );
              }

              // 否則直接顯示原始費率
              return <span className="font-mono text-sm">{formatRate(exchangeData.rate)}</span>;
            })()}
            <ExchangeLink
              exchange={exchangeName}
              symbol={rate.symbol}
              isAvailable={!!exchangeData.rate}
            />
          </div>

          {/* 價格 */}
          {exchangeData.price && (
            <span className="text-xs text-muted-foreground">${formatPrice(exchangeData.price)}</span>
          )}
        </div>
      </td>
    );
  };

  // Feature 012 T041: Determine if this is a top opportunity
  // Feature 014: Updated to use spreadPercent instead of netReturn
  const isTopOpportunity = rate.status === 'opportunity' &&
    rate.bestPair?.spreadPercent !== undefined &&
    rate.bestPair?.spreadPercent !== null &&
    rate.bestPair.spreadPercent > 0.5; // Top if spread > 0.5%

  // Feature 012 T044: Check if data is stale (older than 30 seconds)
  const isStale = (() => {
    try {
      const timestamp = new Date(rate.timestamp);
      const now = new Date();
      const ageInSeconds = (now.getTime() - timestamp.getTime()) / 1000;
      return ageInSeconds > 30;
    } catch {
      return false;
    }
  })();

  return (
    <tr className={`border-b transition-colors ${getRowBgColor()}`}>
      {/* 交易對名稱 */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={handleSymbolClick}
            className="font-medium text-primary hover:text-primary/80 hover:underline"
          >
            {rate.symbol}
          </button>
          {/* Feature 012 T041: Visual indicator for best opportunities */}
          {isTopOpportunity && (
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <span className="inline-flex items-center justify-center w-5 h-5 bg-warning text-warning rounded-full text-xs font-bold cursor-help">
                  ⭐
                </span>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  className="bg-foreground text-background text-xs rounded px-3 py-2 shadow-lg z-50"
                  sideOffset={5}
                >
                  高收益機會！費率差異 &gt; 0.5%
                  <Tooltip.Arrow className="fill-foreground" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          )}
          {/* Feature 012 T044: Stale data indicator */}
          {isStale && (
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <span className="inline-flex items-center px-2 py-0.5 bg-warning/10 text-warning text-xs font-medium rounded cursor-help">
                  陳舊
                </span>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  className="bg-foreground text-background text-xs rounded px-3 py-2 shadow-lg z-50"
                  sideOffset={5}
                >
                  數據可能已過時（超過 30 秒未更新）
                  <Tooltip.Arrow className="fill-foreground" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          )}
        </div>
      </td>

      {/* 4 個交易所的費率列 */}
      {exchangeList.map((exchange) => renderExchangeCell(exchange))}

      {/* 費率差異 */}
      <td className="px-4 py-3 text-right">
        <span
          className={`font-mono text-sm font-semibold ${
            rate.status === 'opportunity'
              ? 'text-profit'
              : rate.status === 'approaching'
              ? 'text-warning'
              : 'text-muted-foreground'
          }`}
        >
          {rate.bestPair
            ? Number(rate.bestPair.spreadPercent).toFixed(4) + '%'
            : '-'}
        </span>
      </td>

      {/* 年化收益 */}
      <td className="px-4 py-3 text-right">
        <span className="font-mono text-sm">
          {rate.bestPair
            ? Number(rate.bestPair.annualizedReturn).toFixed(2) + '%'
            : '-'}
        </span>
      </td>

      {/* 價差 + 回本指標 (Feature 025) + 風險警告 (Feature 033) */}
      <td className="px-4 py-3 text-right">
        <div className="flex flex-col items-end gap-1">
          {/* 價差百分比 + 風險警告 */}
          {(() => {
            const priceDiff = rate.bestPair?.priceDiffPercent;
            const riskLevel = getPriceRiskLevel(priceDiff);

            // 格式化價差顯示
            const formatPriceDiff = (value: number | string | null | undefined) => {
              const numValue = typeof value === 'string' ? parseFloat(value) : value;
              if (numValue === null || numValue === undefined || Number.isNaN(numValue)) {
                return 'N/A';
              }
              return `${numValue >= 0 ? '+' : ''}${numValue.toFixed(2)}%`;
            };

            if (riskLevel === 'unknown') {
              // 無價差資訊
              return (
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <span className="font-mono text-sm text-warning font-medium cursor-help">
                      ⚠️ N/A
                    </span>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      className="bg-warning text-warning-foreground text-xs rounded px-3 py-2 shadow-lg z-50 max-w-xs"
                      sideOffset={5}
                    >
                      <div className="font-semibold mb-1">風險提示</div>
                      <div>無價差資訊，開倉前請自行確認兩交易所的價差，避免因價差過大導致虧損。</div>
                      <Tooltip.Arrow className="fill-warning" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              );
            }

            if (riskLevel === 'warning') {
              // 價差過大警告
              return (
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <span className="font-mono text-sm text-warning font-medium cursor-help">
                      ⚠️ {formatPriceDiff(priceDiff!)}
                    </span>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      className="bg-warning text-warning-foreground text-xs rounded px-3 py-2 shadow-lg z-50 max-w-xs"
                      sideOffset={5}
                    >
                      <div className="font-semibold mb-1">價差警告</div>
                      <div>
                        價差 {Math.abs(typeof priceDiff === 'string' ? parseFloat(priceDiff) : priceDiff ?? 0).toFixed(2)}% 超過 {PRICE_DIFF_WARNING_THRESHOLD}%，
                        開倉成本較高，請評估是否值得進場。
                      </div>
                      <Tooltip.Arrow className="fill-warning" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              );
            }

            // 安全範圍
            return (
              <span className="font-mono text-sm">
                {formatPriceDiff(priceDiff!)}
              </span>
            );
          })()}

          {/* Feature 025: 回本次數指標 + Tooltip (US3) */}
          {rate.bestPair && (() => {
            const payback = calculatePaybackPeriods(
              rate.bestPair.priceDiffPercent,
              rate.bestPair.spreadPercent,
              timeBasis
            );

            // 根據狀態決定是否顯示回本指標
            if (payback.status === 'no_data') {
              // 無數據時不顯示額外指標
              return null;
            }

            const indicator = (
              <span
                className={`text-xs ${
                  payback.color === 'green' ? 'text-profit' :
                  payback.color === 'orange' ? 'text-warning' :
                  payback.color === 'red' ? 'text-loss' :
                  'text-muted-foreground'
                }`}
              >
                {payback.displayText}
              </span>
            );

            // US3: 如果有詳細資訊，用 Tooltip 包裹
            if (payback.details) {
              return (
                <PaybackTooltip payback={payback}>
                  {indicator}
                </PaybackTooltip>
              );
            }

            return indicator;
          })()}
        </div>
      </td>

      {/* 預估手續費 */}
      <td className="px-4 py-3 text-right">
        <FeeEstimateTooltip />
      </td>

      {/* 狀態 */}
      <td className="px-4 py-3">
        <StatusBadge
          status={rate.status}
          spreadPercent={rate.bestPair?.spreadPercent || 0}
        />
      </td>

      {/* 操作 */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {/* Feature 020: 複製按鈕 */}
          <button
            onClick={handleCopy}
            disabled={!rate.bestPair}
            className={`p-2 rounded-md transition-colors ${
              !rate.bestPair
                ? 'text-muted-foreground cursor-not-allowed'
                : copyStatus === 'success'
                ? 'text-profit bg-profit/10'
                : copyStatus === 'error'
                ? 'text-loss bg-loss/10'
                : 'text-muted-foreground hover:bg-muted'
            }`}
            title={!rate.bestPair ? '無套利機會' : '複製套利資訊'}
          >
            {copyStatus === 'success' ? (
              <Check className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>

          {/* Feature 029: 追蹤按鈕 */}
          {onTrackClick && (
            <TrackButton
              isTracking={isTracking}
              isLoading={isTrackingLoading}
              disabled={!rate.bestPair}
              onClick={() => onTrackClick(rate)}
            />
          )}

          {/* Feature 033: 開倉按鈕 - 只在 opportunity 狀態顯示 (T031, T033) */}
          {/* Feature 044: 涉及 MEXC 時顯示警告並禁用 */}
          {onQuickOpen && rate.status === 'opportunity' && rate.bestPair && (
            <OpenPositionButton
              disabled={false}
              onClick={() => onQuickOpen(rate)}
              isMexcRestricted={isArbitragePairRestricted(
                rate.bestPair.longExchange,
                rate.bestPair.shortExchange
              )}
            />
          )}
        </div>
      </td>
    </tr>
  );
});
