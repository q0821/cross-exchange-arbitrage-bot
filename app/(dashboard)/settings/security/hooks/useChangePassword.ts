/**
 * useChangePassword Hook (Feature 061: 密碼管理)
 *
 * 處理變更密碼的狀態管理和 API 呼叫
 */
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordState {
  isLoading: boolean;
  error: string | null;
  success: boolean;
  lockedUntil: Date | null;
  remainingSeconds: number | null;
}

export interface UseChangePasswordReturn {
  state: ChangePasswordState;
  changePassword: (data: ChangePasswordData) => Promise<boolean>;
  clearError: () => void;
  clearSuccess: () => void;
}

const initialState: ChangePasswordState = {
  isLoading: false,
  error: null,
  success: false,
  lockedUntil: null,
  remainingSeconds: null,
};

export function useChangePassword(): UseChangePasswordReturn {
  const router = useRouter();
  const [state, setState] = useState<ChangePasswordState>(initialState);

  const changePassword = useCallback(async (data: ChangePasswordData): Promise<boolean> => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      success: false,
    }));

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        // 處理帳戶鎖定錯誤
        if (result.error?.code === 'ACCOUNT_LOCKED') {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: result.error.message,
            lockedUntil: result.error.lockedUntil ? new Date(result.error.lockedUntil) : null,
            remainingSeconds: result.error.remainingSeconds ?? null,
          }));
          return false;
        }

        // 處理 Token 版本不匹配（需要重新登入）
        if (result.error?.code === 'TOKEN_VERSION_MISMATCH') {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: '登入狀態已失效，請重新登入',
          }));
          // 延遲導向登入頁
          setTimeout(() => {
            router.push('/login');
          }, 2000);
          return false;
        }

        // 處理其他錯誤
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: result.error?.message || '變更密碼失敗',
        }));
        return false;
      }

      // 變更成功
      setState((prev) => ({
        ...prev,
        isLoading: false,
        success: true,
      }));

      // 密碼變更成功後，延遲導向登入頁面（因為 session 已被清除）
      setTimeout(() => {
        router.push('/login');
      }, 3000);

      return true;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : '發生未知錯誤',
      }));
      return false;
    }
  }, [router]);

  const clearError = useCallback(() => {
    setState((prev) => ({
      ...prev,
      error: null,
      lockedUntil: null,
      remainingSeconds: null,
    }));
  }, []);

  const clearSuccess = useCallback(() => {
    setState((prev) => ({
      ...prev,
      success: false,
    }));
  }, []);

  return {
    state,
    changePassword,
    clearError,
    clearSuccess,
  };
}
