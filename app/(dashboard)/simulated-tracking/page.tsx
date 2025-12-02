/**
 * Simulated Tracking Page - 模擬追蹤頁面
 * 顯示用戶的所有追蹤記錄
 *
 * Feature 029: Simulated APY Tracking (T023)
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Target, RefreshCw, AlertCircle } from 'lucide-react';
import { ActiveTrackingCard } from './components/ActiveTrackingCard';
import { TrackingHistoryTable } from './components/TrackingHistoryTable';

interface TrackingData {
  id: string;
  symbol: string;
  longExchange: string;
  shortExchange: string;
  simulatedCapital: number;
  initialAPY: number;
  // 開倉價格和固定顆數
  initialLongPrice: number | null;
  initialShortPrice: number | null;
  positionQuantity: number | null;
  status: string;
  startedAt: string;
  stoppedAt: string | null;
  totalFundingProfit: number;
  totalSettlements: number;
  durationFormatted?: string;
  currentAPY?: number;
}

export default function SimulatedTrackingPage() {
  const [trackings, setTrackings] = useState<TrackingData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stopLoadingId, setStopLoadingId] = useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);

  // 獲取追蹤列表
  const fetchTrackings = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/simulated-tracking?status=all&limit=100');

      if (!response.ok) {
        if (response.status === 401) {
          setError('請先登入');
          return;
        }
        throw new Error('Failed to fetch trackings');
      }

      const data = await response.json();

      if (data.success && data.data?.trackings) {
        setTrackings(data.data.trackings);
      }
    } catch (err) {
      console.error('Failed to fetch trackings:', err);
      setError('無法載入追蹤記錄');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始載入
  useEffect(() => {
    fetchTrackings();
  }, [fetchTrackings]);

  // 停止追蹤
  const handleStop = async (id: string) => {
    setStopLoadingId(id);

    try {
      const response = await fetch(`/api/simulated-tracking/${id}/stop`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to stop tracking');
      }

      // 更新本地狀態
      setTrackings((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, status: 'STOPPED', stoppedAt: new Date().toISOString() } : t
        )
      );
    } catch (err) {
      console.error('Failed to stop tracking:', err);
      setError(err instanceof Error ? err.message : 'Failed to stop tracking');
    } finally {
      setStopLoadingId(null);
    }
  };

  // 刪除追蹤
  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此追蹤記錄嗎？此操作無法復原。')) {
      return;
    }

    setDeleteLoadingId(id);

    try {
      const response = await fetch(`/api/simulated-tracking/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete tracking');
      }

      // 從本地狀態中移除
      setTrackings((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error('Failed to delete tracking:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete tracking');
    } finally {
      setDeleteLoadingId(null);
    }
  };

  // 分離活躍和歷史追蹤
  const activeTrackings = trackings.filter((t) => t.status === 'ACTIVE');
  const historyTrackings = trackings.filter((t) => t.status !== 'ACTIVE');

  // 計算統計
  const totalProfit = trackings.reduce((sum, t) => sum + t.totalFundingProfit, 0);
  const totalCapital = activeTrackings.reduce((sum, t) => sum + t.simulatedCapital, 0);

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Target className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">模擬追蹤</h1>
            <p className="text-sm text-gray-500">
              追蹤套利機會並模擬收益表現
            </p>
          </div>
        </div>

        <button
          onClick={fetchTrackings}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500 mb-1">活躍追蹤數</div>
          <div className="text-2xl font-bold text-gray-900">
            {activeTrackings.length}
            <span className="text-sm font-normal text-gray-500 ml-1">/ 5</span>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500 mb-1">活躍模擬資金</div>
          <div className="text-2xl font-bold text-gray-900">
            ${totalCapital.toLocaleString()}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500 mb-1">累計總收益</div>
          <div
            className={`text-2xl font-bold ${
              totalProfit >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      ) : (
        <>
          {/* Active Trackings */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              活躍追蹤 ({activeTrackings.length})
            </h2>

            {activeTrackings.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-2">尚無活躍追蹤</p>
                <p className="text-sm text-gray-400">
                  前往市場監控頁面，點擊追蹤按鈕開始追蹤套利機會
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeTrackings.map((tracking) => (
                  <ActiveTrackingCard
                    key={tracking.id}
                    tracking={tracking}
                    onStop={handleStop}
                    isStopLoading={stopLoadingId === tracking.id}
                  />
                ))}
              </div>
            )}
          </section>

          {/* History Trackings */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              歷史記錄 ({historyTrackings.length})
            </h2>

            <TrackingHistoryTable
              trackings={historyTrackings}
              onDelete={handleDelete}
              isDeleteLoading={!!deleteLoadingId}
              deletingId={deleteLoadingId}
            />
          </section>
        </>
      )}
    </div>
  );
}
