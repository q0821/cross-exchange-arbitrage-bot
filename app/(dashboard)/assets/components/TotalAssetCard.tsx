/**
 * TotalAssetCard - 總資產摘要卡片
 * 顯示所有交易所的總資產（USD）
 *
 * Feature 031: Asset Tracking History (T015)
 */

import React from 'react';
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
    if (value === null || value === undefined) return 'text-gray-400';
    if (value > 0) return 'text-green-400';
    if (value < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  // 格式化變化百分比
  const formatChangePercent = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  return (
    <div className="bg-gradient-to-br from-blue-900/40 to-purple-900/40 rounded-xl p-6 border border-blue-700/30">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
            <DollarSign className="w-4 h-4" />
            <span>總資產</span>
          </div>
          <div className="text-3xl font-bold text-white">
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
                      ? 'bg-green-900/30 text-green-400'
                      : changePercent < 0
                        ? 'bg-red-900/30 text-red-400'
                        : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  {formatChangePercent(changePercent)}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 text-gray-500 text-xs">
          <Clock className="w-3 h-3" />
          <span>{formatTime(lastUpdated)}</span>
        </div>
      </div>
    </div>
  );
}
