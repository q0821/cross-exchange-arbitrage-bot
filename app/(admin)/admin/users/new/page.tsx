'use client';

/**
 * Admin Create User Page (Feature 068)
 *
 * 新增用戶頁面，支援 i18n 和主題切換
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function AdminCreateUserPage() {
  const router = useRouter();
  const t = useTranslations('users');
  const tCommon = useTranslations('common');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUser, setCreatedUser] = useState<{
    email: string;
    password: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (result.success) {
        setCreatedUser({
          email: result.data.email,
          password: result.data.password,
        });
      } else {
        setError(result.error?.message || tCommon('error'));
      }
    } catch {
      setError(tCommon('error'));
    } finally {
      setLoading(false);
    }
  };

  // Success state - show generated password
  if (createdUser) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => router.push('/admin/users')}
          className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {tCommon('back')}
        </button>

        <div className="max-w-md mx-auto">
          <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/50 rounded-xl p-6 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              {t('create.success')}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              {t('create.passwordGenerated')}{' '}
              <span className="text-slate-900 dark:text-white">{createdUser.email}</span>
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700 mt-4">
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">
              {t('create.generatedPasswordTitle')}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-3">
              {t('create.savePasswordWarning')}
            </p>
            <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-4 font-mono text-center">
              <span className="text-amber-600 dark:text-amber-400 text-lg select-all">
                {createdUser.password}
              </span>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(createdUser.password)}
              className="w-full mt-4 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg transition-colors"
            >
              {t('create.copyToClipboard')}
            </button>
          </div>

          <div className="flex gap-4 mt-6">
            <button
              onClick={() => {
                setCreatedUser(null);
                setEmail('');
              }}
              className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg transition-colors"
            >
              {t('create.createAnother')}
            </button>
            <button
              onClick={() => router.push('/admin/users')}
              className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors"
            >
              {t('create.viewAllUsers')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => router.push('/admin/users')}
        className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {tCommon('back')}
      </button>

      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('create.title')}</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">{t('create.subtitle')}</p>
      </div>

      {/* Create Form */}
      <div className="max-w-md">
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700 space-y-4"
        >
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              {t('create.emailLabel')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('create.emailPlaceholder')}
              required
              className="w-full px-4 py-2 rounded-lg transition-colors
                bg-slate-50 dark:bg-slate-900
                border border-slate-300 dark:border-slate-700
                text-slate-900 dark:text-white
                placeholder-slate-400 dark:placeholder-slate-500
                focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/50 rounded-lg p-3">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 text-sm text-slate-500 dark:text-slate-400">
            <p>{t('create.autoPasswordNote')}</p>
          </div>

          <button
            type="submit"
            disabled={loading || !email}
            className="w-full px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? tCommon('loading') : t('create.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
