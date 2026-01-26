/**
 * Positions Page - 持倉列表頁面
 * 顯示用戶當前的所有持倉
 *
 * Feature 033: Manual Open Position (T018)
 * Feature 035: Close Position (T011)
 * Feature 037: Mark Position Closed (T006)
 * Feature 063: Frontend Data Caching (T013) - TanStack Query integration
 * Feature 069: Position Group Close (T017) - 組合持倉顯示
 * Feature: 持倉管理頁面顯示即時資金費率
 */

'use client';

import { useState } from 'react';
import { Briefcase, RefreshCw, AlertCircle, Loader2, CheckCircle, XCircle, Layers } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { PositionCard } from './components/PositionCard';
import { PositionCardSkeleton } from './components/PositionCardSkeleton';
import { PositionGroupCard } from './components/PositionGroupCard';
import { ClosePositionDialog } from './components/ClosePositionDialog';
import { CloseProgressOverlay } from './components/CloseProgressOverlay';
import { BatchCloseDialog } from './components/BatchCloseDialog';
import { useClosePosition } from './hooks/useClosePosition';
import { useBatchClose } from './hooks/useBatchClose';
import { usePositionRates } from './hooks/usePositionRates';
import { useGroupedPositionsQuery, type Position } from '@/hooks/queries/usePositionsQuery';
import { queryKeys } from '@/lib/query-keys';

/**
 * 格式化持倉時間
 */
