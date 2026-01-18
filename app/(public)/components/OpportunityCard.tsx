import type { PublicOpportunityDTO } from '@/src/types/public-opportunity';

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

  // 格式化持續時間
  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
      return `${hours} 小時 ${minutes} 分鐘`;
    }
    return `${minutes} 分鐘`;
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-xs hover:shadow-sm transition-shadow">
      {/* 交易對和交易所 */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{opportunity.symbol}</h3>
          <div className="mt-1 flex items-center space-x-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              {opportunity.longExchange}
            </span>
            <span>→</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
              {opportunity.shortExchange}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-primary">{opportunity.realizedAPY.toFixed(2)}%</div>
          <div className="text-xs text-muted-foreground">年化報酬率</div>
        </div>
      </div>

      {/* 費差資訊 */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-xs text-muted-foreground">最大費差</div>
          <div className="text-lg font-semibold text-foreground">{opportunity.maxSpread.toFixed(4)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">最終費差</div>
          <div className="text-lg font-semibold text-foreground">{opportunity.finalSpread.toFixed(4)}</div>
        </div>
      </div>

      {/* 時間資訊 */}
      <div className="border-t border-border pt-4 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">持續時間</span>
          <span className="text-foreground font-medium">{formatDuration(opportunity.durationMs)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">結束時間</span>
          <span className="text-foreground">{formatDate(opportunity.disappearedAt)}</span>
        </div>
      </div>
    </div>
  );
}
