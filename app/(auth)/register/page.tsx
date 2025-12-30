'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

/**
 * 註冊頁面
 */
export default function RegisterPage() {
  // 設定頁面標題
  useEffect(() => {
    document.title = '註冊 | Arbitrage Trading Platform';
  }, []);
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 前端驗證
    if (password !== confirmPassword) {
      setError('密碼不一致');
      return;
    }

    if (password.length < 8) {
      setError('密碼至少需要 8 個字元');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || 'Registration failed');
        setIsLoading(false);
        return;
      }

      // 註冊成功，跳轉到登入頁面
      router.push('/login');
    } catch (err) {
      setError('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background bg-gradient-mesh">
      <div className="max-w-md w-full space-y-8 p-8 glass-card">
        <div>
          <h2 className="text-center text-3xl font-bold text-foreground">註冊</h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            建立新帳號開始使用 Arbitrage Platform
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-loss/10 border border-loss/30 text-loss px-4 py-3 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-xs bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                密碼
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-xs bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="至少 8 字元，包含英文和數字"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                密碼必須至少 8 個字元，包含英文字母和數字
              </p>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-foreground"
              >
                確認密碼
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-xs bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="再次輸入密碼"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-xs text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '註冊中...' : '註冊'}
            </button>
          </div>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">已經有帳號？</span>{' '}
            <Link href="/login" className="font-medium text-primary hover:text-primary/80">
              立即登入
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
