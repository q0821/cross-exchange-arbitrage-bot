/**
 * MEXC 完整交易流程測試
 * 1. 開倉
 * 2. 設定停損停利
 * 3. 關倉
 * 4. 計算損益（含資金費率）
 */

import { PrismaClient } from '@/generated/prisma/client';
import { decrypt } from '../lib/encryption';
import ccxt from 'ccxt';

const prisma = new PrismaClient();

// 測試配置
const TEST_SYMBOL = 'BTC/USDT:USDT';
const TEST_AMOUNT = 0.001; // 最小交易量
const STOP_LOSS_PERCENT = 2; // 停損 2%
const TAKE_PROFIT_PERCENT = 2; // 停利 2%

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testMexcFullTrade() {
  console.log('='.repeat(60));
  console.log('MEXC 完整交易流程測試（含資金費率和損益計算）');
  console.log('='.repeat(60));

  // 1. 從資料庫獲取 MEXC API Key
  console.log('\n1️⃣ 從資料庫獲取 MEXC API Key...');
  const apiKeyRecord = await prisma.apiKey.findFirst({
    where: {
      exchange: 'mexc',
      isActive: true,
      environment: 'MAINNET',
    },
  });

  if (!apiKeyRecord) {
    console.log('   ❌ 找不到有效的 MEXC API Key');
    await prisma.$disconnect();
    return;
  }

  const apiKey = decrypt(apiKeyRecord.encryptedKey);
  const apiSecret = decrypt(apiKeyRecord.encryptedSecret);
  console.log(`   ✅ 找到 API Key: ${apiKeyRecord.label}`);
  console.log(`   API Key (前8字): ${apiKey.substring(0, 8)}...`);

  // 2. 初始化 CCXT
  console.log('\n2️⃣ 初始化 MEXC 連接器...');
  const mexc = new (ccxt as any).mexc({
    apiKey,
    secret: apiSecret,
    enableRateLimit: true,
    options: {
      defaultType: 'swap',
    },
  });

  try {
    await mexc.loadMarkets();
    console.log('   ✅ 市場載入成功');
  } catch (error: any) {
    console.log(`   ❌ 市場載入失敗: ${error.message}`);
    await prisma.$disconnect();
    return;
  }

  // 記錄開始時間（用於查詢資金費率）
  const tradeStartTime = Date.now();

  // 3. 檢查餘額
  console.log('\n3️⃣ 檢查帳戶餘額...');
  let initialBalance: number = 0;
  try {
    const balance = await mexc.fetchBalance();
    initialBalance = balance.total?.USDT || 0;
    console.log(`   ✅ 總 USDT: ${initialBalance}`);
    console.log(`   可用 USDT: ${balance.free?.USDT || 0}`);

    if ((balance.free?.USDT || 0) < 10) {
      console.log('   ⚠️ 可用餘額不足 10 USDT，可能無法開倉');
    }
  } catch (error: any) {
    console.log(`   ❌ 獲取餘額失敗: ${error.message}`);
  }

  // 4. 獲取當前價格和資金費率
  console.log('\n4️⃣ 獲取市場資訊...');
  let currentPrice: number;
  let currentFundingRate: number = 0;
  let nextFundingTime: Date | null = null;

  try {
    const ticker = await mexc.fetchTicker(TEST_SYMBOL);
    currentPrice = ticker.last;
    console.log(`   ✅ ${TEST_SYMBOL} 當前價格: ${currentPrice}`);

    const fundingRate = await mexc.fetchFundingRate(TEST_SYMBOL);
    currentFundingRate = fundingRate.fundingRate || 0;
    nextFundingTime = fundingRate.fundingTimestamp ? new Date(fundingRate.fundingTimestamp) : null;
    console.log(`   資金費率: ${(currentFundingRate * 100).toFixed(4)}%`);
    if (nextFundingTime) {
      console.log(`   下次結算: ${nextFundingTime.toLocaleString()}`);
    }
  } catch (error: any) {
    console.log(`   ❌ 獲取市場資訊失敗: ${error.message}`);
    await prisma.$disconnect();
    return;
  }

  // 5. 開多單
  console.log('\n5️⃣ 開多單...');
  console.log(`   交易對: ${TEST_SYMBOL}`);
  console.log(`   數量: ${TEST_AMOUNT} BTC`);
  console.log(`   方向: LONG (買入)`);

  let openOrderId: string;
  let entryPrice: number;
  let openFee: number = 0;

  try {
    const order = await mexc.createOrder(
      TEST_SYMBOL,
      'market',
      'buy',
      TEST_AMOUNT,
      undefined,
      {
        positionSide: 'LONG', // Hedge mode
      }
    );

    openOrderId = order.id;
    entryPrice = order.average || currentPrice;
    openFee = order.fee?.cost || 0;

    console.log(`   ✅ 開倉成功！`);
    console.log(`   訂單 ID: ${openOrderId}`);
    console.log(`   成交價格: ${entryPrice}`);
    console.log(`   成交數量: ${order.filled}`);
    console.log(`   手續費: ${openFee} ${order.fee?.currency || 'USDT'}`);
  } catch (error: any) {
    console.log(`   ❌ 開倉失敗: ${error.message}`);

    if (error.message.includes('permission') || error.message.includes('Permission')) {
      console.log('   ⚠️ 可能是 API Key 沒有交易權限');
    }

    await prisma.$disconnect();
    return;
  }

  // 等待訂單完成
  await sleep(2000);

  // 6. 確認持倉
  console.log('\n6️⃣ 確認持倉...');
  try {
    const positions = await mexc.fetchPositions([TEST_SYMBOL]);
    const position = positions.find((p: any) =>
      p.symbol === TEST_SYMBOL &&
      p.side === 'long' &&
      parseFloat(p.contracts || '0') > 0
    );

    if (position) {
      console.log(`   ✅ 持倉確認！`);
      console.log(`   數量: ${position.contracts} 張`);
      console.log(`   入場價: ${position.entryPrice}`);
      console.log(`   標記價格: ${position.markPrice}`);
      console.log(`   未實現損益: ${position.unrealizedPnl} USDT`);
      console.log(`   保證金: ${position.initialMargin} USDT`);
      entryPrice = position.entryPrice || entryPrice;
    } else {
      console.log('   ⚠️ 未找到持倉，可能訂單未完全成交');
    }
  } catch (error: any) {
    console.log(`   ❌ 獲取持倉失敗: ${error.message}`);
  }

  // 7. 設定停損單
  console.log('\n7️⃣ 設定停損單...');
  const stopLossPrice = entryPrice * (1 - STOP_LOSS_PERCENT / 100);
  console.log(`   停損價格: ${stopLossPrice.toFixed(2)} (-${STOP_LOSS_PERCENT}%)`);

  let stopLossOrderId: string | null = null;
  try {
    const slOrder = await mexc.createOrder(
      TEST_SYMBOL,
      'stop_market',
      'sell',
      TEST_AMOUNT,
      undefined,
      {
        stopPrice: stopLossPrice.toFixed(2),
        positionSide: 'LONG',
        reduceOnly: true,
      }
    );

    stopLossOrderId = slOrder.id;
    console.log(`   ✅ 停損單設定成功！`);
    console.log(`   停損單 ID: ${stopLossOrderId}`);
  } catch (error: any) {
    console.log(`   ❌ 停損單設定失敗: ${error.message}`);
  }

  // 8. 設定停利單
  console.log('\n8️⃣ 設定停利單...');
  const takeProfitPrice = entryPrice * (1 + TAKE_PROFIT_PERCENT / 100);
  console.log(`   停利價格: ${takeProfitPrice.toFixed(2)} (+${TAKE_PROFIT_PERCENT}%)`);

  let takeProfitOrderId: string | null = null;
  try {
    const tpOrder = await mexc.createOrder(
      TEST_SYMBOL,
      'take_profit_market',
      'sell',
      TEST_AMOUNT,
      undefined,
      {
        stopPrice: takeProfitPrice.toFixed(2),
        positionSide: 'LONG',
        reduceOnly: true,
      }
    );

    takeProfitOrderId = tpOrder.id;
    console.log(`   ✅ 停利單設定成功！`);
    console.log(`   停利單 ID: ${takeProfitOrderId}`);
  } catch (error: any) {
    console.log(`   ❌ 停利單設定失敗: ${error.message}`);
  }

  // 等待一下
  await sleep(2000);

  // 9. 取消條件單（準備平倉）
  console.log('\n9️⃣ 取消條件單...');

  if (stopLossOrderId) {
    try {
      await mexc.cancelOrder(stopLossOrderId, TEST_SYMBOL);
      console.log(`   ✅ 停損單已取消`);
    } catch (error: any) {
      console.log(`   ⚠️ 取消停損單失敗: ${error.message}`);
    }
  }

  if (takeProfitOrderId) {
    try {
      await mexc.cancelOrder(takeProfitOrderId, TEST_SYMBOL);
      console.log(`   ✅ 停利單已取消`);
    } catch (error: any) {
      console.log(`   ⚠️ 取消停利單失敗: ${error.message}`);
    }
  }

  // 10. 平倉
  console.log('\n🔟 平倉...');
  let exitPrice: number;
  let closeFee: number = 0;
  let closeOrderId: string;

  try {
    const closeOrder = await mexc.createOrder(
      TEST_SYMBOL,
      'market',
      'sell',
      TEST_AMOUNT,
      undefined,
      {
        positionSide: 'LONG',
        reduceOnly: true,
      }
    );

    closeOrderId = closeOrder.id;
    exitPrice = closeOrder.average || closeOrder.price || currentPrice;
    closeFee = closeOrder.fee?.cost || 0;

    console.log(`   ✅ 平倉成功！`);
    console.log(`   訂單 ID: ${closeOrderId}`);
    console.log(`   成交價格: ${exitPrice}`);
    console.log(`   手續費: ${closeFee} ${closeOrder.fee?.currency || 'USDT'}`);
  } catch (error: any) {
    console.log(`   ❌ 平倉失敗: ${error.message}`);
    await prisma.$disconnect();
    return;
  }

  const tradeEndTime = Date.now();

  // 11. 查詢資金費率記錄
  console.log('\n1️⃣1️⃣ 查詢資金費率記錄...');
  let fundingFee: number = 0;
  try {
    // 嘗試獲取資金費率歷史
    const fundingHistory = await mexc.fetchFundingHistory(TEST_SYMBOL, tradeStartTime, undefined, { limit: 10 });

    if (fundingHistory && fundingHistory.length > 0) {
      console.log(`   找到 ${fundingHistory.length} 筆資金費率記錄:`);
      fundingHistory.forEach((record: any) => {
        const time = new Date(record.timestamp).toLocaleString();
        const amount = record.amount || 0;
        fundingFee += amount;
        console.log(`   - ${time}: ${amount >= 0 ? '+' : ''}${amount} USDT`);
      });
    } else {
      console.log('   ℹ️ 交易期間無資金費率結算');
    }
  } catch (error: any) {
    console.log(`   ⚠️ 無法獲取資金費率記錄: ${error.message}`);
    console.log('   ℹ️ 可能是因為交易時間太短，未經過資金費率結算時點');
  }

  // 12. 查詢交易記錄
  console.log('\n1️⃣2️⃣ 查詢交易記錄...');
  try {
    const trades = await mexc.fetchMyTrades(TEST_SYMBOL, tradeStartTime, undefined, { limit: 10 });

    if (trades && trades.length > 0) {
      console.log(`   找到 ${trades.length} 筆交易記錄:`);
      let totalFees = 0;
      trades.forEach((trade: any) => {
        const time = new Date(trade.timestamp).toLocaleString();
        const side = trade.side;
        const amount = trade.amount;
        const price = trade.price;
        const fee = trade.fee?.cost || 0;
        totalFees += fee;
        console.log(`   - ${time}: ${side.toUpperCase()} ${amount} @ ${price}, 手續費: ${fee}`);
      });
      console.log(`   總手續費: ${totalFees} USDT`);

      // 使用實際交易記錄更新費用
      if (totalFees > 0) {
        openFee = totalFees / 2; // 假設開平倉各一半
        closeFee = totalFees / 2;
      }
    }
  } catch (error: any) {
    console.log(`   ⚠️ 無法獲取交易記錄: ${error.message}`);
  }

  // 13. 計算損益
  console.log('\n1️⃣3️⃣ 損益計算...');
  console.log('   ' + '-'.repeat(40));

  const positionPnl = (exitPrice - entryPrice) * TEST_AMOUNT;
  const totalFees = openFee + closeFee;
  const netPnl = positionPnl - totalFees + fundingFee;

  console.log(`   入場價格:     ${entryPrice} USDT`);
  console.log(`   出場價格:     ${exitPrice} USDT`);
  console.log(`   數量:         ${TEST_AMOUNT} BTC`);
  console.log('   ' + '-'.repeat(40));
  console.log(`   持倉損益:     ${positionPnl >= 0 ? '+' : ''}${positionPnl.toFixed(6)} USDT`);
  console.log(`   開倉手續費:   -${openFee.toFixed(6)} USDT`);
  console.log(`   平倉手續費:   -${closeFee.toFixed(6)} USDT`);
  console.log(`   資金費率:     ${fundingFee >= 0 ? '+' : ''}${fundingFee.toFixed(6)} USDT`);
  console.log('   ' + '-'.repeat(40));
  console.log(`   淨損益:       ${netPnl >= 0 ? '+' : ''}${netPnl.toFixed(6)} USDT`);

  // 14. 確認最終餘額
  console.log('\n1️⃣4️⃣ 確認最終餘額...');
  try {
    const finalBalance = await mexc.fetchBalance();
    const finalUSDT = finalBalance.total?.USDT || 0;
    const actualPnl = finalUSDT - initialBalance;

    console.log(`   初始餘額:     ${initialBalance.toFixed(6)} USDT`);
    console.log(`   最終餘額:     ${finalUSDT.toFixed(6)} USDT`);
    console.log(`   實際變化:     ${actualPnl >= 0 ? '+' : ''}${actualPnl.toFixed(6)} USDT`);

    if (Math.abs(actualPnl - netPnl) > 0.01) {
      console.log(`   ⚠️ 計算差異: ${(actualPnl - netPnl).toFixed(6)} USDT (可能有未計入的費用)`);
    }
  } catch (error: any) {
    console.log(`   ❌ 獲取最終餘額失敗: ${error.message}`);
  }

  // 15. 確認持倉已清空
  console.log('\n1️⃣5️⃣ 確認持倉已清空...');
  try {
    const positions = await mexc.fetchPositions([TEST_SYMBOL]);
    const position = positions.find((p: any) =>
      p.symbol === TEST_SYMBOL &&
      parseFloat(p.contracts || '0') > 0
    );

    if (!position) {
      console.log('   ✅ 持倉已清空！');
    } else {
      console.log(`   ⚠️ 仍有持倉: ${position.contracts} 張`);
    }
  } catch (error: any) {
    console.log(`   ❌ 確認持倉失敗: ${error.message}`);
  }

  // 交易摘要
  console.log('\n' + '='.repeat(60));
  console.log('交易摘要');
  console.log('='.repeat(60));
  console.log(`交易對:       ${TEST_SYMBOL}`);
  console.log(`交易時長:     ${((tradeEndTime - tradeStartTime) / 1000).toFixed(1)} 秒`);
  console.log(`入場價格:     ${entryPrice} USDT`);
  console.log(`出場價格:     ${exitPrice} USDT`);
  console.log(`淨損益:       ${netPnl >= 0 ? '+' : ''}${netPnl.toFixed(6)} USDT`);
  console.log('='.repeat(60));
  console.log('測試完成 ✅');
  console.log('='.repeat(60));

  await prisma.$disconnect();
}

testMexcFullTrade().catch(async (error) => {
  console.error('測試發生錯誤:', error);
  await prisma.$disconnect();
});
