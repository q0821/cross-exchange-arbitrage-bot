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

type ExchangeName = 'binance' | 'okx' | 'mexc' | 'gateio';
type ConnectionStatus = 'success' | 'no_api_key' | 'api_error' | 'rate_limited';

interface AssetSummaryCardProps {
  exchange: ExchangeName;
  status: ConnectionStatus;
  balanceUSD: number | null;
}

// 交易所配色
const exchangeColors: Record<
  ExchangeName,
  { primary: string; bg: string; border: string }
> = {
  binance: {
    primary: 'text-yellow-400',
    bg: 'bg-yellow-900/20',
    border: 'border-yellow-700/30',
  },
  okx: {
    primary: 'text-gray-300',
    bg: 'bg-gray-800/50',
    border: 'border-gray-600/30',
  },
  mexc: {
    primary: 'text-teal-400',
    bg: 'bg-teal-900/20',
    border: 'border-teal-700/30',
  },
  gateio: {
    primary: 'text-blue-400',
    bg: 'bg-blue-900/20',
    border: 'border-blue-700/30',
  },
};

// 交易所顯示名稱
const exchangeDisplayNames: Record<ExchangeName, string> = {
  binance: 'Binance',
  okx: 'OKX',
  mexc: 'MEXC',
  gateio: 'Gate.io',
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
          icon: <CheckCircle className="w-4 h-4 text-green-400" />,
          text: '已連線',
          textColor: 'text-green-400',
        };
      case 'no_api_key':
        return {
          icon: <Key className="w-4 h-4 text-gray-500" />,
          text: '未設定',
          textColor: 'text-gray-500',
        };
      case 'api_error':
        return {
          icon: <XCircle className="w-4 h-4 text-red-400" />,
          text: '連線錯誤',
          textColor: 'text-red-400',
        };
      case 'rate_limited':
        return {
          icon: <Clock className="w-4 h-4 text-yellow-400" />,
          text: '請求受限',
          textColor: 'text-yellow-400',
        };
      default:
        return {
          icon: <AlertTriangle className="w-4 h-4 text-gray-400" />,
          text: '未知',
          textColor: 'text-gray-400',
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div
      className={`rounded-lg p-4 border ${colors.bg} ${colors.border} transition-all hover:scale-[1.02]`}
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
      <div className="text-xl font-bold text-white">
        {status === 'success' ? formatUSD(balanceUSD) : '--'}
      </div>

      {/* 無 API Key 提示 */}
      {status === 'no_api_key' && (
        <p className="text-xs text-gray-500 mt-2">
          前往{' '}
          <a
            href="/settings/api-keys"
            className="text-blue-400 hover:underline"
          >
            設定
          </a>{' '}
          新增 API Key
        </p>
      )}

      {/* 錯誤提示 */}
      {status === 'api_error' && (
        <p className="text-xs text-red-400/70 mt-2">
          請檢查 API Key 是否有效
        </p>
      )}

      {/* Rate Limit 提示 */}
      {status === 'rate_limited' && (
        <p className="text-xs text-yellow-400/70 mt-2">請稍後再試</p>
      )}
    </div>
  );
}
