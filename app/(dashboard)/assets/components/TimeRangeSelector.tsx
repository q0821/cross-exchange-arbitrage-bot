/**
 * TimeRangeSelector - 時間範圍選擇器
 * 讓用戶選擇歷史曲線的時間範圍（7/14/30 天）
 *
 * Feature 031: Asset Tracking History (T022)
 */

import React from 'react';

type TimeRange = 7 | 14 | 30;

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
  disabled?: boolean;
}

const timeRangeOptions: { value: TimeRange; label: string }[] = [
  { value: 7, label: '7 天' },
  { value: 14, label: '14 天' },
  { value: 30, label: '30 天' },
];

export function TimeRangeSelector({
  value,
  onChange,
  disabled = false,
}: TimeRangeSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      {timeRangeOptions.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          disabled={disabled}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            value === option.value
              ? 'bg-primary text-white'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
