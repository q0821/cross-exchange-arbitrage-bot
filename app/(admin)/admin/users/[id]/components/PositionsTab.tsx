'use client';

/**
 * Positions Tab Component (Feature 068)
 *
 * 顯示用戶持倉列表，支援篩選、分頁和 CSV 匯出
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { AdminPositionDetail, AdminUserPositionsResponse } from '@/src/types/admin';
import { PositionDetailCard } from './PositionDetailCard';

interface PositionsTabProps {
  userId: string;
}

export function PositionsTab({ userId }: PositionsTabProps) {
  const t = useTranslations('positions');
  const [data, setData] = useState<AdminUserPositionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'all' | 'open' | 'closed'>('all');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const fetchPositions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        status,
      });

      const response = await fetch(`/api/admin/users/${userId}/trades?${params}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error?.message || t('errors.loadFailed'));
      }
    } catch {
      setError(t('errors.connectFailed'));
    } finally {
      setLoading(false);
    }
  }, [userId, page, status, t]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  const handleExportCSV = async () => {
    setExporting(true);

    try {
      const response = await fetch(`/api/admin/users/${userId}/trades?format=csv`);

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trades-${userId}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      alert(t('errors.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const handleStatusChange = (newStatus: 'all' | 'open' | 'closed') => {
    setStatus(newStatus);
    setPage(1);
  };

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800/50 rounded-xl h-48 mb-4 border border-slate-200 dark:border-slate-700" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/50 rounded-xl p-6 text-center">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={fetchPositions}
          className="mt-4 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg transition-colors"
        >
          {t('retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Filter and Export */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['all', 'open', 'closed'] as const).map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                status === s
                  ? 'bg-amber-500 text-black'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {t(`filter.${s}`)}
            </button>
          ))}
        </div>

        <button
          onClick={handleExportCSV}
          disabled={exporting}
          className="px-4 py-2 bg-green-100 dark:bg-green-500/20 hover:bg-green-200 dark:hover:bg-green-500/30 text-green-700 dark:text-green-400 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {exporting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              {t('exporting')}
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              {t('exportCsv')}
            </>
          )}
        </button>
      </div>

      {/* Positions List */}
      {data && data.positions.length > 0 ? (
        <>
          <div className="grid gap-4">
            {data.positions.map((position: AdminPositionDetail) => (
              <PositionDetailCard key={position.id} position={position} />
            ))}
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="text-slate-500 dark:text-slate-400 text-sm">
                {t('pagination.page', { page: data.page, totalPages: data.totalPages, total: data.total })}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                  className="px-3 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded transition-colors disabled:opacity-50"
                >
                  {t('pagination.prev')}
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  disabled={page === data.totalPages || loading}
                  className="px-3 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded transition-colors disabled:opacity-50"
                >
                  {t('pagination.next')}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white dark:bg-slate-800/50 rounded-xl p-8 text-center border border-slate-200 dark:border-slate-700">
          <p className="text-slate-500 dark:text-slate-400">{t('noPositions')}</p>
        </div>
      )}
    </div>
  );
}
