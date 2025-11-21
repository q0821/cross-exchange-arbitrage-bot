/**
 * RateRow - 費率表格行組件
 * 顯示單一交易對的完整資訊
 *
 * Feature: 006-web-trading-platform (User Story 2.5)
 * Feature: 012-specify-scripts-bash (User Story 1 - T021)
 */

'use client';

import React, { useState, useEffect } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Copy, Check } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { ExchangeLink } from '@/components/market';
import { formatFundingInterval } from '../utils/formatters';
import { FeeEstimateTooltip } from './FeeEstimateTooltip';
import { formatArbitrageMessage } from '../utils/formatArbitrageMessage';
import type {
  ExchangeName,
  MarketRate,
  TimeBasis,
} from '../types';

interface RateRowProps {
  rate: MarketRate;
  timeBasis: TimeBasis; // Feature 012: 用戶選擇的時間基準
  onSymbolClick?: (symbol: string) => void;
  onQuickOpen?: (rate: MarketRate) => void;
}

/**
 * RateRow 組件
 * 使用 React.memo 優化性能，避免不必要的重新渲染
 * Feature 012: 根據用戶選擇的 timeBasis 顯示對應的標準化費率
 */
export const RateRow = React.memo(function RateRow({
  rate,
  timeBasis,
  onSymbolClick,
  onQuickOpen,
}: RateRowProps) {
  // Feature 020: 複製狀態管理
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSymbolClick = () => {
    if (onSymbolClick) {
      onSymbolClick(rate.symbol);
    }
  };

  const handleQuickOpen = (e: React.MouseEvent) => {
    e.stopPropagation(); // 防止觸發行點擊事件
    if (onQuickOpen) {
      onQuickOpen(rate);
    }
  };

  // Feature 020: 複製套利資訊到剪貼板
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // 如果沒有 bestPair，不執行複製
    if (!rate.bestPair) {
      return;
    }

    try {
      const message = formatArbitrageMessage(rate);
      await navigator.clipboard.writeText(message);
      setCopyStatus('success');
    } catch (err) {
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
        return 'bg-green-50 hover:bg-green-100';
      case 'approaching':
        return 'bg-yellow-50 hover:bg-yellow-100';
      default:
        return 'hover:bg-gray-50';
    }
  };

  // 交易所列表（固定順序）
  const exchangeList: ExchangeName[] = ['binance', 'okx', 'mexc', 'gateio'];

  // 渲染交易所費率單元格
  const renderExchangeCell = (exchangeName: ExchangeName) => {
    const exchangeData = rate.exchanges[exchangeName];

    // 如果沒有該交易所的數據，顯示 "-"
    if (!exchangeData) {
      return (
        <td key={exchangeName} className="px-4 py-3 text-right">
          <span className="text-gray-400">-</span>
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
            <span className="inline-block px-2 py-0.5 text-xs font-medium text-white bg-green-600 rounded">
              做多
            </span>
          )}
          {isShort && (
            <span className="inline-block px-2 py-0.5 text-xs font-medium text-white bg-red-600 rounded">
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
                        className="bg-gray-900 text-white text-xs rounded px-3 py-2 shadow-lg z-50"
                        sideOffset={5}
                      >
                        <div className="space-y-1">
                          <div className="font-semibold">原始資金費率：</div>
                          <div>{formatRate(exchangeData.rate)}</div>
                          <div className="text-gray-300 text-[11px] mt-1">
                            原始結算週期：{formatFundingInterval(originalInterval)}
                          </div>
                          <div className="text-gray-300 text-[11px]">
                            已標準化為：{formatFundingInterval(timeBasis)} 基準
                          </div>
                        </div>
                        <Tooltip.Arrow className="fill-gray-900" />
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
            <span className="text-xs text-gray-500">${formatPrice(exchangeData.price)}</span>
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
            className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
          >
            {rate.symbol}
          </button>
          {/* Feature 012 T041: Visual indicator for best opportunities */}
          {isTopOpportunity && (
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <span className="inline-flex items-center justify-center w-5 h-5 bg-yellow-400 text-yellow-900 rounded-full text-xs font-bold cursor-help">
                  ⭐
                </span>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  className="bg-gray-900 text-white text-xs rounded px-3 py-2 shadow-lg z-50"
                  sideOffset={5}
                >
                  高收益機會！費率差異 &gt; 0.5%
                  <Tooltip.Arrow className="fill-gray-900" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          )}
          {/* Feature 012 T044: Stale data indicator */}
          {isStale && (
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <span className="inline-flex items-center px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded cursor-help">
                  陳舊
                </span>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  className="bg-gray-900 text-white text-xs rounded px-3 py-2 shadow-lg z-50"
                  sideOffset={5}
                >
                  數據可能已過時（超過 30 秒未更新）
                  <Tooltip.Arrow className="fill-gray-900" />
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
              ? 'text-green-600'
              : rate.status === 'approaching'
              ? 'text-yellow-600'
              : 'text-gray-600'
          }`}
        >
          {rate.bestPair ? rate.bestPair.spreadPercent.toFixed(4) + '%' : '-'}
        </span>
      </td>

      {/* 年化收益 */}
      <td className="px-4 py-3 text-right">
        <span className="font-mono text-sm">
          {rate.bestPair ? rate.bestPair.annualizedReturn.toFixed(2) + '%' : '-'}
        </span>
      </td>

      {/* 價差 */}
      <td className="px-4 py-3 text-right">
        <span className="font-mono text-sm">
          {rate.bestPair?.priceDiffPercent != null && !isNaN(rate.bestPair.priceDiffPercent)
            ? `${rate.bestPair.priceDiffPercent >= 0 ? '+' : ''}${rate.bestPair.priceDiffPercent.toFixed(2)}%`
            : 'N/A'}
        </span>
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
                ? 'text-gray-300 cursor-not-allowed'
                : copyStatus === 'success'
                ? 'text-green-600 bg-green-50'
                : copyStatus === 'error'
                ? 'text-red-600 bg-red-50'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            title={!rate.bestPair ? '無套利機會' : '複製套利資訊'}
          >
            {copyStatus === 'success' ? (
              <Check className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>

          {rate.status === 'opportunity' && (
            <button
              onClick={handleQuickOpen}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              快速開倉
            </button>
          )}
        </div>
      </td>
    </tr>
  );
});
