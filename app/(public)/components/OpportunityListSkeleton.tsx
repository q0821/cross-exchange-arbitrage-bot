/**
 * 套利機會列表載入骨架屏
 *
 * 顯示載入狀態的佔位元素
 */
export function OpportunityListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="rounded-lg border border-border bg-card p-6 shadow-xs animate-pulse"
        >
          {/* 標題區塊 */}
          <div className="flex items-start justify-between mb-4">
            <div className="space-y-2">
              <div className="h-6 bg-muted rounded w-32"></div>
              <div className="flex items-center space-x-2">
                <div className="h-6 bg-muted rounded w-20"></div>
                <div className="h-4 bg-muted rounded w-4"></div>
                <div className="h-6 bg-muted rounded w-20"></div>
              </div>
            </div>
            <div className="text-right space-y-1">
              <div className="h-8 bg-muted rounded w-20"></div>
              <div className="h-3 bg-muted rounded w-16"></div>
            </div>
          </div>

          {/* 費差區塊 */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="space-y-1">
              <div className="h-3 bg-muted rounded w-16"></div>
              <div className="h-6 bg-muted rounded w-24"></div>
            </div>
            <div className="space-y-1">
              <div className="h-3 bg-muted rounded w-16"></div>
              <div className="h-6 bg-muted rounded w-24"></div>
            </div>
          </div>

          {/* 時間資訊區塊 */}
          <div className="border-t border-border pt-4 space-y-2">
            <div className="flex justify-between">
              <div className="h-4 bg-muted rounded w-16"></div>
              <div className="h-4 bg-muted rounded w-32"></div>
            </div>
            <div className="flex justify-between">
              <div className="h-4 bg-muted rounded w-16"></div>
              <div className="h-4 bg-muted rounded w-40"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
