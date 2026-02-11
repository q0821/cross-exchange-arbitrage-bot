/**
 * Funding Fee Adapter Factory
 *
 * 資金費率查詢適配器工廠：根據交易所名稱回傳對應的 adapter
 * Feature: 041-funding-rate-pnl-display (Adapter Pattern Refactor)
 */

import type * as ccxt from 'ccxt';
import type { SupportedExchange } from '../../types/trading';
import type { FundingFeeAdapter } from './adapters/FundingFeeAdapter';
import { BinanceFundingFeeAdapter } from './adapters/BinanceFundingFeeAdapter';
import { MexcFundingFeeAdapter } from './adapters/MexcFundingFeeAdapter';
import { OkxFundingFeeAdapter } from './adapters/OkxFundingFeeAdapter';
import { GateioFundingFeeAdapter } from './adapters/GateioFundingFeeAdapter';
import { BingxFundingFeeAdapter } from './adapters/BingxFundingFeeAdapter';

/**
 * 根據交易所名稱取得對應的 FundingFeeAdapter
 *
 * @param exchange - 交易所名稱
 * @param ccxtExchange - 已認證的 CCXT 實例（已 loadMarkets）
 */
export function getFundingFeeAdapter(
  exchange: SupportedExchange,
  ccxtExchange: ccxt.Exchange,
): FundingFeeAdapter {
  switch (exchange) {
    case 'binance':
      return new BinanceFundingFeeAdapter(ccxtExchange);
    case 'mexc':
      return new MexcFundingFeeAdapter(ccxtExchange);
    case 'okx':
      return new OkxFundingFeeAdapter(ccxtExchange);
    case 'gateio':
      return new GateioFundingFeeAdapter(ccxtExchange);
    case 'bingx':
      return new BingxFundingFeeAdapter(ccxtExchange);
    default:
      throw new Error(`Unsupported exchange for funding fee query: ${exchange}`);
  }
}
