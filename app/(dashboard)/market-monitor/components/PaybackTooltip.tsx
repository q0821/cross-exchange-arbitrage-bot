/**
 * PaybackTooltip - 價差回本資訊工具提示組件
 *
 * Feature 025: 價差回本週期指標 (User Story 3)
 *
 * 當用戶將滑鼠移到回本指標上時，顯示詳細的計算資訊
 */

'use client';

import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import type { PaybackResult } from '../types/payback';

interface PaybackTooltipProps {
  payback: PaybackResult;
  children: React.ReactNode;
}

/**
 * 格式化時間顯示
 * - < 24 小時：顯示「約 X.X 小時」
 * - >= 24 小時：顯示「約 X.X 天」
 */
function formatEstimatedTime(hours: number): string {
  if (hours < 24) {
    return `約 ${hours.toFixed(1)} 小時`;
  }
  const days = hours / 24;
  return `約 ${days.toFixed(1)} 天`;
}

/**
 * PaybackTooltip 組件
 * 使用 Radix UI Tooltip 顯示詳細的回本計算資訊
 */
export function PaybackTooltip({ payback, children }: PaybackTooltipProps) {
  // 如果沒有詳細資訊，不顯示 Tooltip
  if (!payback.details) {
    return <>{children}</>;
  }

  const { details, estimatedHours } = payback;

  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span className="cursor-help underline decoration-dotted decoration-1 underline-offset-2">
            {children}
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="z-50 overflow-hidden rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-md animate-in fade-in-0 zoom-in-95"
            sideOffset={5}
          >
            <div className="flex flex-col gap-2 min-w-[200px] max-w-[320px]">
              {/* 標題 */}
              <div className="font-semibold text-gray-900">
                價差回本詳情
              </div>

              {/* 資訊列表 */}
              <div className="flex flex-col gap-1 text-xs">
                {/* 當前價差 */}
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">當前價差：</span>
                  <span className="font-mono font-medium text-gray-900">
                    {details.priceDiff !== null
                      ? `${Number(details.priceDiff) >= 0 ? '+' : ''}${Number(details.priceDiff).toFixed(2)}%`
                      : 'N/A'}
                  </span>
                </div>

                {/* 費率差異 */}
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">費率差異：</span>
                  <span className="font-mono font-medium text-gray-900">
                    {Number(details.rateSpread).toFixed(2)}%
                  </span>
                </div>

                {/* 計算公式 */}
                <div className="mt-1 pt-2 border-t border-gray-200">
                  <div className="text-gray-600 mb-1">計算說明：</div>
                  <div className="text-gray-800 leading-relaxed">
                    {details.formula}
                  </div>
                </div>

                {/* 預估回本時間 */}
                {estimatedHours !== undefined && (
                  <div className="flex justify-between items-center mt-1 pt-2 border-t border-gray-200">
                    <span className="text-gray-600">預估時間：</span>
                    <span className="font-medium text-gray-900">
                      {formatEstimatedTime(estimatedHours)}
                    </span>
                  </div>
                )}

                {/* 警告訊息（如果有） */}
                {details.warning && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="text-orange-600 text-xs leading-relaxed">
                      {details.warning}
                    </div>
                  </div>
                )}
              </div>

              {/* 免責聲明 */}
              <div className="mt-2 pt-2 border-t border-gray-200 text-[10px] text-gray-500 leading-relaxed">
                ⚠️ 注意：回本次數基於當前費率差計算，實際費率可能波動。此指標僅供參考，不構成投資建議。
              </div>
            </div>
            <Tooltip.Arrow className="fill-white" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
