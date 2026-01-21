/**
 * OpenPositionDialog - 開倉對話框
 * 讓用戶輸入倉位數量、選擇槓桿並確認開倉
 *
 * Feature 033: Manual Open Position (T014, T015)
 * Feature 044: MEXC Trading Restriction - 顯示警告並禁用開倉
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
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
  Copy,
} from 'lucide-react';
import { splitQuantity } from '@/lib/split-quantity';
import type { MarketRate, ExchangeName } from '../types';
import type { StabilityWarning } from '../hooks/useOpenPosition';
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
  }, positionCount: number) => Promise<void>;
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
  /** 分單開倉進度 - 當前組數 (Feature 060) */
  currentGroup?: number;
  /** 分單開倉進度 - 總組數 (Feature 060) */
  totalGroups?: number;
  /** 費率穩定性警告 (資金費率穩定性檢測功能) */
  stabilityWarning?: StabilityWarning | null;
  /** 是否正在載入穩定性資訊 */
  isLoadingStability?: boolean;
}

const MIN_QUANTITY = 0.0001;
const MAX_QUANTITY = 1000000;
const MARGIN_BUFFER = 0.1; // 10% 緩衝

// Feature 060: 分單開倉限制
const MIN_POSITION_COUNT = 1;
const MAX_POSITION_COUNT = 10;

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
  currentGroup = 0,
  totalGroups = 0,
  stabilityWarning = null,
  isLoadingStability = false,
}: OpenPositionDialogProps) {
  const [quantity, setQuantity] = useState<number>(0);
  const [leverage, setLeverage] = useState<1 | 2>(1);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Feature 060: 分單開倉組數
  const [positionCount, setPositionCount] = useState<number>(1);

  // 計算每組數量預覽
  const quantitiesPreview = quantity > 0 && positionCount > 0
    ? splitQuantity(quantity, positionCount)
    : [];
  const quantityPerGroup = quantitiesPreview.length > 0 ? quantitiesPreview[0] ?? 0 : 0;

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
      // Feature 060: 重置分單開倉組數
      setPositionCount(1);
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

  // Feature 060: 處理開倉組數變更
  const handlePositionCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (isNaN(value) || value < MIN_POSITION_COUNT) {
      setPositionCount(MIN_POSITION_COUNT);
    } else if (value > MAX_POSITION_COUNT) {
      setPositionCount(MAX_POSITION_COUNT);
    } else {
      setPositionCount(value);
    }
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

    // Feature 060: 驗證每組最小數量
    if (positionCount > 1 && quantityPerGroup < MIN_QUANTITY) {
      setValidationError(
        `每組數量不得小於 ${MIN_QUANTITY}，請減少開倉組數或增加總數量`
      );
      return;
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
    }, positionCount);
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
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card rounded-lg shadow-xl z-50 w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-profit" />
              開倉
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="p-1 hover:bg-muted rounded-md"
                disabled={isLoading}
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Opportunity Info */}
          <div className="bg-muted rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-foreground">{rate.symbol}</h3>
              <span className="text-lg font-bold text-profit">
                {bestPair ? Number(bestPair.annualizedReturn).toFixed(2) : '-'}% APY
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <ArrowUpCircle className="w-4 h-4 text-profit" />
                <div>
                  <span className="text-muted-foreground">做多</span>
                  <p className="font-medium capitalize">{longExchange}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ArrowDownCircle className="w-4 h-4 text-loss" />
                <div>
                  <span className="text-muted-foreground">做空</span>
                  <p className="font-medium capitalize">{shortExchange}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 044: MEXC Restriction Warning Banner */}
          {isMexcRestricted && restrictionInfo && (
            <div className="border border-amber-300 bg-amber-50 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
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

          {/* 費率穩定性警告 (資金費率穩定性檢測功能) */}
          {isLoadingStability && (
            <div className="border border-border bg-muted rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                正在檢查費率穩定性...
              </div>
            </div>
          )}

          {!isLoadingStability && stabilityWarning?.hasWarning && (
            <div className="border border-amber-300 bg-amber-50 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-amber-800 mb-1">
                    費率不穩定警告
                  </h4>
                  <p className="text-sm text-amber-700 mb-2">
                    {stabilityWarning.combinedWarning || '此交易對的資金費率過去 24 小時內頻繁翻轉，可能影響套利收益。'}
                  </p>
                  <div className="flex flex-col gap-1 text-xs text-amber-600">
                    {stabilityWarning.longExchange && !stabilityWarning.longExchange.isStable && (
                      <div className="flex items-center gap-1">
                        <span className="capitalize font-medium">{stabilityWarning.longExchange.exchange}:</span>
                        <span>翻轉 {stabilityWarning.longExchange.flipCount} 次</span>
                      </div>
                    )}
                    {stabilityWarning.shortExchange && !stabilityWarning.shortExchange.isStable && (
                      <div className="flex items-center gap-1">
                        <span className="capitalize font-medium">{stabilityWarning.shortExchange.exchange}:</span>
                        <span>翻轉 {stabilityWarning.shortExchange.flipCount} 次</span>
                      </div>
                    )}
                    {/* 顯示不支援查詢的交易所 */}
                    {stabilityWarning.longExchange && !stabilityWarning.longExchange.supported && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <span className="capitalize font-medium">{stabilityWarning.longExchange.exchange}:</span>
                        <span>無歷史資料</span>
                      </div>
                    )}
                    {stabilityWarning.shortExchange && !stabilityWarning.shortExchange.supported && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <span className="capitalize font-medium">{stabilityWarning.shortExchange.exchange}:</span>
                        <span>無歷史資料</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-amber-600 mt-2 italic">
                    建議謹慎開倉，或選擇費率更穩定的交易對
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Market Data with Refresh */}
          <div className="border border-border bg-muted rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">即時市場數據</span>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1 px-2 py-1 text-xs text-primary hover:bg-muted rounded-md disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                刷新
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-primary">{longExchange} 價格：</span>
                <span className="font-mono text-foreground">
                  ${longPrice?.toFixed(4) || '-'}
                </span>
              </div>
              <div>
                <span className="text-primary">{shortExchange} 價格：</span>
                <span className="font-mono text-foreground">
                  ${shortPrice?.toFixed(4) || '-'}
                </span>
              </div>
              <div>
                <span className="text-primary">費率差：</span>
                <span className="font-mono text-foreground">
                  {bestPair ? Number(bestPair.spreadPercent).toFixed(4) : '-'}%
                </span>
              </div>
              <div>
                <span className="text-primary">最後更新：</span>
                <span className="font-mono text-foreground">
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
                className="block text-sm font-medium text-foreground mb-1"
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
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-hidden focus:ring-2 focus:ring-profit disabled:bg-muted"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                多空雙邊將使用相同數量進行對沖
              </p>
            </div>

            {/* Leverage Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-2">
                槓桿倍數
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleLeverageChange(1)}
                  disabled={isLoading}
                  className={`flex-1 py-2 px-4 rounded-md border-2 transition-colors ${
                    leverage === 1
                      ? 'border-profit bg-profit/10 text-profit font-medium'
                      : 'border-border hover:border-border'
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
                      ? 'border-profit bg-profit/10 text-profit font-medium'
                      : 'border-border hover:border-border'
                  } disabled:opacity-50`}
                >
                  2x
                </button>
              </div>
            </div>

            {/* Feature 060: 分單開倉組數 */}
            <div className="mb-4">
              <label
                htmlFor="positionCount"
                className="block text-sm font-medium text-foreground mb-1"
              >
                <Copy className="w-4 h-4 inline mr-1" />
                開倉組數
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  id="positionCount"
                  value={positionCount}
                  onChange={handlePositionCountChange}
                  min={MIN_POSITION_COUNT}
                  max={MAX_POSITION_COUNT}
                  step="1"
                  disabled={isLoading}
                  className="w-24 px-3 py-2 border border-border rounded-md focus:outline-hidden focus:ring-2 focus:ring-profit disabled:bg-muted"
                />
                <span className="text-sm text-muted-foreground">
                  組（{MIN_POSITION_COUNT}-{MAX_POSITION_COUNT}）
                </span>
              </div>
              {positionCount > 1 && quantity > 0 && (
                <div className="mt-2 p-2 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground mb-1">每組數量預覽：</p>
                  <div className="flex flex-wrap gap-1">
                    {quantitiesPreview.map((q, i) => (
                      <span
                        key={i}
                        className={`text-xs px-2 py-0.5 rounded ${
                          q < MIN_QUANTITY
                            ? 'bg-loss/20 text-loss'
                            : 'bg-profit/20 text-profit'
                        }`}
                      >
                        第{i + 1}組: {q.toFixed(4)} {coinSymbol}
                      </span>
                    ))}
                  </div>
                  {quantityPerGroup < MIN_QUANTITY && (
                    <p className="text-xs text-loss mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      每組數量不得小於 {MIN_QUANTITY}
                    </p>
                  )}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                分單開倉可減少滑價，每組建立獨立持倉
              </p>
            </div>

            {/* Stop Loss / Take Profit Settings (Feature 038) */}
            <div className="border border-border rounded-lg p-3 mb-4">
              <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-warning" />
                風險管理
              </h4>

              {/* Stop Loss */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={stopLossEnabled}
                      onChange={(e) => setStopLossEnabled(e.target.checked)}
                      disabled={isLoading}
                      className="w-4 h-4 text-warning border-border rounded focus:ring-warning"
                    />
                    <Shield className="w-3 h-3 text-warning" />
                    啟用停損
                  </label>
                  {stopLossEnabled && (
                    <span className="text-xs text-muted-foreground">
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
                      className="flex-1 px-2 py-1 text-sm border border-border rounded-md focus:outline-hidden focus:ring-2 focus:ring-warning disabled:bg-muted"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                    {avgPrice && (
                      <span className="text-xs text-muted-foreground">
                        (觸發價 ≈ ${(avgPrice * (1 - stopLossPercent / 100)).toFixed(2)})
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Take Profit */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={takeProfitEnabled}
                      onChange={(e) => setTakeProfitEnabled(e.target.checked)}
                      disabled={isLoading}
                      className="w-4 h-4 text-profit border-border rounded focus:ring-profit"
                    />
                    <Target className="w-3 h-3 text-profit" />
                    啟用停利
                  </label>
                  {takeProfitEnabled && (
                    <span className="text-xs text-muted-foreground">
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
                      className="flex-1 px-2 py-1 text-sm border border-border rounded-md focus:outline-hidden focus:ring-2 focus:ring-profit disabled:bg-muted"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                    {avgPrice && (
                      <span className="text-xs text-muted-foreground">
                        (觸發價 ≈ ${(avgPrice * (1 + takeProfitPercent / 100)).toFixed(2)})
                      </span>
                    )}
                  </div>
                )}
              </div>

              {!stopLossEnabled && !takeProfitEnabled && (
                <p className="text-xs text-warning mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  建議啟用停損以降低風險
                </p>
              )}
            </div>

            {/* Margin Requirements */}
            <div className="bg-muted rounded-lg p-3 mb-4">
              <h4 className="text-sm font-medium text-foreground mb-2">保證金需求</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{longExchange} 做多：</span>
                  <span className={isLongBalanceSufficient ? 'text-profit' : 'text-loss'}>
                    {longMarginRequired.toFixed(2)} / {longBalance.toFixed(2)} USDT
                    {isLongBalanceSufficient ? ' ✓' : ' ✗'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{shortExchange} 做空：</span>
                  <span className={isShortBalanceSufficient ? 'text-profit' : 'text-loss'}>
                    {shortMarginRequired.toFixed(2)} / {shortBalance.toFixed(2)} USDT
                    {isShortBalanceSufficient ? ' ✓' : ' ✗'}
                  </span>
                </div>
              </div>
              {isLoadingBalances && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  載入餘額中...
                </p>
              )}
            </div>

            {/* Error Messages */}
            {(validationError || error) && (
              <div className="mb-4 p-3 bg-loss/10 border border-loss/30 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-loss mt-0.5 shrink-0" />
                <div className="text-sm text-loss">
                  <p>{validationError || error}</p>
                </div>
              </div>
            )}

            {/* Insufficient Balance Warning */}
            {!isBalanceSufficient && !validationError && !error && quantity > 0 && (
              <div className="mb-4 p-3 bg-warning/10 border border-warning/30 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                <div className="text-sm text-warning">
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
                className="px-4 py-2 text-sm font-medium text-foreground bg-muted rounded-md hover:bg-muted disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isLoading || !avgPrice || !isBalanceSufficient || isMexcRestricted || (positionCount > 1 && quantityPerGroup < MIN_QUANTITY)}
                className="px-4 py-2 text-sm font-medium text-white bg-profit rounded-md hover:bg-profit/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {totalGroups > 1
                      ? `正在建立第 ${currentGroup}/${totalGroups} 組持倉...`
                      : '開倉中...'}
                  </>
                ) : isMexcRestricted ? (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    無法透過 API 開倉
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-4 h-4" />
                    {positionCount > 1 ? `確認開倉（${positionCount} 組）` : '確認開倉'}
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
