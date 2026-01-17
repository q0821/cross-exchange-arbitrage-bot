/**
 * usePasswordReset Hook (Feature 061: 密碼管理)
 *
 * 處理密碼重設的狀態管理和 API 呼叫
 */
'use client';

import { useState, useCallback } from 'react';

export interface ResetPasswordData {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface TokenValidationState {
  isValidating: boolean;
  isValid: boolean | null;
  expiresAt: Date | null;
  error: string | null;
}

export interface ResetState {
  isLoading: boolean;
  success: boolean;
  error: string | null;
}

export interface UsePasswordResetReturn {
  tokenState: TokenValidationState;
  resetState: ResetState;
  validateToken: (token: string) => Promise<void>;
  resetPassword: (data: ResetPasswordData) => Promise<boolean>;
  clearError: () => void;
}

export function usePasswordReset(): UsePasswordResetReturn {
  const [tokenState, setTokenState] = useState<TokenValidationState>({
    isValidating: false,
    isValid: null,
    expiresAt: null,
    error: null,
  });

  const [resetState, setResetState] = useState<ResetState>({
    isLoading: false,
    success: false,
    error: null,
  });

  /**
   * 驗證 Token
   */
  const validateToken = useCallback(async (token: string): Promise<void> => {
    setTokenState((prev) => ({
      ...prev,
      isValidating: true,
      error: null,
    }));

    try {
      const response = await fetch(
        `/api/auth/validate-reset-token?token=${encodeURIComponent(token)}`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        setTokenState({
          isValidating: false,
          isValid: false,
          expiresAt: null,
          error: data.data?.error || '重設連結無效或已過期',
        });
        return;
      }

      setTokenState({
        isValidating: false,
        isValid: true,
        expiresAt: data.data?.expiresAt ? new Date(data.data.expiresAt) : null,
        error: null,
      });
    } catch (_error) {
      setTokenState({
        isValidating: false,
        isValid: false,
        expiresAt: null,
        error: '驗證連結時發生錯誤',
      });
    }
  }, []);

  /**
   * 執行密碼重設
   */
  const resetPassword = useCallback(async (data: ResetPasswordData): Promise<boolean> => {
    setResetState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        setResetState({
          isLoading: false,
          success: false,
          error: result.error?.message || '重設密碼失敗',
        });
        return false;
      }

      setResetState({
        isLoading: false,
        success: true,
        error: null,
      });

      return true;
    } catch (error) {
      setResetState({
        isLoading: false,
        success: false,
        error: error instanceof Error ? error.message : '發生未知錯誤',
      });
      return false;
    }
  }, []);

  /**
   * 清除錯誤
   */
  const clearError = useCallback(() => {
    setTokenState((prev) => ({ ...prev, error: null }));
    setResetState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    tokenState,
    resetState,
    validateToken,
    resetPassword,
    clearError,
  };
}
