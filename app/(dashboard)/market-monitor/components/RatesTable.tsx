/**
 * RatesTable - 費率表格組件
 * 顯示多個交易對的即時費率資訊
 *
 * Feature: 006-web-trading-platform (User Story 2.5)
 * Feature: 009-specify-scripts-bash (穩定排序改進)
 */

'use client';

import React, { useMemo } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { RateRow } from './RateRow';
import { OpportunityStatus } from './StatusBadge';
import { stableSortComparator } from '../utils/sortComparator';
import type { SortField, SortDirection, MarketRate, TimeBasis } from '../types';

interface RatesTableProps {
  ratesMap: Map<string, MarketRate>;
  timeBasis: TimeBasis; // Feature 012: 用戶選擇的時間基準
  sortBy?: SortField;
  sortDirection?: SortDirection;
  filterStatus?: OpportunityStatus | 'all';
  onSort?: (field: SortField) => void;
  onSymbolClick?: (symbol: string) => void;
  onQuickOpen?: (rate: MarketRate) => void;
  // Feature 029: 追蹤功能
  isTrackingFn?: (symbol: string, longExchange: string, shortExchange: string) => boolean;
  isTrackingLoading?: boolean;
  onTrackClick?: (rate: MarketRate) => void;
}

/**
 * RatesTable 組件
 * 支援排序、篩選和點擊事件
 * 實作快照排序 (Snapshot Sorting) 模式：
 * - sortedSymbols 只依賴 sortBy 和 sortDirection
 * - WebSocket 更新不觸發重新排序
 * - 顯示時從 ratesMap 提取最新值
 */
export function RatesTable({
  ratesMap,
  timeBasis,
  sortBy = 'symbol',
  sortDirection = 'asc',
  filterStatus = 'all',
  onSort,
  onSymbolClick,
  onQuickOpen,
  // Feature 029: 追蹤功能
  isTrackingFn,
  isTrackingLoading,
  onTrackClick,
}: RatesTableProps) {
  // 快照排序：只在排序條件改變時重新計算順序
  const sortedSymbols = useMemo(() => {
    const symbols = Array.from(ratesMap.keys());

    // 篩選
    const filtered =
      filterStatus === 'all'
        ? symbols
        : symbols.filter((symbol) => {
            const rate = ratesMap.get(symbol);
            return rate?.status === filterStatus;
          });

    // 排序 (使用穩定排序比較函數)
    return filtered.sort((symbolA, symbolB) => {
      const rateA = ratesMap.get(symbolA);
      const rateB = ratesMap.get(symbolB);

      // 如果資料不存在，將其排到後面
      if (!rateA) return 1;
      if (!rateB) return -1;

      return stableSortComparator(rateA, rateB, sortBy, sortDirection);
    });
  }, [sortBy, sortDirection, filterStatus]); // ✅ 不依賴 ratesMap

  // 根據固定順序提取最新資料進行渲染
  const displayRates = useMemo(() => {
    return sortedSymbols
      .map((symbol) => ratesMap.get(symbol))
      .filter((rate): rate is MarketRate => rate !== undefined);
  }, [sortedSymbols, ratesMap]);

  // 排序圖標
  const getSortIcon = (field: SortField) => {
    if (sortBy !== field) {
      return <span className="text-gray-400">↕</span>;
    }
    return sortDirection === 'asc' ? <span>↑</span> : <span>↓</span>;
  };

  // 處理排序點擊
  const handleSort = (field: SortField) => {
    if (onSort) {
      onSort(field);
    }
  };

  if (displayRates.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">
          {filterStatus === 'all' ? '暫無資料' : `暫無「${filterStatus}」狀態的交易對`}
        </p>
      </div>
    );
  }

  return (
    <Tooltip.Provider>
      {/* 指標說明區塊 */}
      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">關鍵指標說明</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-blue-800">
          <div>
            <span className="font-semibold">年化收益：</span>
            <span className="ml-1">費率差異 × 365 × 3（每 8 小時結算，一年 1095 次）</span>
          </div>
          <div>
            <span className="font-semibold">價差：</span>
            <span className="ml-1">(做空價格 - 做多價格) / 平均價格 × 100，正值有利</span>
          </div>
          <div>
            <span className="font-semibold">預估手續費：</span>
            <span className="ml-1">0.2%（4 筆 Taker 交易：建倉做多、建倉做空、平倉做多、平倉做空）</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {/* 交易對 */}
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('symbol')}
              >
                <div className="flex items-center gap-1">
                  <span>交易對</span>
                  {getSortIcon('symbol')}
                </div>
              </th>

              {/* Binance 費率 */}
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Binance 費率
              </th>

              {/* OKX 費率 */}
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                OKX 費率
              </th>

              {/* MEXC 費率 */}
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                MEXC 費率
              </th>

              {/* Gate.io 費率 */}
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Gate.io 費率
              </th>

              {/* 費率差異 */}
              <th
                className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('spread')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>費率差異</span>
                  {getSortIcon('spread')}
                </div>
              </th>

              {/* 年化收益 */}
              <th
                className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('annualizedReturn')}
              >
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <div className="flex items-center justify-end gap-1">
                      <span>年化收益</span>
                      {getSortIcon('annualizedReturn')}
                    </div>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      className="bg-gray-900 text-white text-xs rounded px-3 py-2 max-w-xs shadow-lg z-50"
                      sideOffset={5}
                    >
                      <div className="space-y-1">
                        <div className="font-semibold">計算公式：</div>
                        <div>年化收益 = 費率差異 × 365 × 3</div>
                        <div className="text-gray-300 text-[11px] mt-1">
                          （資金費率每 8 小時結算一次，一年 1095 次）
                        </div>
                      </div>
                      <Tooltip.Arrow className="fill-gray-900" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </th>

              {/* 價差 */}
              <th
                className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('priceDiff')}
              >
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <div className="flex items-center justify-end gap-1">
                      <span>價差</span>
                      {getSortIcon('priceDiff')}
                    </div>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      className="bg-gray-900 text-white text-xs rounded px-3 py-2 max-w-xs shadow-lg z-50"
                      sideOffset={5}
                    >
                      <div className="space-y-1">
                        <div className="font-semibold">計算公式：</div>
                        <div>價差 = (做空價格 - 做多價格) / 平均價格 × 100</div>
                        <div className="text-gray-300 text-[11px] mt-1">
                          正值表示有利（做空價格較高），負值表示不利
                        </div>
                      </div>
                      <Tooltip.Arrow className="fill-gray-900" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </th>

              {/* 預估手續費 */}
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="flex items-center justify-end gap-1">
                  <span>預估手續費</span>
                </div>
              </th>

              {/* 狀態 */}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                狀態
              </th>

              {/* 操作 */}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {displayRates.map((rate) => {
              // Feature 029: 計算是否正在追蹤此機會
              const isTracking = isTrackingFn && rate.bestPair
                ? isTrackingFn(rate.symbol, rate.bestPair.longExchange, rate.bestPair.shortExchange)
                : false;

              return (
                <RateRow
                  key={rate.symbol}
                  rate={rate}
                  timeBasis={timeBasis}
                  onSymbolClick={onSymbolClick}
                  onQuickOpen={onQuickOpen}
                  isTracking={isTracking}
                  isTrackingLoading={isTrackingLoading}
                  onTrackClick={onTrackClick}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </Tooltip.Provider>
  );
}
