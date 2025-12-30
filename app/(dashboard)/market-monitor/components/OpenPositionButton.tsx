/**
 * OpenPositionButton - 開倉按鈕組件
 * 顯示在 RateRow 中，用於開啟開倉對話框
 *
 * Feature 033: Manual Open Position (T013)
 * Feature 044: MEXC Trading Restriction - 禁用涉及 MEXC 的開倉
 */

'use client';

import { TrendingUp, Loader2 } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';

interface OpenPositionButtonProps {
  disabled: boolean;
  isLoading?: boolean;
  onClick: () => void;
  /** Feature 044: 是否因交易所限制而禁用（如 MEXC 不支援 API 開倉） */
  isMexcRestricted?: boolean;
  /** Feature 044: 限制說明訊息 */
  restrictionMessage?: string;
}

export function OpenPositionButton({
  disabled,
  isLoading = false,
  onClick,
  isMexcRestricted = false,
  restrictionMessage = 'MEXC 不支援 API 開倉，請手動建倉',
}: OpenPositionButtonProps) {
  // Feature 044: 如果涉及 MEXC，則禁用按鈕
  const isDisabled = disabled || isLoading || isMexcRestricted;

  // Feature 044: 根據禁用原因決定樣式
  const getButtonClassName = () => {
    if (isLoading) {
      return 'text-muted-foreground cursor-not-allowed';
    }
    if (isMexcRestricted) {
      // 警告色：琥珀色表示有原因的禁用
      return 'text-warning bg-warning/10 cursor-not-allowed';
    }
    if (disabled) {
      return 'text-muted-foreground cursor-not-allowed';
    }
    return 'text-muted-foreground hover:bg-profit/10 hover:text-profit';
  };

  // Feature 044: 根據狀態決定 Tooltip 內容
  const getTooltipContent = () => {
    if (isMexcRestricted) {
      return restrictionMessage;
    }
    if (disabled) {
      return '無套利機會';
    }
    return '開倉此套利機會';
  };

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          onClick={onClick}
          disabled={isDisabled}
          className={`p-2 rounded-md transition-colors ${getButtonClassName()}`}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <TrendingUp className="w-4 h-4" />
          )}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className={`text-white text-xs rounded px-3 py-2 shadow-lg z-50 max-w-xs ${
            isMexcRestricted ? 'bg-warning' : 'bg-foreground'
          }`}
          sideOffset={5}
        >
          {getTooltipContent()}
          <Tooltip.Arrow className={isMexcRestricted ? 'fill-warning' : 'fill-foreground'} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
