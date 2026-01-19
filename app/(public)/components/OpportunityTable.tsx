'use client';

import { useState } from 'react';
import type { PublicOpportunityDTO } from '@/src/types/public-opportunity';
import { formatDuration } from '@/lib/format-duration';
import { OpportunityDetailDialog } from './OpportunityDetailDialog';

interface OpportunityTableProps {
  data: PublicOpportunityDTO[];
}

/**
 * 套利機會表格元件
 *
 * 以表格形式顯示套利機會列表，並提供詳細資訊按鈕
 *
 * 欄位：
 * - 發生時間
 * - 交易對
 * - 多方交易所（綠色 Badge）
 * - 空方交易所（紅色 Badge）
 * - 年化報酬率（醒目顯示）
 * - 持續時間
 * - 詳細資訊按鈕
 */
export function OpportunityTable({ data }: OpportunityTableProps) {
  const [selectedOpportunity, setSelectedOpportunity] = useState<PublicOpportunityDTO | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showApyTooltip, setShowApyTooltip] = useState(false);
  const [showDurationTooltip, setShowDurationTooltip] = useState(false);

  // 格式化 APY（2 位小數）
  const formatAPY = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  // 格式化時間
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 打開詳細資訊 Dialog
  const handleViewDetails = (opportunity: PublicOpportunityDTO) => {
    setSelectedOpportunity(opportunity);
    setIsDialogOpen(true);
  };

  // 關閉 Dialog
  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    // 延遲清空選中項，避免關閉動畫時內容消失
    setTimeout(() => setSelectedOpportunity(null), 300);
  };

  return (
    <>
      {/* 桌面版表格 */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">發生時間</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">交易對</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">多方交易所</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">空方交易所</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-foreground relative">
                <button
                  type="button"
                  onClick={() => setShowApyTooltip(!showApyTooltip)}
                  className="inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                >
                  年化報酬率
                  <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
                {showApyTooltip && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowApyTooltip(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 z-50 w-72 p-3 bg-popover border border-border rounded-lg shadow-lg text-left">
                      <p className="text-sm text-foreground leading-relaxed">
                        這是理論年化收益，假設該費率差能維持一整年。實際顯示的是機會結束時點的年化報酬率。
                      </p>
                    </div>
                  </>
                )}
              </th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-foreground relative">
                <button
                  type="button"
                  onClick={() => setShowDurationTooltip(!showDurationTooltip)}
                  className="inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                >
                  持續時間
                  <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
                {showDurationTooltip && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowDurationTooltip(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 z-50 w-72 p-3 bg-popover border border-border rounded-lg shadow-lg text-left">
                      <p className="text-sm text-foreground leading-relaxed">
                        從機會被偵測到至機會結束之間的時間長度。
                      </p>
                    </div>
                  </>
                )}
              </th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((opportunity) => (
              <tr
                key={opportunity.id}
                className="hover:bg-muted/30 transition-colors"
              >
                {/* 發生時間 */}
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {formatDate(opportunity.appearedAt)}
                </td>

                {/* 交易對 */}
                <td className="px-4 py-3 text-sm font-medium text-foreground">
                  {opportunity.symbol}
                </td>

                {/* 多方交易所 */}
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs font-medium">
                    {opportunity.longExchange}
                  </span>
                </td>

                {/* 空方交易所 */}
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 text-xs font-medium">
                    {opportunity.shortExchange}
                  </span>
                </td>

                {/* 年化報酬率 */}
                <td className="px-4 py-3 text-right">
                  <span className="text-lg font-bold text-primary">
                    {formatAPY(opportunity.realizedAPY)}
                  </span>
                </td>

                {/* 持續時間 */}
                <td className="px-4 py-3 text-right text-sm text-foreground">
                  {formatDuration(opportunity.durationMs)}
                </td>

                {/* 操作按鈕 */}
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleViewDetails(opportunity)}
                    className="px-3 py-1.5 text-xs font-medium text-primary hover:text-primary/80 hover:bg-primary/10 rounded-md transition-colors"
                  >
                    詳細資訊
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 手機版表格（橫向滾動） */}
      <div className="md:hidden overflow-x-auto">
        <table className="w-full border-collapse min-w-[640px]">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-foreground">時間</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-foreground">交易對</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-foreground">多方</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-foreground">空方</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-foreground relative">
                <button
                  type="button"
                  onClick={() => setShowApyTooltip(!showApyTooltip)}
                  className="inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                >
                  APY
                  <svg className="w-3 h-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
                {showApyTooltip && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowApyTooltip(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 z-50 w-64 p-3 bg-popover border border-border rounded-lg shadow-lg text-left">
                      <p className="text-xs text-foreground leading-relaxed">
                        這是理論年化收益，假設該費率差能維持一整年。實際顯示的是機會結束時點的年化報酬率。
                      </p>
                    </div>
                  </>
                )}
              </th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-foreground">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((opportunity) => (
              <tr
                key={opportunity.id}
                className="hover:bg-muted/30 transition-colors"
              >
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {formatDate(opportunity.appearedAt)}
                </td>
                <td className="px-3 py-2 text-xs font-medium text-foreground">
                  {opportunity.symbol}
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs">
                    {opportunity.longExchange}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 text-xs">
                    {opportunity.shortExchange}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <span className="text-sm font-bold text-primary">
                    {formatAPY(opportunity.realizedAPY)}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => handleViewDetails(opportunity)}
                    className="px-2 py-1 text-xs font-medium text-primary hover:text-primary/80 hover:bg-primary/10 rounded transition-colors"
                  >
                    詳情
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 詳細資訊 Dialog */}
      <OpportunityDetailDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        opportunity={selectedOpportunity}
      />
    </>
  );
}
