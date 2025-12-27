/**
 * PositionDetailsPanel - 持倉詳情面板組件
 *
 * 顯示持倉的詳細資訊：價格、損益、資金費率、年化報酬率等
 * Feature: 045-position-details-view
 */

'use client';

import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  AlertCircle,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import type { PositionDetailsInfo } from '@/src/types/trading';
import { FundingFeeBreakdown } from './FundingFeeBreakdown';
import { AnnualizedReturnDisplay } from './AnnualizedReturnDisplay';

interface PositionDetailsPanelProps {
  details: PositionDetailsInfo | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

/**
 * 格式化數字顯示
 */
function formatNumber(value: number | string | undefined, decimals: number = 2): string {
  if (value === undefined || value === null) return 'N/A';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'N/A';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * 格式化價格（自動決定小數位數）
 */
function formatPrice(value: number | string | undefined): string {
  if (value === undefined || value === null) return 'N/A';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'N/A';

  // 根據價格大小決定小數位數
  if (num >= 1000) return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (num >= 1) return num.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  return num.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 8 });
}

/**
 * 格式化損益顯示（含顏色）
 */
function PnLDisplay({ value, label }: { value: number | undefined; label: string }) {
  if (value === undefined) {
    return (
      <div className="text-sm">
        <span className="text-muted-foreground">{label}:</span>{' '}
        <span className="text-muted-foreground">N/A</span>
      </div>
    );
  }

  const isPositive = value >= 0;
  const colorClass = isPositive ? 'text-profit' : 'text-loss';
  const prefix = isPositive ? '+' : '';

  return (
    <div className="text-sm">
      <span className="text-muted-foreground">{label}:</span>{' '}
      <span className={`font-medium ${colorClass}`}>
        {prefix}${formatNumber(value, 4)}
      </span>
    </div>
  );
}

export function PositionDetailsPanel({
  details,
  isLoading,
  error,
  onRetry,
}: PositionDetailsPanelProps) {
  // 載入中狀態
  if (isLoading) {
    return (
      <div className="mt-4 p-4 bg-muted rounded-lg border border-border">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>載入中...</span>
        </div>
      </div>
    );
  }

  // 錯誤狀態
  if (error) {
    return (
      <div className="mt-4 p-4 bg-loss/10 rounded-lg border border-loss/30">
        <div className="flex items-center gap-2 text-loss">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
        <button
          onClick={onRetry}
          className="mt-2 flex items-center gap-1 text-sm text-loss hover:text-loss/80"
        >
          <RefreshCw className="w-3 h-3" />
          重試
        </button>
      </div>
    );
  }

  // 無資料狀態
  if (!details) {
    return null;
  }

  return (
    <div className="mt-4 p-4 bg-muted rounded-lg border border-border space-y-4">
      {/* 價格資訊區塊 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 多頭資訊 */}
        <div className="space-y-2">
          <div className="flex items-center gap-1 text-profit font-medium text-sm">
            <TrendingUp className="w-4 h-4" />
            <span>多頭 ({details.longExchange})</span>
          </div>
          <div className="text-xs space-y-1">
            <div>
              <span className="text-muted-foreground">開倉價格:</span>{' '}
              <span className="font-medium">${formatPrice(details.longEntryPrice)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">現在價格:</span>{' '}
              <span className="font-medium">
                {details.priceQuerySuccess
                  ? `$${formatPrice(details.longCurrentPrice)}`
                  : <span className="text-loss">查詢失敗</span>
                }
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">持倉數量:</span>{' '}
              <span className="font-medium">{formatNumber(details.longPositionSize, 6)}</span>
            </div>
          </div>
        </div>

        {/* 空頭資訊 */}
        <div className="space-y-2">
          <div className="flex items-center gap-1 text-loss font-medium text-sm">
            <TrendingDown className="w-4 h-4" />
            <span>空頭 ({details.shortExchange})</span>
          </div>
          <div className="text-xs space-y-1">
            <div>
              <span className="text-muted-foreground">開倉價格:</span>{' '}
              <span className="font-medium">${formatPrice(details.shortEntryPrice)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">現在價格:</span>{' '}
              <span className="font-medium">
                {details.priceQuerySuccess
                  ? `$${formatPrice(details.shortCurrentPrice)}`
                  : <span className="text-loss">查詢失敗</span>
                }
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">持倉數量:</span>{' '}
              <span className="font-medium">{formatNumber(details.shortPositionSize, 6)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 價格查詢錯誤提示 */}
      {!details.priceQuerySuccess && details.priceQueryError && (
        <div className="p-2 bg-warning/10 border border-warning/30 rounded text-xs text-warning">
          ⚠️ {details.priceQueryError}
        </div>
      )}

      {/* 未實現損益 */}
      <div className="pt-3 border-t border-border">
        <div className="flex items-center gap-1 text-foreground font-medium text-sm mb-2">
          <DollarSign className="w-4 h-4" />
          <span>未實現損益</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <PnLDisplay value={details.longUnrealizedPnL} label="多頭" />
          <PnLDisplay value={details.shortUnrealizedPnL} label="空頭" />
          <PnLDisplay value={details.totalUnrealizedPnL} label="總計" />
        </div>
      </div>

      {/* 資金費率明細 */}
      {details.fundingFees && (
        <FundingFeeBreakdown
          fundingFees={details.fundingFees}
          querySuccess={details.fundingFeeQuerySuccess}
          queryError={details.fundingFeeQueryError}
        />
      )}

      {/* 資金費率查詢失敗提示 */}
      {!details.fundingFeeQuerySuccess && details.fundingFeeQueryError && (
        <div className="p-2 bg-warning/10 border border-warning/30 rounded text-xs text-warning">
          ⚠️ {details.fundingFeeQueryError}
        </div>
      )}

      {/* 手續費資訊 */}
      {details.fees && (
        <div className="pt-3 border-t border-border">
          <div className="flex items-center gap-1 text-foreground font-medium text-sm mb-2">
            <DollarSign className="w-4 h-4" />
            <span>手續費</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">多頭:</span>{' '}
              <span className="font-medium">
                {details.fees.longOpenFee ? `$${formatNumber(details.fees.longOpenFee, 4)}` : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">空頭:</span>{' '}
              <span className="font-medium">
                {details.fees.shortOpenFee ? `$${formatNumber(details.fees.shortOpenFee, 4)}` : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">總計:</span>{' '}
              <span className="font-medium text-warning">
                {details.fees.totalFees ? `-$${formatNumber(details.fees.totalFees, 4)}` : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 年化報酬率 */}
      <AnnualizedReturnDisplay
        annualizedReturn={details.annualizedReturn}
        error={details.annualizedReturnError}
      />

      {/* 持倉時間資訊 */}
      <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>開倉時間: {new Date(details.openedAt).toLocaleString()}</span>
        </div>
        <div>
          槓桿: {details.leverage}x
        </div>
      </div>

      {/* 查詢時間 */}
      <div className="text-right text-xs text-muted-foreground">
        查詢時間: {new Date(details.queriedAt).toLocaleTimeString()}
      </div>
    </div>
  );
}
