/**
 * Admin Auth Utilities (Feature 068)
 *
 * 管理員認證相關工具函數
 */

import crypto from 'crypto';

/**
 * 密碼字元集
 */
const PASSWORD_CHARSET = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  numbers: '0123456789',
  special: '!@#$%^&*',
};

/**
 * 產生隨機安全密碼
 * @param length 密碼長度（預設 16）
 * @returns 隨機密碼
 */
export function generateSecurePassword(length: number = 16): string {
  // 確保密碼包含各類字元
  const required = [
    PASSWORD_CHARSET.lowercase[crypto.randomInt(PASSWORD_CHARSET.lowercase.length)],
    PASSWORD_CHARSET.uppercase[crypto.randomInt(PASSWORD_CHARSET.uppercase.length)],
    PASSWORD_CHARSET.numbers[crypto.randomInt(PASSWORD_CHARSET.numbers.length)],
    PASSWORD_CHARSET.special[crypto.randomInt(PASSWORD_CHARSET.special.length)],
  ];

  // 填充剩餘字元
  const allChars = Object.values(PASSWORD_CHARSET).join('');
  const remaining = Array.from({ length: length - required.length }, () =>
    allChars[crypto.randomInt(allChars.length)]
  );

  // 混合並打亂
  const password = [...required, ...remaining];
  for (let i = password.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }

  return password.join('');
}

/**
 * 驗證密碼強度
 * @param password 待驗證的密碼
 * @returns 驗證結果
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*)');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 驗證 Email 格式
 * @param email 待驗證的 email
 * @returns 是否有效
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 計算帳戶鎖定時間
 * 根據失敗次數遞增鎖定時間
 * @param failedAttempts 失敗次數
 * @returns 鎖定秒數
 */
export function calculateLockoutDuration(failedAttempts: number): number {
  // 5 次失敗後開始鎖定
  if (failedAttempts < 5) {
    return 0;
  }

  // 鎖定時間遞增：15分鐘、30分鐘、1小時、2小時...
  const baseMinutes = 15;
  const multiplier = Math.min(failedAttempts - 4, 8); // 最多 8 倍（2 小時）
  return baseMinutes * multiplier * 60; // 轉換為秒
}

/**
 * 格式化剩餘鎖定時間
 * @param seconds 剩餘秒數
 * @returns 格式化字串
 */
export function formatRemainingLockTime(seconds: number): string {
  if (seconds <= 0) {
    return '0 秒';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} 小時`);
  if (minutes > 0) parts.push(`${minutes} 分鐘`);
  if (secs > 0 && hours === 0) parts.push(`${secs} 秒`);

  return parts.join(' ') || '0 秒';
}
