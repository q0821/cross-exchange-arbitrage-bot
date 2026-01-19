import { useState, useEffect } from 'react';
import type { PublicOpportunitiesResponse } from '@/src/types/public-opportunity';

interface UsePublicOpportunitiesOptions {
  page?: number;
  pageSize?: number;
  days?: number;
}

interface UsePublicOpportunitiesResult {
  data: PublicOpportunitiesResponse | undefined;
  isLoading: boolean;
  error: Error | null;
}

/**
 * 公開套利機會資料獲取 Hook
 *
 * @param options - 查詢選項（分頁、時間範圍）
 * @returns 資料、loading 狀態、錯誤資訊
 */
export function usePublicOpportunities(
  options: UsePublicOpportunitiesOptions = {},
): UsePublicOpportunitiesResult {
  const { page = 1, pageSize = 20, days = 90 } = options;

  const [data, setData] = useState<PublicOpportunitiesResponse | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // 構建查詢參數
        const params = new URLSearchParams({
          page: page.toString(),
          pageSize: pageSize.toString(),
          days: days.toString(),
        });

        const response = await fetch(`/api/public/opportunities?${params.toString()}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          // 處理 HTTP 錯誤
          if (response.status === 429) {
            throw new Error('Rate limit exceeded. 請稍後再試。');
          }

          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const result: PublicOpportunitiesResponse = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error occurred'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [page, pageSize, days]);

  return { data, isLoading, error };
}
