import { logger } from './lib/logger.js';
import { validateApiKeys } from './lib/config.js';
import { createExchange } from './connectors/factory.js';
import { ErrorHandler } from './lib/errors.js';

async function testAPI() {
  try {
    logger.info('=== API 連線測試開始 ===');

    // 驗證 API 金鑰
    validateApiKeys();
    logger.info('✓ API 金鑰驗證通過');

    // 測試符號
    const testSymbol = 'ETHUSDT';

    // 初始化 Binance 連線
    logger.info('\n--- 測試 Binance 連線 ---');
    const binance = createExchange('binance', true); // testnet = true
    await binance.connect();
    logger.info('✓ Binance 連線成功');

    // 取得 Binance 價格
    logger.info(`正在取得 ${testSymbol} 價格...`);
    const binancePrice = await binance.getPrice(testSymbol);
    logger.info({
      exchange: binancePrice.exchange,
      symbol: binancePrice.symbol,
      price: binancePrice.price,
      timestamp: binancePrice.timestamp,
    }, '✓ Binance 價格資料');

    // 取得 Binance 資金費率
    logger.info(`正在取得 ${testSymbol} 資金費率...`);
    const binanceFunding = await binance.getFundingRate(testSymbol);
    logger.info({
      exchange: binanceFunding.exchange,
      symbol: binanceFunding.symbol,
      fundingRate: binanceFunding.fundingRate,
      fundingRatePercent: (binanceFunding.fundingRate * 100).toFixed(4) + '%',
      nextFundingTime: binanceFunding.nextFundingTime,
      markPrice: binanceFunding.markPrice,
    }, '✓ Binance 資金費率');

    // 初始化 OKX 連線
    logger.info('\n--- 測試 OKX 連線 ---');
    const okx = createExchange('okx', true); // testnet = true
    await okx.connect();
    logger.info('✓ OKX 連線成功');

    // 取得 OKX 價格
    logger.info(`正在取得 ${testSymbol} 價格...`);
    const okxPrice = await okx.getPrice(testSymbol);
    logger.info({
      exchange: okxPrice.exchange,
      symbol: okxPrice.symbol,
      price: okxPrice.price,
      timestamp: okxPrice.timestamp,
    }, '✓ OKX 價格資料');

    // 取得 OKX 資金費率
    logger.info(`正在取得 ${testSymbol} 資金費率...`);
    const okxFunding = await okx.getFundingRate(testSymbol);
    logger.info({
      exchange: okxFunding.exchange,
      symbol: okxFunding.symbol,
      fundingRate: okxFunding.fundingRate,
      fundingRatePercent: (okxFunding.fundingRate * 100).toFixed(4) + '%',
      nextFundingTime: okxFunding.nextFundingTime,
      markPrice: okxFunding.markPrice,
    }, '✓ OKX 資金費率');

    // 計算價差
    logger.info('\n--- 價格比較 ---');
    const priceDiff = Math.abs(binancePrice.price - okxPrice.price);
    const priceDiffPercent = (priceDiff / binancePrice.price) * 100;
    logger.info({
      binancePrice: binancePrice.price,
      okxPrice: okxPrice.price,
      priceDiff: priceDiff.toFixed(2),
      priceDiffPercent: priceDiffPercent.toFixed(4) + '%',
    }, '價格差異');

    // 計算資金費率差異
    const fundingRateDiff = Math.abs(binanceFunding.fundingRate - okxFunding.fundingRate);
    const fundingRateDiffPercent = fundingRateDiff * 100;
    logger.info({
      binanceFundingRate: (binanceFunding.fundingRate * 100).toFixed(4) + '%',
      okxFundingRate: (okxFunding.fundingRate * 100).toFixed(4) + '%',
      fundingRateDiff: (fundingRateDiffPercent).toFixed(4) + '%',
    }, '資金費率差異');

    // 斷線
    await binance.disconnect();
    await okx.disconnect();

    logger.info('\n=== API 測試完成 ===');
  } catch (error) {
    if (error instanceof Error) {
      logger.error({
        error: error.message,
        stack: error.stack,
      }, 'API 測試失敗');
      ErrorHandler.handle(error);
    }
    process.exit(1);
  }
}

// 執行測試
testAPI().catch((error) => {
  logger.fatal({
    error: error instanceof Error ? error.message : String(error),
  }, 'Failed to run API test');
  process.exit(1);
});
