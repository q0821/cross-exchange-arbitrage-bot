/**
 * TrackingHistoryTable - 追蹤歷史表格組件
 * 顯示已停止和過期的追蹤記錄
 *
 * Feature 029: Simulated APY Tracking (T022)
 */

'use client';

import Link from 'next/link';
import { Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';

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
  // 關倉價格
  exitLongPrice: number | null;
  exitShortPrice: number | null;
  // 損益明細
  fundingPnl: number | null;
  pricePnl: number | null;
  tradingCost: number | null;
  status: string;
  startedAt: string;
  stoppedAt: string | null;
  totalFundingProfit: number;
  totalSettlements: number;
  durationFormatted?: string;
}

interface TrackingHistoryTableProps {
  trackings: TrackingData[];
  onDelete?: (id: string) => void;
  isDeleteLoading?: boolean;
  deletingId?: string | null;
}

export function TrackingHistoryTable({
  trackings,
  onDelete,
  isDeleteLoading,
  deletingId,
}: TrackingHistoryTableProps) {
  if (trackings.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-muted-foreground">尚無歷史追蹤記錄</p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                交易對
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                方向
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                倉位/均價
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                預估收益
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                結算次數
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                狀態
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                開/關倉時間
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {trackings.map((tracking) => {
              const profitPercentage =
                (tracking.totalFundingProfit / tracking.simulatedCapital) * 100;
              const isPositive = tracking.totalFundingProfit >= 0;
              const coinSymbol = tracking.symbol.replace('USDT', '');

              return (
                <tr
                  key={tracking.id}
                  className="hover:bg-muted/50 transition-colors"
                >
                  {/* Symbol */}
                  <td className="px-4 py-3">
                    <Link
                      href={`/simulated-tracking/${tracking.id}`}
                      className="font-medium text-primary hover:text-primary/80 hover:underline"
                    >
                      {tracking.symbol}
                    </Link>
                  </td>

                  {/* Direction */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-xs">
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-profit/10 text-profit rounded">
                        <TrendingUp className="w-3 h-3" />
                        <span className="capitalize">{tracking.longExchange}</span>
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-loss/10 text-loss rounded">
                        <TrendingDown className="w-3 h-3" />
                        <span className="capitalize">{tracking.shortExchange}</span>
                      </span>
                    </div>
                  </td>

                  {/* Position / Entry Prices */}
                  <td className="px-4 py-3 text-right">
                    {tracking.positionQuantity ? (
                      <div>
                        <div className="font-mono text-sm">
                          {tracking.positionQuantity.toFixed(4)}{' '}
                          <span className="text-xs text-muted-foreground">{coinSymbol}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {tracking.initialLongPrice ? `$${tracking.initialLongPrice.toFixed(6)}` : 'N/A'}
                          {' / '}
                          {tracking.initialShortPrice ? `$${tracking.initialShortPrice.toFixed(6)}` : 'N/A'}
                        </div>
                      </div>
                    ) : (
                      <span className="font-mono text-sm">
                        ${tracking.simulatedCapital.toLocaleString()}
                      </span>
                    )}
                  </td>

                  {/* Profit with Tooltip */}
                  <td className="px-4 py-3 text-right">
                    <Tooltip.Provider delayDuration={300}>
                      <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                          <span className="cursor-help inline-block">
                            <span
                              className={`font-mono text-sm ${
                                isPositive ? 'text-profit' : 'text-loss'
                              }`}
                            >
                              {isPositive ? '+' : ''}
                              {tracking.totalFundingProfit.toFixed(2)}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">
                              ({isPositive ? '+' : ''}
                              {profitPercentage.toFixed(2)}%)
                            </span>
                          </span>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                          <Tooltip.Content
                            className="z-50 bg-popover text-popover-foreground text-xs rounded-lg px-3 py-2 shadow-lg border border-border"
                            sideOffset={5}
                          >
                            <div className="space-y-1.5 min-w-[180px]">
                              <div className="font-medium text-muted-foreground border-b border-border pb-1 mb-1">
                                收益明細
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">開倉價格：</span>
                                <span>
                                  ${tracking.initialLongPrice?.toFixed(6) ?? 'N/A'} / ${tracking.initialShortPrice?.toFixed(6) ?? 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">關倉價格：</span>
                                <span>
                                  ${tracking.exitLongPrice?.toFixed(6) ?? 'N/A'} / ${tracking.exitShortPrice?.toFixed(6) ?? 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">結算次數：</span>
                                <span>{tracking.totalSettlements} 次</span>
                              </div>
                              <div className="flex justify-between border-t border-border pt-1 mt-1">
                                <span className="text-muted-foreground">資費收益：</span>
                                <span className={tracking.fundingPnl != null && tracking.fundingPnl >= 0 ? 'text-profit' : 'text-loss'}>
                                  {tracking.fundingPnl != null
                                    ? `${tracking.fundingPnl >= 0 ? '+' : ''}$${tracking.fundingPnl.toFixed(2)}`
                                    : 'N/A'}
                                </span>
                              </div>
                              {tracking.pricePnl != null && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">幣價損益：</span>
                                  <span className={tracking.pricePnl >= 0 ? 'text-profit' : 'text-loss'}>
                                    {tracking.pricePnl >= 0 ? '+' : ''}${tracking.pricePnl.toFixed(2)}
                                  </span>
                                </div>
                              )}
                              {tracking.tradingCost != null && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">交易成本：</span>
                                  <span className="text-warning">
                                    -${tracking.tradingCost.toFixed(2)}
                                  </span>
                                </div>
                              )}
                            </div>
                            <Tooltip.Arrow className="fill-popover" />
                          </Tooltip.Content>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                    </Tooltip.Provider>
                  </td>

                  {/* Settlements */}
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    {tracking.totalSettlements}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                        tracking.status === 'STOPPED'
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-warning/10 text-warning'
                      }`}
                    >
                      {tracking.status === 'STOPPED' ? '已停止' : '已過期'}
                    </span>
                  </td>

                  {/* Open/Close Time */}
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    <div className="space-y-0.5">
                      <div className="text-xs">
                        <span className="text-muted-foreground">開: </span>
                        {new Date(tracking.startedAt).toLocaleString('zh-TW', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })}
                      </div>
                      <div className="text-xs">
                        <span className="text-muted-foreground">關: </span>
                        {tracking.stoppedAt
                          ? new Date(tracking.stoppedAt).toLocaleString('zh-TW', {
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false,
                            })
                          : '-'}
                      </div>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    {onDelete && (
                      <button
                        onClick={() => onDelete(tracking.id)}
                        disabled={isDeleteLoading && deletingId === tracking.id}
                        className="p-1.5 text-muted-foreground hover:text-loss hover:bg-loss/10 rounded-md transition-colors disabled:opacity-50"
                        title="刪除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
