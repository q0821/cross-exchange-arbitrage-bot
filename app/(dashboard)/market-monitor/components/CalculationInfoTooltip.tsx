/**
 * CalculationInfoTooltip Component
 *
 * General-purpose tooltip for displaying calculation information
 *
 * Feature: 012-specify-scripts-bash (User Story 3 - T042)
 */

'use client';

import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';

export interface CalculationInfoTooltipProps {
  /** Tooltip title */
  title: string;
  /** Main content lines */
  content: string[];
  /** Optional footer note */
  footer?: string;
  /** Trigger element (if not provided, uses default info icon) */
  children?: React.ReactNode;
}

/**
 * CalculationInfoTooltip Component
 *
 * Displays calculation information in a tooltip
 * Can be used for any type of calculation explanation
 */
export function CalculationInfoTooltip({
  title,
  content,
  footer,
  children,
}: CalculationInfoTooltipProps) {
  const defaultTrigger = (
    <span className="inline-flex items-center justify-center w-4 h-4 bg-gray-200 text-gray-600 rounded-full text-xs cursor-help hover:bg-gray-300 transition-colors">
      ?
    </span>
  );

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        {children || defaultTrigger}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className="bg-gray-900 text-white text-xs rounded px-3 py-2 max-w-xs shadow-lg z-50"
          sideOffset={5}
        >
          <div className="space-y-1">
            <div className="font-semibold text-sm mb-2">{title}</div>
            {content.map((line, index) => (
              <div key={index} className="text-gray-200">
                {line}
              </div>
            ))}
            {footer && (
              <div className="text-gray-400 text-[11px] mt-2 pt-2 border-t border-gray-700">
                {footer}
              </div>
            )}
          </div>
          <Tooltip.Arrow className="fill-gray-900" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/**
 * Pre-configured tooltips for common calculations
 */
export const AnnualizedReturnInfo = () => (
  <CalculationInfoTooltip
    title="年化收益計算"
    content={[
      '年化收益 = 費率差異 × 365 × 3',
      '資金費率每 8 小時結算一次',
      '一年共 1095 次結算（365 × 3）',
    ]}
    footer="此為理論最大收益，實際收益需扣除手續費和價差成本"
  />
);

export const PriceDiffInfo = () => (
  <CalculationInfoTooltip
    title="價差計算"
    content={[
      '價差 = (做空價格 - 做多價格) / 平均價格 × 100',
      '正值：做空價格較高（有利）',
      '負值：做空價格較低（不利）',
    ]}
    footer="價差會影響實際套利收益"
  />
);

export const NetReturnInfo = () => (
  <CalculationInfoTooltip
    title="淨收益計算"
    content={[
      '淨收益 = 費率差異 - 手續費 (0.2%)',
      '手續費 = 4 筆交易 × 0.05% taker fee',
      '綠色：> 0.1% (優質機會)',
      '黃色：-0.05% ~ 0.1% (邊際機會)',
      '紅色：< -0.05% (不建議)',
    ]}
    footer="這是扣除所有交易成本後的真實獲利"
  />
);
