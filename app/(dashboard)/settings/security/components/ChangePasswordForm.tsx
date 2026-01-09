/**
 * ChangePasswordForm - 變更密碼表單元件
 *
 * Feature 061: 密碼管理 (T022)
 *
 * 功能：
 * - 輸入目前密碼、新密碼、確認密碼
 * - 顯示密碼強度指示器
 * - 表單驗證和錯誤提示
 * - 帳戶鎖定倒數計時顯示
 */
'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useChangePassword } from '../hooks/useChangePassword';
import { calculatePasswordStrength, getPasswordRequirements } from '@/src/lib/password-strength';
import type { PasswordStrengthResult } from '@/src/types/auth';

export function ChangePasswordForm() {
  const { state, changePassword, clearError } = useChangePassword();

  // 表單狀態
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 密碼可見性
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 密碼強度
  const [strengthResult, setStrengthResult] = useState<PasswordStrengthResult | null>(null);

  // 表單驗證錯誤
  const [validationErrors, setValidationErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  // 鎖定倒數
  const [lockCountdown, setLockCountdown] = useState<number | null>(null);

  // 計算密碼強度
  useEffect(() => {
    if (newPassword) {
      setStrengthResult(calculatePasswordStrength(newPassword));
    } else {
      setStrengthResult(null);
    }
  }, [newPassword]);

  // 帳戶鎖定倒數計時
  useEffect(() => {
    if (!state.remainingSeconds || state.remainingSeconds <= 0) {
      return;
    }

    setLockCountdown(state.remainingSeconds);

    const interval = setInterval(() => {
      setLockCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          clearError();
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state.remainingSeconds, clearError]);

  // 驗證表單
  const validateForm = (): boolean => {
    const errors: typeof validationErrors = {};

    if (!currentPassword) {
      errors.currentPassword = '請輸入目前密碼';
    }

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

    await changePassword({
      currentPassword,
      newPassword,
      confirmPassword,
    });
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

  // 格式化倒數時間
  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const requirements = getPasswordRequirements();

  return (
    <div className="glass-card p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Lock className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">變更密碼</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          定期變更密碼可以提升帳戶安全性
        </p>
      </div>

      {/* 成功訊息 */}
      {state.success && (
        <div className="mb-6 p-4 bg-profit/10 border border-profit/30 rounded-md">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-profit" />
            <div>
              <p className="font-medium text-profit">密碼已成功變更</p>
              <p className="text-sm text-muted-foreground mt-1">
                即將導向登入頁面，請使用新密碼登入...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 錯誤訊息 */}
      {state.error && (
        <div className="mb-6 p-4 bg-loss/10 border border-loss/30 rounded-md">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-loss shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-loss">{state.error}</p>
              {lockCountdown !== null && (
                <p className="text-sm text-muted-foreground mt-1">
                  請等待 {formatCountdown(lockCountdown)} 後再試
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 目前密碼 */}
        <div>
          <label htmlFor="currentPassword" className="block text-sm font-medium text-foreground mb-1">
            目前密碼
          </label>
          <div className="relative">
            <input
              id="currentPassword"
              type={showCurrentPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setValidationErrors((prev) => ({ ...prev, currentPassword: undefined }));
              }}
              disabled={state.isLoading || state.success || lockCountdown !== null}
              className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 transition-colors ${
                validationErrors.currentPassword
                  ? 'border-loss/50 focus:ring-loss/30'
                  : 'border-border focus:ring-primary/30'
              } disabled:bg-muted/50 disabled:cursor-not-allowed`}
              placeholder="輸入目前密碼"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {validationErrors.currentPassword && (
            <p className="mt-1 text-sm text-loss">{validationErrors.currentPassword}</p>
          )}
        </div>

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
              disabled={state.isLoading || state.success || lockCountdown !== null}
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
              {strengthResult.suggestions.length > 0 && strengthResult.strength !== 'strong' && (
                <ul className="mt-2 text-xs text-muted-foreground space-y-0.5">
                  {strengthResult.suggestions.slice(0, 2).map((suggestion, index) => (
                    <li key={index}>• {suggestion}</li>
                  ))}
                </ul>
              )}
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
              disabled={state.isLoading || state.success || lockCountdown !== null}
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
          disabled={state.isLoading || state.success || lockCountdown !== null}
          className="w-full py-2.5 px-4 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {state.isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              變更中...
            </>
          ) : (
            '變更密碼'
          )}
        </button>
      </form>

      {/* 密碼要求說明 */}
      <div className="mt-6 pt-4 border-t border-border">
        <h3 className="text-sm font-medium text-foreground mb-2">密碼要求</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          {requirements.map((req, index) => (
            <li key={index}>• {req}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
