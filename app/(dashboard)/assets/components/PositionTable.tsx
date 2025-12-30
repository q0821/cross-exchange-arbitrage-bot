/**
 * PositionTable - 持倉列表表格
 * 顯示各交易所的當前持倉資訊
 *
 * Feature 031: Asset Tracking History (T036)
 */

'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react';

type ExchangeName = 'binance' | 'okx' | 'mexc' | 'gateio' | 'bingx';
type ConnectionStatus = 'success' | 'no_api_key' | 'api_error' | 'rate_limited';

/**
 * 單一持倉資料
 */
interface Position {
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  entryPrice: number;
  markPrice: number;
  leverage: number;
  marginUsed: number;
  unrealizedPnl: number;
  liquidationPrice?: number;
}

/**
 * 交易所持倉資料
 */
interface ExchangePositions {
  exchange: ExchangeName;
  status: ConnectionStatus;
  positions: Position[];
  totalPnl: number;
  errorMessage?: string;
}

interface PositionTableProps {
  exchanges: ExchangePositions[];
  totalUnrealizedPnl: number;
  isLoading?: boolean;
}

// 交易所顯示名稱
const exchangeDisplayNames: Record<ExchangeName, string> = {
  binance: 'Binance',
  okx: 'OKX',
  mexc: 'MEXC',
  gateio: 'Gate.io',
  bingx: 'BingX',
};

// 格式化金額
const formatUSD = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

// 格式化數量
const formatQuantity = (value: number) => {
  if (value >= 1) {
    return value.toFixed(4);
  }
  return value.toFixed(6);
};

export function PositionTable({
  exchanges,
  totalUnrealizedPnl,
  isLoading,
}: PositionTableProps) {
  const [expandedExchanges, setExpandedExchanges] = useState<Set<string>>(
    new Set(['binance', 'okx', 'mexc', 'gateio', 'bingx'])
  );

  // 切換展開/收合
  const toggleExchange = (exchange: string) => {
    const newExpanded = new Set(expandedExchanges);
    if (newExpanded.has(exchange)) {
      newExpanded.delete(exchange);
    } else {
      newExpanded.add(exchange);
    }
    setExpandedExchanges(newExpanded);
  };

  // 統計總持倉數量
  const totalPositions = exchanges.reduce(
    (sum, ex) => sum + ex.positions.length,
    0
  );

  // Loading 狀態
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  // 無持倉狀態
  if (totalPositions === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
        <p>目前無持倉</p>
        <p className="text-sm mt-1">開倉後會在此顯示持倉資訊</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 總未實現損益摘要 */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/50 rounded-lg">
        <span className="text-muted-foreground">總未實現損益</span>
        <div className="flex items-center gap-2">
          {totalUnrealizedPnl > 0 ? (
            <TrendingUp className="w-4 h-4 text-profit" />
          ) : totalUnrealizedPnl < 0 ? (
            <TrendingDown className="w-4 h-4 text-loss" />
          ) : null}
          <span
            className={`font-semibold ${
              totalUnrealizedPnl > 0
                ? 'text-profit'
                : totalUnrealizedPnl < 0
                  ? 'text-loss'
                  : 'text-foreground'
            }`}
          >
            {formatUSD(totalUnrealizedPnl)}
          </span>
        </div>
      </div>

      {/* 各交易所持倉 */}
      {exchanges.map((exchange) => {
        const isExpanded = expandedExchanges.has(exchange.exchange);
        const hasPositions = exchange.positions.length > 0;

        return (
          <div
            key={exchange.exchange}
            className="border border-border rounded-lg overflow-hidden"
          >
            {/* 交易所標題 */}
            <button
              onClick={() => toggleExchange(exchange.exchange)}
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-foreground">
                  {exchangeDisplayNames[exchange.exchange]}
                </span>
                <span className="text-muted-foreground text-sm">
                  ({exchange.positions.length} 個持倉)
                </span>
              </div>
              <div className="flex items-center gap-3">
                {hasPositions && (
                  <span
                    className={`text-sm ${
                      exchange.totalPnl > 0
                        ? 'text-profit'
                        : exchange.totalPnl < 0
                          ? 'text-loss'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {formatUSD(exchange.totalPnl)}
                  </span>
                )}
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </button>

            {/* 持倉列表 */}
            {isExpanded && hasPositions && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr className="text-muted-foreground">
                      <th className="px-4 py-2 text-left">交易對</th>
                      <th className="px-4 py-2 text-left">方向</th>
                      <th className="px-4 py-2 text-right">數量</th>
                      <th className="px-4 py-2 text-right">開倉價</th>
                      <th className="px-4 py-2 text-right">標記價</th>
                      <th className="px-4 py-2 text-right">槓桿</th>
                      <th className="px-4 py-2 text-right">未實現損益</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {exchange.positions.map((position, index) => (
                      <tr key={`${position.symbol}-${index}`} className="hover:bg-muted/20">
                        <td className="px-4 py-2 text-foreground font-medium">
                          {position.symbol}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              position.side === 'LONG'
                                ? 'bg-profit/20 text-profit'
                                : 'bg-loss/20 text-loss'
                            }`}
                          >
                            {position.side === 'LONG' ? '做多' : '做空'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right text-muted-foreground">
                          {formatQuantity(position.quantity)}
                        </td>
                        <td className="px-4 py-2 text-right text-muted-foreground">
                          {formatUSD(position.entryPrice)}
                        </td>
                        <td className="px-4 py-2 text-right text-muted-foreground">
                          {formatUSD(position.markPrice)}
                        </td>
                        <td className="px-4 py-2 text-right text-muted-foreground">
                          {position.leverage}x
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-medium ${
                            position.unrealizedPnl > 0
                              ? 'text-profit'
                              : position.unrealizedPnl < 0
                                ? 'text-loss'
                                : 'text-muted-foreground'
                          }`}
                        >
                          {formatUSD(position.unrealizedPnl)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 無持倉或狀態異常 */}
            {isExpanded && !hasPositions && (
              <div className="px-4 py-3 text-muted-foreground text-sm">
                {exchange.status === 'no_api_key'
                  ? '未設定 API Key'
                  : exchange.status === 'api_error'
                    ? `API 錯誤: ${exchange.errorMessage || '未知錯誤'}`
                    : exchange.status === 'rate_limited'
                      ? '請求受限，請稍後再試'
                      : '目前無持倉'}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
