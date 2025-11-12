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
import { RateRow, MarketRate } from './RateRow';
import { OpportunityStatus } from './StatusBadge';
import { stableSortComparator } from '../utils/sortComparator';
import type { SortField, SortDirection } from '../types';

interface RatesTableProps {
  ratesMap: Map<string, MarketRate>;
  sortBy?: SortField;
  sortDirection?: SortDirection;
  filterStatus?: OpportunityStatus | 'all';
  onSort?: (field: SortField) => void;
  onSymbolClick?: (symbol: string) => void;
  onQuickOpen?: (rate: MarketRate) => void;
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
  sortBy = 'symbol',
  sortDirection = 'asc',
  filterStatus = 'all',
  onSort,
  onSymbolClick,
  onQuickOpen,
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
                <div className="flex items-center justify-end gap-1">
                  <span>年化收益</span>
                  {getSortIcon('annualizedReturn')}
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
            {displayRates.map((rate) => (
              <RateRow
                key={rate.symbol}
                rate={rate}
                onSymbolClick={onSymbolClick}
                onQuickOpen={onQuickOpen}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Tooltip.Provider>
  );
}
