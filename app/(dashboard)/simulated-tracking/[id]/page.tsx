/**
 * Tracking Detail Page - 追蹤詳情頁面
 * 顯示單個追蹤的完整資訊和快照歷史
 *
 * Feature 029: Simulated APY Tracking (T039)
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Target,
  TrendingUp,
  TrendingDown,
  Square,
} from 'lucide-react';
import { TrackingStatCards } from '../components/TrackingStatCards';
import { SnapshotTimeline } from '../components/SnapshotTimeline';

interface TrackingData {
  id: string;
  symbol: string;
  longExchange: string;
  shortExchange: string;
  simulatedCapital: number;
  autoStopOnExpire: boolean;
  initialSpread: number;
  initialAPY: number;
  initialLongRate: number;
  initialShortRate: number;
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
  longIntervalHours: number;
  shortIntervalHours: number;
  status: string;
  startedAt: string;
  stoppedAt: string | null;
  totalFundingProfit: number;
  totalSettlements: number;
  maxSpread: number;
  minSpread: number;
  durationFormatted?: string;
}

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

export default function TrackingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const trackingId = params?.id as string;

  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSnapshotsLoading, setIsSnapshotsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStopLoading, setIsStopLoading] = useState(false);

  // 獲取追蹤詳情
  const fetchTracking = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`/api/simulated-tracking/${trackingId}`);

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        if (response.status === 404) {
          setError('追蹤記錄不存在');
          return;
        }
        throw new Error('Failed to fetch tracking');
      }

      const data = await response.json();

      if (data.success && data.data?.tracking) {
        setTracking(data.data.tracking);
      }
    } catch (_err) {
      console.error('Failed to fetch tracking:', err);
      setError('無法載入追蹤詳情');
    } finally {
      setIsLoading(false);
    }
  }, [trackingId, router]);

  // 獲取快照歷史
  const fetchSnapshots = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/simulated-tracking/${trackingId}/snapshots?limit=100`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch snapshots');
      }

      const data = await response.json();

      if (data.success && data.data?.snapshots) {
        setSnapshots(data.data.snapshots);
      }
    } catch (_err) {
      console.error('Failed to fetch snapshots:', err);
    } finally {
      setIsSnapshotsLoading(false);
    }
  }, [trackingId]);

  // 初始載入
  useEffect(() => {
    fetchTracking();
    fetchSnapshots();
  }, [fetchTracking, fetchSnapshots]);

  // 停止追蹤
  const handleStop = async () => {
    if (!tracking || !confirm('確定要停止此追蹤嗎？')) {
      return;
    }

    setIsStopLoading(true);

    try {
      const response = await fetch(`/api/simulated-tracking/${trackingId}/stop`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to stop tracking');
      }

      const data = await response.json();

      // 更新本地狀態，包含損益資料
      if (data.success && data.data?.tracking) {
        const stoppedTracking = data.data.tracking;
        setTracking((prev) =>
          prev
            ? {
                ...prev,
                status: 'STOPPED',
                stoppedAt: stoppedTracking.stoppedAt || new Date().toISOString(),
                exitLongPrice: stoppedTracking.exitLongPrice,
                exitShortPrice: stoppedTracking.exitShortPrice,
                pricePnl: stoppedTracking.pricePnl,
                fundingPnl: stoppedTracking.fundingPnl,
                totalPnl: stoppedTracking.totalPnl,
              }
            : null
        );
      } else {
        // 如果回應格式不符，只更新狀態
        setTracking((prev) =>
          prev
            ? { ...prev, status: 'STOPPED', stoppedAt: new Date().toISOString() }
            : null
        );
      }
    } catch (_err) {
      console.error('Failed to stop tracking:', err);
      setError(err instanceof Error ? err.message : 'Failed to stop tracking');
    } finally {
      setIsStopLoading(false);
    }
  };

  // 刷新
  const handleRefresh = () => {
    setIsLoading(true);
    setIsSnapshotsLoading(true);
    fetchTracking();
    fetchSnapshots();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !tracking) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="bg-loss/10 border border-loss/30 rounded-lg p-8 text-center">
          <AlertCircle className="w-12 h-12 text-loss mx-auto mb-3" />
          <p className="text-loss">{error || '追蹤記錄不存在'}</p>
          <Link
            href="/simulated-tracking"
            className="inline-flex items-center gap-2 mt-4 text-primary hover:text-primary/80"
          >
            <ArrowLeft className="w-4 h-4" />
            返回列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/simulated-tracking"
            className="p-2 hover:bg-muted rounded-md transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">
                {tracking.symbol}
              </h1>
              <span
                className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                  tracking.status === 'ACTIVE'
                    ? 'bg-profit/10 text-profit'
                    : tracking.status === 'STOPPED'
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-warning/10 text-warning'
                }`}
              >
                <Target className="w-3 h-3" />
                {tracking.status === 'ACTIVE'
                  ? '追蹤中'
                  : tracking.status === 'STOPPED'
                  ? '已停止'
                  : '已過期'}
              </span>
            </div>

            {/* Exchange Pair */}
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-profit/10 text-profit rounded">
                <TrendingUp className="w-3 h-3" />
                <span className="capitalize">{tracking.longExchange}</span>
              </span>
              <span className="text-muted-foreground">→</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-loss/10 text-loss rounded">
                <TrendingDown className="w-3 h-3" />
                <span className="capitalize">{tracking.shortExchange}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="p-2 text-muted-foreground hover:bg-muted rounded-md transition-colors"
            title="刷新"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          {tracking.status === 'ACTIVE' && (
            <button
              onClick={handleStop}
              disabled={isStopLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground bg-muted rounded-md hover:bg-muted/80 disabled:opacity-50 transition-colors"
            >
              <Square className="w-4 h-4" />
              {isStopLoading ? '處理中...' : '停止追蹤'}
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-8">
        <TrackingStatCards tracking={tracking} />
      </div>

      {/* Snapshot Timeline */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">
          結算歷史 ({snapshots.length})
        </h2>
        <SnapshotTimeline snapshots={snapshots} isLoading={isSnapshotsLoading} />
      </div>
    </div>
  );
}
