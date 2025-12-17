/**
 * Trades Page - 交易歷史頁面
 *
 * 顯示用戶的所有已平倉交易記錄
 * Feature: 035-close-position (T017)
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { History, RefreshCw, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { TradeCard } from './components/TradeCard';
import { TradeCardSkeletonList } from './components/TradeCardSkeleton';
import type { TradePerformanceInfo } from '@/src/types/trading';

interface TradesResponse {
  success: boolean;
  data: {
    trades: TradePerformanceInfo[];
    total: number;
  };
}

export default function TradesPage() {
  const [trades, setTrades] = useState<TradePerformanceInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchTrades = useCallback(async () => {
    try {
      const response = await fetch('/api/trades?limit=50');
      const data: TradesResponse = await response.json();

      if (data.success) {
        setTrades(data.data.trades);
        setTotal(data.data.total);
        setError(null);
      } else {
        setError('無法載入交易歷史');
      }
    } catch (err) {
      console.error('Failed to fetch trades:', err);
      setError('載入交易歷史時發生錯誤');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchTrades();
  };

  // 計算總績效
  const totalPnL = trades.reduce((sum, t) => sum + parseFloat(t.totalPnL), 0);
  const totalWins = trades.filter((t) => parseFloat(t.totalPnL) >= 0).length;
  const totalLosses = trades.filter((t) => parseFloat(t.totalPnL) < 0).length;
  const winRate = trades.length > 0 ? (totalWins / trades.length) * 100 : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <History className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">交易歷史</h1>
            </div>
          </div>

          {/* Skeleton Cards */}
          <TradeCardSkeletonList count={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <History className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">交易歷史</h1>
            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-sm font-medium">
              {total} 筆交易
            </span>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Summary Stats */}
        {trades.length > 0 && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            {/* Total PnL */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-500 mb-1">總損益</p>
              <p
                className={`text-2xl font-bold ${
                  totalPnL >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {totalPnL >= 0 ? '+' : ''}
                {totalPnL.toFixed(2)} USDT
              </p>
            </div>

            {/* Win Rate */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-500 mb-1">勝率</p>
              <p className="text-2xl font-bold text-gray-900">{winRate.toFixed(1)}%</p>
            </div>

            {/* Wins */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-1 text-sm text-gray-500 mb-1">
                <TrendingUp className="w-4 h-4 text-green-500" />
                獲利交易
              </div>
              <p className="text-2xl font-bold text-green-600">{totalWins}</p>
            </div>

            {/* Losses */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-1 text-sm text-gray-500 mb-1">
                <TrendingDown className="w-4 h-4 text-red-500" />
                虧損交易
              </div>
              <p className="text-2xl font-bold text-red-600">{totalLosses}</p>
            </div>
          </div>
        )}

        {/* Trades List */}
        {trades.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {trades.map((trade) => (
              <TradeCard key={trade.id} trade={trade} />
            ))}
          </div>
        ) : (
          !error && (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <History className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">尚無交易記錄</h3>
              <p className="text-sm text-gray-500">平倉後的交易績效會顯示在這裡</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
