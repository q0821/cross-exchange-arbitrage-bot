/**
 * 交易所交易限制配置
 *
 * 定義哪些交易所不支援透過 API 進行開倉交易
 * 用於前端 UI 顯示警告和禁用開倉功能
 */

/**
 * 受限交易所識別碼
 */
export type RestrictedExchangeId = 'mexc';

/**
 * 限制類型
 */
export type RestrictionType = 'api_trading_disabled';

/**
 * 交易所限制資訊
 */
export interface ExchangeRestriction {
  exchangeId: RestrictedExchangeId;
  restrictionType: RestrictionType;
  message: string;
  externalUrl: string;
}

/**
 * 受限交易所配置
 *
 * 若需新增其他受限交易所，只需：
 * 1. 更新 RestrictedExchangeId 型別
 * 2. 在此物件中新增配置
 */
export const RESTRICTED_EXCHANGES: Record<RestrictedExchangeId, ExchangeRestriction> = {
  mexc: {
    exchangeId: 'mexc',
    restrictionType: 'api_trading_disabled',
    message: 'MEXC 不支援 API 開倉，請手動建倉',
    externalUrl: 'https://futures.mexc.com/exchange',
  },
};

/**
 * 檢查單一交易所是否受限
 *
 * @param exchangeId - 交易所識別碼
 * @returns 是否為受限交易所
 */
export function isExchangeRestricted(exchangeId: string): boolean {
  return exchangeId in RESTRICTED_EXCHANGES;
}

/**
 * 獲取交易所限制詳情
 *
 * @param exchangeId - 交易所識別碼
 * @returns 限制詳情，若無限制則返回 null
 */
export function getExchangeRestriction(exchangeId: string): ExchangeRestriction | null {
  return RESTRICTED_EXCHANGES[exchangeId as RestrictedExchangeId] ?? null;
}

/**
 * 檢查套利對是否涉及受限交易所
 *
 * @param longExchange - 做多方交易所
 * @param shortExchange - 做空方交易所
 * @returns 是否涉及受限交易所（任一方受限即返回 true）
 */
export function isArbitragePairRestricted(longExchange: string, shortExchange: string): boolean {
  return isExchangeRestricted(longExchange) || isExchangeRestricted(shortExchange);
}

/**
 * 獲取套利對中受限的交易所資訊
 *
 * @param longExchange - 做多方交易所
 * @param shortExchange - 做空方交易所
 * @returns 受限交易所的限制資訊，若無限制則返回 null
 */
export function getArbitragePairRestriction(
  longExchange: string,
  shortExchange: string
): ExchangeRestriction | null {
  const longRestriction = getExchangeRestriction(longExchange);
  if (longRestriction) return longRestriction;

  const shortRestriction = getExchangeRestriction(shortExchange);
  if (shortRestriction) return shortRestriction;

  return null;
}
