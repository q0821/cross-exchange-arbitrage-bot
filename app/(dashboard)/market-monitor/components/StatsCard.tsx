/**
 * StatsCard - 統計卡片組件
 * 顯示市場監控的即時統計摘要
 *
 * Feature: 006-web-trading-platform (User Story 2.5)
 */

'use client';


export interface MarketStats {
  /** 正在監控的交易對總數 */
  totalSymbols: number;
  /** 當前機會數量（差異 ≥ 0.5%）*/
  opportunityCount: number;
  /** 接近閾值數量（差異 0.4%-0.5%）*/
  approachingCount: number;
  /** 最高費率差異 */
  maxSpread: {
    symbol: string;
    spread: number | string;
  } | null;
  /** 系統運行時長（秒）*/
  uptime: number;
  /** 最後更新時間 */
  lastUpdate: string | null;
}

interface StatsCardProps {
  stats: MarketStats | null;
  isLoading?: boolean;
}

/**
 * StatsCard 組件
 * 使用網格佈局顯示 4 個主要統計卡片
 */
export function StatsCard({ stats, isLoading = false }: StatsCardProps) {
  // 格式化運行時長（秒 -> 時:分:秒）
  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  // 格式化最後更新時間
  const formatLastUpdate = (timestamp: string | null): string => {
    if (!timestamp) return '從未更新';
    const date = new Date(timestamp);

    // 格式化為 YYYY-MM-DD HH:mm:ss
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="glass-card p-6 animate-pulse"
          >
            <div className="h-4 bg-muted rounded w-20 mb-4"></div>
            <div className="h-8 bg-muted rounded w-16 mb-2"></div>
            <div className="h-3 bg-muted rounded w-24"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 text-warning">
        <p>統計資料載入中...</p>
      </div>
    );
  }

  const cards = [
    {
      title: '監控交易對',
      value: stats.totalSymbols,
      suffix: '個',
      icon: '📊',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: '套利機會',
      value: stats.opportunityCount,
      suffix: '個',
      icon: '🔔',
      color: 'text-profit',
      bgColor: 'bg-profit/10',
      highlight: stats.opportunityCount > 0,
    },
    {
      title: '接近閾值',
      value: stats.approachingCount,
      suffix: '個',
      icon: '⚠️',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      title: '最高差異',
      value: stats.maxSpread
        ? typeof stats.maxSpread.spread === 'number'
          ? stats.maxSpread.spread.toFixed(4)
          : stats.maxSpread.spread
        : '-',
      suffix: stats.maxSpread ? '%' : '',
      subtext: stats.maxSpread ? stats.maxSpread.symbol : '無資料',
      icon: '📈',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
  ];

  return (
    <div>
      {/* 統計卡片網格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {cards.map((card, index) => (
          <div
            key={index}
            className={`
              glass-card p-6 transition-all
              ${card.highlight ? 'border-profit ring-2 ring-profit/30' : 'border-border'}
            `}
          >
            {/* 標題和圖標 */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-muted-foreground">{card.title}</h3>
              <span className="text-2xl" role="img" aria-label={card.title}>
                {card.icon}
              </span>
            </div>

            {/* 數值 */}
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-bold ${card.color}`}>{card.value}</span>
              {card.suffix && <span className="text-lg text-muted-foreground">{card.suffix}</span>}
            </div>

            {/* 次要文字 */}
            {card.subtext && <p className="text-xs text-muted-foreground mt-2">{card.subtext}</p>}
          </div>
        ))}
      </div>

      {/* 底部資訊列 */}
      <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
        <div className="flex items-center gap-4">
          <span>
            <span className="font-medium">運行時長：</span>
            {formatUptime(stats.uptime)}
          </span>
        </div>
        <div>
          <span className="font-medium">最後更新：</span>
          {formatLastUpdate(stats.lastUpdate)}
        </div>
      </div>
    </div>
  );
}
