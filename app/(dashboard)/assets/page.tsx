/**
 * Assets Page - 資產總覽頁面
 * 顯示用戶在各交易所的資產餘額和歷史曲線
 *
 * Feature 031: Asset Tracking History (T014)
 * Feature 052: WebSocket 即時餘額更新 (T073)
 * Feature 063: Frontend Data Caching (T022) - TanStack Query integration
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Wallet, RefreshCw, AlertCircle, TrendingUp, ArrowUp, ArrowDown, Layers, ChevronDown, ChevronUp, Radio } from 'lucide-react';
import { TotalAssetCard } from './components/TotalAssetCard';
import { AssetSummaryCard } from './components/AssetSummaryCard';
import { TimeRangeSelector } from './components/TimeRangeSelector';
import { AssetHistoryChart, type HistoryDataPoint } from './components/AssetHistoryChart';
import { PositionTable } from './components/PositionTable';
import { useAssetsQuery } from '@/hooks/queries/useAssetsQuery';
import { useAssetHistoryQuery, type HistorySnapshot } from '@/hooks/queries/useAssetHistoryQuery';
import { useSocket } from '@/hooks/useSocket';

type ExchangeName = 'binance' | 'okx' | 'mexc' | 'gateio' | 'bingx';
type ConnectionStatus = 'success' | 'no_api_key' | 'api_error' | 'rate_limited';

/**
 * 將 API 回傳的 status 映射為 AssetSummaryCard 需要的格式
 */
function mapApiStatus(status: string): ConnectionStatus {
  if (status === 'error') return 'api_error';
  return status as ConnectionStatus;
}

/**
 * 將 HistorySnapshot 轉換為 HistoryDataPoint 格式
 */
function transformHistoryData(snapshots: HistorySnapshot[]): HistoryDataPoint[] {
  return snapshots.map((snapshot) => ({
    timestamp: snapshot.timestamp,
    binance: snapshot.binanceBalanceUSD ?? null,
    okx: snapshot.okxBalanceUSD ?? null,
    mexc: snapshot.mexcBalanceUSD ?? null,
    gate: snapshot.gateioBalanceUSD ?? null,
    total: snapshot.totalBalanceUSD,
  }));
}

type TimeRange = 7 | 14 | 30;

/**
 * 持倉資料
 */
interface Position {
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  entryPrice: number;
  markPrice: number;
  leverage: number;
  marginUsed: number;
  unrealizedPnl: number;
  liquidationPrice?: number;
}

interface ExchangePositions {
  exchange: 'binance' | 'okx' | 'mexc' | 'gateio' | 'bingx';
  status: 'success' | 'no_api_key' | 'api_error' | 'rate_limited';
  positions: Position[];
  totalPnl: number;
  errorMessage?: string;
}

interface PositionsData {
  exchanges: ExchangePositions[];
  totalUnrealizedPnl: number;
  lastUpdated: string;
}

