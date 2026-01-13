/**
 * ContractQuantityConverter
 *
 * 負責將用戶輸入的數量轉換為交易所的合約數量
 *
 * Feature: 062-refactor-trading-srp
 */

import { logger } from '@/lib/logger';
import type { ContractQuantityConverterFn, SupportedExchange } from '@/types/trading';

/**
 * 將用戶指定的數量轉換為合約數量
 *
 * 某些交易所（如 OKX）的合約大小不是 1，
 * 例如 BEAT 的 contractSize = 10，
 * 所以用戶要買 40 BEAT，實際要下單 4 張合約
 *
 * 從 PositionOrchestrator.createCcxtTraderAsync 內部函數提取
 * 原始位置：src/services/trading/PositionOrchestrator.ts:850-863
 *
 * @param ccxtExchange - CCXT 交易所實例（需要已 loadMarkets）
 * @param symbol - 交易對符號（如 'BTC/USDT:USDT'）
 * @param amount - 用戶輸入的數量
 * @param exchange - 交易所名稱（用於日誌）
 * @returns 轉換後的合約數量
 */
export const convertToContracts: ContractQuantityConverterFn = (
  ccxtExchange: unknown,
  symbol: string,
  amount: number,
): number => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exchange = ccxtExchange as any;
  const market = exchange.markets?.[symbol];
  const contractSize = market?.contractSize || 1;

  if (contractSize !== 1) {
    const contracts = amount / contractSize;
    logger.info(
      { symbol, originalAmount: amount, contractSize, contracts },
      'Converting quantity to contracts',
    );
    return contracts;
  }

  return amount;
};

/**
 * 帶有交易所名稱的合約數量轉換
 *
 * 與 convertToContracts 相同，但增加交易所名稱用於更詳細的日誌
 *
 * @param ccxtExchange - CCXT 交易所實例
 * @param symbol - 交易對符號
 * @param amount - 用戶輸入的數量
 * @param exchangeName - 交易所名稱（用於日誌）
 * @returns 轉換後的合約數量
 */
export function convertToContractsWithExchange(
  ccxtExchange: unknown,
  symbol: string,
  amount: number,
  exchangeName: SupportedExchange,
): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exchange = ccxtExchange as any;
  const market = exchange.markets?.[symbol];
  const contractSize = market?.contractSize || 1;

  if (contractSize !== 1) {
    const contracts = amount / contractSize;
    logger.info(
      { exchange: exchangeName, symbol, originalAmount: amount, contractSize, contracts },
      'Converting quantity to contracts',
    );
    return contracts;
  }

  return amount;
}

/**
 * 獲取合約大小
 *
 * @param ccxtExchange - CCXT 交易所實例
 * @param symbol - 交易對符號
 * @returns 合約大小（預設為 1）
 */
export function getContractSize(ccxtExchange: unknown, symbol: string): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exchange = ccxtExchange as any;
  const market = exchange.markets?.[symbol];
  return market?.contractSize || 1;
}
