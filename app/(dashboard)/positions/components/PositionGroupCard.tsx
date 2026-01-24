/**
 * PositionGroupCard - 組合持倉卡片組件
 * 顯示分單開倉後合併的組合持倉資訊
 *
 * Feature 069: 分單持倉合併顯示與批量平倉
 */

'use client';

import { useState, useCallback } from 'react';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  ChevronDown,
  ChevronUp,
  Layers,
  Clock,
  Shield,
  Target,
  XCircle,
  Eye,
  Loader2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import type { PositionGroup } from '@/hooks/queries/usePositionsQuery';
import { useGroupPositionDetails } from '../hooks/useGroupPositionDetails';

interface PositionGroupCardProps {
  group: PositionGroup;
  onBatchClose?: (groupId: string) => void;
  isBatchClosing?: boolean;
  onExpandPosition?: (positionId: string) => void;
}

/**
 * 格式化交易所名稱
 */
function formatExchange(exchange: string): string {
  const exchangeMap: Record<string, string> = {
    binance: 'Binance',
    okx: 'OKX',
    gateio: 'Gate.io',
    mexc: 'MEXC',
    bingx: 'BingX',
  };
  return exchangeMap[exchange] || exchange;
}

/**
 * 格式化數字
 */
function formatNumber(value: string | null, decimals = 2): string {
  if (value === null) return '-';
  const num = parseFloat(value);
  if (isNaN(num)) return '-';
  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * 格式化價格
 */
function formatPrice(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return '-';
  if (num >= 1000) {
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 8,
  });
}

/**
 * 計算相對時間
 */
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return `${diffMins} 分鐘前`;
  } else if (diffHours < 24) {
    return `${diffHours} 小時前`;
  } else {
    return `${diffDays} 天前`;
  }
}

