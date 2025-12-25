/**
 * OpenPositionDialog - 開倉對話框
 * 讓用戶輸入倉位數量、選擇槓桿並確認開倉
 *
 * Feature 033: Manual Open Position (T014, T015)
 * Feature 044: MEXC Trading Restriction - 顯示警告並禁用開倉
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  X,
  TrendingUp,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Layers,
  RefreshCw,
  ArrowUpCircle,
  ArrowDownCircle,
  Shield,
  Target,
  ExternalLink,
} from 'lucide-react';
import type { MarketRate, ExchangeName } from '../types';
import {
  isArbitragePairRestricted,
  getArbitragePairRestriction,
} from '@/lib/trading-restrictions';

/** 停損停利設定 */
interface StopLossTakeProfitConfig {
  stopLossEnabled: boolean;
  stopLossPercent?: number;
  takeProfitEnabled: boolean;
  takeProfitPercent?: number;
}

interface OpenPositionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  rate: MarketRate | null;
  onConfirm: (data: {
    symbol: string;
    longExchange: string;
    shortExchange: string;
    quantity: number;
    leverage: 1 | 2;
    stopLossEnabled: boolean;
    stopLossPercent?: number;
    takeProfitEnabled: boolean;
    takeProfitPercent?: number;
  }) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  /** 用戶各交易所餘額 */
  balances: Record<string, number>;
  /** 是否正在載入餘額 */
  isLoadingBalances: boolean;
  /** 刷新市場數據回調 */
  onRefreshMarketData?: () => Promise<void>;
  /** 預設停損停利設定 */
  defaultStopLossConfig?: StopLossTakeProfitConfig;
}

const MIN_QUANTITY = 0.0001;
const MAX_QUANTITY = 1000000;
const MARGIN_BUFFER = 0.1; // 10% 緩衝

// 停損停利百分比限制 (Feature 038)
const STOP_LOSS_PERCENT_MIN = 0.5;
const STOP_LOSS_PERCENT_MAX = 50;
const TAKE_PROFIT_PERCENT_MIN = 0.5;
const TAKE_PROFIT_PERCENT_MAX = 100;
const DEFAULT_STOP_LOSS_PERCENT = 5;
const DEFAULT_TAKE_PROFIT_PERCENT = 3;

