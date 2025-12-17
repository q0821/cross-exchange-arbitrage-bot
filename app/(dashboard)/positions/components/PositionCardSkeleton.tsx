/**
 * PositionCardSkeleton - 持倉卡片載入骨架
 *
 * Feature 033: Manual Open Position (T035)
 */

'use client';

import React from 'react';

export function PositionCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm animate-pulse">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="h-6 w-24 bg-gray-200 rounded" />
          <div className="h-6 w-16 bg-gray-200 rounded-full" />
        </div>
        <div className="h-3 w-32 bg-gray-200 rounded mt-2" />
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Long Side */}
          <div className="space-y-2">
            <div className="h-4 w-12 bg-gray-200 rounded" />
            <div className="h-4 w-20 bg-gray-200 rounded" />
          </div>

          {/* Short Side */}
          <div className="space-y-2">
            <div className="h-4 w-12 bg-gray-200 rounded" />
            <div className="h-4 w-20 bg-gray-200 rounded" />
          </div>
        </div>

        {/* Leverage */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="h-4 w-16 bg-gray-200 rounded" />
            <div className="h-4 w-8 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PositionsPageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 bg-gray-200 rounded" />
            <div className="h-8 w-32 bg-gray-200 rounded" />
            <div className="h-6 w-16 bg-gray-200 rounded-full" />
          </div>
          <div className="h-9 w-20 bg-gray-200 rounded" />
        </div>

        {/* Section Title Skeleton */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-6 w-20 bg-gray-200 rounded" />
            <div className="h-5 w-8 bg-gray-200 rounded-full" />
          </div>

          {/* Position Cards Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            <PositionCardSkeleton />
            <PositionCardSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}
