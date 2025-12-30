/**
 * SymbolSelector - 交易對選擇器組件
 * 允許用戶選擇預設群組或自訂交易對列表
 *
 * Feature: 006-web-trading-platform (User Story 2.5)
 */

'use client';

import { useState } from 'react';
import { OpportunityStatus } from './StatusBadge';

export interface SymbolGroup {
  id: string;
  name: string;
  symbolCount: number;
  symbols: string[];
}

interface SymbolSelectorProps {
  groups: SymbolGroup[];
  selectedGroup: string;
  filterStatus: OpportunityStatus | 'all';
  onGroupChange: (groupId: string) => void;
  onFilterChange: (status: OpportunityStatus | 'all') => void;
}

/**
 * SymbolSelector 組件
 * 提供群組選擇和狀態篩選功能
 */
export function SymbolSelector({
  groups,
  selectedGroup,
  filterStatus,
  onGroupChange,
  onFilterChange,
}: SymbolSelectorProps) {
  const [isGroupOpen, setIsGroupOpen] = useState(false);

  const currentGroup = groups.find((g) => g.id === selectedGroup);

  // 狀態篩選選項
  const filterOptions: Array<{ value: OpportunityStatus | 'all'; label: string; icon: string }> = [
    { value: 'all', label: '全部', icon: '📊' },
    { value: 'opportunity', label: '機會', icon: '🔔' },
    { value: 'approaching', label: '接近', icon: '⚠️' },
    { value: 'normal', label: '正常', icon: '➖' },
  ];

  return (
    <div className="flex items-center gap-4 flex-wrap">
      {/* 群組選擇器 */}
      <div className="relative">
        <label className="block text-sm font-medium text-foreground mb-1">交易對群組</label>
        <button
          onClick={() => setIsGroupOpen(!isGroupOpen)}
          className="w-64 px-4 py-2 text-left bg-card border border-border rounded-lg shadow-xs hover:bg-muted focus:outline-hidden focus:ring-2 focus:ring-primary transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-foreground">
                {currentGroup?.name || '選擇群組'}
              </div>
              {currentGroup && (
                <div className="text-xs text-muted-foreground">{currentGroup.symbolCount} 個交易對</div>
              )}
            </div>
            <svg
              className={`w-5 h-5 text-muted-foreground transition-transform ${
                isGroupOpen ? 'transform rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </button>

        {/* 下拉選單 */}
        {isGroupOpen && (
          <>
            {/* 背景遮罩 */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsGroupOpen(false)}
            ></div>

            {/* 選單內容 */}
            <div className="absolute z-20 mt-1 w-64 bg-card border border-border rounded-lg shadow-lg max-h-80 overflow-auto">
              {groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => {
                    onGroupChange(group.id);
                    setIsGroupOpen(false);
                  }}
                  className={`
                    w-full px-4 py-3 text-left hover:bg-muted transition-colors
                    ${selectedGroup === group.id ? 'bg-primary/10' : ''}
                  `}
                >
                  <div className="font-medium text-foreground">{group.name}</div>
                  <div className="text-xs text-muted-foreground">{group.symbolCount} 個交易對</div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 狀態篩選 */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">狀態篩選</label>
        <div className="flex gap-2">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => onFilterChange(option.value)}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${
                  filterStatus === option.value
                    ? 'bg-primary text-white'
                    : 'bg-card text-foreground border border-border hover:bg-muted'
                }
              `}
            >
              <span className="mr-1.5" role="img" aria-label={option.label}>
                {option.icon}
              </span>
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
