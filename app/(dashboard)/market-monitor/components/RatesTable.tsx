/**
 * RatesTable - 費率表格組件
 * 顯示多個交易對的即時費率資訊
 *
 * Feature: 006-web-trading-platform (User Story 2.5)
 */

'use client';

import React, { useMemo } from 'react';
import { RateRow, MarketRate } from './RateRow';
import { OpportunityStatus } from './StatusBadge';

type SortField = 'symbol' | 'spread' | 'annualizedReturn';
type SortDirection = 'asc' | 'desc';

interface RatesTableProps {
  rates: MarketRate[];
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
 */
export function RatesTable({
  rates,
  sortBy = 'spread',
  sortDirection = 'desc',
  filterStatus = 'all',
  onSort,
  onSymbolClick,
  onQuickOpen,
}: RatesTableProps) {
  // 篩選和排序邏輯
  const processedRates = useMemo(() => {
    // 1. 篩選
    let filtered = rates;
    if (filterStatus !== 'all') {
      filtered = rates.filter((rate) => rate.status === filterStatus);
    }

    // 2. 排序
    const sorted = [...filtered].sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (sortBy) {
        case 'symbol':
          aValue = a.symbol;
          bValue = b.symbol;
          break;
        case 'spread':
          aValue = a.bestPair?.spreadPercent ?? 0;
          bValue = b.bestPair?.spreadPercent ?? 0;
          break;
        case 'annualizedReturn':
          aValue = a.bestPair?.annualizedReturn ?? 0;
          bValue = b.bestPair?.annualizedReturn ?? 0;
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

    return sorted;
  }, [rates, sortBy, sortDirection, filterStatus]);

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

  if (processedRates.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">
          {filterStatus === 'all' ? '暫無資料' : `暫無「${filterStatus}」狀態的交易對`}
        </p>
      </div>
    );
  }

  return (
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
          {processedRates.map((rate) => (
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
  );
}
