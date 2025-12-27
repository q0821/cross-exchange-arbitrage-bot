/**
 * CloseProgressOverlay - 平倉進度覆蓋層
 *
 * 即時顯示平倉操作的進度
 * Feature: 035-close-position (T023)
 */

'use client';

import React from 'react';
import { Loader2, CheckCircle, TrendingUp, TrendingDown, Calculator, BadgeCheck } from 'lucide-react';
import type { ClosePositionStep } from '@/src/types/trading';

interface CloseProgressOverlayProps {
  positionId: string;
  symbol: string;
  step: ClosePositionStep;
  progress: number;
  message: string;
  exchange?: string;
}

/**
 * 進度步驟配置
 */
const STEP_CONFIG: Record<
  ClosePositionStep,
  {
    icon: React.ElementType;
    label: string;
    color: string;
  }
> = {
  validating: {
    icon: Loader2,
    label: '驗證中',
    color: 'text-primary',
  },
  closing_long: {
    icon: TrendingUp,
    label: '平倉多頭',
    color: 'text-profit',
  },
  closing_short: {
    icon: TrendingDown,
    label: '平倉空頭',
    color: 'text-loss',
  },
  calculating_pnl: {
    icon: Calculator,
    label: '計算損益',
    color: 'text-purple-500',
  },
  completing: {
    icon: BadgeCheck,
    label: '完成',
    color: 'text-profit',
  },
};

/**
 * 進度步驟列表（用於進度指示器）
 */
const STEPS: ClosePositionStep[] = [
  'validating',
  'closing_long',
  'closing_short',
  'calculating_pnl',
  'completing',
];

export function CloseProgressOverlay({
  symbol,
  step,
  progress,
  message,
  exchange,
}: CloseProgressOverlayProps) {
  const config = STEP_CONFIG[step] || STEP_CONFIG.validating;
  const StepIcon = config.icon;
  const isAnimated = step !== 'completing';
  const currentStepIndex = STEPS.indexOf(step);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Progress Card */}
      <div className="relative bg-card rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Progress Bar */}
        <div className="h-1 bg-border">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Header */}
        <div className="px-6 pt-4 pb-2">
          <h2 className="text-lg font-semibold text-foreground">平倉進度</h2>
          <p className="text-sm text-muted-foreground">{symbol}</p>
        </div>

        {/* Current Step */}
        <div className="px-6 py-6 flex flex-col items-center">
          <div className={`p-4 rounded-full bg-muted ${config.color}`}>
            <StepIcon className={`w-12 h-12 ${isAnimated ? 'animate-spin' : ''}`} />
          </div>
          <p className="mt-4 text-lg font-medium text-foreground">{message}</p>
          {exchange && (
            <p className="text-sm text-muted-foreground capitalize">交易所: {exchange}</p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">{progress}%</p>
        </div>

        {/* Step Indicators */}
        <div className="px-6 pb-6">
          <div className="flex items-center justify-between">
            {STEPS.map((s, index) => {
              const isCompleted = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;
              const stepConfig = STEP_CONFIG[s];
              const Icon = stepConfig.icon;

              return (
                <div key={s} className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isCompleted
                        ? 'bg-profit/10'
                        : isCurrent
                          ? 'bg-primary/10'
                          : 'bg-muted'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5 text-profit" />
                    ) : (
                      <Icon
                        className={`w-4 h-4 ${
                          isCurrent ? stepConfig.color : 'text-muted-foreground'
                        } ${isCurrent && isAnimated ? 'animate-pulse' : ''}`}
                      />
                    )}
                  </div>
                  <span
                    className={`mt-1 text-xs ${
                      isCurrent ? 'text-foreground font-medium' : 'text-muted-foreground'
                    }`}
                  >
                    {stepConfig.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CloseProgressOverlay;
