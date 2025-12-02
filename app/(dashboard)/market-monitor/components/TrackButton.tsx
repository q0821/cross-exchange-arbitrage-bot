/**
 * TrackButton - 追蹤按鈕組件
 * 顯示在 RateRow 中，用於開始追蹤套利機會
 *
 * Feature 029: Simulated APY Tracking (T013)
 */

'use client';

import React from 'react';
import { Target, Loader2 } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';

interface TrackButtonProps {
  isTracking: boolean;
  isLoading: boolean;
  disabled: boolean;
  onClick: () => void;
}

export function TrackButton({
  isTracking,
  isLoading,
  disabled,
  onClick,
}: TrackButtonProps) {
  if (isTracking) {
    return (
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-md cursor-default">
            <Target className="w-3 h-3" />
            追蹤中
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="bg-gray-900 text-white text-xs rounded px-3 py-2 shadow-lg z-50"
            sideOffset={5}
          >
            此機會正在被追蹤中
            <Tooltip.Arrow className="fill-gray-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    );
  }

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          onClick={onClick}
          disabled={disabled || isLoading}
          className={`p-2 rounded-md transition-colors ${
            disabled || isLoading
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-600 hover:bg-gray-100 hover:text-blue-600'
          }`}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Target className="w-4 h-4" />
          )}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className="bg-gray-900 text-white text-xs rounded px-3 py-2 shadow-lg z-50"
          sideOffset={5}
        >
          {disabled ? '無套利機會' : '開始追蹤此機會'}
          <Tooltip.Arrow className="fill-gray-900" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
