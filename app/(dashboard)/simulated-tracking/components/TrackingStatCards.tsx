/**
 * TrackingStatCards - 追蹤統計卡片組件
 * 顯示追蹤的關鍵統計數據
 *
 * Feature 029: Simulated APY Tracking (T038)
 */

'use client';

import React from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  Activity,
  Target,
  Layers,
} from 'lucide-react';

interface TrackingData {
  symbol: string;
  simulatedCapital: number;
  initialAPY: number;
  initialSpread: number;
  // 開倉價格和固定顆數
  initialLongPrice: number | null;
  initialShortPrice: number | null;
  positionQuantity: number | null;
  // 平倉價格和損益（停止追蹤時記錄）
  exitLongPrice: number | null;
  exitShortPrice: number | null;
  pricePnl: number | null;
  fundingPnl: number | null;
  totalPnl: number | null;
  status: string;
  totalFundingProfit: number;
  totalSettlements: number;
  maxSpread: number;
  minSpread: number;
  durationFormatted?: string;
}

interface TrackingStatCardsProps {
  tracking: TrackingData;
}

export function TrackingStatCards({ tracking }: TrackingStatCardsProps) {
  const profitPercentage =
    (tracking.totalFundingProfit / tracking.simulatedCapital) * 100;
  const isPositive = tracking.totalFundingProfit >= 0;

  // 取得幣種名稱（移除 USDT 後綴）
  const coinSymbol = tracking.symbol.replace('USDT', '');

  // 開倉價格顯示（分開顯示兩個交易所，處理部分缺失的情況）
  const entryPricesSubValue = (() => {
    if (!tracking.initialLongPrice && !tracking.initialShortPrice) {
      return undefined;
    }
    const longPriceStr = tracking.initialLongPrice
      ? `$${tracking.initialLongPrice.toFixed(4)}`
      : 'N/A';
    const shortPriceStr = tracking.initialShortPrice
      ? `$${tracking.initialShortPrice.toFixed(4)}`
      : 'N/A';
    return `${longPriceStr} / ${shortPriceStr}`;
  })();

  const stats = [
    {
      label: '模擬資金',
      value: `$${tracking.simulatedCapital.toLocaleString()}`,
      icon: DollarSign,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
    },
    {
      label: '固定顆數',
      value: tracking.positionQuantity
        ? `${tracking.positionQuantity.toFixed(4)} ${coinSymbol}`
        : '資金模式',
      subValue: entryPricesSubValue,
      icon: Layers,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50',
    },
    {
      label: '累計收益',
      value: `${isPositive ? '+' : ''}$${tracking.totalFundingProfit.toFixed(2)}`,
      subValue: `(${isPositive ? '+' : ''}${profitPercentage.toFixed(2)}%)`,
      icon: isPositive ? TrendingUp : TrendingDown,
      color: isPositive ? 'text-green-600' : 'text-red-600',
      bgColor: isPositive ? 'bg-green-50' : 'bg-red-50',
    },
    {
      label: '初始年化',
      value: `${tracking.initialAPY.toFixed(2)}%`,
      icon: Target,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: '結算次數',
      value: `${tracking.totalSettlements}`,
      icon: Activity,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      label: '追蹤時長',
      value: tracking.durationFormatted || '計算中...',
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      label: '費率差範圍',
      value: `${tracking.minSpread.toFixed(4)}% ~ ${tracking.maxSpread.toFixed(4)}%`,
      icon: Activity,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
  ];

  // 損益明細（停止追蹤時顯示）
  const hasPnlData =
    tracking.status !== 'ACTIVE' && tracking.totalPnl !== null;

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-white rounded-lg border border-gray-200 p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded ${stat.bgColor}`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <span className="text-xs text-gray-500">{stat.label}</span>
            </div>
            <div className={`text-lg font-semibold ${stat.color}`}>
              {stat.value}
            </div>
            {stat.subValue && (
              <div className="text-xs text-gray-500 mt-1">{stat.subValue}</div>
            )}
          </div>
        ))}
      </div>

      {/* PnL Breakdown - 停止追蹤後顯示 */}
      {hasPnlData && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            損益明細
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 幣價損益 */}
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
              <div className="text-xs text-gray-500 mb-1">幣價損益</div>
              <div
                className={`text-lg font-semibold ${
                  (tracking.pricePnl ?? 0) >= 0
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}
              >
                {(tracking.pricePnl ?? 0) >= 0 ? '+' : ''}$
                {(tracking.pricePnl ?? 0).toFixed(2)}
              </div>
              {tracking.exitLongPrice && tracking.exitShortPrice && (
                <div className="text-xs text-gray-400 mt-1">
                  平倉價: ${tracking.exitLongPrice.toFixed(4)} / $
                  {tracking.exitShortPrice.toFixed(4)}
                </div>
              )}
            </div>

            {/* 資費差損益 */}
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
              <div className="text-xs text-gray-500 mb-1">資費差損益</div>
              <div
                className={`text-lg font-semibold ${
                  (tracking.fundingPnl ?? 0) >= 0
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}
              >
                {(tracking.fundingPnl ?? 0) >= 0 ? '+' : ''}$
                {(tracking.fundingPnl ?? 0).toFixed(2)}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                結算次數: {tracking.totalSettlements}
              </div>
            </div>

            {/* 合計損益 */}
            <div
              className={`p-3 rounded-lg border ${
                (tracking.totalPnl ?? 0) >= 0
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="text-xs text-gray-500 mb-1">合計損益</div>
              <div
                className={`text-xl font-bold ${
                  (tracking.totalPnl ?? 0) >= 0
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}
              >
                {(tracking.totalPnl ?? 0) >= 0 ? '+' : ''}$
                {(tracking.totalPnl ?? 0).toFixed(2)}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                報酬率:{' '}
                {(
                  ((tracking.totalPnl ?? 0) / tracking.simulatedCapital) *
                  100
                ).toFixed(2)}
                %
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
