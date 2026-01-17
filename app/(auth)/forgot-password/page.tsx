'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * 忘記密碼頁面
 *
 * Feature 061: 密碼管理 (T038)
 */
export default function ForgotPasswordPage() {
  // 設定頁面標題
  useEffect(() => {
    document.title = '忘記密碼 | Arbitrage Trading Platform';
  }, []);

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [rateLimitSeconds, setRateLimitSeconds] = useState<number | null>(null);

  // Rate limit 倒數計時
  useEffect(() => {
    if (rateLimitSeconds === null || rateLimitSeconds <= 0) return;

    const interval = setInterval(() => {
      setRateLimitSeconds((prev) => {
        if (prev === null || prev <= 1) {
          setError(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [rateLimitSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        // 處理 rate limiting
        if (data.error?.code === 'RATE_LIMIT') {
          setRateLimitSeconds(data.error.retryAfter || 60);
          setError(`請求過於頻繁，請稍候再試`);
        } else {
          setError(data.error?.message || '發送失敗，請稍後再試');
        }
        setIsLoading(false);
        return;
      }

      // 成功
      setSuccess(true);
      setIsLoading(false);
    } catch (_err) {
      setError('發生未知錯誤，請稍後再試');
      setIsLoading(false);
    }
  };

  // 格式化倒數時間
  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${secs} 秒`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background bg-gradient-mesh">
      <div className="max-w-md w-full space-y-8 p-8 glass-card">
        {/* 返回登入連結 */}
        <div>
          <Link
            href="/login"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回登入
          </Link>
        </div>

        {/* 標題 */}
        <div className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Mail className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">忘記密碼</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            輸入您的電子郵件，我們將發送密碼重設連結給您
          </p>
        </div>

        {/* 成功訊息 */}
        {success ? (
          <div className="space-y-6">
            <div className="p-4 bg-profit/10 border border-profit/30 rounded-md">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-profit shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-profit">郵件已發送</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    如果 <strong>{email}</strong> 是有效的帳戶，您將在幾分鐘內收到密碼重設連結。
                  </p>
                </div>
              </div>
            </div>

            <div className="text-sm text-muted-foreground space-y-2">
              <p>• 請檢查您的收件匣和垃圾郵件資料夾</p>
              <p>• 連結將在 1 小時後失效</p>
              <p>• 如果未收到郵件，請確認電子郵件地址是否正確</p>
            </div>

            <button
              onClick={() => {
                setSuccess(false);
                setEmail('');
              }}
              className="w-full py-2 px-4 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              使用其他電子郵件
            </button>
          </div>
        ) : (
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* 錯誤訊息 */}
            {error && (
              <div className="p-4 bg-loss/10 border border-loss/30 rounded-md">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-loss shrink-0 mt-0.5" />
                  <div>
                    <p className="text-loss">{error}</p>
                    {rateLimitSeconds !== null && rateLimitSeconds > 0 && (
                      <p className="text-sm text-muted-foreground mt-1">
                        請等待 {formatCountdown(rateLimitSeconds)} 後再試
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Email 輸入 */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                電子郵件
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading || (rateLimitSeconds !== null && rateLimitSeconds > 0)}
                className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-xs bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-muted/50 disabled:cursor-not-allowed"
                placeholder="your@email.com"
              />
            </div>

            {/* 提交按鈕 */}
            <button
              type="submit"
              disabled={isLoading || (rateLimitSeconds !== null && rateLimitSeconds > 0)}
              className="w-full flex justify-center items-center gap-2 py-2 px-4 border border-transparent rounded-md shadow-xs text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  發送中...
                </>
              ) : (
                '發送重設連結'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
