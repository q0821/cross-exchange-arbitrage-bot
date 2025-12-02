/**
 * TrackingHistoryTable - 追蹤歷史表格組件
 * 顯示已停止和過期的追蹤記錄
 *
 * Feature 029: Simulated APY Tracking (T022)
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { Trash2, TrendingUp, TrendingDown } from 'lucide-react';

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
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-500">尚無歷史追蹤記錄</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                交易對
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                方向
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                倉位/均價
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                累計收益
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                結算次數
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                狀態
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                開/關倉時間
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {trackings.map((tracking) => {
              const profitPercentage =
                (tracking.totalFundingProfit / tracking.simulatedCapital) * 100;
              const isPositive = tracking.totalFundingProfit >= 0;
              const coinSymbol = tracking.symbol.replace('USDT', '');

              return (
                <tr
                  key={tracking.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  {/* Symbol */}
                  <td className="px-4 py-3">
                    <Link
                      href={`/simulated-tracking/${tracking.id}`}
                      className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {tracking.symbol}
                    </Link>
                  </td>

                  {/* Direction */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-xs">
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-50 text-green-700 rounded">
                        <TrendingUp className="w-3 h-3" />
                        <span className="capitalize">{tracking.longExchange}</span>
                      </span>
                      <span className="text-gray-400">→</span>
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-50 text-red-700 rounded">
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
                          <span className="text-xs text-gray-500">{coinSymbol}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {tracking.initialLongPrice ? `$${tracking.initialLongPrice.toFixed(4)}` : 'N/A'}
                          {' / '}
                          {tracking.initialShortPrice ? `$${tracking.initialShortPrice.toFixed(4)}` : 'N/A'}
                        </div>
                      </div>
                    ) : (
                      <span className="font-mono text-sm">
                        ${tracking.simulatedCapital.toLocaleString()}
                      </span>
                    )}
                  </td>

                  {/* Profit */}
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`font-mono text-sm ${
                        isPositive ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {tracking.totalFundingProfit.toFixed(2)}
                    </span>
                    <span className="text-xs text-gray-500 ml-1">
                      ({isPositive ? '+' : ''}
                      {profitPercentage.toFixed(2)}%)
                    </span>
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
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}
                    >
                      {tracking.status === 'STOPPED' ? '已停止' : '已過期'}
                    </span>
                  </td>

                  {/* Open/Close Time */}
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <div className="space-y-0.5">
                      <div className="text-xs">
                        <span className="text-gray-400">開: </span>
                        {new Date(tracking.startedAt).toLocaleString('zh-TW', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })}
                      </div>
                      <div className="text-xs">
                        <span className="text-gray-400">關: </span>
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
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
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
