/**
 * StartTrackingDialog - 開始追蹤對話框
 * 讓用戶輸入模擬資金並設定自動停止選項
 *
 * Feature 029: Simulated APY Tracking (T014)
 */

'use client';

import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Target, AlertCircle, Loader2 } from 'lucide-react';
import type { MarketRate } from '../types';

interface StartTrackingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  rate: MarketRate | null;
  onConfirm: (data: {
    simulatedCapital: number;
    autoStopOnExpire: boolean;
  }) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const MIN_CAPITAL = 100;
const MAX_CAPITAL = 1000000;
const DEFAULT_CAPITAL = 10000;

export function StartTrackingDialog({
  isOpen,
  onClose,
  rate,
  onConfirm,
  isLoading,
  error,
}: StartTrackingDialogProps) {
  const [simulatedCapital, setSimulatedCapital] = useState<number>(DEFAULT_CAPITAL);
  const [autoStopOnExpire, setAutoStopOnExpire] = useState<boolean>(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleCapitalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setSimulatedCapital(isNaN(value) ? 0 : value);
    setValidationError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 驗證資金金額
    if (simulatedCapital < MIN_CAPITAL) {
      setValidationError(`最低模擬資金為 ${MIN_CAPITAL} USDT`);
      return;
    }

    if (simulatedCapital > MAX_CAPITAL) {
      setValidationError(`最高模擬資金為 ${MAX_CAPITAL.toLocaleString()} USDT`);
      return;
    }

    await onConfirm({
      simulatedCapital,
      autoStopOnExpire,
    });
  };

  const handleClose = () => {
    if (!isLoading) {
      setSimulatedCapital(DEFAULT_CAPITAL);
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
                  {rate.bestPair.annualizedReturn.toFixed(2)}%
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
            {/* Simulated Capital Input */}
            <div className="mb-4">
              <label
                htmlFor="simulatedCapital"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                模擬資金 (USDT)
              </label>
              <input
                type="number"
                id="simulatedCapital"
                value={simulatedCapital}
                onChange={handleCapitalChange}
                min={MIN_CAPITAL}
                max={MAX_CAPITAL}
                step={100}
                disabled={isLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
              <p className="mt-1 text-xs text-gray-500">
                範圍：{MIN_CAPITAL} - {MAX_CAPITAL.toLocaleString()} USDT
              </p>
            </div>

            {/* Estimated Profit Per Settlement */}
            <div className="bg-blue-50 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-800">
                <span className="font-medium">預估每次結算收益：</span>
                <span className="float-right font-mono">
                  {(simulatedCapital * (rate.bestPair.spreadPercent / 100)).toFixed(2)} USDT
                </span>
              </p>
              <p className="text-xs text-blue-600 mt-1">
                基於當前費率差 {rate.bestPair.spreadPercent.toFixed(4)}%
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
                <p className="text-sm text-red-700">{validationError || error}</p>
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
                disabled={isLoading}
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
