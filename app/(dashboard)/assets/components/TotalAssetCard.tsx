/**
 * TotalAssetCard - 總資產摘要卡片
 * 顯示所有交易所的總資產（USD）
 *
 * Feature 031: Asset Tracking History (T015)
 */

import { DollarSign, Clock } from 'lucide-react';

interface TotalAssetCardProps {
  totalBalanceUSD: number;
  lastUpdated: string;
  changePercent?: number | null;
  changeUSD?: number | null;
}

export function TotalAssetCard({
  totalBalanceUSD,
  lastUpdated,
  changePercent,
  changeUSD,
}: TotalAssetCardProps) {
  // 格式化金額
  const formatUSD = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // 格式化時間
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 變化顏色
  const getChangeColor = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'text-muted-foreground';
    if (value > 0) return 'text-profit';
    if (value < 0) return 'text-loss';
    return 'text-muted-foreground';
  };

  // 格式化變化百分比
  const formatChangePercent = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  return (
    <div className="glass-card bg-linear-to-br from-primary/10 to-secondary/10 dark:from-primary/20 dark:to-secondary/20 rounded-xl p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
            <DollarSign className="w-4 h-4" />
            <span>總資產</span>
          </div>
          <div className="text-3xl font-bold text-foreground">
            {formatUSD(totalBalanceUSD)}
          </div>
          {(changePercent !== undefined || changeUSD !== undefined) && (
            <div className="flex items-center gap-2 mt-2">
              {changeUSD !== undefined && changeUSD !== null && (
                <span className={`text-sm ${getChangeColor(changeUSD)}`}>
                  {changeUSD > 0 ? '+' : ''}
                  {formatUSD(changeUSD)}
                </span>
              )}
              {changePercent !== undefined && changePercent !== null && (
                <span
                  className={`text-sm px-2 py-0.5 rounded ${
                    changePercent > 0
                      ? 'bg-profit/20 text-profit'
                      : changePercent < 0
                        ? 'bg-loss/20 text-loss'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {formatChangePercent(changePercent)}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 text-muted-foreground text-xs">
          <Clock className="w-3 h-3" />
          <span>{formatTime(lastUpdated)}</span>
        </div>
      </div>
    </div>
  );
}
