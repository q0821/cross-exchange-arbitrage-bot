'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import type { AdminUserDetail } from '@/src/types/admin';
import { PositionsTab } from './components/PositionsTab';

/**
 * Admin User Detail Page (Feature 068)
 *
 * 用戶詳細資料頁面，支援 i18n
 */

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AdminUserDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const t = useTranslations('users');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'positions'>('info');

  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await fetch(`/api/admin/users/${id}`);
        const result = await response.json();

        if (result.success) {
          setUser(result.data);
          document.title = `${result.data.email} | Admin`;
        } else {
          setError(result.error?.message || tCommon('error'));
        }
      } catch {
        setError(tCommon('error'));
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, [id, tCommon]);

  const handleSuspend = async () => {
    if (!confirm(t('confirm.suspend'))) return;

    setActionLoading('suspend');
    try {
      const response = await fetch(`/api/admin/users/${id}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });
      const result = await response.json();

      if (result.success) {
        setUser((prev) => (prev ? { ...prev, isActive: false } : null));
        if (result.data.warning) {
          alert(result.data.warning);
        }
      } else {
        alert(result.error?.message || tCommon('error'));
      }
    } catch {
      alert(tCommon('error'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleEnable = async () => {
    setActionLoading('enable');
    try {
      const response = await fetch(`/api/admin/users/${id}/enable`, {
        method: 'POST',
      });
      const result = await response.json();

      if (result.success) {
        setUser((prev) => (prev ? { ...prev, isActive: true } : null));
      } else {
        alert(result.error?.message || tCommon('error'));
      }
    } catch {
      alert(tCommon('error'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetPassword = async () => {
    if (!confirm(t('confirm.resetPassword'))) return;

    setActionLoading('reset');
    try {
      const response = await fetch(`/api/admin/users/${id}/reset-password`, {
        method: 'POST',
      });
      const result = await response.json();

      if (result.success) {
        alert(t('messages.newPassword', { password: result.data.newPassword }));
      } else {
        alert(result.error?.message || tCommon('error'));
      }
    } catch {
      alert(tCommon('error'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    const confirmText = prompt(t('confirm.delete'));
    if (confirmText !== 'DELETE') return;

    setActionLoading('delete');
    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmText: 'DELETE' }),
      });
      const result = await response.json();

      if (result.success) {
        router.push('/admin/users');
      } else {
        alert(result.error?.message || tCommon('error'));
      }
    } catch {
      alert(tCommon('error'));
    } finally {
      setActionLoading(null);
    }
  };

  const handlePromoteToAdmin = async () => {
    if (!confirm(t('confirm.promoteToAdmin'))) return;

    setActionLoading('promote');
    try {
      const response = await fetch(`/api/admin/users/${id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'ADMIN' }),
      });
      const result = await response.json();

      if (result.success) {
        setUser((prev) => (prev ? { ...prev, role: 'ADMIN' } : null));
        alert(t('messages.promoteSuccess'));
      } else {
        alert(result.error?.message || tCommon('error'));
      }
    } catch {
      alert(tCommon('error'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDemoteToUser = async () => {
    if (!confirm(t('confirm.demoteToUser'))) return;

    setActionLoading('demote');
    try {
      const response = await fetch(`/api/admin/users/${id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'USER' }),
      });
      const result = await response.json();

      if (result.success) {
        setUser((prev) => (prev ? { ...prev, role: 'USER' } : null));
        alert(t('messages.demoteSuccess'));
      } else {
        if (result.error?.code === 'CANNOT_DEMOTE_SELF') {
          alert(t('messages.cannotDemoteSelf'));
        } else {
          alert(result.error?.message || tCommon('error'));
        }
      }
    } catch {
      alert(tCommon('error'));
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return 'N/A';
    const d = new Date(date);

    if (locale === 'zh-TW') {
      // 繁體中文：YYYY/MM/DD HH:mm
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${year}/${month}/${day} ${hours}:${minutes}`;
    }

    // English: MMM DD, YYYY, HH:MM AM/PM
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
        <div className="bg-white dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700 animate-pulse">
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => router.back()}
          className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          ← {t('detail.backToUsers')}
        </button>
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/50 rounded-xl p-6 text-center">
          <p className="text-red-600 dark:text-red-400">{error || tCommon('error')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {t('detail.backToUsers')}
      </button>

      {/* User Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center">
            <span className="text-slate-600 dark:text-slate-300 text-2xl font-medium">
              {user.email.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{user.email}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-slate-500 dark:text-slate-400">
                {user.role === 'ADMIN' ? t('role.admin') : t('role.user')}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  user.isActive
                    ? 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400'
                    : 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400'
                }`}
              >
                {user.isActive ? t('detail.statusValues.active') : t('detail.statusValues.suspended')}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleResetPassword}
            disabled={!!actionLoading}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {actionLoading === 'reset' ? t('actions.resetting') : t('actions.resetPassword')}
          </button>

          {/* Promote/Demote Button */}
          {user.role === 'USER' ? (
            <button
              onClick={handlePromoteToAdmin}
              disabled={!!actionLoading}
              className="px-4 py-2 bg-blue-100 dark:bg-blue-500/20 hover:bg-blue-200 dark:hover:bg-blue-500/30 text-blue-700 dark:text-blue-400 rounded-lg transition-colors disabled:opacity-50"
            >
              {actionLoading === 'promote' ? t('actions.promoting') : t('actions.promoteToAdmin')}
            </button>
          ) : (
            <button
              onClick={handleDemoteToUser}
              disabled={!!actionLoading}
              className="px-4 py-2 bg-purple-100 dark:bg-purple-500/20 hover:bg-purple-200 dark:hover:bg-purple-500/30 text-purple-700 dark:text-purple-400 rounded-lg transition-colors disabled:opacity-50"
            >
              {actionLoading === 'demote' ? t('actions.demoting') : t('actions.demoteToUser')}
            </button>
          )}

          {user.isActive ? (
            <button
              onClick={handleSuspend}
              disabled={!!actionLoading}
              className="px-4 py-2 bg-orange-100 dark:bg-orange-500/20 hover:bg-orange-200 dark:hover:bg-orange-500/30 text-orange-700 dark:text-orange-400 rounded-lg transition-colors disabled:opacity-50"
            >
              {actionLoading === 'suspend' ? t('actions.suspending') : t('actions.suspend')}
            </button>
          ) : (
            <button
              onClick={handleEnable}
              disabled={!!actionLoading}
              className="px-4 py-2 bg-green-100 dark:bg-green-500/20 hover:bg-green-200 dark:hover:bg-green-500/30 text-green-700 dark:text-green-400 rounded-lg transition-colors disabled:opacity-50"
            >
              {actionLoading === 'enable' ? t('actions.enabling') : t('actions.enable')}
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={!!actionLoading}
            className="px-4 py-2 bg-red-100 dark:bg-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/30 text-red-700 dark:text-red-400 rounded-lg transition-colors disabled:opacity-50"
          >
            {actionLoading === 'delete' ? t('actions.deleting') : t('actions.delete')}
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
        <button
          onClick={() => setActiveTab('info')}
          className={`px-4 py-2 rounded-t-lg transition-colors ${
            activeTab === 'info'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-b-2 border-amber-500'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {t('detail.tabs.info')}
        </button>
        <button
          onClick={() => setActiveTab('positions')}
          className={`px-4 py-2 rounded-t-lg transition-colors ${
            activeTab === 'positions'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-b-2 border-amber-500'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {t('detail.tabs.positions')}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'info' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Info */}
          <div className="bg-white dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">
              {t('detail.basicInfo')}
            </h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">{t('detail.fields.email')}</dt>
                <dd className="text-slate-900 dark:text-white">{user.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">{t('detail.fields.role')}</dt>
                <dd className="text-slate-900 dark:text-white">
                  {user.role === 'ADMIN' ? t('role.admin') : t('role.user')}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">{t('detail.fields.created')}</dt>
                <dd className="text-slate-900 dark:text-white">{formatDate(user.createdAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">{t('detail.fields.lastLogin')}</dt>
                <dd className="text-slate-900 dark:text-white">{formatDate(user.lastLoginAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">{t('detail.fields.passwordChanged')}</dt>
                <dd className="text-slate-900 dark:text-white">{formatDate(user.passwordChangedAt)}</dd>
              </div>
            </dl>
          </div>

          {/* Account Security */}
          <div className="bg-white dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">
              {t('detail.accountSecurity')}
            </h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">{t('detail.fields.status')}</dt>
                <dd>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user.isActive
                        ? 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400'
                        : 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400'
                    }`}
                  >
                    {user.isActive ? t('detail.statusValues.active') : t('detail.statusValues.suspended')}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">{t('detail.fields.failedLoginAttempts')}</dt>
                <dd className={user.failedLoginAttempts > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-900 dark:text-white'}>
                  {user.failedLoginAttempts}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">{t('detail.fields.lockedUntil')}</dt>
                <dd className={user.lockedUntil ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}>
                  {user.lockedUntil ? formatDate(user.lockedUntil) : t('detail.fields.notLocked')}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">{t('detail.fields.apiKeyCount')}</dt>
                <dd className="text-slate-900 dark:text-white">{user.apiKeyCount}</dd>
              </div>
            </dl>
          </div>

          {/* Trading Stats */}
          <div className="bg-white dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">
              {t('detail.tradingStats')}
            </h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">{t('detail.fields.activePositions')}</dt>
                <dd className="text-slate-900 dark:text-white">{user.positionCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">{t('detail.fields.totalTrades')}</dt>
                <dd className="text-slate-900 dark:text-white">{user.tradeCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">{t('detail.fields.totalPnl')}</dt>
                <dd className={Number(user.totalPnL) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                  ${user.totalPnL}
                </dd>
              </div>
            </dl>
          </div>

          {/* Preferences */}
          <div className="bg-white dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">
              {t('detail.preferences')}
            </h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">{t('detail.fields.timeBasis')}</dt>
                <dd className="text-slate-900 dark:text-white">{user.timeBasisPreference}h</dd>
              </div>
            </dl>
          </div>
        </div>
      ) : (
        <PositionsTab userId={id} />
      )}
    </div>
  );
}
