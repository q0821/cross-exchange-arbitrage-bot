/**
 * SymbolDetailDialog - 交易對詳情對話框
 * 顯示交易對的詳細資訊，包括各交易所費率、價格和套利組合
 */

'use client';

import * as Dialog from '@radix-ui/react-dialog';
import {
  X,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Zap,
  Clock,
} from 'lucide-react';
import type { MarketRate, ExchangeName, TimeBasis } from '../types';

interface SymbolDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  rate: MarketRate | null;
  timeBasis: TimeBasis;
  onQuickOpen?: (rate: MarketRate) => void;
  onStartTracking?: (rate: MarketRate) => void;
  isTracking?: boolean;
}

const EXCHANGE_DISPLAY_NAMES: Record<ExchangeName, string> = {
  binance: 'Binance',
  okx: 'OKX',
  mexc: 'MEXC',
  gateio: 'Gate.io',
  bingx: 'BingX',
};

const TIME_BASIS_LABELS: Record<TimeBasis, string> = {
  1: '1h',
  4: '4h',
  8: '8h',
  24: '24h',
};

function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null) return '-';
  const formatted = (value * 100).toFixed(4);
  return `${value >= 0 ? '+' : ''}${formatted}%`;
}

function formatPrice(value: number | undefined | null): string {
  if (value === undefined || value === null) return '-';
  if (value >= 1000) return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (value >= 1) return value.toFixed(4);
  return value.toFixed(6);
}

export function SymbolDetailDialog({
  isOpen,
  onClose,
  rate,
  timeBasis,
  onQuickOpen,
  onStartTracking,
  isTracking,
}: SymbolDetailDialogProps) {
  if (!rate) return null;

  const { symbol, exchanges, bestPair, status } = rate;
  const timeBasisKey = `${timeBasis}h` as '1h' | '4h' | '8h' | '24h';

  // 取得各交易所的資料，並計算正規化費率
  const exchangeEntries = Object.entries(exchanges) as [ExchangeName, typeof exchanges[string]][];

  // 狀態標籤
  const statusConfig = {
    opportunity: { label: '套利機會', className: 'bg-profit/20 text-profit' },
    approaching: { label: '接近機會', className: 'bg-warning/20 text-warning' },
    normal: { label: '正常', className: 'bg-muted text-muted-foreground' },
  };
  const statusInfo = statusConfig[status];

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[90vh] overflow-y-auto bg-card border border-border rounded-xl shadow-xl z-50">
          {/* Header */}
          <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Dialog.Title className="text-xl font-semibold text-foreground">
                {symbol}
              </Dialog.Title>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusInfo.className}`}>
                {statusInfo.label}
              </span>
            </div>
            <Dialog.Close asChild>
              <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="p-6 space-y-6">
            {/* 最佳套利組合 */}
            {bestPair && (
              <div className="bg-profit/5 border border-profit/20 rounded-lg p-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-profit" />
                  最佳套利組合
                </h3>
                <div className="flex items-center justify-center gap-4 mb-4">
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-profit">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-sm">做多</span>
                    </div>
                    <div className="font-semibold text-foreground">
                      {EXCHANGE_DISPLAY_NAMES[bestPair.longExchange]}
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-loss">
                      <TrendingDown className="w-4 h-4" />
                      <span className="text-sm">做空</span>
                    </div>
                    <div className="font-semibold text-foreground">
                      {EXCHANGE_DISPLAY_NAMES[bestPair.shortExchange]}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-background/50 rounded-lg p-3">
                    <div className="text-muted-foreground">費率價差</div>
                    <div className="font-semibold text-profit">
                      {formatPercent(bestPair.spreadPercent / 100)}
                    </div>
                  </div>
                  <div className="bg-background/50 rounded-lg p-3">
                    <div className="text-muted-foreground">年化報酬</div>
                    <div className="font-semibold text-profit">
                      {bestPair.annualizedReturn.toFixed(2)}%
                    </div>
                  </div>
                  {bestPair.priceDiffPercent !== null && (
                    <div className="bg-background/50 rounded-lg p-3 col-span-2">
                      <div className="text-muted-foreground">價差比例</div>
                      <div className={`font-semibold ${Math.abs(bestPair.priceDiffPercent) > 0.5 ? 'text-warning' : 'text-foreground'}`}>
                        {bestPair.priceDiffPercent.toFixed(4)}%
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 各交易所費率詳情 */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                各交易所費率 ({TIME_BASIS_LABELS[timeBasis]} 基準)
              </h3>
              <div className="space-y-2">
                {exchangeEntries.map(([exchange, data]) => {
                  const normalizedRate = data.normalized?.[timeBasisKey] ?? data.rate;
                  const isPositive = normalizedRate >= 0;

                  return (
                    <div
                      key={exchange}
                      className="flex items-center justify-between bg-muted/30 rounded-lg px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-foreground">
                          {EXCHANGE_DISPLAY_NAMES[exchange]}
                        </span>
                        {data.originalInterval && (
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            原始 {data.originalInterval}h
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className={`font-mono font-semibold ${isPositive ? 'text-profit' : 'text-loss'}`}>
                          {formatPercent(normalizedRate)}
                        </div>
                        {data.price && (
                          <div className="text-xs text-muted-foreground">
                            ${formatPrice(data.price)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 操作按鈕 */}
            <div className="flex gap-3 pt-2">
              {onStartTracking && (
                <button
                  onClick={() => {
                    onStartTracking(rate);
                    onClose();
                  }}
                  disabled={isTracking}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-primary text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isTracking ? '追蹤中' : '模擬追蹤'}
                </button>
              )}
              {onQuickOpen && (
                <button
                  onClick={() => {
                    onQuickOpen(rate);
                    onClose();
                  }}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  開倉
                </button>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
