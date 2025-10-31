/**
 * RateRow - 費率表格行組件
 * 顯示單一交易對的完整資訊
 *
 * Feature: 006-web-trading-platform (User Story 2.5)
 */

'use client';

import React from 'react';
import { StatusBadge, OpportunityStatus } from './StatusBadge';

export interface MarketRate {
  symbol: string;
  binance: {
    rate: number;
    ratePercent?: string;
    price?: number;
  };
  okx: {
    rate: number;
    ratePercent?: string;
    price?: number;
  };
  spread: number;
  spreadPercent?: string;
  annualizedReturn?: string;
  netReturn?: string;
  priceDiffPercent?: string | null;
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

  // 格式化價格顯示
  const formatPrice = (price?: number) => {
    if (!price) return '-';
    return price.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
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

  return (
    <tr className={`border-b transition-colors ${getRowBgColor()}`}>
      {/* 交易對名稱 */}
      <td className="px-4 py-3">
        <button
          onClick={handleSymbolClick}
          className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
        >
          {rate.symbol}
        </button>
      </td>

      {/* Binance 費率 */}
      <td className="px-4 py-3 text-right">
        <div className="flex flex-col items-end">
          <span className="font-mono text-sm">{formatRate(rate.binance.rate)}</span>
          {rate.binance.price && (
            <span className="text-xs text-gray-500">${formatPrice(rate.binance.price)}</span>
          )}
        </div>
      </td>

      {/* OKX 費率 */}
      <td className="px-4 py-3 text-right">
        <div className="flex flex-col items-end">
          <span className="font-mono text-sm">{formatRate(rate.okx.rate)}</span>
          {rate.okx.price && (
            <span className="text-xs text-gray-500">${formatPrice(rate.okx.price)}</span>
          )}
        </div>
      </td>

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
          {rate.spreadPercent || (rate.spread * 100).toFixed(4) + '%'}
        </span>
      </td>

      {/* 年化收益 */}
      <td className="px-4 py-3 text-right">
        <span className="font-mono text-sm">{rate.annualizedReturn || '-'}</span>
      </td>

      {/* 淨收益 */}
      <td className="px-4 py-3 text-right">
        <span
          className={`font-mono text-sm font-semibold ${
            rate.netReturn && parseFloat(rate.netReturn) > 0
              ? 'text-green-600'
              : 'text-red-600'
          }`}
        >
          {rate.netReturn || '-'}
        </span>
      </td>

      {/* 狀態 */}
      <td className="px-4 py-3">
        <StatusBadge
          status={rate.status}
          spreadPercent={parseFloat(rate.spreadPercent || '0')}
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