export default function AssetsPage() {
  // 時間範圍狀態
  const [timeRange, setTimeRange] = useState<TimeRange>(7);

  // 持倉展開狀態
  const [isPositionsExpanded, setIsPositionsExpanded] = useState(false);

  // 持倉資料狀態 (保持現有邏輯，後續可改為 TanStack Query)
  const [positionsData, setPositionsData] = useState<PositionsData | null>(null);
  const [isLoadingPositions, setIsLoadingPositions] = useState(true);

  // WebSocket 連線狀態 (來自 useAssetsQuery 內部的 useSocket)
  const { isConnected: isWsConnected } = useSocket();
  const [lastWsUpdate, setLastWsUpdate] = useState<Date | null>(null);

  // TanStack Query for assets (includes WebSocket integration)
  const {
    data: assetsData,
    isLoading: isLoadingAssets,
    isRefetching: isRefreshingAssets,
    error: assetsError,
    refetch: refetchAssets,
  } = useAssetsQuery();

  // TanStack Query for history
  const {
    data: historyData,
    isLoading: isLoadingHistory,
  } = useAssetHistoryQuery({ days: timeRange });

  // 將 historyData 轉換為 Chart 需要的格式
  const chartData = useMemo<HistoryDataPoint[]>(() => {
    if (!historyData?.snapshots) return [];
    return transformHistoryData(historyData.snapshots);
  }, [historyData?.snapshots]);

  // 獲取持倉資料 (保持現有邏輯)
  const fetchPositions = useCallback(async () => {
    try {
      setIsLoadingPositions(true);

      const response = await fetch('/api/assets/positions');

      if (!response.ok) {
        if (response.status === 401) {
          return;
        }
        throw new Error('Failed to fetch positions');
      }

      const data = await response.json();

      if (data.success && data.data) {
        setPositionsData(data.data);
      }
    } catch (_err) {
      console.error('Failed to fetch positions:', err);
    } finally {
      setIsLoadingPositions(false);
    }
  }, []);

  // 初始載入持倉
  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  // 追蹤 WebSocket 更新時間
  useEffect(() => {
    if (assetsData?.lastUpdated) {
      setLastWsUpdate(new Date(assetsData.lastUpdated));
    }
  }, [assetsData?.lastUpdated]);

  // 手動刷新
  const handleRefresh = async () => {
    await refetchAssets();
  };

  // 狀態映射
  const isLoading = isLoadingAssets;
  const isRefreshing = isRefreshingAssets;
  const error = assetsError?.message ?? null;

  // 檢查是否有任何 API Key 設定
  const hasAnyApiKey =
    assetsData?.exchanges.some((e) => e.status !== 'no_api_key') ?? false;

  // Loading 狀態
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
          </div>
        </div>
      </div>
    );
  }

  // 錯誤狀態
  if (error) {
    return (
      <div className="space-y-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <AlertCircle className="w-12 h-12 text-loss mb-4" />
            <p className="text-loss text-lg">{error}</p>
            <button
              onClick={() => refetchAssets()}
              className="mt-4 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
            >
              重試
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 頁面標題 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wallet className="w-8 h-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">資產總覽</h1>
            {/* WebSocket 連線狀態指示器 */}
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
                isWsConnected
                  ? 'bg-profit/10 text-profit'
                  : 'bg-muted text-muted-foreground'
              }`}
              title={
                isWsConnected
                  ? `即時更新中${lastWsUpdate ? ` (上次更新: ${lastWsUpdate.toLocaleTimeString()})` : ''}`
                  : '離線中'
              }
            >
              <Radio className={`w-3 h-3 ${isWsConnected ? 'animate-pulse' : ''}`} />
              <span>{isWsConnected ? '即時' : '離線'}</span>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-accent text-muted-foreground hover:text-accent-foreground rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            {isRefreshing ? '刷新中...' : '刷新'}
          </button>
        </div>

        {/* 無 API Key 提示 */}
        {!hasAnyApiKey && (
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-warning mt-0.5" />
              <div>
                <p className="text-warning font-medium">尚未設定 API Key</p>
                <p className="text-warning/70 text-sm mt-1">
                  請先到{' '}
                  <a
                    href="/settings/api-keys"
                    className="underline hover:text-warning"
                  >
                    設定 &gt; API 金鑰
                  </a>{' '}
                  頁面新增交易所 API Key，即可查看資產餘額。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 總資產卡片 */}
        {assetsData && (
          <TotalAssetCard
            totalBalanceUSD={assetsData.totalBalanceUSD}
            lastUpdated={assetsData.lastUpdated}
          />
        )}

        {/* 各交易所餘額卡片 */}
        {assetsData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {assetsData.exchanges.map((exchange) => (
              <AssetSummaryCard
                key={exchange.exchange}
                exchange={exchange.exchange as ExchangeName}
                status={mapApiStatus(exchange.status)}
                balanceUSD={exchange.balanceUSD}
              />
            ))}
          </div>
        )}

        {/* 歷史曲線區塊 */}
        <div className="glass-card p-6">
          {/* 標題和時間範圍選擇器 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">資產歷史曲線</h2>
            </div>
            <TimeRangeSelector
              value={timeRange}
              onChange={setTimeRange}
              disabled={isLoadingHistory}
            />
          </div>

          {/* 期間統計摘要 */}
          {historyData?.summary && historyData.snapshots.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-muted-foreground text-xs mb-1">期初資產</p>
                <p className="text-foreground font-medium">
                  ${historyData.summary.startTotal?.toFixed(2) ?? '--'}
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-muted-foreground text-xs mb-1">期末資產</p>
                <p className="text-foreground font-medium">
                  ${historyData.summary.endTotal?.toFixed(2) ?? '--'}
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-muted-foreground text-xs mb-1">變化金額</p>
                <div className="flex items-center gap-1">
                  {historyData.summary.changeUSD !== null && (
                    <>
                      {historyData.summary.changeUSD > 0 ? (
                        <ArrowUp className="w-3 h-3 text-profit" />
                      ) : historyData.summary.changeUSD < 0 ? (
                        <ArrowDown className="w-3 h-3 text-loss" />
                      ) : null}
                      <p
                        className={`font-medium ${
                          historyData.summary.changeUSD > 0
                            ? 'text-profit'
                            : historyData.summary.changeUSD < 0
                              ? 'text-loss'
                              : 'text-foreground'
                        }`}
                      >
                        {historyData.summary.changeUSD > 0 ? '+' : ''}
                        ${historyData.summary.changeUSD.toFixed(2)}
                      </p>
                    </>
                  )}
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-muted-foreground text-xs mb-1">變化百分比</p>
                <p
                  className={`font-medium ${
                    (historyData.summary.changePercent ?? 0) > 0
                      ? 'text-profit'
                      : (historyData.summary.changePercent ?? 0) < 0
                        ? 'text-loss'
                        : 'text-foreground'
                  }`}
                >
                  {historyData.summary.changePercent !== null
                    ? `${historyData.summary.changePercent > 0 ? '+' : ''}${historyData.summary.changePercent.toFixed(2)}%`
                    : '--'}
                </p>
              </div>
            </div>
          )}

          {/* 曲線圖表 */}
          <AssetHistoryChart
            data={chartData}
            isLoading={isLoadingHistory}
          />
        </div>

        {/* 持倉列表區塊（可收合） */}
        <div className="glass-card">
          {/* 標題 - 可點擊展開/收合 */}
          <button
            onClick={() => setIsPositionsExpanded(!isPositionsExpanded)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-accent/50 transition-colors rounded-t-lg"
          >
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">當前持倉</h2>
              {positionsData && (
                <span className="text-muted-foreground text-sm">
                  ({positionsData.exchanges.reduce((sum, ex) => sum + ex.positions.length, 0)} 個)
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {positionsData && positionsData.totalUnrealizedPnl !== 0 && (
                <span
                  className={`text-sm font-medium ${
                    positionsData.totalUnrealizedPnl > 0
                      ? 'text-profit'
                      : 'text-loss'
                  }`}
                >
                  {positionsData.totalUnrealizedPnl > 0 ? '+' : ''}
                  ${positionsData.totalUnrealizedPnl.toFixed(2)}
                </span>
              )}
              {isPositionsExpanded ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
          </button>

          {/* 持倉列表內容 */}
          {isPositionsExpanded && (
            <div className="px-6 pb-6">
              <PositionTable
                exchanges={positionsData?.exchanges ?? []}
                totalUnrealizedPnl={positionsData?.totalUnrealizedPnl ?? 0}
                isLoading={isLoadingPositions}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
