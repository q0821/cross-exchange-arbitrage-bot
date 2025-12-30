/**
 * PositionCardSkeleton - 持倉卡片載入骨架
 *
 * Feature 033: Manual Open Position (T035)
 */

'use client';


export function PositionCardSkeleton() {
  return (
    <div className="glass-card animate-pulse">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="h-6 w-24 bg-muted rounded" />
          <div className="h-6 w-16 bg-muted rounded-full" />
        </div>
        <div className="h-3 w-32 bg-muted rounded mt-2" />
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Long Side */}
          <div className="space-y-2">
            <div className="h-4 w-12 bg-muted rounded" />
            <div className="h-4 w-20 bg-muted rounded" />
          </div>

          {/* Short Side */}
          <div className="space-y-2">
            <div className="h-4 w-12 bg-muted rounded" />
            <div className="h-4 w-20 bg-muted rounded" />
          </div>
        </div>

        {/* Leverage */}
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="h-4 w-16 bg-muted rounded" />
            <div className="h-4 w-8 bg-muted rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PositionsPageSkeleton() {
  return (
    <div className="min-h-screen bg-muted p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 bg-muted rounded" />
            <div className="h-8 w-32 bg-muted rounded" />
            <div className="h-6 w-16 bg-muted rounded-full" />
          </div>
          <div className="h-9 w-20 bg-muted rounded" />
        </div>

        {/* Section Title Skeleton */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-6 w-20 bg-muted rounded" />
            <div className="h-5 w-8 bg-muted rounded-full" />
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
