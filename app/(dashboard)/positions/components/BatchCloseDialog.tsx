/**
 * BatchCloseDialog - 批量平倉確認對話框
 *
 * 顯示批量平倉確認、進度和結果
 * Feature: 069-position-group-close (T026)
 */

'use client';

import { X, Loader2, AlertTriangle, CheckCircle, XCircle, Layers } from 'lucide-react';
import type { PositionGroup } from '@/hooks/queries/usePositionsQuery';
import type { BatchCloseProgress, BatchCloseResult } from '../hooks/useBatchClose';

interface BatchCloseDialogProps {
  group: PositionGroup;
  isConfirming: boolean;
  isClosing: boolean;
  isSuccess: boolean;
  isPartial: boolean;
  isError: boolean;
  progress: BatchCloseProgress | null;
  result: BatchCloseResult | null;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  onReset: () => void;
}

/**
 * 格式化交易所名稱
 */
function formatExchange(exchange: string): string {
  const exchangeMap: Record<string, string> = {
    binance: 'Binance',
    okx: 'OKX',
    gateio: 'Gate.io',
    mexc: 'MEXC',
    bingx: 'BingX',
  };
  return exchangeMap[exchange] || exchange;
}

export function BatchCloseDialog({
  group,
  isConfirming,
  isClosing,
  isSuccess,
  isPartial,
  isError,
  progress,
  result,
  error,
  onConfirm,
  onCancel,
  onReset,
}: BatchCloseDialogProps) {
  const { aggregate, positions } = group;
  const positionCount = positions.length;

  // 判斷是否可以關閉對話框
  const canClose = !isClosing;

  // 判斷對話框標題
  const getTitle = () => {
    if (isSuccess) return '批量平倉完成';
    if (isPartial) return '批量平倉部分完成';
    if (isError) return '批量平倉失敗';
    if (isClosing) return '正在批量平倉...';
    return '批量平倉確認';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={canClose ? onCancel : undefined}
      />

      {/* Dialog */}
      <div className="relative bg-card rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{getTitle()}</h2>
          {canClose && (
            <button
              onClick={onCancel}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {/* 確認階段 */}
          {isConfirming && (
            <div className="space-y-4">
              {/* 組資訊 */}
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 text-xl font-bold text-foreground">
                  <Layers className="w-6 h-6" />
                  {group.symbol}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {formatExchange(group.longExchange)} / {formatExchange(group.shortExchange)}
                </p>
              </div>

              {/* 組統計 */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">持倉數量:</span>
                  <span className="font-medium">{positionCount} 組</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">總數量:</span>
                  <span className="font-medium">{aggregate.totalQuantity}</span>
                </div>
                {aggregate.totalFundingPnL && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">資金費率收益:</span>
                    <span
                      className={`font-medium ${
                        parseFloat(aggregate.totalFundingPnL) >= 0
                          ? 'text-profit'
                          : 'text-loss'
                      }`}
                    >
                      {parseFloat(aggregate.totalFundingPnL) >= 0 ? '+' : ''}
                      ${aggregate.totalFundingPnL}
                    </span>
                  </div>
                )}
              </div>

              {/* 警告 */}
              <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <p className="text-sm text-warning">
                  此操作將平倉組內所有 {positionCount} 個持倉。平倉使用市價單執行，確認後操作無法取消。
                </p>
              </div>
            </div>
          )}

          {/* 平倉進行中 */}
          {isClosing && progress && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center py-4">
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <p className="text-sm text-muted-foreground">{progress.message}</p>
              </div>

              {/* 進度條 */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">進度</span>
                  <span className="font-medium">
                    {progress.current} / {progress.total}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progress.progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 成功結果 */}
          {isSuccess && result && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center py-4">
                <CheckCircle className="w-12 h-12 text-profit mb-4" />
                <p className="text-lg font-medium text-foreground">批量平倉完成</p>
              </div>

              <div className="bg-profit/10 rounded-lg p-4 space-y-2 border border-profit/30">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">成功平倉:</span>
                  <span className="font-medium text-profit">
                    {result.closedPositions} 個持倉
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 部分成功結果 */}
          {isPartial && result && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center py-4">
                <AlertTriangle className="w-12 h-12 text-warning mb-4" />
                <p className="text-lg font-medium text-foreground">部分平倉成功</p>
              </div>

              <div className="space-y-3">
                <div className="bg-profit/10 rounded-lg p-3 border border-profit/30">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-profit" />
                    <span className="text-profit font-medium">
                      成功: {result.closedPositions} 個
                    </span>
                  </div>
                </div>

                <div className="bg-loss/10 rounded-lg p-3 border border-loss/30">
                  <div className="flex items-center gap-2 text-sm mb-2">
                    <XCircle className="w-4 h-4 text-loss" />
                    <span className="text-loss font-medium">
                      失敗: {result.failedPositions} 個
                    </span>
                  </div>
                  <div className="max-h-24 overflow-y-auto">
                    {result.results
                      .filter((r) => !r.success)
                      .map((r) => (
                        <div
                          key={r.positionId}
                          className="text-xs text-muted-foreground truncate"
                        >
                          {r.positionId.slice(0, 12)}...: {r.error}
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <p className="text-sm text-warning">
                  部分持倉平倉失敗，請手動處理失敗的持倉。
                </p>
              </div>
            </div>
          )}

          {/* 錯誤結果 */}
          {isError && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center py-4">
                <XCircle className="w-12 h-12 text-loss mb-4" />
                <p className="text-lg font-medium text-foreground">批量平倉失敗</p>
              </div>

              <div className="bg-loss/10 rounded-lg p-4 border border-loss/30">
                <p className="text-sm text-loss">{error || '發生未知錯誤'}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted">
          {isConfirming && (
            <>
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-md hover:bg-muted"
              >
                取消
              </button>
              <button
                onClick={onConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-loss rounded-md hover:bg-loss/90 flex items-center gap-2"
              >
                確認全部平倉
              </button>
            </>
          )}

          {isClosing && (
            <button
              disabled
              className="px-4 py-2 text-sm font-medium text-foreground bg-muted border border-border rounded-md opacity-50 cursor-not-allowed flex items-center gap-2"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              處理中...
            </button>
          )}

          {(isSuccess || isPartial || isError) && (
            <button
              onClick={onReset}
              className="px-4 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-md hover:bg-muted"
            >
              關閉
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default BatchCloseDialog;
