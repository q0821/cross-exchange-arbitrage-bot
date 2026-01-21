'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { KeyRound, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { usePasswordReset } from './hooks/usePasswordReset';
import { calculatePasswordStrength, getPasswordRequirements } from '@/src/lib/password-strength';
import type { PasswordStrengthResult } from '@/src/types/auth';

/**
 * 重設密碼頁面內容
 *
 * Feature 061: 密碼管理 (T039)
 */
function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';

  const { tokenState, resetState, validateToken, resetPassword } = usePasswordReset();

  // 表單狀態
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 密碼強度（使用 useMemo 計算衍生狀態，避免 effect 中的 setState）
  const strengthResult = useMemo<PasswordStrengthResult | null>(() => {
    if (newPassword) {
      return calculatePasswordStrength(newPassword);
    }
    return null;
  }, [newPassword]);

  // 表單驗證錯誤
  const [validationErrors, setValidationErrors] = useState<{
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  // 設定頁面標題
  useEffect(() => {
    document.title = '重設密碼 | Arbitrage Trading Platform';
  }, []);

  // 頁面載入時驗證 Token
  useEffect(() => {
    if (token) {
      validateToken(token);
    }
  }, [token, validateToken]);

  // 驗證表單
  const validateForm = (): boolean => {
    const errors: typeof validationErrors = {};

    if (!newPassword) {
      errors.newPassword = '請輸入新密碼';
    } else if (newPassword.length < 8) {
      errors.newPassword = '密碼至少需要 8 個字元';
    } else if (!/[a-z]/.test(newPassword)) {
      errors.newPassword = '密碼必須包含小寫字母';
    } else if (!/[A-Z]/.test(newPassword)) {
      errors.newPassword = '密碼必須包含大寫字母';
    } else if (!/[0-9]/.test(newPassword)) {
      errors.newPassword = '密碼必須包含數字';
    }

    if (!confirmPassword) {
      errors.confirmPassword = '請確認新密碼';
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = '密碼不一致';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 提交表單
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const success = await resetPassword({
      token,
      newPassword,
      confirmPassword,
    });

    if (success) {
      // 3 秒後跳轉到登入頁
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    }
  };

  // 取得強度顏色
  const getStrengthColor = (strength: string): string => {
    switch (strength) {
      case 'strong':
        return 'bg-profit';
      case 'medium':
        return 'bg-warning';
      default:
        return 'bg-loss';
    }
  };

  // 取得強度文字
  const getStrengthText = (strength: string): string => {
    switch (strength) {
      case 'strong':
        return '強';
      case 'medium':
        return '中';
      default:
        return '弱';
    }
  };

  const requirements = getPasswordRequirements();

  // Token 驗證中
  if (tokenState.isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background bg-gradient-mesh">
        <div className="max-w-md w-full p-8 glass-card text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">正在驗證重設連結...</p>
        </div>
      </div>
    );
  }

  // Token 無效
  if (tokenState.isValid === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background bg-gradient-mesh">
        <div className="max-w-md w-full p-8 glass-card">
          <div className="text-center mb-6">
            <div className="mx-auto w-12 h-12 bg-loss/10 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-loss" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">連結無效</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {tokenState.error || '此密碼重設連結已失效或過期'}
            </p>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              可能的原因：
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• 連結已過期（有效期限為 1 小時）</li>
              <li>• 連結已被使用過</li>
              <li>• 連結格式不正確</li>
            </ul>
          </div>

          <div className="mt-6 space-y-3">
            <Link
              href="/forgot-password"
              className="block w-full py-2 px-4 text-center text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 transition-colors"
            >
              重新請求密碼重設
            </Link>
            <Link
              href="/login"
              className="block w-full py-2 px-4 text-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              返回登入
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 重設成功
  if (resetState.success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background bg-gradient-mesh">
        <div className="max-w-md w-full p-8 glass-card">
          <div className="text-center mb-6">
            <div className="mx-auto w-12 h-12 bg-profit/10 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-6 h-6 text-profit" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">密碼已重設</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              您的密碼已成功重設，請使用新密碼登入
            </p>
          </div>

          <div className="text-center text-sm text-muted-foreground mb-6">
            即將自動跳轉到登入頁面...
          </div>

          <Link
            href="/login"
            className="block w-full py-2 px-4 text-center text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 transition-colors"
          >
            立即登入
          </Link>
        </div>
      </div>
    );
  }

  // 重設表單
  return (
    <div className="min-h-screen flex items-center justify-center bg-background bg-gradient-mesh">
      <div className="max-w-md w-full space-y-8 p-8 glass-card">
        {/* 返回連結 */}
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
            <KeyRound className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">設定新密碼</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            請輸入您的新密碼
          </p>
        </div>

        <form className="space-y-6" method="POST" action="" onSubmit={handleSubmit}>
          {/* 錯誤訊息 */}
          {resetState.error && (
            <div className="p-4 bg-loss/10 border border-loss/30 rounded-md">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-loss shrink-0 mt-0.5" />
                <p className="text-loss">{resetState.error}</p>
              </div>
            </div>
          )}

          {/* 新密碼 */}
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-foreground mb-1">
              新密碼
            </label>
            <div className="relative">
              <input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setValidationErrors((prev) => ({ ...prev, newPassword: undefined }));
                }}
                disabled={resetState.isLoading}
                className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 transition-colors ${
                  validationErrors.newPassword
                    ? 'border-loss/50 focus:ring-loss/30'
                    : 'border-border focus:ring-primary/30'
                } disabled:bg-muted/50 disabled:cursor-not-allowed`}
                placeholder="輸入新密碼"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {validationErrors.newPassword && (
              <p className="mt-1 text-sm text-loss">{validationErrors.newPassword}</p>
            )}

            {/* 密碼強度指示器 */}
            {strengthResult && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">密碼強度</span>
                  <span className={`text-xs font-medium ${
                    strengthResult.strength === 'strong'
                      ? 'text-profit'
                      : strengthResult.strength === 'medium'
                      ? 'text-warning'
                      : 'text-loss'
                  }`}>
                    {getStrengthText(strengthResult.strength)}
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${getStrengthColor(strengthResult.strength)}`}
                    style={{ width: `${strengthResult.score}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 確認新密碼 */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-1">
              確認新密碼
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setValidationErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                }}
                disabled={resetState.isLoading}
                className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 transition-colors ${
                  validationErrors.confirmPassword
                    ? 'border-loss/50 focus:ring-loss/30'
                    : 'border-border focus:ring-primary/30'
                } disabled:bg-muted/50 disabled:cursor-not-allowed`}
                placeholder="再次輸入新密碼"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {validationErrors.confirmPassword && (
              <p className="mt-1 text-sm text-loss">{validationErrors.confirmPassword}</p>
            )}
            {confirmPassword && newPassword === confirmPassword && (
              <p className="mt-1 text-sm text-profit flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                密碼一致
              </p>
            )}
          </div>

          {/* 提交按鈕 */}
          <button
            type="submit"
            disabled={resetState.isLoading}
            className="w-full flex justify-center items-center gap-2 py-2 px-4 border border-transparent rounded-md shadow-xs text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resetState.isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                重設中...
              </>
            ) : (
              '重設密碼'
            )}
          </button>
        </form>

        {/* 密碼要求說明 */}
        <div className="pt-4 border-t border-border">
          <h3 className="text-sm font-medium text-foreground mb-2">密碼要求</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            {requirements.map((req, index) => (
              <li key={index}>• {req}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * 重設密碼頁面
 * 使用 Suspense 包裝以處理 useSearchParams
 */
export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background bg-gradient-mesh">
          <div className="max-w-md w-full p-8 glass-card text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">載入中...</p>
          </div>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
