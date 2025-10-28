'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface FundingRateData {
  exchange: string;
  label: string;
  symbol: string;
  fundingRate: number | null;
  nextFundingTime: number | null;
  markPrice: number | null;
  indexPrice: number | null;
  timestamp: string;
}

/**
 * 即時資金費率頁面
 */
export default function FundingRatesPage() {
  const [rates, setRates] = useState<FundingRateData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [symbol, setSymbol] = useState('BTC/USDT:USDT');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadFundingRates = async () => {
    try {
      const response = await fetch(`/api/funding-rates?symbol=${encodeURIComponent(symbol)}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to load funding rates');
      }

      const data = await response.json();
      setRates(data.data.rates);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFundingRates();
  }, [symbol]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadFundingRates();
    }, 10000); // 每 10 秒更新一次

    return () => clearInterval(interval);
  }, [autoRefresh, symbol]);

  const formatRate = (rate: number | null): string => {
    if (rate === null) return 'N/A';
    return (rate * 100).toFixed(4) + '%';
  };

  const formatPrice = (price: number | null): string => {
    if (price === null) return 'N/A';
    return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatTime = (timestamp: number | null): string => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-TW');
  };

  const calculateSpread = (): string | null => {
    if (rates.length !== 2 || !rates[0].fundingRate || !rates[1].fundingRate) {
      return null;
    }
    const spread = Math.abs(rates[0].fundingRate - rates[1].fundingRate);
    return (spread * 100).toFixed(4) + '%';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-gray-600">載入中...</div>
      </div>
    );
  }

  if (error && rates.length === 0) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
        {error.includes('API Key') && (
          <div className="text-center">
            <Link
              href="/settings/api-keys"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              前往設定 API Key
            </Link>
          </div>
        )}
      </div>
    );
  }

  const spread = calculateSpread();

  return (
    <div className="space-y-6">
      {/* 標題和控制 */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">即時資金費率</h1>
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-600">自動更新</span>
          </label>
          <button
            onClick={loadFundingRates}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            立即更新
          </button>
        </div>
      </div>

      {/* 交易對選擇 */}
      <div className="bg-white rounded-lg shadow p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">交易對</label>
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="BTC/USDT:USDT">BTCUSDT (永續合約)</option>
          <option value="ETH/USDT:USDT">ETHUSDT (永續合約)</option>
          <option value="SOL/USDT:USDT">SOLUSDT (永續合約)</option>
        </select>
      </div>

      {/* 費率差異 */}
      {spread && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow p-6 border border-blue-200">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-600 mb-1">當前費率差異</p>
              <p className="text-3xl font-bold text-blue-700">{spread}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 mb-1">預估年化收益</p>
              <p className="text-2xl font-semibold text-green-600">
                {((parseFloat(spread.replace('%', '')) / 100) * 365 * 3).toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 資金費率卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {rates.map((rate) => (
          <div key={rate.exchange} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {rate.exchange.toUpperCase()}
                </h3>
                <p className="text-sm text-gray-500">{rate.label}</p>
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                已連接
              </span>
            </div>

            <div className="space-y-4">
              {/* 資金費率 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-600 mb-1">資金費率</p>
                <p className="text-2xl font-bold text-gray-900">{formatRate(rate.fundingRate)}</p>
              </div>

              {/* 標記價格 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-600 mb-1">標記價格</p>
                  <p className="text-lg font-semibold text-gray-900">{formatPrice(rate.markPrice)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">指數價格</p>
                  <p className="text-lg font-semibold text-gray-900">{formatPrice(rate.indexPrice)}</p>
                </div>
              </div>

              {/* 下次結算時間 */}
              <div>
                <p className="text-xs text-gray-600 mb-1">下次結算</p>
                <p className="text-sm text-gray-700">{formatTime(rate.nextFundingTime)}</p>
              </div>

              {/* 更新時間 */}
              <div>
                <p className="text-xs text-gray-500">
                  更新於 {new Date(rate.timestamp).toLocaleTimeString('zh-TW')}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 說明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">💡 資金費率說明</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• 正費率：多頭支付空頭，市場偏多</li>
          <li>• 負費率：空頭支付多頭，市場偏空</li>
          <li>• 費率差異越大，套利機會越好</li>
          <li>• 資金費率每 8 小時結算一次</li>
        </ul>
      </div>
    </div>
  );
}
