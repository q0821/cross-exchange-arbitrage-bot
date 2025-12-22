/**
 * OKX Position Mode Detection
 *
 * 偵測 OKX 帳戶的持倉模式
 * Feature: 040-fix-conditional-orders
 */

import { logger } from '../../lib/logger';

/**
 * OKX 帳戶模式類型
 */
export type OkxPositionMode = 'long_short_mode' | 'net_mode';

/**
 * CCXT Exchange 介面（僅需要的方法）
 * 使用 any 類型以兼容 CCXT 的動態方法
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CcxtExchangeLike = any;

/**
 * 偵測 OKX 帳戶的持倉模式
 *
 * 調用 OKX Account Config API (GET /api/v5/account/config) 獲取 posMode
 * - long_short_mode: 雙向持倉模式，需指定 posSide: 'long' 或 'short'
 * - net_mode: 單向持倉模式，使用 posSide: 'net'
 *
 * @param ccxtExchange - CCXT OKX 交易所實例
 * @returns 'long_short_mode' 或 'net_mode'
 */
export async function detectOkxPositionMode(
  ccxtExchange: CcxtExchangeLike,
): Promise<OkxPositionMode> {
  try {
    // 調用 OKX Account Config API
    const response = await ccxtExchange.privateGetAccountConfig();
    const posMode = response?.data?.[0]?.posMode;

    const detectedMode: OkxPositionMode =
      posMode === 'net_mode' ? 'net_mode' : 'long_short_mode';

    logger.info(
      { positionMode: detectedMode, rawPosMode: posMode },
      'Detected OKX position mode',
    );

    return detectedMode;
  } catch (error) {
    logger.warn(
      { error },
      'Failed to detect OKX position mode, defaulting to long_short_mode',
    );
    return 'long_short_mode';
  }
}
