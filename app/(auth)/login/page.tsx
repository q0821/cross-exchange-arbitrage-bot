'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

/**
 * 登入頁面
 */
export default function LoginPage() {
  // 設定頁面標題
  useEffect(() => {
    document.title = '登入 | Arbitrage Trading Platform';
  }, []);
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || 'Login failed');
        setIsLoading(false);
        return;
      }

      // 登入成功，跳轉到市場監控頁面
      router.push('/market-monitor');
    } catch (_err) {
      setError('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background bg-gradient-mesh">
      <div className="max-w-md w-full space-y-8 p-8 glass-card">
        <div>
          <h2 className="text-center text-3xl font-bold text-foreground">登入</h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Cross-Exchange Arbitrage Platform
          </p>
        </div>

        <form className="mt-8 space-y-6" method="POST" action="" onSubmit={handleSubmit}>
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
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-xs bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="至少 8 字元"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-xs text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '登入中...' : '登入'}
            </button>
          </div>

          <div className="flex items-center justify-between text-sm">
            <Link href="/forgot-password" className="text-muted-foreground hover:text-primary">
              忘記密碼？
            </Link>
            <div>
              <span className="text-muted-foreground">還沒有帳號？</span>{' '}
              <Link href="/register" className="font-medium text-primary hover:text-primary/80">
                立即註冊
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
