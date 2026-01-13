/**
 * BinanceAccountDetector
 *
 * 負責偵測 Binance 帳戶類型（標準 vs Portfolio Margin）
 * 和持倉模式（One-way vs Hedge Mode）
 *
 * Feature: 062-refactor-trading-srp
 */

import { logger } from '@/lib/logger';
import type { BinanceAccountInfo, IBinanceAccountDetector } from '@/types/trading';

/**
 * CCXT Binance Exchange 類型定義
 */
interface CcxtBinanceExchange {
  fapiPrivateGetPositionSideDual: () => Promise<{ dualSidePosition?: boolean | string }>;
  papiGetUmPositionSideDual: () => Promise<{ dualSidePosition?: boolean | string }>;
}

/**
 * Binance 帳戶類型偵測服務
 *
 * 從 PositionOrchestrator.detectBinanceAccountType 提取
 * 原始位置：src/services/trading/PositionOrchestrator.ts:735-764
 */
export class BinanceAccountDetector implements IBinanceAccountDetector {
  /**
   * 偵測 Binance 帳戶類型和持倉模式
   *
   * 偵測順序：
   * 1. 先嘗試標準 Futures API (fapiPrivateGetPositionSideDual)
   * 2. 若失敗，嘗試 Portfolio Margin API (papiGetUmPositionSideDual)
   * 3. 若都失敗，使用預設值（標準帳戶 + One-way Mode）
   *
   * @param ccxtExchange - CCXT Binance 交易所實例
   * @returns 帳戶資訊（isPortfolioMargin, isHedgeMode）
   */
  async detect(ccxtExchange: unknown): Promise<BinanceAccountInfo> {
    const exchange = ccxtExchange as CcxtBinanceExchange;

    // 先嘗試標準 Futures API
    try {
      const result = await exchange.fapiPrivateGetPositionSideDual();
      const isHedgeMode = result?.dualSidePosition === true || result?.dualSidePosition === 'true';
      logger.info({ isHedgeMode, result }, 'Binance standard Futures account detected');
      return { isPortfolioMargin: false, isHedgeMode };
    } catch (fapiError: unknown) {
      const fapiErrorMsg = fapiError instanceof Error ? fapiError.message : String(fapiError);
      logger.warn({ error: fapiErrorMsg }, 'Standard Futures API failed, trying Portfolio Margin');
    }

    // 標準 API 失敗，嘗試 Portfolio Margin API
    try {
      const papiResult = await exchange.papiGetUmPositionSideDual();
      const isHedgeMode = papiResult?.dualSidePosition === true || papiResult?.dualSidePosition === 'true';
      logger.info({ isHedgeMode, papiResult }, 'Binance Portfolio Margin account detected');
      return { isPortfolioMargin: true, isHedgeMode };
    } catch (papiError: unknown) {
      const papiErrorMsg = papiError instanceof Error ? papiError.message : String(papiError);
      logger.warn({ error: papiErrorMsg }, 'Portfolio Margin API also failed');
    }

    // 無法偵測，使用預設值（標準帳戶 + One-way Mode）
    logger.info('Binance account type detection failed, defaulting to standard + One-way Mode');
    return { isPortfolioMargin: false, isHedgeMode: false };
  }
}

/**
 * 建立 BinanceAccountDetector 實例
 */
export function createBinanceAccountDetector(): IBinanceAccountDetector {
  return new BinanceAccountDetector();
}
