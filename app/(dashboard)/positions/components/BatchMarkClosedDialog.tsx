/**
 * BatchMarkClosedDialog - 批量標記已平倉確認對話框
 *
 * 簡化版的 BatchCloseDialog，無進度條
 * 僅更新系統紀錄，不會在交易所執行平倉操作
 */

'use client';

import { X, Loader2, AlertTriangle, CheckCircle, XCircle, Layers } from 'lucide-react';
import type { PositionGroup } from '@/hooks/queries/usePositionsQuery';

interface BatchMarkClosedDialogProps {
  group: PositionGroup;
  isConfirming: boolean;
  isProcessing: boolean;
  isSuccess: boolean;
  isError: boolean;
  totalUpdated: number | null;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  onReset: () => void;
}

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

export function BatchMarkClosedDialog({
  group,
  isConfirming,
  isProcessing,
  isSuccess,
  isError,
  totalUpdated,
  error,
  onConfirm,
  onCancel,
  onReset,
}: BatchMarkClosedDialogProps) {
  const { positions } = group;
  const positionCount = positions.length;

  const canClose = !isProcessing;

  const getTitle = () => {
    if (isSuccess) return '標記完成';
    if (isError) return '標記失敗';
    if (isProcessing) return '正在處理...';
    return '標記已平倉確認';
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
                  <span className="font-medium">{group.aggregate.totalQuantity}</span>
                </div>
              </div>

              {/* 警告 */}
              <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <p className="text-sm text-warning">
                  此操作僅更新系統紀錄，不會在交易所執行平倉操作。請確認您已在交易所手動平倉完成。
                </p>
              </div>
            </div>
          )}

          {/* 處理中 */}
          {isProcessing && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
              <p className="text-sm text-muted-foreground">正在標記持倉為已平倉...</p>
            </div>
          )}

          {/* 成功 */}
          {isSuccess && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center py-4">
                <CheckCircle className="w-12 h-12 text-profit mb-4" />
                <p className="text-lg font-medium text-foreground">標記完成</p>
              </div>
              <div className="bg-profit/10 rounded-lg p-4 border border-profit/30">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">已標記持倉:</span>
                  <span className="font-medium text-profit">
                    {totalUpdated} 個持倉
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 錯誤 */}
          {isError && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center py-4">
                <XCircle className="w-12 h-12 text-loss mb-4" />
                <p className="text-lg font-medium text-foreground">標記失敗</p>
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
                className="px-4 py-2 text-sm font-medium text-muted-foreground bg-muted border border-border rounded-md hover:bg-muted/80 flex items-center gap-2"
              >
                確認標記已平倉
              </button>
            </>
          )}

          {isProcessing && (
            <button
              disabled
              className="px-4 py-2 text-sm font-medium text-foreground bg-muted border border-border rounded-md opacity-50 cursor-not-allowed flex items-center gap-2"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              處理中...
            </button>
          )}

          {(isSuccess || isError) && (
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

export default BatchMarkClosedDialog;
