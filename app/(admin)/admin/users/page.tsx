'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import type { AdminUserListItem, AdminUserListResponse } from '@/src/types/admin';

/**
 * Admin Users List Page (Feature 068)
 *
 * 用戶管理列表頁面，支援 i18n 和主題切換
 */

export default function AdminUsersPage() {
  const router = useRouter();
  const t = useTranslations('users');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [data, setData] = useState<AdminUserListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search and filter state
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '20');
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (status !== 'all') params.set('status', status);

      const response = await fetch(`/api/admin/users?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error?.message || tCommon('error'));
      }
    } catch {
      setError(tCommon('error'));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, status, tCommon]);

  useEffect(() => {
    document.title = `${t('title')} | Admin`;
    fetchUsers();
  }, [fetchUsers, t]);

  const formatDate = (date: Date | string) => {
    const d = new Date(date);

    if (locale === 'zh-TW') {
      // 繁體中文：YYYY/MM/DD
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}/${month}/${day}`;
    }

    // English: MMM DD, YYYY
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {t('searchPlaceholder').replace('...', '')}
          </p>
        </div>
        <button
          onClick={() => router.push('/admin/users/new')}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors"
        >
          + {t('addUser')}
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search Input */}
        <div className="flex-1">
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 rounded-lg transition-colors
              bg-white dark:bg-slate-800
              border border-slate-300 dark:border-slate-700
              text-slate-900 dark:text-white
              placeholder-slate-400 dark:placeholder-slate-400
              focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Status Filter */}
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as 'all' | 'active' | 'inactive');
            setPage(1);
          }}
          className="px-4 py-2 rounded-lg transition-colors
            bg-white dark:bg-slate-800
            border border-slate-300 dark:border-slate-700
            text-slate-900 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="all">{tCommon('all')} {tCommon('status')}</option>
          <option value="active">{t('status.active')}</option>
          <option value="inactive">{t('status.inactive')}</option>
        </select>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/50 rounded-xl p-4 text-center">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={fetchUsers}
            className="mt-2 px-4 py-1 bg-red-100 dark:bg-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/30 text-red-600 dark:text-red-400 rounded-lg transition-colors text-sm"
          >
            {tCommon('refresh')}
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && !data && (
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="animate-pulse p-4 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users Table */}
      {data && (
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('table.name')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('table.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('table.positions')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('table.trades')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('table.lastLogin')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {tCommon('createdAt')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {tCommon('actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {data.items.map((user: AdminUserListItem) => (
                  <tr
                    key={user.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/admin/users/${user.id}`)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center">
                          <span className="text-slate-600 dark:text-slate-300 font-medium">
                            {user.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-slate-900 dark:text-white font-medium">{user.email}</p>
                          <p className="text-slate-500 dark:text-slate-400 text-sm">
                            {user.role === 'ADMIN' ? t('role.admin') : t('role.user')}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          user.isActive
                            ? 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400'
                            : 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400'
                        }`}
                      >
                        {user.isActive ? t('status.active') : t('status.inactive')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
                      {user.positionCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
                      {user.tradeCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-500 dark:text-slate-400 text-sm">
                      {user.lastLoginAt ? formatDate(user.lastLoginAt) : tCommon('never')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-500 dark:text-slate-400 text-sm">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/admin/users/${user.id}`);
                        }}
                        className="text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 text-sm font-medium"
                      >
                        {t('actions.view')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Empty State */}
          {data.items.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-slate-500 dark:text-slate-400">{tCommon('noData')}</p>
            </div>
          )}

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {t('pagination.showing', {
                  from: (page - 1) * data.limit + 1,
                  to: Math.min(page * data.limit, data.total),
                  total: data.total,
                })}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 rounded transition-colors
                    bg-slate-100 dark:bg-slate-700
                    hover:bg-slate-200 dark:hover:bg-slate-600
                    disabled:opacity-50 disabled:cursor-not-allowed
                    text-slate-700 dark:text-white"
                >
                  {t('pagination.prev')}
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  disabled={page === data.totalPages}
                  className="px-3 py-1 rounded transition-colors
                    bg-slate-100 dark:bg-slate-700
                    hover:bg-slate-200 dark:hover:bg-slate-600
                    disabled:opacity-50 disabled:cursor-not-allowed
                    text-slate-700 dark:text-white"
                >
                  {t('pagination.next')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
