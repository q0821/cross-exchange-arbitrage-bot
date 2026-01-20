/**
 * 通知服務工具函式
 * Feature 026: Discord/Slack 套利機會即時推送通知
 * Feature 027: 套利機會結束監測和通知
 * Feature 050: 停損停利觸發通知
 * Feature 058: 通知加入開倉連結
 */

import type {
  TriggerNotificationMessage,
  TriggerNotificationType,
  EmergencyNotificationMessage,
} from './types';
import type { ExitSuggestionMessage } from '@/services/monitor/types';
import { ExitSuggestionReason } from '@/services/monitor/types';

// ===== Feature 067: 平倉建議通知格式化 =====

/**
 * 取得平倉建議原因的描述文字
 * @param reason 平倉建議原因
 * @returns 描述文字
 */
export function getReasonDescription(reason: ExitSuggestionReason): string {
  switch (reason) {
    case ExitSuggestionReason.APY_NEGATIVE:
      return 'APY 已轉負，繼續持有會虧損';
    case ExitSuggestionReason.PROFIT_LOCKABLE:
      return 'APY 低於閾值但整體有獲利可鎖定';
    default:
      return '建議平倉';
  }
}

/**
 * 格式化平倉建議通知訊息
 * Feature 067: 持倉平倉建議監控
 *
 * @param message 平倉建議訊息
 * @returns 格式化的通知文字
 */
export function formatExitSuggestionMessage(message: ExitSuggestionMessage): string {
  const {
    symbol,
    reason: _reason,
    reasonDescription,
    currentAPY,
    fundingPnL,
    priceDiffLoss,
    netProfit,
    longExchange,
    shortExchange,
  } = message;

  const profitEmoji = netProfit >= 0 ? '✅' : '⚠️';
  const apyEmoji = currentAPY < 0 ? '📉' : '📊';

  const lines = [
    `🔔 平倉建議 - ${symbol}`,
    ``,
    `⚠️ 原因: ${reasonDescription}`,
    `${apyEmoji} 當前 APY: ${currentAPY.toFixed(1)}%`,
    `💰 累計費率收益: ${fundingPnL >= 0 ? '+' : ''}${fundingPnL.toFixed(2)} USDT`,
    `📉 價差損失: -${Math.abs(priceDiffLoss).toFixed(2)} USDT`,
    `${profitEmoji} 淨收益: ${netProfit >= 0 ? '+' : ''}${netProfit.toFixed(2)} USDT`,
    ``,
    `📍 做多: ${longExchange.toUpperCase()}`,
    `📍 做空: ${shortExchange.toUpperCase()}`,
  ];

  return lines.join('\n');
}

/**
 * 格式化平倉建議通知訊息（Discord 版本，支援 Markdown）
 * @param message 平倉建議訊息
 * @returns 格式化的 Discord 通知文字
 */
export function formatExitSuggestionMessageDiscord(message: ExitSuggestionMessage): string {
  const {
    symbol,
    reasonDescription,
    currentAPY,
    fundingPnL,
    priceDiffLoss,
    netProfit,
    longExchange,
    shortExchange,
  } = message;

  const profitEmoji = netProfit >= 0 ? '✅' : '⚠️';
  const apyEmoji = currentAPY < 0 ? '📉' : '📊';

  const lines = [
    `🔔 **平倉建議 - ${symbol}**`,
    ``,
    `⚠️ **原因**: ${reasonDescription}`,
    `${apyEmoji} **當前 APY**: ${currentAPY.toFixed(1)}%`,
    `💰 **累計費率收益**: ${fundingPnL >= 0 ? '+' : ''}${fundingPnL.toFixed(2)} USDT`,
    `📉 **價差損失**: -${Math.abs(priceDiffLoss).toFixed(2)} USDT`,
    `${profitEmoji} **淨收益**: **${netProfit >= 0 ? '+' : ''}${netProfit.toFixed(2)} USDT**`,
    ``,
    `📍 做多: \`${longExchange.toUpperCase()}\``,
    `📍 做空: \`${shortExchange.toUpperCase()}\``,
  ];

  return lines.join('\n');
}

