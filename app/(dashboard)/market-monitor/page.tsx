/**
 * Market Monitor Page - 市場監控主頁面
 * 整合所有組件和 hooks，提供完整的多交易對即時監控功能
 *
 * Feature: 006-web-trading-platform (User Story 2.5)
 */

'use client';

import React, { useState, useMemo } from 'react';
import { RatesTable } from './components/RatesTable';
import { StatsCard } from './components/StatsCard';
import { SymbolSelector } from './components/SymbolSelector';
import { useMarketRates } from './hooks/useMarketRates';
import { useSymbolGroups } from './hooks/useSymbolGroups';
import { useTableSort } from './hooks/useTableSort';
import type { MarketRate } from './components/RateRow';

/**
 * MarketMonitorPage 組件
 * 市場監控主頁面
 */
export default function MarketMonitorPage() {
  // 數據訂閱
  const { rates, stats, isConnected, isLoading, error } = useMarketRates();

  // 交易對群組管理
  const {
    groups,
    selectedGroup,
    isLoading: groupsLoading,
    setSelectedGroup,
    getSelectedSymbols,
  } = useSymbolGroups();

  // 表格排序和篩選
  const { sortBy, sortDirection, filterStatus, toggleSort, setFilterStatus } = useTableSort();

  // 根據選中的群組過濾費率數據
  const filteredRates = useMemo(() => {
    if (!selectedGroup || selectedGroup === 'all') {
      return rates;
    }

    const selectedSymbols = getSelectedSymbols();
    if (selectedSymbols.length === 0) {
      return rates;
    }

    // 只顯示選中群組的交易對
    return rates.filter((rate) => selectedSymbols.includes(rate.symbol));
  }, [rates, selectedGroup, getSelectedSymbols]);

  // 計算過濾後的統計數據
  const filteredStats = useMemo(() => {
    if (!stats || filteredRates.length === rates.length) {
      return stats; // 如果沒有過濾，直接使用原始統計
    }

    // 重新計算過濾後的統計
    const opportunityCount = filteredRates.filter((r) => r.status === 'opportunity').length;
    const approachingCount = filteredRates.filter((r) => r.status === 'approaching').length;

    let maxSpread: { symbol: string; spread: string } | null = null;
    filteredRates.forEach((rate) => {
      const spread = parseFloat(rate.spreadPercent);
      if (!maxSpread || spread > parseFloat(maxSpread.spread)) {
        maxSpread = {
          symbol: rate.symbol,
          spread: rate.spreadPercent,
        };
      }
    });

    return {
      totalSymbols: filteredRates.length,
      opportunityCount,
      approachingCount,
      maxSpread,
      uptime: stats.uptime,
      lastUpdate: stats.lastUpdate,
    };
  }, [stats, filteredRates, rates.length]);

  // 詳情對話框狀態（未來擴展）
  const [_selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  // 處理交易對點擊
  const handleSymbolClick = (symbol: string) => {
    console.log('[MarketMonitor] Symbol clicked:', symbol);
    setSelectedSymbol(symbol);
    // TODO: 顯示詳情對話框或導航到詳情頁面
  };

  // 處理快速開倉
  const handleQuickOpen = (rate: MarketRate) => {
    console.log('[MarketMonitor] Quick open:', rate);
    // TODO: 打開開倉對話框
    alert(`快速開倉功能開發中\n交易對: ${rate.symbol}\n費率差異: ${rate.spreadPercent}%`);
  };

  // 載入狀態
  if (isLoading || groupsLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <p className="mt-4 text-gray-600">載入市場數據中...</p>
          </div>
        </div>
      </div>
    );
  }

  // 錯誤狀態
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-800 mb-2">載入失敗</h3>
          <p className="text-red-600">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            重新載入
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* 頁面標題和連線狀態 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">市場監控</h1>
          <p className="text-gray-600 mt-1">即時監控多個交易對的資金費率差異</p>
        </div>

        {/* 連線狀態指示器 */}
        <div className="flex items-center gap-2">
          <div
            className={`h-3 w-3 rounded-full ${
              isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`}
          ></div>
          <span className={`text-sm font-medium ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
            {isConnected ? '即時連線中' : '連線已斷開'}
          </span>
        </div>
      </div>

      {/* 統計卡片 */}
      <StatsCard stats={filteredStats} isLoading={false} />

      {/* 交易對選擇器和篩選器 */}
      <SymbolSelector
        groups={groups}
        selectedGroup={selectedGroup}
        filterStatus={filterStatus}
        onGroupChange={setSelectedGroup}
        onFilterChange={setFilterStatus}
      />

      {/* 費率表格 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            即時費率 {filteredRates.length > 0 && `(${filteredRates.length} 個交易對)`}
          </h2>

          {/* 表格操作按鈕（未來擴展）*/}
          <div className="flex gap-2">
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              title="重新載入"
            >
              🔄 重新載入
            </button>
          </div>
        </div>

        <RatesTable
          rates={filteredRates}
          sortBy={sortBy}
          sortDirection={sortDirection}
          filterStatus={filterStatus}
          onSort={toggleSort}
          onSymbolClick={handleSymbolClick}
          onQuickOpen={handleQuickOpen}
        />
      </div>

      {/* 底部提示 */}
      {!isConnected && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 text-sm">
            ⚠️ WebSocket 連線已斷開，數據可能不是最新的。頁面將自動嘗試重新連線。
          </p>
        </div>
      )}
    </div>
  );
}
