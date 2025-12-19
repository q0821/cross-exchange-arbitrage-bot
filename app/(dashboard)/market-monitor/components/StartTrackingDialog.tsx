/**
 * StartTrackingDialog - 開始追蹤對話框
 * 讓用戶輸入倉位數量（顆數）並設定自動停止選項
 *
 * Feature 029: Simulated APY Tracking (T014)
 * 更新：改為直接輸入顆數而非金額
 */

'use client';

import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Target, AlertCircle, Loader2, Layers } from 'lucide-react';
import type { MarketRate } from '../types';

interface StartTrackingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  rate: MarketRate | null;
  onConfirm: (data: {
    simulatedCapital: number;
    positionQuantity: number;
    autoStopOnExpire: boolean;
  }) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const MIN_QUANTITY = 0.0001;
const MAX_QUANTITY = 1000000;

export function StartTrackingDialog({
  isOpen,
  onClose,
  rate,
  onConfirm,
  isLoading,
  error,
}: StartTrackingDialogProps) {
  const [quantity, setQuantity] = useState<number>(0);
  const [autoStopOnExpire, setAutoStopOnExpire] = useState<boolean>(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  // 計算價格
  const longPrice = rate?.bestPair
    ? rate.exchanges[rate.bestPair.longExchange]?.price ?? null
    : null;
  const shortPrice = rate?.bestPair
    ? rate.exchanges[rate.bestPair.shortExchange]?.price ?? null
    : null;
  const avgPrice = longPrice && shortPrice ? (longPrice + shortPrice) / 2 : null;

  // 當對話框開啟且有價格時，設定預設顆數（約 1000 USDT）
  useEffect(() => {
    if (isOpen && avgPrice && quantity === 0) {
      const defaultCapital = 1000;
      const defaultQuantity = defaultCapital / avgPrice;
      setQuantity(Number(defaultQuantity.toFixed(4)));
    }
  }, [isOpen, avgPrice, quantity]);

  // 計算資金金額
  const simulatedCapital = avgPrice ? quantity * avgPrice : 0;

  // 取得幣種名稱
  const coinSymbol = rate?.symbol?.replace('USDT', '') || '';

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setQuantity(isNaN(value) ? 0 : value);
    setValidationError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 驗證顆數
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

    // 傳送 positionQuantity 和 simulatedCapital 給後端
    await onConfirm({
      simulatedCapital: quantity * avgPrice,
      positionQuantity: quantity,
      autoStopOnExpire,
    });
  };

  const handleClose = () => {
    if (!isLoading) {
      setQuantity(0);
      setAutoStopOnExpire(true);
      setValidationError(null);
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
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl z-50 w-full max-w-md p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              開始追蹤
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
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">交易對</span>
                <p className="font-medium">{rate.symbol}</p>
              </div>
              <div>
                <span className="text-gray-500">年化收益</span>
                <p className="font-medium text-green-600">
                  {Number(rate.bestPair.annualizedReturn).toFixed(2)}%
                </p>
              </div>
              <div>
                <span className="text-gray-500">做多</span>
                <p className="font-medium capitalize">{rate.bestPair.longExchange}</p>
              </div>
              <div>
                <span className="text-gray-500">做空</span>
                <p className="font-medium capitalize">{rate.bestPair.shortExchange}</p>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
              <p className="mt-1 text-xs text-gray-500">
                多空雙方將使用相同顆數進行套利
              </p>

              {/* 價格和資金顯示 */}
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-blue-600">做多價格：</span>
                    <span className="font-mono text-blue-800">
                      ${longPrice?.toFixed(4) || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-600">做空價格：</span>
                    <span className="font-mono text-blue-800">
                      ${shortPrice?.toFixed(4) || '-'}
                    </span>
                  </div>
                </div>
                <div className="mt-1 pt-1 border-t border-blue-200">
                  <span className="text-blue-600">預估總資金：</span>
                  <span className="font-mono font-medium text-blue-800">
                    ${simulatedCapital.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} USDT
                  </span>
                </div>
              </div>
            </div>

            {/* Estimated Profit Per Settlement */}
            <div className="bg-green-50 rounded-lg p-3 mb-4">
              <p className="text-sm text-green-800">
                <span className="font-medium">預估每次結算收益：</span>
                <span className="float-right font-mono">
                  {(simulatedCapital * (Number(rate.bestPair.spreadPercent) / 100)).toFixed(2)} USDT
                </span>
              </p>
              <p className="text-xs text-green-600 mt-1">
                基於當前費率差 {Number(rate.bestPair.spreadPercent).toFixed(4)}%
              </p>
            </div>

            {/* Auto Stop Option */}
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoStopOnExpire}
                  onChange={(e) => setAutoStopOnExpire(e.target.checked)}
                  disabled={isLoading}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  當年化收益低於 800% 時自動停止
                </span>
              </label>
              <p className="mt-1 ml-6 text-xs text-gray-500">
                啟用後，當機會消失或收益過低時會自動標記為過期
              </p>
            </div>

            {/* Error Messages */}
            {(validationError || error) && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-red-700">
                  <p>{validationError || error}</p>
                  {error?.includes('登入') && (
                    <p className="mt-1 text-xs">
                      請前往右上角登入後再使用追蹤功能
                    </p>
                  )}
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
                disabled={isLoading || !avgPrice}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    處理中...
                  </>
                ) : (
                  <>
                    <Target className="w-4 h-4" />
                    開始追蹤
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