// ===== Feature 058: 開倉連結生成 =====

/**
 * 產生開倉頁面連結
 * Feature 058: 通知加入開倉連結
 *
 * @param symbol 交易對符號（如 BTCUSDT）
 * @param longExchange 做多交易所名稱
 * @param shortExchange 做空交易所名稱
 * @returns 開倉頁面 URL，格式：{BASE_URL}/market-monitor?symbol={symbol}&long={long}&short={short}
 */
export function generateOpenPositionUrl(
  symbol: string,
  longExchange: string,
  shortExchange: string
): string {
  // 優先使用 NEXT_PUBLIC_BASE_URL，fallback 到 NEXT_PUBLIC_WS_URL 或預設值
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_WS_URL ||
    'http://localhost:3000';

  const params = new URLSearchParams({
    symbol,
    long: longExchange.toLowerCase(),
    short: shortExchange.toLowerCase(),
  });

  return `${baseUrl}/market-monitor?${params.toString()}`;
}

/**
 * 交易所永續合約交易 URL 對應表
 * 與 src/lib/exchanges/constants.ts 保持一致
 *
 * 注意：symbol 格式為 BTCUSDT（無斜線）
 */
const EXCHANGE_URL_TEMPLATES: Record<string, (symbol: string) => string> = {
  binance: (symbol) => {
    // BTCUSDT → BTCUSDT（保持原樣）
    return `https://www.binance.com/zh-TC/futures/${symbol}`;
  },
  okx: (symbol) => {
    // BTCUSDT → BTC-USDT-SWAP
    const base = symbol.replace('USDT', '');
    return `https://www.okx.com/zh-hant/trade-swap/${base}-USDT-SWAP`;
  },
  mexc: (symbol) => {
    // BTCUSDT → BTC_USDT
    const base = symbol.replace('USDT', '');
    return `https://futures.mexc.com/zh-TW/exchange/${base}_USDT`;
  },
  gate: (symbol) => {
    // BTCUSDT → BTC_USDT
    const base = symbol.replace('USDT', '');
    return `https://www.gate.io/zh-tw/futures_trade/USDT/${base}_USDT`;
  },
  gateio: (symbol) => {
    // BTCUSDT → BTC_USDT（與 gate 相同）
    const base = symbol.replace('USDT', '');
    return `https://www.gate.io/zh-tw/futures_trade/USDT/${base}_USDT`;
  },
  bybit: (symbol) => {
    // BTCUSDT → BTCUSDT（保持原樣）
    return `https://www.bybit.com/trade/usdt/${symbol}`;
  },
  bitget: (symbol) => {
    // BTCUSDT → BTCUSDT（保持原樣）
    return `https://www.bitget.com/futures/usdt/${symbol}`;
  },
  htx: (symbol) => {
    // BTCUSDT → BTC-USDT
    const base = symbol.replace('USDT', '');
    return `https://www.htx.com/futures/linear_swap/exchange#contract_code=${base}-USDT&type=cross`;
  },
};

/**
 * 產生交易所交易頁面連結
 * @param exchange 交易所名稱（小寫）
 * @param symbol 交易對符號（如 BTC/USDT）
 * @returns 交易頁面 URL
 */
export function generateExchangeUrl(exchange: string, symbol: string): string {
  const exchangeLower = exchange.toLowerCase();
  const urlGenerator = EXCHANGE_URL_TEMPLATES[exchangeLower];

  if (urlGenerator) {
    return urlGenerator(symbol);
  }

  // 預設：返回交易所首頁
  return `https://www.${exchangeLower}.com`;
}

/**
 * 格式化數字為百分比字串
 * @param value 數值（0.01 = 1%）
 * @param decimals 小數位數
 */
export function formatPercent(value: number, decimals: number = 4): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * 格式化價格（固定小數位）
 * @param price 價格
 * @param decimals 小數位數
 */
export function formatPrice(price: number, decimals: number = 2): string {
  return `$${price.toFixed(decimals)}`;
}