export function PositionGroupCard({
  group,
  onBatchClose,
  isBatchClosing = false,
  onExpandPosition,
}: PositionGroupCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Feature 069: Fetch aggregated details for all positions in the group
  const {
    details: groupDetails,
    isLoading: isLoadingDetails,
    error: detailsError,
    refetch: refetchDetails,
  } = useGroupPositionDetails({
    group,
    enabled: showDetails,
  });

  const handleToggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handleToggleDetails = useCallback(() => {
    setShowDetails((prev) => !prev);
  }, []);

  const handleBatchClose = useCallback(() => {
    if (onBatchClose) {
      onBatchClose(group.groupId);
    }
  }, [onBatchClose, group.groupId]);

  const { aggregate, positions } = group;
  const firstOpenedAt = aggregate.firstOpenedAt
    ? new Date(aggregate.firstOpenedAt)
    : null;
  const timeAgo = firstOpenedAt ? getTimeAgo(firstOpenedAt) : '-';

  // 檢查是否有停損停利設定
  const hasStopLoss = aggregate.stopLossPercent !== null;
  const hasTakeProfit = aggregate.takeProfitPercent !== null;

  // 計算總損益顯示
  const totalPnL = aggregate.totalFundingPnL
    ? parseFloat(aggregate.totalFundingPnL)
    : null;
  const pnlColor =
    totalPnL === null
      ? 'text-muted-foreground'
      : totalPnL >= 0
        ? 'text-profit'
        : 'text-loss';
  const pnlSign = totalPnL !== null && totalPnL >= 0 ? '+' : '';

  return (
    <div className="glass-card border border-border shadow-xs hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">
              {group.symbol}
            </h3>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
              {aggregate.positionCount} 組
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* 停損停利指示 */}
            {hasStopLoss && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-loss/10 text-loss">
                <Shield className="w-3 h-3" />
                {aggregate.stopLossPercent}%
              </span>
            )}
            {hasTakeProfit && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-profit/10 text-profit">
                <Target className="w-3 h-3" />
                {aggregate.takeProfitPercent}%
              </span>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          <Clock className="w-3 h-3 inline mr-1" />
          {timeAgo}
          {firstOpenedAt && ` · ${firstOpenedAt.toLocaleString()}`}
        </p>
      </div>

      {/* Body - 聚合資訊 */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4">
          {/* 做多側 */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-profit">
              <ArrowUpCircle className="w-4 h-4" />
              <span className="text-sm font-medium">做多</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatExchange(group.longExchange)}
            </p>
            <p className="text-sm font-mono">
              均價: ${formatPrice(aggregate.avgLongEntryPrice)}
            </p>
          </div>

          {/* 做空側 */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-loss">
              <ArrowDownCircle className="w-4 h-4" />
              <span className="text-sm font-medium">做空</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatExchange(group.shortExchange)}
            </p>
            <p className="text-sm font-mono">
              均價: ${formatPrice(aggregate.avgShortEntryPrice)}
            </p>
          </div>
        </div>

        {/* 統計資訊 */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">總數量</p>
              <p className="text-sm font-semibold">
                {formatNumber(aggregate.totalQuantity, 4)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">資金費率收益</p>
              <p className={`text-sm font-semibold ${pnlColor}`}>
                {totalPnL !== null
                  ? `${pnlSign}$${formatNumber(aggregate.totalFundingPnL)}`
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">未實現損益</p>
              <p
                className={`text-sm font-semibold ${
                  aggregate.totalUnrealizedPnL !== null
                    ? parseFloat(aggregate.totalUnrealizedPnL) >= 0
                      ? 'text-profit'
                      : 'text-loss'
                    : 'text-muted-foreground'
                }`}
              >
                {aggregate.totalUnrealizedPnL !== null
                  ? `${parseFloat(aggregate.totalUnrealizedPnL) >= 0 ? '+' : ''}$${formatNumber(aggregate.totalUnrealizedPnL)}`
                  : '-'}
              </p>
            </div>
          </div>
        </div>

        {/* 查看詳情按鈕 (Feature 069) */}
        <div className="mt-4 pt-4 border-t border-border">
          <button
            onClick={handleToggleDetails}
            disabled={isLoadingDetails}
            className="w-full py-2 text-sm font-medium text-primary bg-primary/10 rounded-md hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoadingDetails ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                載入中...
              </>
            ) : showDetails ? (
              <>
                <ChevronUp className="w-4 h-4" />
                隱藏詳情
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                查看詳情
              </>
            )}
          </button>
        </div>

        {/* 詳情面板 (Feature 069) */}
        {showDetails && (
          <GroupDetailsPanel
            details={groupDetails}
            isLoading={isLoadingDetails}
            error={detailsError}
            onRetry={refetchDetails}
            longExchange={group.longExchange}
            shortExchange={group.shortExchange}
          />
        )}
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 flex items-center justify-between">
        <button
          onClick={handleToggleExpand}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              收合詳情
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              展開詳情 ({positions.length} 組)
            </>
          )}
        </button>

        {onBatchClose && (
          <button
            onClick={handleBatchClose}
            disabled={isBatchClosing}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-loss hover:bg-loss/90 disabled:bg-loss/50 rounded-md transition-colors"
          >
            {isBatchClosing ? (
              <>
                <span className="animate-spin">⏳</span>
                平倉中...
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4" />
                全部平倉
              </>
            )}
          </button>
        )}
      </div>

      {/* Expanded Positions List */}
      {isExpanded && (
        <div className="border-t border-border bg-muted/30">
          <div className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground font-medium mb-2">
              組內持倉列表
            </p>
            {positions.map((position, index) => (
              <div
                key={position.id}
                className="flex items-center justify-between p-2 bg-background rounded border border-border text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">#{index + 1}</span>
                  <span className="font-mono text-xs">
                    {position.id.slice(0, 8)}...
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span>槓桿: {position.leverage}x</span>
                  <span className="text-muted-foreground">
                    {new Date(position.createdAt).toLocaleString()}
                  </span>
                  {onExpandPosition && (
                    <button
                      onClick={() => onExpandPosition(position.id)}
                      className="text-primary hover:underline"
                    >
                      詳情
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * GroupDetailsPanel - 組合持倉詳情面板
 * 顯示聚合的現價、資金費率明細、未實現損益等
 */
interface GroupDetailsPanelProps {
  details: import('../hooks/useGroupPositionDetails').GroupPositionDetails | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  longExchange: string;
  shortExchange: string;
}

function GroupDetailsPanel({
  details,
  isLoading,
  error,
  onRetry,
  longExchange,
  shortExchange,
}: GroupDetailsPanelProps) {
  // 載入中
  if (isLoading && !details) {
    return (
      <div className="mt-4 p-4 bg-muted rounded-lg border border-border">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>正在載入詳細資訊...</span>
        </div>
      </div>
    );
  }

  // 錯誤
  if (error && !details) {
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

  if (!details) {
    return null;
  }

  const formatDetailPrice = (value: number | null): string => {
    if (value === null) return 'N/A';
    if (value >= 1000) {
      return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return value.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 8 });
  };

  const formatPnL = (value: number, decimals = 4): string => {
    const prefix = value >= 0 ? '+' : '';
    return `${prefix}$${value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  };

  return (
    <div className="mt-4 p-4 bg-muted rounded-lg border border-border space-y-4">
      {/* 現價資訊 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 多頭現價 */}
        <div className="space-y-2">
          <div className="flex items-center gap-1 text-profit font-medium text-sm">
            <TrendingUp className="w-4 h-4" />
            <span>多頭 ({formatExchange(longExchange)})</span>
          </div>
          <div className="text-xs">
            <span className="text-muted-foreground">現在價格: </span>
            <span className="font-medium">
              {details.priceQuerySuccess ? (
                `$${formatDetailPrice(details.longCurrentPrice)}`
              ) : (
                <span className="text-loss">查詢失敗</span>
              )}
            </span>
          </div>
        </div>

        {/* 空頭現價 */}
        <div className="space-y-2">
          <div className="flex items-center gap-1 text-loss font-medium text-sm">
            <TrendingDown className="w-4 h-4" />
            <span>空頭 ({formatExchange(shortExchange)})</span>
          </div>
          <div className="text-xs">
            <span className="text-muted-foreground">現在價格: </span>
            <span className="font-medium">
              {details.priceQuerySuccess ? (
                `$${formatDetailPrice(details.shortCurrentPrice)}`
              ) : (
                <span className="text-loss">查詢失敗</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* 價格查詢錯誤 */}
      {!details.priceQuerySuccess && details.priceQueryError && (
        <div className="p-2 bg-warning/10 border border-warning/30 rounded text-xs text-warning">
          ⚠️ {details.priceQueryError}
        </div>
      )}

      {/* 未實現損益 */}
      <div className="pt-3 border-t border-border">
        <div className="flex items-center gap-1 text-foreground font-medium text-sm mb-2">
          <DollarSign className="w-4 h-4" />
          <span>未實現損益（總計）</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">多頭: </span>
            <span className={`font-medium ${details.totalLongUnrealizedPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
              {formatPnL(details.totalLongUnrealizedPnL)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">空頭: </span>
            <span className={`font-medium ${details.totalShortUnrealizedPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
              {formatPnL(details.totalShortUnrealizedPnL)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">總計: </span>
            <span className={`font-medium ${details.totalUnrealizedPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
              {formatPnL(details.totalUnrealizedPnL)}
            </span>
          </div>
        </div>
      </div>

      {/* 資金費率明細 */}
      <div className="pt-3 border-t border-border">
        <div className="flex items-center gap-1 text-foreground font-medium text-sm mb-2">
          <Clock className="w-4 h-4" />
          <span>資金費率結算（總計）</span>
        </div>
        {details.fundingFeeQuerySuccess ? (
          <>
            <div className="grid grid-cols-3 gap-2 text-xs mb-3">
              <div>
                <span className="text-muted-foreground">多頭: </span>
                <span className={`font-medium ${details.totalLongFundingFee >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {formatPnL(details.totalLongFundingFee)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">空頭: </span>
                <span className={`font-medium ${details.totalShortFundingFee >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {formatPnL(details.totalShortFundingFee)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">總計: </span>
                <span className={`font-medium ${details.totalFundingFee >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {formatPnL(details.totalFundingFee)}
                </span>
              </div>
            </div>

            {/* 資金費率結算明細 - 按時間顯示 */}
            {details.fundingSettlements.length > 0 && (
              <div className="space-y-1 mt-2">
                <p className="text-xs text-muted-foreground mb-1">
                  結算明細 ({details.fundingSettlements.length} 次):
                </p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {details.fundingSettlements.map((settlement) => (
                    <div
                      key={settlement.timestamp}
                      className="flex items-center justify-between p-2 bg-background rounded text-xs border border-border/50"
                    >
                      <span className="text-muted-foreground">
                        {new Date(settlement.timestamp).toLocaleString('zh-TW', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className={`${settlement.longAmount >= 0 ? 'text-profit' : 'text-loss'}`}>
                          多 {formatPnL(settlement.longAmount)}
                        </span>
                        <span className={`${settlement.shortAmount >= 0 ? 'text-profit' : 'text-loss'}`}>
                          空 {formatPnL(settlement.shortAmount)}
                        </span>
                        <span className={`font-medium ${settlement.totalAmount >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {formatPnL(settlement.totalAmount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-xs text-muted-foreground">
            {details.fundingFeeQueryError || '尚無資金費率結算記錄'}
          </div>
        )}
      </div>

      {/* 手續費 */}
      {details.totalOpenFees > 0 && (
        <div className="pt-3 border-t border-border">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">開倉手續費（總計）:</span>
            <span className="font-medium text-warning">-${formatNumber(details.totalOpenFees.toString(), 4)}</span>
          </div>
        </div>
      )}

      {/* 查詢時間 */}
      <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>已載入 {details.loadedCount}/{details.positionCount} 組</span>
        <span>查詢時間: {details.queriedAt.toLocaleTimeString()}</span>
      </div>
    </div>
  );
}
