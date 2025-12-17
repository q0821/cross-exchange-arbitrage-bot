/**
 * OpenPositionButton - 開倉按鈕組件
 * 顯示在 RateRow 中，用於開啟開倉對話框
 *
 * Feature 033: Manual Open Position (T013)
 */

'use client';

import React from 'react';
import { TrendingUp, Loader2 } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';

interface OpenPositionButtonProps {
  disabled: boolean;
  isLoading?: boolean;
  onClick: () => void;
}

export function OpenPositionButton({
  disabled,
  isLoading = false,
  onClick,
}: OpenPositionButtonProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          onClick={onClick}
          disabled={disabled || isLoading}
          className={`p-2 rounded-md transition-colors ${
            disabled || isLoading
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-600 hover:bg-green-50 hover:text-green-600'
          }`}
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
          className="bg-gray-900 text-white text-xs rounded px-3 py-2 shadow-lg z-50"
          sideOffset={5}
        >
          {disabled ? '無套利機會' : '開倉此套利機會'}
          <Tooltip.Arrow className="fill-gray-900" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
