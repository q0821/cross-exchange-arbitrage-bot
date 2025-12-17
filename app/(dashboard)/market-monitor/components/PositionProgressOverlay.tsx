/**
 * PositionProgressOverlay - 開倉進度覆蓋層
 * 顯示開倉過程中的進度狀態
 *
 * Feature 033: Manual Open Position (T016)
 */

'use client';

import React from 'react';
import {
  CheckCircle,
  XCircle,
  Loader2,
  ArrowUpCircle,
  ArrowDownCircle,
  AlertTriangle,
} from 'lucide-react';

type ProgressStep =
  | 'validating'
  | 'executing_long'
  | 'executing_short'
  | 'completing'
  | 'rolling_back';

interface PositionProgressOverlayProps {
  isOpen: boolean;
  currentStep: ProgressStep;
  progress: number;
  message: string;
  longExchange?: string;
  shortExchange?: string;
  /** 成功回調 */
  onSuccess?: () => void;
  /** 失敗回調 */
  onFailure?: (error: string) => void;
  /** 關閉回調 */
  onClose?: () => void;
  /** 是否成功 */
  isSuccess?: boolean;
  /** 是否失敗 */
  isFailed?: boolean;
  /** 錯誤訊息 */
  errorMessage?: string;
  /** 是否需要手動處理 */
  requiresManualIntervention?: boolean;
}

const STEP_CONFIG: Record<ProgressStep, { label: string; icon: React.ElementType }> = {
  validating: { label: '驗證餘額', icon: Loader2 },
  executing_long: { label: '執行做多', icon: ArrowUpCircle },
  executing_short: { label: '執行做空', icon: ArrowDownCircle },
  completing: { label: '完成開倉', icon: CheckCircle },
  rolling_back: { label: '執行回滾', icon: AlertTriangle },
};

const STEPS: ProgressStep[] = ['validating', 'executing_long', 'executing_short', 'completing'];

export function PositionProgressOverlay({
  isOpen,
  currentStep,
  progress,
  message,
  longExchange,
  shortExchange,
  onClose,
  isSuccess,
  isFailed,
  errorMessage,
  requiresManualIntervention,
}: PositionProgressOverlayProps) {
  if (!isOpen) return null;

  const currentStepIndex = STEPS.indexOf(currentStep);

  const getStepStatus = (step: ProgressStep) => {
    const stepIndex = STEPS.indexOf(step);

    if (currentStep === 'rolling_back') {
      return stepIndex < 2 ? 'failed' : 'pending';
    }

    if (isSuccess) {
      return 'completed';
    }

    if (isFailed) {
      return stepIndex <= currentStepIndex ? 'failed' : 'pending';
    }

    if (stepIndex < currentStepIndex) {
      return 'completed';
    }

    if (stepIndex === currentStepIndex) {
      return 'current';
    }

    return 'pending';
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        {/* Header */}
        <div className="text-center mb-6">
          {isSuccess ? (
            <>
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <h2 className="text-lg font-semibold text-green-700">開倉成功</h2>
            </>
          ) : isFailed ? (
            <>
              {requiresManualIntervention ? (
                <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto mb-2" />
              ) : (
                <XCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
              )}
              <h2 className="text-lg font-semibold text-red-700">
                {requiresManualIntervention ? '需要手動處理' : '開倉失敗'}
              </h2>
            </>
          ) : (
            <>
              <Loader2 className="w-12 h-12 text-blue-500 mx-auto mb-2 animate-spin" />
              <h2 className="text-lg font-semibold text-gray-800">開倉中</h2>
            </>
          )}
          <p className="text-sm text-gray-600 mt-1">{message}</p>
        </div>

        {/* Progress Bar */}
        {!isSuccess && !isFailed && (
          <div className="mb-6">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 text-center mt-1">{progress}%</p>
          </div>
        )}

        {/* Steps */}
        <div className="space-y-3">
          {STEPS.map((step) => {
            const config = STEP_CONFIG[step];
            const status = getStepStatus(step);

            // 動態顯示交易所名稱
            let label = config.label;
            if (step === 'executing_long' && longExchange) {
              label = `執行做多 (${longExchange})`;
            } else if (step === 'executing_short' && shortExchange) {
              label = `執行做空 (${shortExchange})`;
            }

            return (
              <div
                key={step}
                className={`flex items-center gap-3 p-2 rounded-md ${
                  status === 'current'
                    ? 'bg-blue-50'
                    : status === 'completed'
                    ? 'bg-green-50'
                    : status === 'failed'
                    ? 'bg-red-50'
                    : 'bg-gray-50'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    status === 'current'
                      ? 'bg-blue-500'
                      : status === 'completed'
                      ? 'bg-green-500'
                      : status === 'failed'
                      ? 'bg-red-500'
                      : 'bg-gray-300'
                  }`}
                >
                  {status === 'current' ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  ) : status === 'completed' ? (
                    <CheckCircle className="w-4 h-4 text-white" />
                  ) : status === 'failed' ? (
                    <XCircle className="w-4 h-4 text-white" />
                  ) : (
                    <span className="w-2 h-2 bg-gray-400 rounded-full" />
                  )}
                </div>
                <span
                  className={`text-sm ${
                    status === 'current'
                      ? 'text-blue-700 font-medium'
                      : status === 'completed'
                      ? 'text-green-700'
                      : status === 'failed'
                      ? 'text-red-700'
                      : 'text-gray-500'
                  }`}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Rolling Back Step (only shown when rolling back) */}
        {currentStep === 'rolling_back' && (
          <div className="mt-3 p-2 rounded-md bg-orange-50">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full flex items-center justify-center bg-orange-500">
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              </div>
              <span className="text-sm text-orange-700 font-medium">執行回滾...</span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {isFailed && errorMessage && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{errorMessage}</p>
          </div>
        )}

        {/* Manual Intervention Warning */}
        {requiresManualIntervention && (
          <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm text-orange-700 font-medium">
              ⚠️ 自動回滾失敗，請手動處理已開倉的部分。
            </p>
            <p className="text-xs text-orange-600 mt-1">
              請前往交易所確認並手動平倉。
            </p>
          </div>
        )}

        {/* Close Button */}
        {(isSuccess || isFailed) && onClose && (
          <div className="mt-6 text-center">
            <button
              onClick={onClose}
              className={`px-6 py-2 rounded-md text-sm font-medium ${
                isSuccess
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-600 hover:bg-gray-700 text-white'
              }`}
            >
              {isSuccess ? '完成' : '關閉'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
