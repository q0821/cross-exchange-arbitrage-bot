'use client';

interface TimeRangeFilterProps {
  selectedDays: number;
  onDaysChange: (days: number) => void;
}

const TIME_OPTIONS = [
  { days: 7, label: '7 天' },
  { days: 30, label: '30 天' },
  { days: 90, label: '90 天' },
] as const;

/**
 * 時間範圍篩選元件
 *
 * 提供 7/30/90 天切換按鈕，預設選中 90 天
 */
export function TimeRangeFilter({ selectedDays, onDaysChange }: TimeRangeFilterProps) {
  const handleClick = (days: number) => {
    // 只有當點擊的不是當前選中的選項時才觸發事件
    if (days !== selectedDays) {
      onDaysChange(days);
    }
  };

  return (
    <div role="group" aria-label="時間範圍篩選" className="flex items-center space-x-2">
      <span className="text-sm text-muted-foreground mr-2">時間範圍：</span>
      <div className="inline-flex rounded-md shadow-sm" role="group">
        {TIME_OPTIONS.map((option, index) => {
          const isSelected = option.days === selectedDays;
          const isFirst = index === 0;
          const isLast = index === TIME_OPTIONS.length - 1;

          return (
            <button
              key={option.days}
              onClick={() => handleClick(option.days)}
              aria-pressed={isSelected}
              className={`
                px-4 py-2 text-sm font-medium border transition-colors
                ${isFirst ? 'rounded-l-md' : ''}
                ${isLast ? 'rounded-r-md' : ''}
                ${!isFirst ? '-ml-px' : ''}
                ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary z-10'
                    : 'bg-background text-foreground border-border hover:bg-accent hover:text-accent-foreground'
                }
              `}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