function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} 天`);
  if (hours > 0) parts.push(`${hours} 小時`);
  if (minutes > 0) parts.push(`${minutes} 分`);

  return parts.length > 0 ? parts.join(' ') : '少於 1 分鐘';
}

export default function PositionsPage() {
  const [markingAsClosedId, setMarkingAsClosedId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // TanStack Query for grouped positions data (Feature 069)
  const {
    data,
    isLoading,
    isRefetching,
    error: queryError,
    refetch,
  } = useGroupedPositionsQuery();

  const queryClient = useQueryClient();

  // 平倉功能
  const closePosition = useClosePosition();

  // Feature 069: 批量平倉功能
  const batchClose = useBatchClose();

  // Feature: 即時資金費率
  const { isConnected: isRatesConnected, getRateForPosition, currentTime } = usePositionRates();

  // Feature 069: 分組顯示支援
  const ungroupedPositions = data?.positions ?? [];
  const groups = data?.groups ?? [];
  const total = data?.total ?? 0;

  // 合併未分組持倉和組內持倉為完整列表（用於舊功能相容）
  const allPositions: Position[] = [
    ...ungroupedPositions,
    ...groups.flatMap((g) => g.positions),
  ];

  const error = localError || (queryError?.message ?? null);
  const isRefreshing = isRefetching;

  const handleRefresh = async () => {
    setLocalError(null);
    await refetch();
  };

  /**
   * 處理平倉按鈕點擊 - 先顯示確認對話框
   */
  const handleClosePosition = async (positionId: string) => {
    // 先獲取市場數據並顯示確認對話框
    await closePosition.startClose(positionId);
  };

  /**
   * 確認平倉
   */
  const handleConfirmClose = async () => {
    const success = await closePosition.confirmClose();
    if (success) {
      // 平倉成功，invalidate 快取讓 TanStack Query 自動刷新
      queryClient.invalidateQueries({ queryKey: queryKeys.trading.positions() });
      queryClient.invalidateQueries({ queryKey: queryKeys.trading.groupedPositions() });
      queryClient.invalidateQueries({ queryKey: queryKeys.assets.all });
    }
  };

  /**
   * Feature 069: 處理組合批量平倉
   */
  const handleBatchClose = (groupId: string) => {
    batchClose.startBatchClose(groupId);
  };

  /**
   * Feature 069: 確認批量平倉
   */
  const handleConfirmBatchClose = async () => {
    await batchClose.confirmBatchClose();
  };

  /**
   * Feature 069: 取消批量平倉
   */
  const handleCancelBatchClose = () => {
    batchClose.cancelBatchClose();
  };

  /**
   * Feature 069: 重置批量平倉狀態
   */
  const handleResetBatchClose = () => {
    batchClose.reset();
  };

  /**
   * 取消平倉
   */
  const handleCancelClose = () => {
    closePosition.cancelClose();
  };

  /**
   * 處理標記已平倉
   */
  const handleMarkAsClosed = async (positionId: string) => {
    setMarkingAsClosedId(positionId);
    setLocalError(null);
    try {
      const response = await fetch(`/api/positions/${positionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'markAsClosed' }),
      });

      const result = await response.json();

      if (result.success) {
        // 成功，invalidate 快取
        queryClient.invalidateQueries({ queryKey: queryKeys.trading.positions() });
      } else {
        // 顯示錯誤
        setLocalError(result.error?.message || '標記失敗');
      }
    } catch (err) {
      console.error('Failed to mark position as closed:', err);
      setLocalError('標記持倉時發生錯誤');
    } finally {
      setMarkingAsClosedId(null);
    }
  };

  // 找到正在平倉的持倉
  const closingPosition = allPositions.find((p) => p.id === closePosition.closingPositionId);

  // Feature 069: 分類未分組持倉（已分組的由 PositionGroupCard 顯示）
  const openPositions = ungroupedPositions.filter(
    (p) => p.status === 'OPEN' || p.status === 'OPENING'
  );
  const pendingPositions = ungroupedPositions.filter(
    (p) => p.status === 'PENDING'
  );
  const partialPositions = ungroupedPositions.filter(
    (p) => p.status === 'PARTIAL'
  );
  const failedPositions = ungroupedPositions.filter(
    (p) => p.status === 'FAILED'
  );

  // Feature 069: 分類組合持倉（只顯示活躍的組合）
  const openGroups = groups.filter((g) =>
    g.positions.some((p) => p.status === 'OPEN' || p.status === 'OPENING')
  );
  // TODO: partialGroups 和 failedGroups 將在 User Story 3/4 使用

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Briefcase className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">持倉管理</h1>
          </div>
        </div>

        {/* Skeleton Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <PositionCardSkeleton />
          <PositionCardSkeleton />
          <PositionCardSkeleton />
          <PositionCardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Briefcase className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">持倉管理</h1>
            <span className="bg-primary/10 text-primary px-2 py-1 rounded-full text-sm font-medium">
              {total} 個持倉
            </span>
            {/* Feature 069: 顯示組合數量 */}
            {groups.length > 0 && (
              <span className="inline-flex items-center gap-1 bg-secondary/10 text-secondary px-2 py-1 rounded-full text-sm font-medium">
                <Layers className="w-3 h-3" />
                {groups.length} 個組合
              </span>
            )}
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-md hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-loss/10 border border-loss/30 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-loss mt-0.5" />
            <div>
              <p className="text-sm text-loss">{error}</p>
            </div>
          </div>
        )}

        {/* Partial Positions (需手動處理) */}
        {partialPositions.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5 text-warning" />
              <h2 className="text-lg font-semibold text-warning">需手動處理</h2>
              <span className="bg-warning/10 text-warning px-2 py-0.5 rounded-full text-xs font-medium">
                {partialPositions.length}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {partialPositions.map((position) => (
                <PositionCard
                  key={position.id}
                  position={position as any}
                  onMarkAsClosed={handleMarkAsClosed}
                  isMarkingAsClosed={markingAsClosedId === position.id}
                  rateInfo={getRateForPosition(position.symbol, position.longExchange, position.shortExchange)}
                  isRatesConnected={isRatesConnected}
                  currentTime={currentTime}
                />
              ))}
            </div>
          </div>
        )}

        {/* Close Position Status Banner */}
        {closePosition.isLoading && (
          <div className="mb-6 p-4 bg-primary/10 border border-primary/30 rounded-lg flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <div>
              <p className="text-sm font-medium text-primary">
                {closePosition.progress?.message || '正在執行平倉...'}
              </p>
            </div>
          </div>
        )}

        {closePosition.isSuccess && closePosition.successResult && (
          <div className="mb-6 p-4 bg-profit/10 border border-profit/30 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-profit mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-profit mb-2">平倉成功</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">價差損益</p>
                    <p className={`font-medium ${parseFloat(closePosition.successResult.trade.priceDiffPnL) >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {parseFloat(closePosition.successResult.trade.priceDiffPnL) >= 0 ? '+' : ''}
                      {parseFloat(closePosition.successResult.trade.priceDiffPnL).toFixed(2)} USDT
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">總損益</p>
                    <p className={`font-medium ${parseFloat(closePosition.successResult.trade.totalPnL) >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {parseFloat(closePosition.successResult.trade.totalPnL) >= 0 ? '+' : ''}
                      {parseFloat(closePosition.successResult.trade.totalPnL).toFixed(2)} USDT
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">ROI</p>
                    <p className={`font-medium ${parseFloat(closePosition.successResult.trade.roi) >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {parseFloat(closePosition.successResult.trade.roi) >= 0 ? '+' : ''}
                      {parseFloat(closePosition.successResult.trade.roi).toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">持倉時間</p>
                    <p className="font-medium text-foreground">
                      {formatDuration(closePosition.successResult.trade.holdingDuration)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => closePosition.reset()}
                  className="mt-3 text-xs text-profit hover:text-profit/80"
                >
                  關閉
                </button>
              </div>
            </div>
          </div>
        )}

        {closePosition.isPartial && closePosition.partialResult && (
          <div className="mb-6 p-4 bg-warning/10 border border-warning/30 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-warning mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-warning mb-1">部分平倉成功</p>
                <p className="text-sm text-warning mb-2">{closePosition.partialResult.message}</p>
                <div className="text-sm">
                  <p className="text-muted-foreground">
                    <span className="font-medium">已平倉：</span>
                    {closePosition.partialResult.closedSide.exchange} ({closePosition.partialResult.closedSide.side})
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium">失敗：</span>
                    {closePosition.partialResult.failedSide.exchange} ({closePosition.partialResult.failedSide.side}) - {closePosition.partialResult.failedSide.error}
                  </p>
                </div>
                <button
                  onClick={() => closePosition.reset()}
                  className="mt-3 text-xs text-warning hover:text-warning/80"
                >
                  關閉
                </button>
              </div>
            </div>
          </div>
        )}

        {closePosition.isError && closePosition.error && (
          <div className="mb-6 p-4 bg-loss/10 border border-loss/30 rounded-lg flex items-start gap-3">
            <XCircle className="w-5 h-5 text-loss mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-loss">平倉失敗</p>
              <p className="text-sm text-loss">{closePosition.error}</p>
              <button
                onClick={() => closePosition.reset()}
                className="mt-2 text-xs text-loss hover:text-loss/80"
              >
                關閉
              </button>
            </div>
          </div>
        )}

        {/* Feature 069: Open Position Groups */}
        {openGroups.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-5 h-5 text-profit" />
              <h2 className="text-lg font-semibold text-foreground">組合持倉</h2>
              <span className="bg-profit/10 text-profit px-2 py-0.5 rounded-full text-xs font-medium">
                {openGroups.length} 組
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {openGroups.map((group) => (
                <PositionGroupCard
                  key={group.groupId}
                  group={group}
                  onBatchClose={handleBatchClose}
                  isBatchClosing={batchClose.closingGroupId === group.groupId && batchClose.isClosing}
                  rateInfo={getRateForPosition(group.symbol, group.longExchange, group.shortExchange)}
                  isRatesConnected={isRatesConnected}
                  currentTime={currentTime}
                />
              ))}
            </div>
          </div>
        )}

        {/* Open Positions (ungrouped) */}
        {openPositions.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-lg font-semibold text-foreground">持倉中</h2>
              <span className="bg-profit/10 text-profit px-2 py-0.5 rounded-full text-xs font-medium">
                {openPositions.length}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {openPositions.map((position) => (
                <PositionCard
                  key={position.id}
                  position={position as any}
                  onClose={handleClosePosition}
                  isClosing={closePosition.closingPositionId === position.id && closePosition.isLoading}
                  onMarkAsClosed={handleMarkAsClosed}
                  isMarkingAsClosed={markingAsClosedId === position.id}
                  rateInfo={getRateForPosition(position.symbol, position.longExchange, position.shortExchange)}
                  isRatesConnected={isRatesConnected}
                  currentTime={currentTime}
                />
              ))}
            </div>
          </div>
        )}

        {/* Pending Positions */}
        {pendingPositions.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-lg font-semibold text-foreground">處理中</h2>
              <span className="bg-warning/10 text-warning px-2 py-0.5 rounded-full text-xs font-medium">
                {pendingPositions.length}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {pendingPositions.map((position) => (
                <PositionCard
                  key={position.id}
                  position={position as any}
                  rateInfo={getRateForPosition(position.symbol, position.longExchange, position.shortExchange)}
                  isRatesConnected={isRatesConnected}
                  currentTime={currentTime}
                />
              ))}
            </div>
          </div>
        )}

        {/* Failed Positions */}
        {failedPositions.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-lg font-semibold text-foreground">失敗</h2>
              <span className="bg-loss/10 text-loss px-2 py-0.5 rounded-full text-xs font-medium">
                {failedPositions.length}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {failedPositions.map((position) => (
                <PositionCard
                  key={position.id}
                  position={position as any}
                  onMarkAsClosed={handleMarkAsClosed}
                  isMarkingAsClosed={markingAsClosedId === position.id}
                  rateInfo={getRateForPosition(position.symbol, position.longExchange, position.shortExchange)}
                  isRatesConnected={isRatesConnected}
                  currentTime={currentTime}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {allPositions.length === 0 && !error && (
          <div className="text-center py-12 glass-card">
            <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-medium text-foreground mb-1">尚無持倉</h3>
            <p className="text-sm text-muted-foreground">
              前往市場監控頁面開始套利交易
            </p>
          </div>
        )}
      </div>

      {/* Close Position Dialog */}
      {closingPosition && (closePosition.state === 'loading_market_data' || closePosition.state === 'confirming') && (
        <ClosePositionDialog
          position={closingPosition as any}
          marketData={closePosition.marketData}
          isLoading={closePosition.state === 'loading_market_data'}
          isClosing={false}
          onConfirm={handleConfirmClose}
          onCancel={handleCancelClose}
        />
      )}

      {/* Close Progress Overlay */}
      {closingPosition && closePosition.state === 'closing' && closePosition.progress && (
        <CloseProgressOverlay
          positionId={closingPosition.id}
          symbol={closingPosition.symbol}
          step={closePosition.progress.step}
          progress={closePosition.progress.progress}
          message={closePosition.progress.message}
          exchange={closePosition.progress.exchange}
        />
      )}

      {/* Feature 069: Batch Close Dialog */}
      {(() => {
        // 從所有 groups 中查找（包括已關閉的），避免平倉後找不到 group
        const closingGroup = groups.find((g) => g.groupId === batchClose.closingGroupId);
        if (!batchClose.closingGroupId || batchClose.isIdle || !closingGroup) {
          return null;
        }
        return (
          <BatchCloseDialog
            group={closingGroup}
            isConfirming={batchClose.isConfirming}
            isClosing={batchClose.isClosing}
            isSuccess={batchClose.isSuccess}
            isPartial={batchClose.isPartial}
            isError={batchClose.isError}
            progress={batchClose.progress}
            result={batchClose.result}
            error={batchClose.error}
            onConfirm={handleConfirmBatchClose}
            onCancel={handleCancelBatchClose}
            onReset={handleResetBatchClose}
          />
        );
      })()}
    </>
  );
}
