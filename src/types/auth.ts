/**
 * 認證相關類型定義 (Feature 061: 密碼管理)
 */

// ============================================================================
// 密碼變更
// ============================================================================

/**
 * 變更密碼請求
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * 變更密碼結果
 */
export interface ChangePasswordResult {
  success: boolean;
  message: string;
}

// ============================================================================
// 忘記密碼 / 重設密碼
// ============================================================================

/**
 * 忘記密碼請求
 */
export interface ForgotPasswordRequest {
  email: string;
}

/**
 * 忘記密碼回應
 */
export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
}

/**
 * 重設密碼請求
 */
export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * 重設密碼結果
 */
export interface ResetPasswordResult {
  success: boolean;
  message: string;
}

/**
 * 驗證重設 Token 結果
 */
export interface ValidateResetTokenResult {
  valid: boolean;
  expiresAt?: Date;
  error?: string;
}

// ============================================================================
// 密碼強度
// ============================================================================

/**
 * 密碼強度等級
 */
export type PasswordStrength = 'weak' | 'medium' | 'strong';

/**
 * 密碼強度檢查結果
 */
export interface PasswordStrengthResult {
  strength: PasswordStrength;
  score: number; // 0-100
  suggestions: string[];
}

// ============================================================================
// 帳戶鎖定
// ============================================================================

/**
 * 帳戶鎖定狀態
 */
export interface AccountLockStatus {
  isLocked: boolean;
  lockedUntil?: Date;
  failedAttempts: number;
  remainingLockTime?: number; // seconds
}

// ============================================================================
// JWT Payload
// ============================================================================

/**
 * JWT Payload 結構 (擴展 tokenVersion)
 */
export interface JwtPayload {
  userId: string;
  email: string;
  tokenVersion: number;
  iat?: number;
  exp?: number;
}

// ============================================================================
// 審計日誌 Action 類型
// ============================================================================

/**
 * 密碼相關審計日誌動作
 */
export type PasswordAuditAction =
  | 'PASSWORD_CHANGE'
  | 'PASSWORD_RESET_REQUEST'
  | 'PASSWORD_RESET_COMPLETE'
  | 'LOGIN_FAILED'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_UNLOCKED';

/**
 * 審計日誌詳情
 */
export interface PasswordAuditDetails {
  method?: 'change' | 'reset' | 'timeout';
  email?: string;
  tokenId?: string;
  reason?: 'invalid_password' | 'account_locked';
  failedAttempts?: number;
  lockedUntil?: string;
}
