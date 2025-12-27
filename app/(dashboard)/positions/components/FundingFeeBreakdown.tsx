/**
 * FundingFeeBreakdown - 資金費率明細組件
 *
 * 顯示多頭和空頭的資金費率結算記錄
 * Feature: 045-position-details-view
 */

'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Coins } from 'lucide-react';
import type { FundingFeeDetailsInfo } from '@/src/types/trading';

interface FundingFeeBreakdownProps {
  fundingFees: FundingFeeDetailsInfo;
  querySuccess: boolean;
  queryError?: string;
}

/**
 * 格式化金額（含正負號和顏色）
 */
function formatAmount(amount: string): { text: string; colorClass: string } {
  const num = parseFloat(amount);
  if (isNaN(num)) {
    return { text: 'N/A', colorClass: 'text-gray-400' };
  }

  const isPositive = num >= 0;
  const prefix = isPositive ? '+' : '';
  const colorClass = isPositive ? 'text-green-600' : 'text-red-600';

  return {
    text: `${prefix}${num.toFixed(6)}`,
    colorClass,
  };
}

/**
 * 單邊資金費率列表
 */
function FundingFeeList({
  entries,
}: {
  entries: FundingFeeDetailsInfo['longEntries'];
}) {
  if (entries.length === 0) {
    return (
      <div className="text-xs text-gray-400 italic">
        無結算記錄
      </div>
    );
  }

  return (
    <div className="max-h-40 overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-gray-100">
          <tr>
            <th className="text-left py-1 px-2 text-gray-500 font-medium">時間</th>
            <th className="text-right py-1 px-2 text-gray-500 font-medium">金額</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => {
            const { text, colorClass } = formatAmount(entry.amount);
            return (
              <tr key={entry.id || index} className="border-b border-gray-100 last:border-0">
                <td className="py-1 px-2 text-gray-600">
                  {new Date(entry.datetime).toLocaleString('zh-TW', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className={`py-1 px-2 text-right font-mono ${colorClass}`}>
                  {text}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function FundingFeeBreakdown({
  fundingFees,
}: FundingFeeBreakdownProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 計算總計顯示
  const longTotal = formatAmount(fundingFees.longTotal);
  const shortTotal = formatAmount(fundingFees.shortTotal);
  const netTotal = formatAmount(fundingFees.netTotal);

  const hasEntries = fundingFees.longEntries.length > 0 || fundingFees.shortEntries.length > 0;

  return (
    <div className="pt-3 border-t border-gray-200">
      {/* 標題和總計 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1 text-gray-700 font-medium text-sm">
          <Coins className="w-4 h-4" />
          <span>資金費率</span>
        </div>
        {hasEntries && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3 h-3" />
                收起明細
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                查看明細
              </>
            )}
          </button>
        )}
      </div>

      {/* 總計區塊 */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className="text-gray-500">多頭:</span>{' '}
          <span className={`font-medium ${longTotal.colorClass}`}>
            {longTotal.text}
          </span>
        </div>
        <div>
          <span className="text-gray-500">空頭:</span>{' '}
          <span className={`font-medium ${shortTotal.colorClass}`}>
            {shortTotal.text}
          </span>
        </div>
        <div>
          <span className="text-gray-500">總計:</span>{' '}
          <span className={`font-medium ${netTotal.colorClass}`}>
            {netTotal.text}
          </span>
        </div>
      </div>

      {/* 展開明細 */}
      {isExpanded && hasEntries && (
        <div className="mt-3 grid grid-cols-2 gap-4">
          {/* 多頭明細 */}
          <div className="bg-green-50 rounded p-2">
            <div className="text-xs font-medium text-green-700 mb-1">
              多頭結算記錄 ({fundingFees.longEntries.length})
            </div>
            <FundingFeeList entries={fundingFees.longEntries} />
          </div>

          {/* 空頭明細 */}
          <div className="bg-red-50 rounded p-2">
            <div className="text-xs font-medium text-red-700 mb-1">
              空頭結算記錄 ({fundingFees.shortEntries.length})
            </div>
            <FundingFeeList entries={fundingFees.shortEntries} />
          </div>
        </div>
      )}

      {/* 無結算記錄提示 */}
      {!hasEntries && (
        <div className="mt-2 text-xs text-gray-400 italic">
          尚無資金費率結算記錄
        </div>
      )}
    </div>
  );
}
