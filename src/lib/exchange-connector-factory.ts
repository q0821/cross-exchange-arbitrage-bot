/**
 * Exchange Connector Factory
 *
 * Feature: 067-position-exit-monitor
 *
 * 建立帶有 API 認證的交易所連接器，用於查詢用戶的私有資料
 * - 資金費率歷史
 * - 訂單歷史
 * - 持倉歷史
 */

import type { Exchange } from 'ccxt';
import { logger } from '@/lib/logger';
import { createCcxtExchange, type SupportedExchange as CcxtSupportedExchange } from '@/lib/ccxt-factory';

/**
 * 連接器選項
 */
export interface ConnectorOptions {
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
  isTestnet: boolean;
}

/**
 * 資金費率歷史記錄
 */
export interface FundingHistoryEntry {
  amount: number;
  timestamp: number;
  symbol?: string;
}

/**
 * 帶認證的交易所連接器介面
 */
export interface IAuthenticatedConnector {
  /**
   * 查詢資金費率歷史
   *
   * @param symbol - 交易對符號
   * @param options - 查詢選項
   * @returns 資金費率歷史記錄
   */
  fetchFundingHistory(
    symbol: string,
    options?: { since?: number; limit?: number }
  ): Promise<FundingHistoryEntry[]>;
}

/**
 * CCXT 連接器封裝
 *
 * 使用統一 CCXT 工廠確保 proxy 配置自動套用
 */
class CcxtAuthenticatedConnector implements IAuthenticatedConnector {
  private exchange: Exchange;
  private exchangeName: string;

  constructor(exchangeName: string, options: ConnectorOptions) {
    this.exchangeName = exchangeName;

    // 使用統一工廠創建 CCXT 實例（自動套用 proxy 配置）
    this.exchange = createCcxtExchange(exchangeName as CcxtSupportedExchange, {
      apiKey: options.apiKey,
      secret: options.apiSecret,
      password: options.passphrase,
      sandbox: options.isTestnet,
      enableRateLimit: true,
      options: {
        defaultType: 'swap',
      },
    });
  }

  /**
   * 查詢資金費率歷史
   */
  async fetchFundingHistory(
    symbol: string,
    options?: { since?: number; limit?: number }
  ): Promise<FundingHistoryEntry[]> {
    try {
      // 載入市場資訊
      await this.exchange.loadMarkets();

      // 轉換符號格式 (BTCUSDT -> BTC/USDT:USDT)
      const ccxtSymbol = this.convertSymbol(symbol);

      // 使用 CCXT fetchFundingHistory（部分交易所支援）
      // 或使用 fetchMyTrades + 過濾 funding 記錄
      const params: Record<string, unknown> = {};
      if (options?.since) {
        params.since = options.since;
      }
      if (options?.limit) {
        params.limit = options.limit;
      }

      // 嘗試使用 fetchFundingHistory（不是所有交易所都支援）
      const exchangeWithFundingHistory = this.exchange as Exchange & {
        fetchFundingHistory?: (
          symbol: string,
          since?: number,
          limit?: number,
          params?: Record<string, unknown>
        ) => Promise<Array<Record<string, unknown>>>;
      };

      if (typeof exchangeWithFundingHistory.fetchFundingHistory === 'function') {
        const history = await exchangeWithFundingHistory.fetchFundingHistory(ccxtSymbol, options?.since, options?.limit, params);
        return history.map((entry: Record<string, unknown>) => ({
          amount: Number(entry.amount || 0),
          timestamp: Number(entry.timestamp || Date.now()),
          symbol: String(entry.symbol || symbol),
        }));
      }

      // 如果不支援 fetchFundingHistory，嘗試其他方法
      logger.warn(
        { exchange: this.exchangeName, symbol },
        '[Feature 067] fetchFundingHistory not supported, returning empty array'
      );

      return [];
    } catch (error) {
      logger.error(
        { exchange: this.exchangeName, symbol, error },
        '[Feature 067] Error fetching funding history'
      );
      throw error;
    }
  }

  /**
   * 轉換符號格式
   */
  private convertSymbol(symbol: string): string {
    // BTCUSDT -> BTC/USDT:USDT (swap format)
    if (symbol.endsWith('USDT')) {
      const base = symbol.replace('USDT', '');
      return `${base}/USDT:USDT`;
    }
    return symbol;
  }
}

/**
 * 建立帶認證的交易所連接器
 *
 * @param exchange - 交易所名稱
 * @param options - 連接器選項
 * @returns 帶認證的連接器
 */
export function createExchangeConnector(
  exchange: string,
  options: ConnectorOptions
): IAuthenticatedConnector {
  return new CcxtAuthenticatedConnector(exchange, options);
}
