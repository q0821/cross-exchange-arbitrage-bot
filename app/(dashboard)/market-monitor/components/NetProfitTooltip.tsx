/**
 * NetProfitTooltip Component
 *
 * Displays detailed calculation breakdown for net profit
 *
 * Feature: 012-specify-scripts-bash (User Story 2 - T031)
 */

'use client';

import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';

export interface NetProfitTooltipProps {
  /** Net profit percentage */
  netProfit: number;
  /** Funding rate spread percentage */
  spreadPercent: number;
  /** Price difference percentage (optional) */
  priceDiffPercent?: number | null;
  /** Taker fee rate (default: 0.0005 per trade, 0.002 total for 4 trades) */
  takerFeeRate?: number;
}

/**
 * NetProfitTooltip Component
 *
 * Shows calculation details in tooltip:
 * - Rate spread
 * - Transaction fees (4 trades × 0.05% = 0.2%)
 * - Net profit = spread - fees
 */
export function NetProfitTooltip({
  netProfit,
  spreadPercent,
  priceDiffPercent,
  takerFeeRate = 0.0005,
}: NetProfitTooltipProps) {
  const totalFeePercent = takerFeeRate * 4 * 100; // Convert to percentage
  const formattedSpread = spreadPercent.toFixed(4);
  const formattedFee = totalFeePercent.toFixed(2);
  const formattedNetProfit = netProfit.toFixed(4);

  // Determine color class based on profit
  const colorClass =
    netProfit > 0.1
      ? 'bg-green-100 text-green-800'
      : netProfit >= -0.05 && netProfit <= 0.1
      ? 'bg-yellow-100 text-yellow-800'
      : 'bg-red-100 text-red-800';

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <span
          className={`font-mono text-sm font-semibold px-2 py-1 rounded cursor-help ${colorClass}`}
        >
          {netProfit >= 0 ? '+' : ''}
          {formattedNetProfit}%
        </span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className="bg-gray-900 text-white text-xs rounded px-3 py-2 max-w-xs shadow-lg z-50"
          sideOffset={5}
        >
          <div className="space-y-1">
            <div className="font-semibold text-sm mb-2">淨收益計算詳情</div>

            <div className="flex justify-between gap-4">
              <span className="text-gray-300">費率差異：</span>
              <span className="font-mono">{formattedSpread}%</span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-gray-300">交易手續費：</span>
              <span className="font-mono">-{formattedFee}%</span>
            </div>

            <div className="text-[11px] text-gray-400 mt-1">
              (4 筆交易 × {(takerFeeRate * 100).toFixed(2)}% taker fee)
            </div>

            {priceDiffPercent != null && !isNaN(priceDiffPercent) && (
              <>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-300">價差影響：</span>
                  <span
                    className={`font-mono ${
                      priceDiffPercent >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {priceDiffPercent >= 0 ? '+' : ''}
                    {priceDiffPercent.toFixed(2)}%
                  </span>
                </div>
                <div className="text-[11px] text-gray-400">
                  ({priceDiffPercent >= 0 ? '有利' : '不利'})
                </div>
              </>
            )}

            <div className="border-t border-gray-700 my-2"></div>

            <div className="flex justify-between gap-4">
              <span className="font-semibold">淨收益：</span>
              <span
                className={`font-mono font-semibold ${
                  netProfit >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {netProfit >= 0 ? '+' : ''}
                {formattedNetProfit}%
              </span>
            </div>

            <div className="text-[11px] text-gray-400 mt-2">
              計算公式：淨收益 = 費率差異 - 手續費
            </div>
          </div>
          <Tooltip.Arrow className="fill-gray-900" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
