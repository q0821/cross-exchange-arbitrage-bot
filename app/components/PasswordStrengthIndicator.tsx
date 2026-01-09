/**
 * PasswordStrengthIndicator - 密碼強度指示器元件
 *
 * Feature 061: 密碼管理 (T043)
 *
 * 顯示密碼強度的視覺化指示器，包括：
 * - 強度條（弱/中/強）
 * - 強度文字標籤
 * - 改善建議
 */
'use client';

import { useMemo } from 'react';
import { calculatePasswordStrength } from '@/src/lib/password-strength';
import type { PasswordStrengthResult } from '@/src/types/auth';

export interface PasswordStrengthIndicatorProps {
  password: string;
  showSuggestions?: boolean;
  maxSuggestions?: number;
  className?: string;
}

/**
 * 取得強度顏色的 CSS class
 */
function getStrengthColorClass(strength: string): string {
  switch (strength) {
    case 'strong':
      return 'bg-profit';
    case 'medium':
      return 'bg-warning';
    default:
      return 'bg-loss';
  }
}

/**
 * 取得強度文字顏色的 CSS class
 */
function getStrengthTextColorClass(strength: string): string {
  switch (strength) {
    case 'strong':
      return 'text-profit';
    case 'medium':
      return 'text-warning';
    default:
      return 'text-loss';
  }
}

/**
 * 取得強度中文文字
 */
function getStrengthText(strength: string): string {
  switch (strength) {
    case 'strong':
      return '強';
    case 'medium':
      return '中';
    default:
      return '弱';
  }
}

export function PasswordStrengthIndicator({
  password,
  showSuggestions = true,
  maxSuggestions = 2,
  className = '',
}: PasswordStrengthIndicatorProps) {
  // 計算密碼強度
  const strengthResult: PasswordStrengthResult | null = useMemo(() => {
    if (!password) return null;
    return calculatePasswordStrength(password);
  }, [password]);

  // 如果沒有密碼，不顯示
  if (!strengthResult) return null;

  const { strength, score, suggestions } = strengthResult;
  const colorClass = getStrengthColorClass(strength);
  const textColorClass = getStrengthTextColorClass(strength);

  return (
    <div className={`space-y-2 ${className}`}>
      {/* 強度標籤和進度條 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">密碼強度</span>
          <span className={`text-xs font-medium ${textColorClass}`}>
            {getStrengthText(strength)}
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${colorClass}`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      {/* 改善建議 */}
      {showSuggestions && suggestions.length > 0 && strength !== 'strong' && (
        <ul className="text-xs text-muted-foreground space-y-0.5">
          {suggestions.slice(0, maxSuggestions).map((suggestion, index) => (
            <li key={index}>• {suggestion}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default PasswordStrengthIndicator;
