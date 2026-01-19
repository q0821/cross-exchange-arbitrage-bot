'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { OpportunityList } from './OpportunityList';
import { OpportunityListSkeleton } from './OpportunityListSkeleton';
import { Pagination } from './Pagination';
import { TimeRangeFilter } from './TimeRangeFilter';
import { usePublicOpportunities } from '../hooks/usePublicOpportunities';

/**
 * 客戶端套利機會列表包裝元件
 *
 * 支援分頁、時間範圍篩選、URL 參數同步
 */
function OpportunityListClientInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // 從 URL 獲取參數
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const currentDays = parseInt(searchParams.get('days') || '90', 10);

  // 獲取資料
  const { data, isLoading, error } = usePublicOpportunities({
    page: currentPage,
    pageSize: 20,
    days: currentDays,
  });

  // 更新 URL 參數
  const updateQueryParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handlePageChange = (page: number) => {
    updateQueryParams({ page: page.toString() });
  };

  const handleDaysChange = (days: number) => {
    // 切換時間範圍時，重置到第一頁
    updateQueryParams({ days: days.toString(), page: '1' });
  };

  // 錯誤狀態
  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-destructive mb-4">
          <svg
            className="w-12 h-12 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-lg font-semibold">載入失敗</p>
          <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          重新載入
        </button>
      </div>
    );
  }

  // 載入中狀態
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-10 w-48 bg-muted animate-pulse rounded"></div>
        </div>
        <OpportunityListSkeleton />
      </div>
    );
  }

  // 無資料狀態
  if (!data || data.data.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <TimeRangeFilter selectedDays={currentDays} onDaysChange={handleDaysChange} />
        </div>
        <OpportunityList data={[]} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 時間範圍篩選 */}
      <div className="flex justify-between items-center">
        <TimeRangeFilter selectedDays={currentDays} onDaysChange={handleDaysChange} />
        <div className="text-sm text-muted-foreground">
          共 {data.pagination.total} 筆記錄
        </div>
      </div>

      {/* 套利機會列表 */}
      <OpportunityList data={data.data} />

      {/* 分頁 */}
      {data.pagination.totalPages > 1 && (
        <div className="mt-8">
          <Pagination
            currentPage={data.pagination.page}
            totalPages={data.pagination.totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
}

/**
 * 包裝 Suspense 的客戶端元件
 */
export function OpportunityListClient() {
  return (
    <Suspense fallback={<OpportunityListSkeleton />}>
      <OpportunityListClientInner />
    </Suspense>
  );
}
