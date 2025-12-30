/**
 * ConditionalOrderWarning - 條件單警告元件
 *
 * 顯示條件單設定部分成功或失敗的警告訊息
 * Feature: 038-specify-scripts-bash (T038)
 */

'use client';

import { AlertTriangle, Shield, Target, X } from 'lucide-react';
import type { ConditionalOrderStatus } from '@/src/types/trading';

interface ConditionalOrderWarningProps {
  /** 條件單狀態 */
  status: ConditionalOrderStatus;
  /** 錯誤訊息 */
  errorMessage?: string | null;
  /** 持倉 ID */
  positionId?: string;
  /** 交易對 */
  symbol?: string;
  /** 關閉回調 */
  onDismiss?: () => void;
  /** 是否可關閉 */
  dismissible?: boolean;
}

/**
 * 條件單警告元件
 *
 * 顯示情境：
 * - PARTIAL: 部分條件單設定成功
 * - FAILED: 條件單設定完全失敗
 */
export function ConditionalOrderWarning({
  status,
  errorMessage,
  positionId,
  symbol,
  onDismiss,
  dismissible = true,
}: ConditionalOrderWarningProps) {
  // 只在 PARTIAL 或 FAILED 狀態顯示
  if (status !== 'PARTIAL' && status !== 'FAILED') {
    return null;
  }

  const isPartial = status === 'PARTIAL';

  return (
    <div
      className={`rounded-lg p-4 border ${
        isPartial
          ? 'bg-warning/10 border-warning/30'
          : 'bg-loss/10 border-loss/30'
      }`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className={`w-5 h-5 shrink-0 ${
            isPartial ? 'text-warning' : 'text-loss'
          }`}
        />

        <div className="flex-1">
          <h4
            className={`font-medium ${
              isPartial ? 'text-warning' : 'text-loss'
            }`}
          >
            {isPartial ? '條件單部分設定成功' : '條件單設定失敗'}
          </h4>

          <p
            className={`mt-1 text-sm ${
              isPartial ? 'text-warning' : 'text-loss'
            }`}
          >
            {isPartial
              ? '部分停損或停利條件單未能成功設定，請手動確認交易所設定。'
              : '停損停利條件單設定失敗，倉位已開啟但無自動風險保護。'}
          </p>

          {errorMessage && (
            <div
              className={`mt-2 p-2 rounded text-xs ${
                isPartial
                  ? 'bg-warning/10 text-warning'
                  : 'bg-loss/10 text-loss'
              }`}
            >
              <span className="font-medium">錯誤詳情：</span>
              {errorMessage}
            </div>
          )}

          {(positionId || symbol) && (
            <div className="mt-2 text-xs text-muted-foreground">
              {symbol && <span className="mr-2">交易對: {symbol}</span>}
              {positionId && <span>持倉 ID: {positionId.slice(0, 8)}...</span>}
            </div>
          )}

          {/* 建議操作 */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`font-medium ${
                isPartial ? 'text-warning' : 'text-loss'
              }`}
            >
              建議操作：
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Shield className="w-3 h-3" />
              前往交易所手動設定停損
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Target className="w-3 h-3" />
              或密切關注倉位風險
            </span>
          </div>
        </div>

        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className={`p-1 rounded hover:bg-white/50 transition-colors ${
              isPartial ? 'text-warning' : 'text-loss'
            }`}
            aria-label="關閉警告"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
