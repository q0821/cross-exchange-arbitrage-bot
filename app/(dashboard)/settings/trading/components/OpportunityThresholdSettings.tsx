'use client';

import { useState, useEffect } from 'react';
import {
  useOpportunityThreshold,
  DEFAULT_OPPORTUNITY_THRESHOLD,
  MIN_THRESHOLD,
  MAX_THRESHOLD,
} from '../../../market-monitor/hooks/useOpportunityThreshold';
import { APPROACHING_THRESHOLD_RATIO } from '../../../market-monitor/utils/rateCalculations';

/**
 * 年化收益門檻設定元件
 *
 * Feature 036: 可配置年化收益門檻
 *
 * 功能：
 * - 數字輸入框設定門檻值
 * - 快速選擇按鈕 (300%, 500%, 800%, 1000%)
 * - 重設為預設值按鈕
 * - 即時顯示接近門檻
 * - 輸入驗證和錯誤提示
 * - 儲存成功/失敗訊息
 */
export function OpportunityThresholdSettings() {
  const {
    threshold,
    approachingThreshold,
    setThreshold,
    resetToDefault,
    isReady,
    isStorageAvailable,
    validateThreshold,
  } = useOpportunityThreshold();

  // 本地輸入狀態（用於即時編輯）
  const [inputValue, setInputValue] = useState<string>(threshold.toString());
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // 快速選擇按鈕選項
  const quickOptions = [300, 500, 800, 1000];

  // 當 threshold 變更時，同步更新輸入框（例如從其他標籤頁同步）
  useEffect(() => {
    if (isReady) {
      setInputValue(threshold.toString());
      setHasChanges(false);
    }
  }, [threshold, isReady]);

  // 處理輸入變更
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setError(null);
    setSuccessMessage(null);

    const numValue = parseInt(value, 10);
    setHasChanges(!isNaN(numValue) && numValue !== threshold);
  };

  // 處理儲存
  const handleSave = () => {
    const numValue = parseInt(inputValue, 10);
    const validation = validateThreshold(numValue);

    if (!validation.valid) {
      setError(validation.error || '無效的門檻值');
      setSuccessMessage(null);
      return;
    }

    setThreshold(numValue);
    setError(null);
    setSuccessMessage('設定已儲存');
    setHasChanges(false);

    // 3 秒後清除成功訊息
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // 處理快速選擇
  const handleQuickSelect = (value: number) => {
    setInputValue(value.toString());
    setThreshold(value);
    setError(null);
    setSuccessMessage('設定已儲存');
    setHasChanges(false);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // 處理重設
  const handleReset = () => {
    resetToDefault();
    setInputValue(DEFAULT_OPPORTUNITY_THRESHOLD.toString());
    setError(null);
    setSuccessMessage('已重設為預設值');
    setHasChanges(false);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // 處理 Enter 鍵儲存
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && hasChanges) {
      handleSave();
    }
  };

  if (!isReady) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
        <div className="h-12 bg-muted rounded w-1/4 mb-4"></div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">年化收益門檻</h2>

      {/* localStorage 不可用警告 */}
      {!isStorageAvailable && (
        <div className="mb-4 p-3 bg-warning/10 border border-warning/30 rounded-md">
          <p className="text-sm text-warning">
            瀏覽器儲存空間不可用，設定將無法保留。請檢查瀏覽器設定或關閉隱私模式。
          </p>
        </div>
      )}

      {/* 門檻輸入區 */}
      <div className="mb-4">
        <label htmlFor="threshold-input" className="block text-sm font-medium text-foreground mb-2">
          機會門檻 (年化收益 %)
        </label>
        <div className="flex items-center gap-2">
          <input
            id="threshold-input"
            type="number"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            min={MIN_THRESHOLD}
            max={MAX_THRESHOLD}
            className={`w-32 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
              error
                ? 'border-loss/30 focus:ring-loss'
                : 'border-border focus:ring-primary'
            }`}
            disabled={!isStorageAvailable}
          />
          <span className="text-muted-foreground">%</span>
          {hasChanges && (
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors text-sm"
            >
              儲存
            </button>
          )}
        </div>
        {error && (
          <p className="mt-1 text-sm text-loss">{error}</p>
        )}
        {successMessage && (
          <p className="mt-1 text-sm text-profit">{successMessage}</p>
        )}
      </div>

      {/* 快速選擇按鈕 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-foreground mb-2">
          快速選擇
        </label>
        <div className="flex flex-wrap gap-2">
          {quickOptions.map((value) => (
            <button
              key={value}
              onClick={() => handleQuickSelect(value)}
              disabled={!isStorageAvailable}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                threshold === value
                  ? 'bg-primary text-white'
                  : 'bg-muted text-foreground hover:bg-muted/80'
              } ${!isStorageAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {value}%
            </button>
          ))}
        </div>
      </div>

      {/* 接近門檻顯示 */}
      <div className="mb-4 p-3 bg-muted rounded-md">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium">接近門檻：</span>{' '}
          <span className="text-primary font-semibold">{approachingThreshold.toFixed(0)}%</span>{' '}
          <span className="text-muted-foreground">(主門檻的 {APPROACHING_THRESHOLD_RATIO * 100}%)</span>
        </p>
      </div>

      {/* 重設按鈕 */}
      <button
        onClick={handleReset}
        disabled={!isStorageAvailable || threshold === DEFAULT_OPPORTUNITY_THRESHOLD}
        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
          threshold === DEFAULT_OPPORTUNITY_THRESHOLD || !isStorageAvailable
            ? 'bg-muted text-muted-foreground cursor-not-allowed'
            : 'bg-muted text-foreground hover:bg-muted/80'
        }`}
      >
        重設為預設值 ({DEFAULT_OPPORTUNITY_THRESHOLD}%)
      </button>

      {/* 說明 */}
      <div className="mt-6 pt-4 border-t border-border">
        <h3 className="text-sm font-medium text-foreground mb-2">說明</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• 當交易對的年化收益 ≥ 門檻時，顯示為「機會」狀態並可開倉</li>
          <li>• 當年化收益 ≥ 接近門檻但 &lt; 主門檻時，顯示為「接近」狀態</li>
          <li>• 此設定僅影響前端顯示，不影響 Webhook 通知門檻</li>
          <li>• 設定會自動儲存在瀏覽器中，重新開啟頁面後仍會保留</li>
        </ul>
      </div>
    </div>
  );
}
