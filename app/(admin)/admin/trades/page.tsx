'use client';

/**
 * Admin Platform Trades Page (Feature 068)
 *
 * 平台所有交易記錄列表，支援 i18n 和主題切換
 */

import { useEffect, useState, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import type { AdminTradeListResponse, AdminTradeListItem } from '@/src/types/admin';

export default function AdminTradesPage() {
  const t = useTranslations('trades');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [data, setData] = useState<AdminTradeListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [page, setPage] = useState(1);
  const [symbol, setSymbol] = useState('');
  const [sortBy, setSortBy] = useState<'closedAt' | 'totalPnL'>('closedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchTrades = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sortBy,
        sortOrder,
      });

      if (symbol) params.append('symbol', symbol);

      const response = await fetch(`/api/admin/trades?${params}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error?.message || tCommon('error'));
      }
    } catch {
      setError(tCommon('error'));
    } finally {
      setLoading(false);
    }
  }, [page, symbol, sortBy, sortOrder, tCommon]);

  useEffect(() => {
    document.title = `${t('title')} | Admin`;
    fetchTrades();
  }, [fetchTrades, t]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTrades();
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);

    if (locale === 'zh-TW') {
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${month}/${day} ${hours}:${minutes}`;
    }

    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          {t('subtitle')}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">
              {t('filters.symbol')}
            </label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder={t('placeholder.symbol')}
              className="w-full px-3 py-2 rounded-lg transition-colors
                bg-slate-50 dark:bg-slate-900
                border border-slate-300 dark:border-slate-700
                text-slate-900 dark:text-white
                placeholder-slate-400 dark:placeholder-slate-500
                focus:outline-none focus:border-amber-500 dark:focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">{t('filters.sortBy')}</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'closedAt' | 'totalPnL')}
              className="px-3 py-2 rounded-lg transition-colors
                bg-slate-50 dark:bg-slate-900
                border border-slate-300 dark:border-slate-700
                text-slate-900 dark:text-white
                focus:outline-none focus:border-amber-500 dark:focus:border-blue-500"
            >
              <option value="closedAt">{t('filters.date')}</option>
              <option value="totalPnL">{t('filters.pnl')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">{t('filters.order')}</label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
              className="px-3 py-2 rounded-lg transition-colors
                bg-slate-50 dark:bg-slate-900
                border border-slate-300 dark:border-slate-700
                text-slate-900 dark:text-white
                focus:outline-none focus:border-amber-500 dark:focus:border-blue-500"
            >
              <option value="desc">{t('filters.desc')}</option>
              <option value="asc">{t('filters.asc')}</option>
            </select>
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors"
          >
            {tCommon('search')}
          </button>
        </form>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/50 rounded-xl p-6 text-center">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={fetchTrades}
            className="mt-4 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg transition-colors"
          >
            {tCommon('refresh')}
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && !data && (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 animate-pulse"
            >
              <div className="flex justify-between">
                <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-5 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
              <div className="mt-2 flex gap-4">
                <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Trade Table */}
      {data && (
        <>
          <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                      {t('table.symbol')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                      {t('table.user')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                      {t('table.exchanges')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                      {t('table.pnl')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                      {t('table.roi')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                      {t('table.duration')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                      {t('table.closeTime')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {data.items.map((trade: AdminTradeListItem) => (
                    <tr
                      key={trade.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="text-slate-900 dark:text-white font-medium">
                          {trade.symbol}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-600 dark:text-slate-300 text-sm">
                          {trade.userEmail}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs">
                          <span className="text-green-600 dark:text-green-400">
                            L: {trade.longExchange}
                          </span>
                          <span className="text-slate-400 dark:text-slate-500 mx-1">/</span>
                          <span className="text-red-600 dark:text-red-400">
                            S: {trade.shortExchange}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-medium ${
                            parseFloat(trade.totalPnL) >= 0
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          ${trade.totalPnL}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`${
                            parseFloat(trade.roi) >= 0
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {trade.roi}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400 text-sm">
                        {Math.round(trade.holdingDuration / 3600)}h
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400 text-sm">
                        {formatDate(trade.closedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-slate-500 dark:text-slate-400 text-sm">
                {t('pagination.page', { page: data.page, totalPages: data.totalPages, total: data.total })}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                  className="px-3 py-1 rounded transition-colors
                    bg-slate-100 dark:bg-slate-700
                    hover:bg-slate-200 dark:hover:bg-slate-600
                    text-slate-700 dark:text-white
                    disabled:opacity-50"
                >
                  {t('pagination.prev')}
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  disabled={page === data.totalPages || loading}
                  className="px-3 py-1 rounded transition-colors
                    bg-slate-100 dark:bg-slate-700
                    hover:bg-slate-200 dark:hover:bg-slate-600
                    text-slate-700 dark:text-white
                    disabled:opacity-50"
                >
                  {t('pagination.next')}
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {data.items.length === 0 && (
            <div className="bg-white dark:bg-slate-800/50 rounded-xl p-8 text-center">
              <p className="text-slate-500 dark:text-slate-400">{tCommon('noData')}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
