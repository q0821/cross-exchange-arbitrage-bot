/**
 * FeeEstimateTooltip Component
 * Feature 014: 移除淨收益欄位，改為獨立參考指標顯示
 *
 * 顯示預估手續費的詳細明細
 */

'use client';

import { Info } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';

/**
 * FeeEstimateTooltip - 手續費估算 Tooltip
 *
 * 顯示套利交易的手續費明細：
 * - 建倉做多 (Long Open): Taker 0.05%
 * - 建倉做空 (Short Open): Taker 0.05%
 * - 平倉做多 (Long Close): Taker 0.05%
 * - 平倉做空 (Short Close): Taker 0.05%
 * - 總計: 0.20%
 */
export function FeeEstimateTooltip() {
  return (
    <Tooltip.Root delayDuration={200}>
      <Tooltip.Trigger asChild>
        <div className="inline-flex items-center gap-1 cursor-help">
          <span className="text-gray-700 dark:text-gray-300 font-medium">
            0.2%
          </span>
          <Info className="inline w-4 h-4 text-gray-500 dark:text-gray-400" />
        </div>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="bottom"
          className="bg-gray-900 text-white text-xs rounded px-4 py-3 max-w-sm shadow-lg z-50"
          sideOffset={5}
        >
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">
              預估手續費明細
            </h4>
            <table className="w-full text-xs">
              <tbody className="space-y-1">
                <tr className="border-b border-gray-700">
                  <td className="py-1.5 pr-4">
                    建倉做多 (Long Open)
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    Taker 0.05%
                  </td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="py-1.5 pr-4">
                    建倉做空 (Short Open)
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    Taker 0.05%
                  </td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="py-1.5 pr-4">
                    平倉做多 (Long Close)
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    Taker 0.05%
                  </td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="py-1.5 pr-4">
                    平倉做空 (Short Close)
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    Taker 0.05%
                  </td>
                </tr>
                <tr className="border-t-2 border-gray-600">
                  <td className="pt-2 pr-4 font-semibold">
                    總計
                  </td>
                  <td className="pt-2 text-right font-bold tabular-nums">
                    0.20%
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="text-[11px] text-gray-300 mt-2">
              所有交易統一使用 Taker fee 計算
            </p>
          </div>
          <Tooltip.Arrow className="fill-gray-900" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
