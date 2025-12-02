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
} from 'lucide-react';

interface TrackingData {
  simulatedCapital: number;
  initialAPY: number;
  initialSpread: number;
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

  const stats = [
    {
      label: '模擬資金',
      value: `$${tracking.simulatedCapital.toLocaleString()}`,
      icon: DollarSign,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
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

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
  );
}
