/**
 * AssetSummaryCard - 單一交易所餘額卡片
 * 顯示單一交易所的資產餘額和連線狀態
 *
 * Feature 031: Asset Tracking History (T016)
 */

import React from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Key,
  Clock,
} from 'lucide-react';

type ExchangeName = 'binance' | 'okx' | 'mexc' | 'gateio' | 'bingx';
type ConnectionStatus = 'success' | 'no_api_key' | 'api_error' | 'rate_limited';

interface AssetSummaryCardProps {
  exchange: ExchangeName;
  status: ConnectionStatus;
  balanceUSD: number | null;
}

// 交易所配色 - 支援深淺色主題
const exchangeColors: Record<
  ExchangeName,
  { primary: string; bg: string; border: string }
> = {
  binance: {
    primary: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-100/50 dark:bg-yellow-900/20',
    border: 'border-yellow-300/50 dark:border-yellow-700/30',
  },
  okx: {
    primary: 'text-slate-700 dark:text-slate-300',
    bg: 'bg-slate-100/50 dark:bg-slate-800/50',
    border: 'border-slate-300/50 dark:border-slate-600/30',
  },
  mexc: {
    primary: 'text-teal-600 dark:text-teal-400',
    bg: 'bg-teal-100/50 dark:bg-teal-900/20',
    border: 'border-teal-300/50 dark:border-teal-700/30',
  },
  gateio: {
    primary: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-100/50 dark:bg-blue-900/20',
    border: 'border-blue-300/50 dark:border-blue-700/30',
  },
  bingx: {
    primary: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-100/50 dark:bg-orange-900/20',
    border: 'border-orange-300/50 dark:border-orange-700/30',
  },
};

// 交易所顯示名稱
const exchangeDisplayNames: Record<ExchangeName, string> = {
  binance: 'Binance',
  okx: 'OKX',
  mexc: 'MEXC',
  gateio: 'Gate.io',
  bingx: 'BingX',
};

export function AssetSummaryCard({
  exchange,
  status,
  balanceUSD,
}: AssetSummaryCardProps) {
  const colors = exchangeColors[exchange];
  const displayName = exchangeDisplayNames[exchange];

  // 格式化金額
  const formatUSD = (value: number | null) => {
    if (value === null) return '--';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // 狀態圖示和文字
  const getStatusInfo = () => {
    switch (status) {
      case 'success':
        return {
          icon: <CheckCircle className="w-4 h-4 text-profit" />,
          text: '已連線',
          textColor: 'text-profit',
        };
      case 'no_api_key':
        return {
          icon: <Key className="w-4 h-4 text-muted-foreground" />,
          text: '未設定',
          textColor: 'text-muted-foreground',
        };
      case 'api_error':
        return {
          icon: <XCircle className="w-4 h-4 text-loss" />,
          text: '連線錯誤',
          textColor: 'text-loss',
        };
      case 'rate_limited':
        return {
          icon: <Clock className="w-4 h-4 text-warning" />,
          text: '請求受限',
          textColor: 'text-warning',
        };
      default:
        return {
          icon: <AlertTriangle className="w-4 h-4 text-muted-foreground" />,
          text: '未知',
          textColor: 'text-muted-foreground',
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div
      className={`glass-card rounded-lg p-4 ${colors.bg} ${colors.border} transition-all hover:scale-[1.02] cursor-pointer`}
    >
      {/* 交易所名稱 */}
      <div className="flex items-center justify-between mb-3">
        <span className={`font-semibold ${colors.primary}`}>{displayName}</span>
        <div className="flex items-center gap-1">
          {statusInfo.icon}
          <span className={`text-xs ${statusInfo.textColor}`}>
            {statusInfo.text}
          </span>
        </div>
      </div>

      {/* 餘額 */}
      <div className="text-xl font-bold text-foreground">
        {status === 'success' ? formatUSD(balanceUSD) : '--'}
      </div>

      {/* 無 API Key 提示 */}
      {status === 'no_api_key' && (
        <p className="text-xs text-muted-foreground mt-2">
          前往{' '}
          <a
            href="/settings/api-keys"
            className="text-primary hover:underline"
          >
            設定
          </a>{' '}
          新增 API Key
        </p>
      )}

      {/* 錯誤提示 */}
      {status === 'api_error' && (
        <p className="text-xs text-loss/70 mt-2">
          請檢查 API Key 是否有效
        </p>
      )}

      {/* Rate Limit 提示 */}
      {status === 'rate_limited' && (
        <p className="text-xs text-warning/70 mt-2">請稍後再試</p>
      )}
    </div>
  );
}
