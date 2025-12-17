/**
 * TradeCardSkeleton - 交易卡片載入骨架
 *
 * 在交易記錄載入時顯示的佔位元素
 * Feature: 035-close-position (T027)
 */

'use client';

import React from 'react';

export function TradeCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm animate-pulse">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="h-6 w-24 bg-gray-200 rounded" />
          <div className="text-right">
            <div className="h-6 w-20 bg-gray-200 rounded mb-1" />
            <div className="h-4 w-12 bg-gray-200 rounded" />
          </div>
        </div>
        <div className="h-3 w-40 bg-gray-200 rounded mt-2" />
      </div>

      {/* Summary */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4 mb-3">
          {/* Long Side */}
          <div className="space-y-2">
            <div className="h-4 w-12 bg-gray-200 rounded" />
            <div className="h-4 w-16 bg-gray-200 rounded" />
          </div>

          {/* Short Side */}
          <div className="space-y-2">
            <div className="h-4 w-12 bg-gray-200 rounded" />
            <div className="h-4 w-16 bg-gray-200 rounded" />
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="text-center p-2 bg-gray-50 rounded">
              <div className="h-3 w-12 bg-gray-200 rounded mx-auto mb-2" />
              <div className="h-4 w-10 bg-gray-200 rounded mx-auto" />
            </div>
          ))}
        </div>

        {/* Expand Button */}
        <div className="w-full mt-3 pt-3 border-t border-gray-100 flex items-center justify-center">
          <div className="h-4 w-16 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}

/**
 * 多個骨架卡片
 */
export function TradeCardSkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <TradeCardSkeleton key={i} />
      ))}
    </div>
  );
}

export default TradeCardSkeleton;
