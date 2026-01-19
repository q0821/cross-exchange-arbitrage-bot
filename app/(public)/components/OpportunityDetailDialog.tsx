'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { PublicOpportunityDTO } from '@/src/types/public-opportunity';
import { formatDuration } from '@/lib/format-duration';

interface OpportunityDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  opportunity: PublicOpportunityDTO | null;
}

/**
 * 套利機會詳細資訊 Dialog
 *
 * 顯示完整的套利機會詳細資訊，包含：
 * - 基本資訊：交易對、交易所
 * - 費差資訊：最大費差、最終費差
 * - 時間資訊：發現時間、消失時間、持續時間
 * - 收益資訊：年化報酬率
 */
export function OpportunityDetailDialog({
  isOpen,
  onClose,
  opportunity,
}: OpportunityDetailDialogProps) {
  if (!opportunity) return null;

  // 格式化時間
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // 格式化百分比（4 位小數）
  const formatSpread = (value: number) => {
    return `${(value * 100).toFixed(4)}%`;
  };

  // 格式化 APY（2 位小數）
  const formatAPY = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in" />

        {/* Content */}
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-card border border-border rounded-lg shadow-lg animate-in fade-in zoom-in-95">
          {/* Header */}
          <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
            <Dialog.Title className="text-xl font-semibold text-foreground">
              套利機會詳細資訊
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="rounded-full p-1.5 hover:bg-muted transition-colors"
                aria-label="關閉"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="px-6 py-6 space-y-6">
            {/* 基本資訊 */}
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">基本資訊</h3>
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <span className="text-sm text-muted-foreground">狀態</span>
                  {opportunity.status === 'ACTIVE' ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 text-sm font-medium animate-pulse">
                      進行中
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 text-sm font-medium">
                      已結束
                    </span>
                  )}
                </div>
                <div className="flex items-start justify-between">
                  <span className="text-sm text-muted-foreground">交易對</span>
                  <span className="text-base font-semibold text-foreground">{opportunity.symbol}</span>
                </div>
                <div className="flex items-start justify-between">
                  <span className="text-sm text-muted-foreground">多方交易所</span>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-sm font-medium">
                    {opportunity.longExchange}
                  </span>
                </div>
                <div className="flex items-start justify-between">
                  <span className="text-sm text-muted-foreground">空方交易所</span>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 text-sm font-medium">
                    {opportunity.shortExchange}
                  </span>
                </div>
              </div>
            </section>

            {/* 費差資訊 */}
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">費差資訊</h3>
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <span className="text-sm text-muted-foreground">最大費差</span>
                  <span className="text-base font-semibold text-foreground">{formatSpread(opportunity.maxSpread)}</span>
                </div>
                <div className="flex items-start justify-between">
                  <span className="text-sm text-muted-foreground">
                    {opportunity.status === 'ACTIVE' ? '當前費差' : '結束費差'}
                  </span>
                  <span className="text-base font-semibold text-foreground">{formatSpread(opportunity.currentSpread)}</span>
                </div>
              </div>
            </section>

            {/* 收益資訊 */}
            <section className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                {opportunity.status === 'ACTIVE' ? '當前年化報酬率' : '結束時年化報酬率'}
              </h3>
              <div className="text-3xl font-bold text-primary">{formatAPY(opportunity.currentAPY)}</div>
            </section>

            {/* 時間資訊 */}
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">時間資訊</h3>
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <span className="text-sm text-muted-foreground">發現時間</span>
                  <span className="text-sm text-foreground">{formatDate(opportunity.appearedAt)}</span>
                </div>
                {opportunity.status === 'ENDED' && opportunity.disappearedAt && (
                  <div className="flex items-start justify-between">
                    <span className="text-sm text-muted-foreground">結束時間</span>
                    <span className="text-sm text-foreground">{formatDate(opportunity.disappearedAt)}</span>
                  </div>
                )}
                <div className="flex items-start justify-between">
                  <span className="text-sm text-muted-foreground">持續時間</span>
                  <span className="text-base font-semibold text-foreground">
                    {opportunity.durationMs !== null ? formatDuration(opportunity.durationMs) : '進行中'}
                  </span>
                </div>
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-card border-t border-border px-6 py-4 flex justify-end">
            <Dialog.Close asChild>
              <button className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium">
                關閉
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
