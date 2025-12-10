/**
 * AssetHistoryChart - 資產歷史曲線圖表
 * 使用 Recharts AreaChart 顯示資產變化
 *
 * Feature 031: Asset Tracking History (T023)
 */

'use client';

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

/**
 * 曲線圖資料點
 */
export interface HistoryDataPoint {
  timestamp: string;
  binance: number | null;
  okx: number | null;
  mexc: number | null;
  gate: number | null;
  total: number;
}

interface AssetHistoryChartProps {
  data: HistoryDataPoint[];
  isLoading?: boolean;
}

// 交易所配色
const exchangeColors = {
  binance: '#F3BA2F', // Binance 黃
  okx: '#FFFFFF', // OKX 白
  mexc: '#00B897', // MEXC 綠
  gate: '#2354E6', // Gate.io 藍
  total: '#8B5CF6', // 總資產 紫
};

// 格式化 USD
const formatUSD = (value: number) => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
};

// 格式化日期（X 軸）
const formatDate = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('zh-TW', {
    month: 'short',
    day: 'numeric',
  });
};

// 格式化完整日期時間（Tooltip）
const formatDateTime = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-TW', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// 自定義 Tooltip
const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload || !label) return null;

  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
      <p className="text-gray-400 text-xs mb-2">{formatDateTime(label)}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4 text-sm">
          <span style={{ color: entry.color }}>{getDisplayName(entry.name)}</span>
          <span className="text-white font-medium">
            ${entry.value?.toFixed(2) ?? '--'}
          </span>
        </div>
      ))}
    </div>
  );
};

// 獲取顯示名稱
const getDisplayName = (key: string) => {
  const names: Record<string, string> = {
    binance: 'Binance',
    okx: 'OKX',
    mexc: 'MEXC',
    gate: 'Gate.io',
    total: '總資產',
  };
  return names[key] || key;
};

export function AssetHistoryChart({ data, isLoading }: AssetHistoryChartProps) {
  // 檢查是否有資料
  const hasData = data.length > 0;

  // 檢查哪些交易所有資料
  const hasExchangeData = {
    binance: data.some((d) => d.binance !== null && d.binance > 0),
    okx: data.some((d) => d.okx !== null && d.okx > 0),
    mexc: data.some((d) => d.mexc !== null && d.mexc > 0),
    gate: data.some((d) => d.gate !== null && d.gate > 0),
  };

  // Loading 狀態
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  // 無資料狀態
  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <p>尚無歷史資料</p>
        <p className="text-sm mt-1">系統每小時會自動記錄資產快照</p>
      </div>
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            {/* 漸層定義 */}
            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={exchangeColors.total} stopOpacity={0.3} />
              <stop offset="95%" stopColor={exchangeColors.total} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorBinance" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={exchangeColors.binance} stopOpacity={0.3} />
              <stop offset="95%" stopColor={exchangeColors.binance} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorOkx" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={exchangeColors.okx} stopOpacity={0.2} />
              <stop offset="95%" stopColor={exchangeColors.okx} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorMexc" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={exchangeColors.mexc} stopOpacity={0.3} />
              <stop offset="95%" stopColor={exchangeColors.mexc} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorGate" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={exchangeColors.gate} stopOpacity={0.3} />
              <stop offset="95%" stopColor={exchangeColors.gate} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatDate}
            stroke="#6B7280"
            tick={{ fontSize: 12 }}
          />
          <YAxis
            tickFormatter={formatUSD}
            stroke="#6B7280"
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => (
              <span className="text-gray-300">{getDisplayName(value)}</span>
            )}
          />

          {/* 總資產曲線（主要） */}
          <Area
            type="monotone"
            dataKey="total"
            stroke={exchangeColors.total}
            strokeWidth={2}
            fill="url(#colorTotal)"
            name="total"
          />

          {/* 各交易所曲線 */}
          {hasExchangeData.binance && (
            <Area
              type="monotone"
              dataKey="binance"
              stroke={exchangeColors.binance}
              strokeWidth={1.5}
              fill="url(#colorBinance)"
              name="binance"
              connectNulls
            />
          )}

          {hasExchangeData.okx && (
            <Area
              type="monotone"
              dataKey="okx"
              stroke={exchangeColors.okx}
              strokeWidth={1.5}
              fill="url(#colorOkx)"
              name="okx"
              connectNulls
            />
          )}

          {hasExchangeData.mexc && (
            <Area
              type="monotone"
              dataKey="mexc"
              stroke={exchangeColors.mexc}
              strokeWidth={1.5}
              fill="url(#colorMexc)"
              name="mexc"
              connectNulls
            />
          )}

          {hasExchangeData.gate && (
            <Area
              type="monotone"
              dataKey="gate"
              stroke={exchangeColors.gate}
              strokeWidth={1.5}
              fill="url(#colorGate)"
              name="gate"
              connectNulls
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
