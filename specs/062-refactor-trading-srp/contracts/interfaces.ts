/**
 * 重構交易服務介面定義
 * Feature: 062-refactor-trading-srp
 *
 * 這些介面定義了從 PositionOrchestrator 和 PositionCloser 中
 * 提取出的 5 個獨立服務的契約。
 */

import type { SupportedExchange } from '@/types/exchange';

// =============================================================================
// BinanceAccountDetector - Binance 帳戶類型偵測服務
// =============================================================================

/**
 * Binance 帳戶資訊
 */
export interface BinanceAccountInfo {
  /** 是否為 Portfolio Margin 帳戶 */
  isPortfolioMargin: boolean;
  /** 是否為 Hedge Mode（雙向持倉模式） */
  isHedgeMode: boolean;
}

/**
 * Binance 帳戶偵測器介面
 *
 * 負責偵測 Binance 帳戶類型（標準 vs Portfolio Margin）
 * 和持倉模式（One-way vs Hedge Mode）
 */
export interface IBinanceAccountDetector {
  /**
   * 偵測 Binance 帳戶類型和持倉模式
   *
   * @param ccxtExchange - CCXT 交易所實例
   * @returns 帳戶資訊（Portfolio Margin 和 Hedge Mode 狀態）
   * @throws 當 API 呼叫失敗時，回傳預設值（標準帳戶 + One-way Mode）
   */
  detect(ccxtExchange: unknown): Promise<BinanceAccountInfo>;
}

// =============================================================================
// CcxtExchangeFactory - CCXT 交易所實例工廠
// =============================================================================

/**
 * 交易所配置
 */
export interface ExchangeConfig {
  /** API Key */
  apiKey: string;
  /** API Secret */
  apiSecret: string;
  /** Passphrase（OKX 專用） */
  passphrase?: string;
  /** 是否為測試網 */
  isTestnet: boolean;
}

/**
 * 交易所實例（包含 CCXT 實例和偵測結果）
 */
export interface ExchangeInstance {
  /** CCXT 交易所實例 */
  ccxt: unknown;
  /** 是否為 Portfolio Margin 帳戶（Binance 專用） */
  isPortfolioMargin: boolean;
  /** 是否為 Hedge Mode */
  isHedgeMode: boolean;
  /** 已載入的市場資料 */
  markets: Record<string, unknown>;
}

/**
 * CCXT 交易所工廠介面
 *
 * 負責創建和配置 CCXT 交易所實例，
 * 包含不同交易所的特殊設定處理
 */
export interface ICcxtExchangeFactory {
  /**
   * 創建交易所實例
   *
   * @param exchange - 交易所類型
   * @param config - 交易所配置
   * @returns 完整的交易所實例（含偵測結果和市場資料）
   */
  create(
    exchange: SupportedExchange,
    config: ExchangeConfig
  ): Promise<ExchangeInstance>;
}

// =============================================================================
// ContractQuantityConverter - 合約數量轉換工具
// =============================================================================

/**
 * 合約數量轉換器介面
 *
 * 負責將用戶輸入的數量轉換為交易所的合約數量
 */
export interface IContractQuantityConverter {
  /**
   * 將數量轉換為合約數量
   *
   * @param ccxtExchange - CCXT 交易所實例
   * @param symbol - 交易對符號（如 'BTC/USDT:USDT'）
   * @param amount - 用戶輸入的數量
   * @returns 轉換後的合約數量
   * @throws 當 contractSize 為 0 或 undefined 時，使用 1 作為預設值
   */
  convert(
    ccxtExchange: unknown,
    symbol: string,
    amount: number
  ): number;
}

/**
 * 合約數量轉換純函數（替代類別方式）
 */
export type ContractQuantityConverterFn = (
  ccxtExchange: unknown,
  symbol: string,
  amount: number
) => number;

// =============================================================================
// OrderParamsBuilder - 訂單參數建構器
// =============================================================================

/**
 * Hedge Mode 配置
 */
export interface HedgeModeConfig {
  /** 是否為 Hedge Mode */
  enabled: boolean;
  /** 是否為 Portfolio Margin（Binance 專用） */
  isPortfolioMargin?: boolean;
}

/**
 * 訂單參數（不同交易所格式）
 */
export interface OrderParams {
  /** Binance positionSide 參數 */
  positionSide?: 'LONG' | 'SHORT';
  /** OKX posSide 參數 */
  posSide?: 'long' | 'short';
  /** OKX tdMode 參數 */
  tdMode?: 'cross';
  /** reduceOnly 參數 */
  reduceOnly?: boolean;
}

/**
 * 訂單參數建構器介面
 *
 * 負責根據交易所和持倉模式建構訂單參數
 */
export interface IOrderParamsBuilder {
  /**
   * 建構開倉參數
   *
   * @param exchange - 交易所類型
   * @param side - 買賣方向
   * @param hedgeMode - Hedge Mode 配置
   * @returns 訂單參數
   */
  buildOpenParams(
    exchange: SupportedExchange,
    side: 'buy' | 'sell',
    hedgeMode: HedgeModeConfig
  ): OrderParams;

  /**
   * 建構平倉參數
   *
   * @param exchange - 交易所類型
   * @param side - 買賣方向（與原始持倉相反）
   * @param hedgeMode - Hedge Mode 配置
   * @returns 訂單參數
   */
  buildCloseParams(
    exchange: SupportedExchange,
    side: 'buy' | 'sell',
    hedgeMode: HedgeModeConfig
  ): OrderParams;
}

// =============================================================================
// OrderPriceFetcher - 訂單價格獲取服務
// =============================================================================

/**
 * 價格獲取結果
 */
export interface FetchPriceResult {
  /** 成交價格 */
  price: number;
  /** 價格來源 */
  source: 'order' | 'fetchOrder' | 'fetchMyTrades';
}

/**
 * 訂單價格獲取器介面
 *
 * 負責獲取訂單成交價格，包含多層 fallback 機制：
 * 1. order.average || order.price
 * 2. fetchOrder API
 * 3. fetchMyTrades API
 */
export interface IOrderPriceFetcher {
  /**
   * 獲取訂單成交價格
   *
   * @param ccxtExchange - CCXT 交易所實例
   * @param orderId - 訂單 ID
   * @param symbol - 交易對符號
   * @param initialPrice - 初始價格（來自 order.average || order.price）
   * @returns 價格獲取結果（含來源）
   * @throws 當所有重試都失敗時，記錄警告並使用 0 作為價格
   */
  fetch(
    ccxtExchange: unknown,
    orderId: string,
    symbol: string,
    initialPrice?: number
  ): Promise<FetchPriceResult>;
}

// =============================================================================
// 統一的交易服務介面（組合所有子服務）
// =============================================================================

/**
 * 交易服務依賴注入容器
 *
 * 用於 PositionOrchestrator 和 PositionCloser 的依賴注入
 */
export interface TradingServiceDependencies {
  binanceAccountDetector: IBinanceAccountDetector;
  exchangeFactory: ICcxtExchangeFactory;
  quantityConverter: IContractQuantityConverter;
  paramsBuilder: IOrderParamsBuilder;
  priceFetcher: IOrderPriceFetcher;
}