/**
 * 智能格式化價格（根據價格大小動態調整小數位）
 * - 價格 >= 1：2 位小數（如 $100.00）
 * - 價格 >= 0.01：4 位小數（如 $0.0900）
 * - 價格 < 0.01：6 位小數（如 $0.000123）
 *
 * @param price 價格
 */
export function formatPriceSmart(price: number): string {
  if (price >= 1) {
    return `$${price.toFixed(2)}`;
  } else if (price >= 0.01) {
    return `$${price.toFixed(4)}`;
  } else {
    return `$${price.toFixed(6)}`;
  }
}

// ===== Feature 027: 套利機會結束通知工具函式 =====

/**
 * 格式化持續時間為人類可讀字串
 * @param durationMs 持續時間（毫秒）
 * @returns 格式化的時間字串（如 "2 小時 30 分鐘"）
 */
export function formatDuration(durationMs: number): string {
  const totalMinutes = Math.floor(durationMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} 分鐘`;
  } else if (minutes === 0) {
    return `${hours} 小時`;
  } else {
    return `${hours} 小時 ${minutes} 分鐘`;
  }
}

/**
 * 格式化費差統計資訊
 * @param initialSpread 初始費差 (0.01 = 1%)
 * @param maxSpread 最高費差
 * @param maxSpreadAt 最高費差發生時間
 * @param finalSpread 結束時費差
 * @returns 格式化的費差統計字串
 */
export function formatSpreadStats(
  initialSpread: number,
  maxSpread: number,
  maxSpreadAt: Date,
  finalSpread: number
): string {
  const formatSpread = (spread: number) => `${(spread * 100).toFixed(2)}%`;
  const timeStr = maxSpreadAt.toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return `初始：${formatSpread(initialSpread)} → 最高：${formatSpread(maxSpread)}（${timeStr}）→ 結束：${formatSpread(finalSpread)}`;
}

/**
 * 格式化時間為 HH:MM 格式
 * @param date 日期時間
 * @returns 格式化的時間字串（如 "08:30"）
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * 格式化模擬收益資訊
 * Feature 030: 顯示各交易所的結算間隔，方便用戶驗證計算正確性
 * @param params 收益參數
 * @returns 格式化的收益資訊字串
 */
export function formatProfitInfo(params: {
  longSettlementCount: number;
  shortSettlementCount: number;
  longExchange: string;
  shortExchange: string;
  longIntervalHours: number;
  shortIntervalHours: number;
  totalFundingProfit: number;
  totalCost: number;
  netProfit: number;
  realizedAPY: number;
}): string {
  const {
    longSettlementCount,
    shortSettlementCount,
    longExchange,
    shortExchange,
    longIntervalHours,
    shortIntervalHours,
    totalFundingProfit,
    totalCost,
    netProfit,
    realizedAPY,
  } = params;

  const totalCount = longSettlementCount + shortSettlementCount;
  const profitSign = totalFundingProfit >= 0 ? '+' : '';
  const netSign = netProfit >= 0 ? '+' : '';

  return [
    `結算次數：${totalCount} 次`,
    `├ 做多 ${longExchange.toUpperCase()} (${longIntervalHours}h)：${longSettlementCount} 次`,
    `└ 做空 ${shortExchange.toUpperCase()} (${shortIntervalHours}h)：${shortSettlementCount} 次`,
    `總費率收益：${profitSign}${(totalFundingProfit * 100).toFixed(2)}%`,
    `開平倉成本：-${(totalCost * 100).toFixed(2)}%`,
    `淨收益：${netSign}${(netProfit * 100).toFixed(2)}%`,
    `實際 APY：${realizedAPY.toFixed(0)}%`,
  ].join('\n');
}

/**
 * 格式化模擬收益資訊（Discord 版本，支援粗體）
 */
export function formatProfitInfoDiscord(params: {
  longSettlementCount: number;
  shortSettlementCount: number;
  longExchange: string;
  shortExchange: string;
  longIntervalHours: number;
  shortIntervalHours: number;
  totalFundingProfit: number;
  totalCost: number;
  netProfit: number;
  realizedAPY: number;
}): string {
  const {
    longSettlementCount,
    shortSettlementCount,
    longExchange,
    shortExchange,
    longIntervalHours,
    shortIntervalHours,
    totalFundingProfit,
    totalCost,
    netProfit,
    realizedAPY,
  } = params;

  const totalCount = longSettlementCount + shortSettlementCount;
  const profitSign = totalFundingProfit >= 0 ? '+' : '';
  const netSign = netProfit >= 0 ? '+' : '';

  return [
    `結算次數：${totalCount} 次`,
    `├ 做多 ${longExchange.toUpperCase()} (${longIntervalHours}h)：${longSettlementCount} 次`,
    `└ 做空 ${shortExchange.toUpperCase()} (${shortIntervalHours}h)：${shortSettlementCount} 次`,
    `總費率收益：${profitSign}${(totalFundingProfit * 100).toFixed(2)}%`,
    `開平倉成本：-${(totalCost * 100).toFixed(2)}%`,
    `淨收益：**${netSign}${(netProfit * 100).toFixed(2)}%**`,
    `實際 APY：**${realizedAPY.toFixed(0)}%**`,
  ].join('\n');
}

// ===== Feature 050: 停損停利觸發通知工具函式 =====

/**
 * 建立觸發通知訊息的輸入參數
 */
export interface BuildTriggerNotificationInput {
  positionId: string;
  symbol: string;
  triggerType: TriggerNotificationType;
  triggeredExchange: string;
  triggeredSide: 'LONG' | 'SHORT';
  triggerPrice?: number;
  closedExchange: string;
  closedSide: 'LONG' | 'SHORT';
  closePrice?: number;
  positionSize: number;
  leverage: number;
  openedAt: Date;
  closedAt: Date;
  pnl: {
    priceDiffPnL: number;
    fundingRatePnL: number;
    totalFees: number;
    totalPnL: number;
    roi: number;
  };
}

/**
 * 建立觸發通知訊息
 * Feature 050: 停損停利觸發偵測與自動平倉
 *
 * @param input 輸入參數
 * @returns TriggerNotificationMessage
 */
export function buildTriggerNotificationMessage(
  input: BuildTriggerNotificationInput
): TriggerNotificationMessage {
  const holdingDurationMs = input.closedAt.getTime() - input.openedAt.getTime();

  return {
    positionId: input.positionId,
    symbol: input.symbol,
    triggerType: input.triggerType,
    triggeredExchange: input.triggeredExchange,
    triggeredSide: input.triggeredSide,
    triggerPrice: input.triggerPrice,
    closedExchange: input.closedExchange,
    closedSide: input.closedSide,
    closePrice: input.closePrice,
    pnl: input.pnl,
    positionSize: input.positionSize,
    leverage: input.leverage,
    holdingDuration: formatDuration(holdingDurationMs),
    triggeredAt: input.closedAt, // 觸發時間通常與平倉時間相近
    closedAt: input.closedAt,
  };
}

/**
 * 建立緊急通知訊息的輸入參數
 */
export interface BuildEmergencyNotificationInput {
  positionId: string;
  symbol: string;
  triggerType: TriggerNotificationType;
  triggeredExchange: string;
  error: string;
  requiresManualIntervention: boolean;
}

/**
 * 建立緊急通知訊息（平倉失敗時）
 * Feature 050: 停損停利觸發偵測與自動平倉
 *
 * @param input 輸入參數
 * @returns EmergencyNotificationMessage
 */
export function buildEmergencyNotificationMessage(
  input: BuildEmergencyNotificationInput
): EmergencyNotificationMessage {
  return {
    positionId: input.positionId,
    symbol: input.symbol,
    triggerType: input.triggerType,
    triggeredExchange: input.triggeredExchange,
    error: input.error,
    requiresManualIntervention: input.requiresManualIntervention,
    timestamp: new Date(),
  };
}
