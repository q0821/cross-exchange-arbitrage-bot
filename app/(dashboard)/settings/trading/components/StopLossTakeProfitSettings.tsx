/**
 * StopLossTakeProfitSettings - 停損停利預設設定元件
 *
 * Feature 038: 開倉停損停利設定 (T031, T032)
 *
 * 功能：
 * - 停損預設開關和百分比設定
 * - 停利預設開關和百分比設定
 * - 即時儲存到後端 API
 * - 輸入驗證和錯誤提示
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, Target, Loader2 } from 'lucide-react';
import type { TradingSettings } from '@/src/types/trading';

// 驗證常數
const STOP_LOSS_PERCENT_MIN = 0.5;
const STOP_LOSS_PERCENT_MAX = 50;
const TAKE_PROFIT_PERCENT_MIN = 0.5;
const TAKE_PROFIT_PERCENT_MAX = 100;

export function StopLossTakeProfitSettings() {
  // API 狀態
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 設定狀態
  const [settings, setSettings] = useState<TradingSettings | null>(null);

  // 本地輸入狀態
  const [stopLossEnabled, setStopLossEnabled] = useState(true);
  const [stopLossPercent, setStopLossPercent] = useState('5');
  const [takeProfitEnabled, setTakeProfitEnabled] = useState(false);
  const [takeProfitPercent, setTakeProfitPercent] = useState('3');

  // 驗證狀態
  const [stopLossError, setStopLossError] = useState<string | null>(null);
  const [takeProfitError, setTakeProfitError] = useState<string | null>(null);

  // 載入設定
  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/settings/trading');

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('請先登入');
        }
        throw new Error('載入設定失敗');
      }

      const data = await response.json();

      if (data.success && data.data) {
        const s = data.data as TradingSettings;
        setSettings(s);
        setStopLossEnabled(s.defaultStopLossEnabled);
        setStopLossPercent(s.defaultStopLossPercent.toString());
        setTakeProfitEnabled(s.defaultTakeProfitEnabled);
        setTakeProfitPercent(s.defaultTakeProfitPercent.toString());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入設定失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // 驗證停損百分比
  const validateStopLoss = (value: string): string | null => {
    const num = parseFloat(value);
    if (isNaN(num)) return '請輸入有效數字';
    if (num < STOP_LOSS_PERCENT_MIN) return `最小值為 ${STOP_LOSS_PERCENT_MIN}%`;
    if (num > STOP_LOSS_PERCENT_MAX) return `最大值為 ${STOP_LOSS_PERCENT_MAX}%`;
    return null;
  };

  // 驗證停利百分比
  const validateTakeProfit = (value: string): string | null => {
    const num = parseFloat(value);
    if (isNaN(num)) return '請輸入有效數字';
    if (num < TAKE_PROFIT_PERCENT_MIN) return `最小值為 ${TAKE_PROFIT_PERCENT_MIN}%`;
    if (num > TAKE_PROFIT_PERCENT_MAX) return `最大值為 ${TAKE_PROFIT_PERCENT_MAX}%`;
    return null;
  };

  // 儲存設定
  const saveSettings = async (updates: Partial<TradingSettings>) => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/settings/trading', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('儲存設定失敗');
      }

      const data = await response.json();

      if (data.success && data.data) {
        setSettings(data.data);
        setSuccessMessage('設定已儲存');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存設定失敗');
    } finally {
      setIsSaving(false);
    }
  };

  // 處理停損開關變更
  const handleStopLossEnabledChange = (enabled: boolean) => {
    setStopLossEnabled(enabled);
    saveSettings({ defaultStopLossEnabled: enabled });
  };

  // 處理停損百分比變更
  const handleStopLossPercentChange = (value: string) => {
    setStopLossPercent(value);
    const error = validateStopLoss(value);
    setStopLossError(error);
  };

  // 處理停損百分比失焦時儲存
  const handleStopLossPercentBlur = () => {
    if (stopLossError) return;
    const num = parseFloat(stopLossPercent);
    if (!isNaN(num) && num !== settings?.defaultStopLossPercent) {
      saveSettings({ defaultStopLossPercent: num });
    }
  };

  // 處理停利開關變更
  const handleTakeProfitEnabledChange = (enabled: boolean) => {
    setTakeProfitEnabled(enabled);
    saveSettings({ defaultTakeProfitEnabled: enabled });
  };

  // 處理停利百分比變更
  const handleTakeProfitPercentChange = (value: string) => {
    setTakeProfitPercent(value);
    const error = validateTakeProfit(value);
    setTakeProfitError(error);
  };

  // 處理停利百分比失焦時儲存
  const handleTakeProfitPercentBlur = () => {
    if (takeProfitError) return;
    const num = parseFloat(takeProfitPercent);
    if (!isNaN(num) && num !== settings?.defaultTakeProfitPercent) {
      saveSettings({ defaultTakeProfitPercent: num });
    }
  };

  // 處理 Enter 鍵儲存
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    type: 'stopLoss' | 'takeProfit',
  ) => {
    if (e.key === 'Enter') {
      if (type === 'stopLoss') {
        handleStopLossPercentBlur();
      } else {
        handleTakeProfitPercentBlur();
      }
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-12 bg-gray-200 rounded w-full mb-4"></div>
          <div className="h-12 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">開倉停損停利預設值</h2>

      {/* 全域錯誤 */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* 成功訊息 */}
      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-700">{successMessage}</p>
        </div>
      )}

      {/* 停損設定 */}
      <div className="mb-6 pb-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-orange-500" />
            <span className="font-medium text-gray-900">停損 (Stop Loss)</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={stopLossEnabled}
              onChange={(e) => handleStopLossEnabledChange(e.target.checked)}
              disabled={isSaving}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <p className="text-sm text-gray-600 mb-3">
          開倉時自動為雙邊倉位設定停損單，當價格不利時自動平倉以限制損失
        </p>

        {stopLossEnabled && (
          <div className="ml-7">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              停損百分比
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={stopLossPercent}
                onChange={(e) => handleStopLossPercentChange(e.target.value)}
                onBlur={handleStopLossPercentBlur}
                onKeyDown={(e) => handleKeyDown(e, 'stopLoss')}
                min={STOP_LOSS_PERCENT_MIN}
                max={STOP_LOSS_PERCENT_MAX}
                step="0.5"
                disabled={isSaving}
                className={`w-24 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                  stopLossError
                    ? 'border-red-300 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
              />
              <span className="text-gray-500">%</span>
              {isSaving && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
            </div>
            {stopLossError && (
              <p className="mt-1 text-sm text-red-600">{stopLossError}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              建議範圍: 2-10%
            </p>
          </div>
        )}
      </div>

      {/* 停利設定 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-green-500" />
            <span className="font-medium text-gray-900">停利 (Take Profit)</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={takeProfitEnabled}
              onChange={(e) => handleTakeProfitEnabledChange(e.target.checked)}
              disabled={isSaving}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <p className="text-sm text-gray-600 mb-3">
          開倉時自動為雙邊倉位設定停利單，當達到目標獲利時自動平倉鎖定收益
        </p>

        {takeProfitEnabled && (
          <div className="ml-7">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              停利百分比
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={takeProfitPercent}
                onChange={(e) => handleTakeProfitPercentChange(e.target.value)}
                onBlur={handleTakeProfitPercentBlur}
                onKeyDown={(e) => handleKeyDown(e, 'takeProfit')}
                min={TAKE_PROFIT_PERCENT_MIN}
                max={TAKE_PROFIT_PERCENT_MAX}
                step="0.5"
                disabled={isSaving}
                className={`w-24 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                  takeProfitError
                    ? 'border-red-300 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
              />
              <span className="text-gray-500">%</span>
              {isSaving && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
            </div>
            {takeProfitError && (
              <p className="mt-1 text-sm text-red-600">{takeProfitError}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              建議範圍: 1-5%
            </p>
          </div>
        )}
      </div>

      {/* 說明 */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-2">說明</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• 預設值會在開倉對話框中自動帶入</li>
          <li>• 開倉時仍可個別調整或關閉停損停利</li>
          <li>• 停損停利是基於入場價格的百分比計算</li>
          <li>• 停損停利單會同時設定在雙邊交易所</li>
        </ul>
      </div>
    </div>
  );
}
