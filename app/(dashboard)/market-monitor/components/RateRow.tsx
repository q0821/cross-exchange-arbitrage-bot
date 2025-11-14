/**
 * RateRow - 費率表格行組件
 * 顯示單一交易對的完整資訊
 *
 * Feature: 006-web-trading-platform (User Story 2.5)
 * Feature: 012-specify-scripts-bash (User Story 1 - T021)
 */

'use client';

import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { StatusBadge, OpportunityStatus } from './StatusBadge';
import { ExchangeLink } from '@/components/market';
import { formatFundingInterval } from '../utils/formatters';
import { NetProfitTooltip } from './NetProfitTooltip';

// 交易所名稱類型
export type ExchangeName = 'binance' | 'okx' | 'mexc' | 'gateio';

// 單個交易所的費率數據
export interface ExchangeRate {
  rate: number;
  ratePercent?: string;
  price?: number | null;
  // Feature 012: Normalized rate data (optional)
  normalizedRate?: number;
  originalFundingInterval?: number;
  targetTimeBasis?: number;
}

// 最佳套利對信息
export interface BestArbitragePair {
  longExchange: ExchangeName;   // 做多的交易所
  shortExchange: ExchangeName;  // 做空的交易所
  spread: number;               // 利差（小數）
  spreadPercent: number;        // 利差百分比
  annualizedReturn: number;     // 年化收益
  priceDiffPercent?: number | null;  // 價差百分比（正值表示有利，負值表示不利）
  netReturn?: number | null;     // 淨收益百分比（扣除價差和手續費後的真實獲利）
}

// 市場費率數據（支持多交易所）
export interface MarketRate {
  symbol: string;
  exchanges: Record<ExchangeName, ExchangeRate>;  // 所有交易所的費率
  bestPair: BestArbitragePair | null;             // 最佳套利對
  status: OpportunityStatus;
  timestamp: string;
}

interface RateRowProps {
  rate: MarketRate;
  onSymbolClick?: (symbol: string) => void;
  onQuickOpen?: (rate: MarketRate) => void;
}

/**
 * RateRow 組件
 * 使用 React.memo 優化性能，避免不必要的重新渲染
 */
export const RateRow = React.memo(function RateRow({
  rate,
  onSymbolClick,
  onQuickOpen,
}: RateRowProps) {
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
            {/* Feature 012: Show normalized rate with tooltip for original interval */}
            {exchangeData.normalizedRate !== undefined && exchangeData.originalFundingInterval ? (
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <span className="font-mono text-sm cursor-help underline decoration-dotted">
                    {formatRate(exchangeData.normalizedRate)}
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
                        原始結算週期：{formatFundingInterval(exchangeData.originalFundingInterval)}
                      </div>
                      {exchangeData.targetTimeBasis && (
                        <div className="text-gray-300 text-[11px]">
                          標準化為：{formatFundingInterval(exchangeData.targetTimeBasis)}
                        </div>
                      )}
                    </div>
                    <Tooltip.Arrow className="fill-gray-900" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            ) : (
              <span className="font-mono text-sm">{formatRate(exchangeData.rate)}</span>
            )}
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
  const isTopOpportunity = rate.status === 'opportunity' &&
    rate.bestPair?.netReturn !== undefined &&
    rate.bestPair.netReturn > 0.5; // Top if net return > 0.5%

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
                  高收益機會！淨收益 &gt; 0.5%
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

      {/* 淨收益 */}
      <td className="px-4 py-3 text-right">
        {rate.bestPair?.netReturn != null && !isNaN(rate.bestPair.netReturn) ? (
          <NetProfitTooltip
            netProfit={rate.bestPair.netReturn}
            spreadPercent={rate.bestPair.spreadPercent}
            priceDiffPercent={rate.bestPair.priceDiffPercent}
          />
        ) : (
          <span className="font-mono text-sm text-gray-400">N/A</span>
        )}
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
        {rate.status === 'opportunity' && (
          <button
            onClick={handleQuickOpen}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            快速開倉
          </button>
        )}
      </td>
    </tr>
  );
});
