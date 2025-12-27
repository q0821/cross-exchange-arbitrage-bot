/**
 * Positions Page - 持倉列表頁面
 * 顯示用戶當前的所有持倉
 *
 * Feature 033: Manual Open Position (T018)
 * Feature 035: Close Position (T011)
 * Feature 037: Mark Position Closed (T006)
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Briefcase, RefreshCw, AlertCircle, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { PositionCard } from './components/PositionCard';
import { ClosePositionDialog } from './components/ClosePositionDialog';
import { CloseProgressOverlay } from './components/CloseProgressOverlay';
import { useClosePosition } from './hooks/useClosePosition';
import type { PositionInfo } from '@/src/types/trading';

interface PositionsResponse {
  success: boolean;
  data: {
    positions: PositionInfo[];
    total: number;
  };
}

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
  const [positions, setPositions] = useState<PositionInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [markingAsClosedId, setMarkingAsClosedId] = useState<string | null>(null);

  // 平倉功能
  const closePosition = useClosePosition();

  const fetchPositions = useCallback(async () => {
    try {
      const response = await fetch('/api/positions');
      const data: PositionsResponse = await response.json();

      if (data.success) {
        setPositions(data.data.positions);
        setTotal(data.data.total);
        setError(null);
      } else {
        setError('無法載入持倉列表');
      }
    } catch (err) {
      console.error('Failed to fetch positions:', err);
      setError('載入持倉列表時發生錯誤');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchPositions();
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
      // 平倉成功，刷新列表
      await fetchPositions();
    }
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
    try {
      const response = await fetch(`/api/positions/${positionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'markAsClosed' }),
      });

      const data = await response.json();

      if (data.success) {
        // 成功，刷新列表
        await fetchPositions();
      } else {
        // 顯示錯誤
        setError(data.error?.message || '標記失敗');
      }
    } catch (err) {
      console.error('Failed to mark position as closed:', err);
      setError('標記持倉時發生錯誤');
    } finally {
      setMarkingAsClosedId(null);
    }
  };

  // 找到正在平倉的持倉
  const closingPosition = positions.find((p) => p.id === closePosition.closingPositionId);

  // 分類持倉
  const openPositions = positions.filter(
    (p) => p.status === 'OPEN' || p.status === 'OPENING'
  );
  const pendingPositions = positions.filter(
    (p) => p.status === 'PENDING'
  );
  const partialPositions = positions.filter(
    (p) => p.status === 'PARTIAL'
  );
  const failedPositions = positions.filter(
    (p) => p.status === 'FAILED'
  );

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <span className="ml-2 text-muted-foreground">載入中...</span>
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
                  position={position}
                  onMarkAsClosed={handleMarkAsClosed}
                  isMarkingAsClosed={markingAsClosedId === position.id}
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

        {/* Open Positions */}
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
                  position={position}
                  onClose={handleClosePosition}
                  isClosing={closePosition.closingPositionId === position.id && closePosition.isLoading}
                  onMarkAsClosed={handleMarkAsClosed}
                  isMarkingAsClosed={markingAsClosedId === position.id}
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
                <PositionCard key={position.id} position={position} />
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
                  position={position}
                  onMarkAsClosed={handleMarkAsClosed}
                  isMarkingAsClosed={markingAsClosedId === position.id}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {positions.length === 0 && !error && (
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
          position={closingPosition}
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
    </>
  );
}
