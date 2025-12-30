/**
 * StatusBadge - 狀態標籤組件
 * 顯示套利機會的狀態指示器
 *
 * Feature: 006-web-trading-platform (User Story 2.5)
 */

'use client';


export type OpportunityStatus = 'opportunity' | 'approaching' | 'normal';

interface StatusBadgeProps {
  status: OpportunityStatus;
  /** 費率差異百分比 */
  spreadPercent: number;
}

/**
 * StatusBadge 組件
 * 根據狀態顯示不同顏色和圖標的標籤
 */
export function StatusBadge({ status, spreadPercent }: StatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'opportunity':
        return {
          icon: '🔔',
          label: '機會',
          bgColor: 'bg-profit/10',
          textColor: 'text-profit',
          borderColor: 'border-profit/30',
        };
      case 'approaching':
        return {
          icon: '⚠️',
          label: '接近',
          bgColor: 'bg-warning/10',
          textColor: 'text-warning',
          borderColor: 'border-warning/30',
        };
      case 'normal':
      default:
        return {
          icon: '➖',
          label: '正常',
          bgColor: 'bg-muted',
          textColor: 'text-muted-foreground',
          borderColor: 'border-border',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border
        ${config.bgColor} ${config.textColor} ${config.borderColor}
      `}
      title={`費率差異: ${typeof spreadPercent === 'number' && !isNaN(spreadPercent) ? spreadPercent.toFixed(4) : 'N/A'}%`}
    >
      <span className="text-sm" role="img" aria-label={config.label}>
        {config.icon}
      </span>
      <span>{config.label}</span>
    </span>
  );
}

/**
 * 簡化版狀態徽章（只顯示圖標）
 */
export function StatusIcon({ status }: { status: OpportunityStatus }) {
  const getIcon = () => {
    switch (status) {
      case 'opportunity':
        return '🔔';
      case 'approaching':
        return '⚠️';
      case 'normal':
      default:
        return '➖';
    }
  };

  return (
    <span className="text-lg" role="img" aria-label={status}>
      {getIcon()}
    </span>
  );
}
