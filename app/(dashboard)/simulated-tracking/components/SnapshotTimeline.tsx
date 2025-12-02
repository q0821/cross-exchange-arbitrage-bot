/**
 * SnapshotTimeline - 快照時間線組件
 * 顯示追蹤的結算快照歷史
 *
 * Feature 029: Simulated APY Tracking (T037)
 */

'use client';

import React from 'react';
import { Clock, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

interface SnapshotData {
  id: string;
  snapshotType: string;
  longRate: number;
  shortRate: number;
  spread: number;
  annualizedReturn: number;
  longPrice: number | null;
  shortPrice: number | null;
  priceDiffPercent: number | null;
  settlementSide: string | null;
  fundingProfit: number | null;
  cumulativeProfit: number;
  recordedAt: string;
}

interface SnapshotTimelineProps {
  snapshots: SnapshotData[];
  isLoading?: boolean;
}

export function SnapshotTimeline({ snapshots, isLoading }: SnapshotTimelineProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-pulse text-gray-400">載入中...</div>
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">尚無快照記錄</p>
        <p className="text-sm text-gray-400 mt-1">
          快照將在下一次資金費率結算時自動記錄
        </p>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatRate = (rate: number) => {
    return (rate * 100).toFixed(4) + '%';
  };

  const getSettlementSideLabel = (side: string | null) => {
    switch (side) {
      case 'LONG':
        return '做多結算';
      case 'SHORT':
        return '做空結算';
      case 'BOTH':
        return '雙向結算';
      default:
        return '週期快照';
    }
  };

  return (
    <div className="space-y-4">
      {snapshots.map((snapshot) => {
        const isPositive = (snapshot.fundingProfit ?? 0) >= 0;

        return (
          <div
            key={snapshot.id}
            className="relative pl-8 pb-4 border-l-2 border-gray-200 last:border-l-0 last:pb-0"
          >
            {/* Timeline dot */}
            <div
              className={`absolute left-[-9px] top-0 w-4 h-4 rounded-full border-2 ${
                snapshot.snapshotType === 'SETTLEMENT'
                  ? 'bg-blue-500 border-blue-500'
                  : 'bg-gray-300 border-gray-300'
              }`}
            />

            {/* Snapshot card */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                      snapshot.snapshotType === 'SETTLEMENT'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {getSettlementSideLabel(snapshot.settlementSide)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDate(snapshot.recordedAt)}
                  </span>
                </div>

                {/* Profit */}
                {snapshot.fundingProfit !== null && (
                  <div
                    className={`flex items-center gap-1 font-medium ${
                      isPositive ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>
                      {isPositive ? '+' : ''}
                      {snapshot.fundingProfit.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Rates Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {/* Long Rate */}
                <div>
                  <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                    <TrendingUp className="w-3 h-3 text-green-500" />
                    做多費率
                  </div>
                  <div className="font-mono">{formatRate(snapshot.longRate)}</div>
                </div>

                {/* Short Rate */}
                <div>
                  <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                    <TrendingDown className="w-3 h-3 text-red-500" />
                    做空費率
                  </div>
                  <div className="font-mono">{formatRate(snapshot.shortRate)}</div>
                </div>

                {/* Spread */}
                <div>
                  <div className="text-xs text-gray-500 mb-1">費率差</div>
                  <div className="font-mono">{snapshot.spread.toFixed(4)}%</div>
                </div>

                {/* Annualized */}
                <div>
                  <div className="text-xs text-gray-500 mb-1">年化收益</div>
                  <div className="font-mono text-blue-600">
                    {snapshot.annualizedReturn.toFixed(2)}%
                  </div>
                </div>
              </div>

              {/* Cumulative Profit */}
              <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                <span className="text-xs text-gray-500">累計收益</span>
                <span
                  className={`font-medium ${
                    snapshot.cumulativeProfit >= 0
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  {snapshot.cumulativeProfit >= 0 ? '+' : ''}
                  {snapshot.cumulativeProfit.toFixed(2)} USDT
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