export function OpenPositionDialog({
  isOpen,
  onClose,
  rate,
  onConfirm,
  isLoading,
  error,
  balances,
  isLoadingBalances,
  onRefreshMarketData,
  defaultStopLossConfig,
}: OpenPositionDialogProps) {
  const [quantity, setQuantity] = useState<number>(0);
  const [leverage, setLeverage] = useState<1 | 2>(1);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // 停損停利狀態 (Feature 038)
  const [stopLossEnabled, setStopLossEnabled] = useState<boolean>(
    defaultStopLossConfig?.stopLossEnabled ?? true
  );
  const [stopLossPercent, setStopLossPercent] = useState<number>(
    defaultStopLossConfig?.stopLossPercent ?? DEFAULT_STOP_LOSS_PERCENT
  );
  const [takeProfitEnabled, setTakeProfitEnabled] = useState<boolean>(
    defaultStopLossConfig?.takeProfitEnabled ?? false
  );
  const [takeProfitPercent, setTakeProfitPercent] = useState<number>(
    defaultStopLossConfig?.takeProfitPercent ?? DEFAULT_TAKE_PROFIT_PERCENT
  );

  // 獲取最佳交易對資訊
  const bestPair = rate?.bestPair;
  const longExchange = bestPair?.longExchange as ExchangeName;
  const shortExchange = bestPair?.shortExchange as ExchangeName;

  // Feature 044: 檢查是否涉及受限交易所（如 MEXC）
  const isMexcRestricted = bestPair
    ? isArbitragePairRestricted(bestPair.longExchange, bestPair.shortExchange)
    : false;
  const restrictionInfo = bestPair
    ? getArbitragePairRestriction(bestPair.longExchange, bestPair.shortExchange)
    : null;

  // 計算價格
  const longPrice = longExchange
    ? rate?.exchanges[longExchange]?.price ?? null
    : null;
  const shortPrice = shortExchange
    ? rate?.exchanges[shortExchange]?.price ?? null
    : null;
  const avgPrice = longPrice && shortPrice ? (longPrice + shortPrice) / 2 : null;

  // 計算所需保證金
  const longMarginRequired = longPrice && quantity
    ? (quantity * longPrice / leverage) * (1 + MARGIN_BUFFER)
    : 0;
  const shortMarginRequired = shortPrice && quantity
    ? (quantity * shortPrice / leverage) * (1 + MARGIN_BUFFER)
    : 0;

  // 獲取餘額
  const longBalance = longExchange ? balances[longExchange] ?? 0 : 0;
  const shortBalance = shortExchange ? balances[shortExchange] ?? 0 : 0;

  // 檢查餘額是否充足
  const isLongBalanceSufficient = longBalance >= longMarginRequired;
  const isShortBalanceSufficient = shortBalance >= shortMarginRequired;
  const isBalanceSufficient = isLongBalanceSufficient && isShortBalanceSufficient;

  // 取得幣種名稱
  const coinSymbol = rate?.symbol?.replace('USDT', '') || '';

  // 當對話框開啟時設定預設值
  useEffect(() => {
    if (isOpen && avgPrice && quantity === 0) {
      const defaultCapital = 100; // 預設 100 USDT
      const defaultQuantity = defaultCapital / avgPrice;
      setQuantity(Number(defaultQuantity.toFixed(4)));
      setLastUpdated(new Date());
    }
  }, [isOpen, avgPrice, quantity]);

  // 重置狀態
  useEffect(() => {
    if (!isOpen) {
      setQuantity(0);
      setLeverage(1);
      setValidationError(null);
      setLastUpdated(null);
      // 重置停損停利到預設值
      setStopLossEnabled(defaultStopLossConfig?.stopLossEnabled ?? true);
      setStopLossPercent(defaultStopLossConfig?.stopLossPercent ?? DEFAULT_STOP_LOSS_PERCENT);
      setTakeProfitEnabled(defaultStopLossConfig?.takeProfitEnabled ?? false);
      setTakeProfitPercent(defaultStopLossConfig?.takeProfitPercent ?? DEFAULT_TAKE_PROFIT_PERCENT);
    }
  }, [isOpen, defaultStopLossConfig]);

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setQuantity(isNaN(value) ? 0 : value);
    setValidationError(null);
  };

  const handleLeverageChange = (newLeverage: 1 | 2) => {
    setLeverage(newLeverage);
    setValidationError(null);
  };

  const handleRefresh = useCallback(async () => {
    if (isRefreshing || !onRefreshMarketData) return;

    setIsRefreshing(true);
    try {
      await onRefreshMarketData();
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to refresh market data:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, onRefreshMarketData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 驗證數量
    if (quantity < MIN_QUANTITY) {
      setValidationError(`最低倉位數量為 ${MIN_QUANTITY}`);
      return;
    }

    if (quantity > MAX_QUANTITY) {
      setValidationError(`最高倉位數量為 ${MAX_QUANTITY.toLocaleString()}`);
      return;
    }

    if (!avgPrice) {
      setValidationError('無法取得價格資料');
      return;
    }

    if (!bestPair) {
      setValidationError('無可用的套利機會');
      return;
    }

    // 驗證餘額
    if (!isBalanceSufficient) {
      if (!isLongBalanceSufficient) {
        setValidationError(
          `${longExchange} 餘額不足：需要 ${longMarginRequired.toFixed(2)} USDT，可用 ${longBalance.toFixed(2)} USDT`
        );
      } else {
        setValidationError(
          `${shortExchange} 餘額不足：需要 ${shortMarginRequired.toFixed(2)} USDT，可用 ${shortBalance.toFixed(2)} USDT`
        );
      }
      return;
    }

    // 驗證停損百分比 (Feature 038)
    if (stopLossEnabled) {
      if (stopLossPercent < STOP_LOSS_PERCENT_MIN || stopLossPercent > STOP_LOSS_PERCENT_MAX) {
        setValidationError(
          `停損百分比必須在 ${STOP_LOSS_PERCENT_MIN}% 到 ${STOP_LOSS_PERCENT_MAX}% 之間`
        );
        return;
      }
    }

    // 驗證停利百分比 (Feature 038)
    if (takeProfitEnabled) {
      if (takeProfitPercent < TAKE_PROFIT_PERCENT_MIN || takeProfitPercent > TAKE_PROFIT_PERCENT_MAX) {
        setValidationError(
          `停利百分比必須在 ${TAKE_PROFIT_PERCENT_MIN}% 到 ${TAKE_PROFIT_PERCENT_MAX}% 之間`
        );
        return;
      }
    }

    await onConfirm({
      symbol: rate!.symbol,
      longExchange: bestPair.longExchange,
      shortExchange: bestPair.shortExchange,
      quantity,
      leverage,
      // 停損停利參數 (Feature 038)
      stopLossEnabled,
      stopLossPercent: stopLossEnabled ? stopLossPercent : undefined,
      takeProfitEnabled,
      takeProfitPercent: takeProfitEnabled ? takeProfitPercent : undefined,
    });
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  if (!rate?.bestPair) {
    return null;
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl z-50 w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              開倉
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="p-1 hover:bg-gray-100 rounded-md"
                disabled={isLoading}
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Opportunity Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700">{rate.symbol}</h3>
              <span className="text-lg font-bold text-green-600">
                {bestPair ? Number(bestPair.annualizedReturn).toFixed(2) : '-'}% APY
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <ArrowUpCircle className="w-4 h-4 text-green-500" />
                <div>
                  <span className="text-gray-500">做多</span>
                  <p className="font-medium capitalize">{longExchange}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ArrowDownCircle className="w-4 h-4 text-red-500" />
                <div>
                  <span className="text-gray-500">做空</span>
                  <p className="font-medium capitalize">{shortExchange}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 044: MEXC Restriction Warning Banner */}
          {isMexcRestricted && restrictionInfo && (
            <div className="border border-amber-300 bg-amber-50 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-amber-800 mb-1">
                    交易所限制
                  </h4>
                  <p className="text-sm text-amber-700 mb-3">
                    {restrictionInfo.message}
                  </p>
                  <a
                    href={restrictionInfo.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-md transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    前往 MEXC 手動操作
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Market Data with Refresh */}
          <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-700">即時市場數據</span>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-100 rounded-md disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                刷新
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-blue-600">{longExchange} 價格：</span>
                <span className="font-mono text-blue-800">
                  ${longPrice?.toFixed(4) || '-'}
                </span>
              </div>
              <div>
                <span className="text-blue-600">{shortExchange} 價格：</span>
                <span className="font-mono text-blue-800">
                  ${shortPrice?.toFixed(4) || '-'}
                </span>
              </div>
              <div>
                <span className="text-blue-600">費率差：</span>
                <span className="font-mono text-blue-800">
                  {bestPair ? Number(bestPair.spreadPercent).toFixed(4) : '-'}%
                </span>
              </div>
              <div>
                <span className="text-blue-600">最後更新：</span>
                <span className="font-mono text-blue-800">
                  {lastUpdated ? lastUpdated.toLocaleTimeString() : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {/* Position Quantity Input */}
            <div className="mb-4">
              <label
                htmlFor="positionQuantity"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                <Layers className="w-4 h-4 inline mr-1" />
                倉位數量 ({coinSymbol})
              </label>
              <input
                type="number"
                id="positionQuantity"
                value={quantity || ''}
                onChange={handleQuantityChange}
                min={MIN_QUANTITY}
                max={MAX_QUANTITY}
                step="any"
                disabled={isLoading}
                placeholder={`輸入 ${coinSymbol} 數量`}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
              />
              <p className="mt-1 text-xs text-gray-500">
                多空雙邊將使用相同數量進行對沖
              </p>
            </div>

            {/* Leverage Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                槓桿倍數
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleLeverageChange(1)}
                  disabled={isLoading}
                  className={`flex-1 py-2 px-4 rounded-md border-2 transition-colors ${
                    leverage === 1
                      ? 'border-green-500 bg-green-50 text-green-700 font-medium'
                      : 'border-gray-300 hover:border-gray-400'
                  } disabled:opacity-50`}
                >
                  1x
                </button>
                <button
                  type="button"
                  onClick={() => handleLeverageChange(2)}
                  disabled={isLoading}
                  className={`flex-1 py-2 px-4 rounded-md border-2 transition-colors ${
                    leverage === 2
                      ? 'border-green-500 bg-green-50 text-green-700 font-medium'
                      : 'border-gray-300 hover:border-gray-400'
                  } disabled:opacity-50`}
                >
                  2x
                </button>
              </div>
            </div>

            {/* Stop Loss / Take Profit Settings (Feature 038) */}
            <div className="border border-gray-200 rounded-lg p-3 mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-orange-500" />
                風險管理
              </h4>

              {/* Stop Loss */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={stopLossEnabled}
                      onChange={(e) => setStopLossEnabled(e.target.checked)}
                      disabled={isLoading}
                      className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <Shield className="w-3 h-3 text-orange-500" />
                    啟用停損
                  </label>
                  {stopLossEnabled && (
                    <span className="text-xs text-gray-500">
                      {STOP_LOSS_PERCENT_MIN}% - {STOP_LOSS_PERCENT_MAX}%
                    </span>
                  )}
                </div>
                {stopLossEnabled && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={stopLossPercent}
                      onChange={(e) => setStopLossPercent(parseFloat(e.target.value) || 0)}
                      min={STOP_LOSS_PERCENT_MIN}
                      max={STOP_LOSS_PERCENT_MAX}
                      step="0.1"
                      disabled={isLoading}
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
                    />
                    <span className="text-sm text-gray-600">%</span>
                    {avgPrice && (
                      <span className="text-xs text-gray-500">
                        (觸發價 ≈ ${(avgPrice * (1 - stopLossPercent / 100)).toFixed(2)})
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Take Profit */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={takeProfitEnabled}
                      onChange={(e) => setTakeProfitEnabled(e.target.checked)}
                      disabled={isLoading}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <Target className="w-3 h-3 text-green-500" />
                    啟用停利
                  </label>
                  {takeProfitEnabled && (
                    <span className="text-xs text-gray-500">
                      {TAKE_PROFIT_PERCENT_MIN}% - {TAKE_PROFIT_PERCENT_MAX}%
                    </span>
                  )}
                </div>
                {takeProfitEnabled && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={takeProfitPercent}
                      onChange={(e) => setTakeProfitPercent(parseFloat(e.target.value) || 0)}
                      min={TAKE_PROFIT_PERCENT_MIN}
                      max={TAKE_PROFIT_PERCENT_MAX}
                      step="0.1"
                      disabled={isLoading}
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                    />
                    <span className="text-sm text-gray-600">%</span>
                    {avgPrice && (
                      <span className="text-xs text-gray-500">
                        (觸發價 ≈ ${(avgPrice * (1 + takeProfitPercent / 100)).toFixed(2)})
                      </span>
                    )}
                  </div>
                )}
              </div>

              {!stopLossEnabled && !takeProfitEnabled && (
                <p className="text-xs text-yellow-600 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  建議啟用停損以降低風險
                </p>
              )}
            </div>

            {/* Margin Requirements */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">保證金需求</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">{longExchange} 做多：</span>
                  <span className={isLongBalanceSufficient ? 'text-green-600' : 'text-red-600'}>
                    {longMarginRequired.toFixed(2)} / {longBalance.toFixed(2)} USDT
                    {isLongBalanceSufficient ? ' ✓' : ' ✗'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{shortExchange} 做空：</span>
                  <span className={isShortBalanceSufficient ? 'text-green-600' : 'text-red-600'}>
                    {shortMarginRequired.toFixed(2)} / {shortBalance.toFixed(2)} USDT
                    {isShortBalanceSufficient ? ' ✓' : ' ✗'}
                  </span>
                </div>
              </div>
              {isLoadingBalances && (
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  載入餘額中...
                </p>
              )}
            </div>

            {/* Error Messages */}
            {(validationError || error) && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-red-700">
                  <p>{validationError || error}</p>
                </div>
              </div>
            )}

            {/* Insufficient Balance Warning */}
            {!isBalanceSufficient && !validationError && !error && quantity > 0 && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-yellow-700">
                  <p>餘額不足，無法開倉。請調整數量或充值。</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isLoading || !avgPrice || !isBalanceSufficient || isMexcRestricted}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    開倉中...
                  </>
                ) : isMexcRestricted ? (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    無法透過 API 開倉
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-4 h-4" />
                    確認開倉
                  </>
                )}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
