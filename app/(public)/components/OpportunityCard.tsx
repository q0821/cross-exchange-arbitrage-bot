import type { PublicOpportunityDTO } from '@/src/types/public-opportunity';
import { formatDuration } from '@/lib/format-duration';

interface OpportunityCardProps {
  opportunity: PublicOpportunityDTO;
}

/**
 * 套利機會卡片元件
 *
 * 顯示單筆套利機會的摘要資訊
 */
export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  // 格式化時間
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 格式化百分比（4 位小數）
  const formatSpread = (value: number) => {
    return `${(value * 100).toFixed(4)}%`;
  };

  // 格式化 APY（2 位小數）
  const formatAPY = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-xs hover:shadow-sm transition-shadow">
      {/* 標題：交易對 */}
      <div className="mb-2">
        <div className="text-xs text-muted-foreground">交易對 (Symbol)</div>
        <h3 className="text-lg font-semibold text-foreground">{opportunity.symbol}</h3>
      </div>

      {/* 交易所資訊 */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-xs text-muted-foreground">多方 (Long)</div>
          <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-sm">
            {opportunity.longExchange}
          </span>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">空方 (Short)</div>
          <span className="inline-flex items-center px-2 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 text-sm">
            {opportunity.shortExchange}
          </span>
        </div>
      </div>

      {/* 費差資訊 */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-xs text-muted-foreground">最大費差 (Max Spread)</div>
          <div className="text-lg font-semibold text-foreground">{formatSpread(opportunity.maxSpread)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">最終費差 (Final Spread)</div>
          <div className="text-lg font-semibold text-foreground">{formatSpread(opportunity.finalSpread)}</div>
        </div>
      </div>

      {/* 年化報酬率 */}
      <div className="mb-4">
        <div className="text-xs text-muted-foreground">年化報酬率 (APY)</div>
        <div className="text-2xl font-bold text-primary">{formatAPY(opportunity.realizedAPY)}</div>
      </div>

      {/* 時間資訊 */}
      <div className="border-t border-border pt-4 space-y-2 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">持續時間 (Duration)</div>
          <div className="text-foreground font-medium">{formatDuration(opportunity.durationMs)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">消失時間 (Disappeared At)</div>
          <div className="text-foreground">{formatDate(opportunity.disappearedAt)}</div>
        </div>
      </div>
    </div>
  );
}
