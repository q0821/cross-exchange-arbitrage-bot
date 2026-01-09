/**
 * 密碼強度計算器 (Feature 061: 密碼管理)
 *
 * 根據密碼長度和字符類型計算強度
 */
import type { PasswordStrength, PasswordStrengthResult } from '@/types/auth';

/**
 * 檢查是否包含小寫字母
 */
function hasLowercase(password: string): boolean {
  return /[a-z]/.test(password);
}

/**
 * 檢查是否包含大寫字母
 */
function hasUppercase(password: string): boolean {
  return /[A-Z]/.test(password);
}

/**
 * 檢查是否包含數字
 */
function hasDigit(password: string): boolean {
  return /[0-9]/.test(password);
}

/**
 * 檢查是否包含特殊符號
 */
function hasSpecialChar(password: string): boolean {
  return /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
}

/**
 * 計算密碼分數 (0-100)
 */
function calculateScore(password: string): number {
  if (!password) return 0;

  let score = 0;

  // 長度分數 (最高 40 分)
  const length = password.length;
  if (length >= 8) score += 10;
  if (length >= 10) score += 10;
  if (length >= 12) score += 10;
  if (length >= 16) score += 10;

  // 字符類型分數 (每種 15 分，最高 60 分)
  if (hasLowercase(password)) score += 15;
  if (hasUppercase(password)) score += 15;
  if (hasDigit(password)) score += 15;
  if (hasSpecialChar(password)) score += 15;

  return Math.min(score, 100);
}

/**
 * 根據分數判斷強度等級
 */
function getStrengthLevel(score: number): PasswordStrength {
  if (score >= 70) return 'strong';
  if (score >= 40) return 'medium';
  return 'weak';
}

/**
 * 產生改善建議
 */
function generateSuggestions(password: string): string[] {
  const suggestions: string[] = [];

  if (!password || password.length === 0) {
    return ['請輸入密碼'];
  }

  if (password.length < 8) {
    suggestions.push('密碼長度至少需要 8 個字元');
  } else if (password.length < 12) {
    suggestions.push('建議使用 12 個字元以上的密碼');
  }

  if (!hasLowercase(password)) {
    suggestions.push('建議加入小寫字母 (a-z)');
  }

  if (!hasUppercase(password)) {
    suggestions.push('建議加入大寫字母 (A-Z)');
  }

  if (!hasDigit(password)) {
    suggestions.push('建議加入數字 (0-9)');
  }

  if (!hasSpecialChar(password)) {
    suggestions.push('建議加入特殊符號 (!@#$%^&* 等)');
  }

  // 檢查常見弱密碼模式
  if (/^[a-z]+$/.test(password) || /^[A-Z]+$/.test(password)) {
    suggestions.push('避免只使用字母');
  }

  if (/^[0-9]+$/.test(password)) {
    suggestions.push('避免只使用數字');
  }

  if (/(.)\1{2,}/.test(password)) {
    suggestions.push('避免使用連續重複的字元');
  }

  if (/^(123456|password|qwerty|abc123)/i.test(password)) {
    suggestions.push('避免使用常見的弱密碼');
  }

  return suggestions;
}

/**
 * 計算密碼強度
 *
 * @param password 要檢查的密碼
 * @returns 密碼強度結果
 *
 * @example
 * ```ts
 * const result = calculatePasswordStrength('MyP@ssw0rd123');
 * // { strength: 'strong', score: 85, suggestions: [] }
 * ```
 */
export function calculatePasswordStrength(password: string): PasswordStrengthResult {
  const score = calculateScore(password);
  const strength = getStrengthLevel(score);
  const suggestions = generateSuggestions(password);

  return {
    strength,
    score,
    suggestions,
  };
}

/**
 * 檢查密碼是否符合最低要求
 *
 * 最低要求：
 * - 至少 8 字元
 * - 包含大寫字母
 * - 包含小寫字母
 * - 包含數字
 */
export function meetsMinimumRequirements(password: string): boolean {
  if (!password || password.length < 8) return false;
  if (!hasLowercase(password)) return false;
  if (!hasUppercase(password)) return false;
  if (!hasDigit(password)) return false;

  return true;
}

/**
 * 取得密碼要求說明
 */
export function getPasswordRequirements(): string[] {
  return [
    '至少 8 個字元',
    '至少一個小寫字母 (a-z)',
    '至少一個大寫字母 (A-Z)',
    '至少一個數字 (0-9)',
  ];
}
