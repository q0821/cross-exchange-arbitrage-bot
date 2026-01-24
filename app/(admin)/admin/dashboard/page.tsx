'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { DashboardStats } from '@/src/types/admin';

/**
 * Admin Dashboard Page (Feature 068)
 *
 * 平台統計儀表板，支援 i18n 和主題切換
 */

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  colorClass: string;
}

function StatsCard({ title, value, subtitle, icon, colorClass }: StatsCardProps) {
  return (
    <div className="group bg-white dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700 transition-all duration-300 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-600">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 ${colorClass} rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
          {icon}
        </div>
        <div>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{title}</p>
          <p className="text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
          {subtitle && (
            <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${t('title')} | Admin`;

    async function fetchStats() {
      try {
        const response = await fetch('/api/admin/dashboard');
        const data = await response.json();

        if (data.success) {
          setStats(data.data);
        } else {
          setError(data.error?.message || tCommon('error'));
        }
      } catch {
        setError(tCommon('error'));
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [t, tCommon]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{tCommon('loading')}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700"
            >
              <div className="flex items-center gap-4 animate-pulse">
                <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-xl" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h2>
        </div>
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/50 rounded-xl p-6 text-center">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/30 text-red-600 dark:text-red-400 rounded-lg transition-colors"
          >
            {tCommon('refresh')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">{t('welcome')}</p>
      </div>

      {/* User Stats */}
      <div>
        <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">
          {t('stats.totalUsers')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title={t('stats.totalUsers')}
            value={stats?.users.total ?? 0}
            subtitle={t('subtitles.newToday', { count: stats?.users.todayNew ?? 0 })}
            colorClass="bg-blue-100 dark:bg-blue-500/10"
            icon={
              <svg
                className="w-6 h-6 text-blue-600 dark:text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            }
          />
          <StatsCard
            title={t('stats.activeUsers')}
            value={stats?.users.active ?? 0}
            colorClass="bg-green-100 dark:bg-green-500/10"
            icon={
              <svg
                className="w-6 h-6 text-green-600 dark:text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          />
          <StatsCard
            title={t('stats.weekActive')}
            value={stats?.users.weekActive ?? 0}
            subtitle={t('subtitles.loggedIn7Days')}
            colorClass="bg-purple-100 dark:bg-purple-500/10"
            icon={
              <svg
                className="w-6 h-6 text-purple-600 dark:text-purple-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            }
          />
          <StatsCard
            title={t('stats.inactive')}
            value={stats?.users.inactive ?? 0}
            colorClass="bg-slate-100 dark:bg-slate-500/10"
            icon={
              <svg
                className="w-6 h-6 text-slate-600 dark:text-slate-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                />
              </svg>
            }
          />
        </div>
      </div>

      {/* Position Stats */}
      <div>
        <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">
          {t('stats.totalPositions')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title={t('stats.totalPositions')}
            value={stats?.positions.activeCount ?? 0}
            colorClass="bg-amber-100 dark:bg-amber-500/10"
            icon={
              <svg
                className="w-6 h-6 text-amber-600 dark:text-amber-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            }
          />
          {stats?.positions.byExchange &&
            Object.entries(stats.positions.byExchange)
              .slice(0, 3)
              .map(([exchange, count]) => (
                <StatsCard
                  key={exchange}
                  title={exchange.charAt(0).toUpperCase() + exchange.slice(1)}
                  value={count}
                  colorClass="bg-cyan-100 dark:bg-cyan-500/10"
                  icon={
                    <svg
                      className="w-6 h-6 text-cyan-600 dark:text-cyan-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                  }
                />
              ))}
        </div>
      </div>

      {/* Trade Stats */}
      <div>
        <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">
          {t('stats.totalTrades')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title={t('stats.totalTrades')}
            value={stats?.trades.closedCount ?? 0}
            subtitle={t('subtitles.todayCount', { count: stats?.trades.todayCount ?? 0 })}
            colorClass="bg-indigo-100 dark:bg-indigo-500/10"
            icon={
              <svg
                className="w-6 h-6 text-indigo-600 dark:text-indigo-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            }
          />
          <StatsCard
            title={t('stats.totalPnl')}
            value={`$${stats?.trades.totalPnL ?? '0.00'}`}
            colorClass={
              Number(stats?.trades.totalPnL ?? 0) >= 0
                ? 'bg-green-100 dark:bg-green-500/10'
                : 'bg-red-100 dark:bg-red-500/10'
            }
            icon={
              <svg
                className={`w-6 h-6 ${
                  Number(stats?.trades.totalPnL ?? 0) >= 0
                    ? 'text-green-600 dark:text-green-500'
                    : 'text-red-600 dark:text-red-500'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          />
          <StatsCard
            title={t('stats.averageRoi')}
            value={`${stats?.trades.averageROI ?? '0.00'}%`}
            colorClass="bg-teal-100 dark:bg-teal-500/10"
            icon={
              <svg
                className="w-6 h-6 text-teal-600 dark:text-teal-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                />
              </svg>
            }
          />
          <StatsCard
            title={t('stats.todayTrades')}
            value={`$${stats?.trades.todayPnL ?? '0.00'}`}
            colorClass={
              Number(stats?.trades.todayPnL ?? 0) >= 0
                ? 'bg-green-100 dark:bg-green-500/10'
                : 'bg-red-100 dark:bg-red-500/10'
            }
            icon={
              <svg
                className={`w-6 h-6 ${
                  Number(stats?.trades.todayPnL ?? 0) >= 0
                    ? 'text-green-600 dark:text-green-500'
                    : 'text-red-600 dark:text-red-500'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          />
        </div>
      </div>
    </div>
  );
}
