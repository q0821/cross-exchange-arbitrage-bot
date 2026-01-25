#!/usr/bin/env node
/**
 * Test Gate.io Conditional Order with Realistic Price
 *
 * 使用實際市場價格測試 Gate.io 停損停利價格精度
 */

import { PrismaClient } from '@/generated/prisma/client';
import Decimal from 'decimal.js';
import { decrypt } from '../lib/encryption';
import { createCcxtExchange } from '../../src/lib/ccxt-factory';
import { GateioConditionalOrderAdapter } from '../services/trading/adapters/GateioConditionalOrderAdapter';

const prisma = new PrismaClient();

async function main() {
  const symbol = process.argv[2] || 'PIPPINUSDT';

  console.log('\n🧪 Gate.io 條件單價格精度測試');
  console.log('='.repeat(60));
  console.log(`📅 時間: ${new Date().toISOString()}`);
  console.log(`💱 交易對: ${symbol}`);

  try {
    // 獲取 API Key
    const apiKey = await prisma.apiKey.findFirst({
      where: { exchange: 'gateio', isActive: true },
    });

    if (!apiKey) {
      console.log('❌ 找不到 Gate.io API Key');
      return;
    }

    console.log(`👤 用戶 ID: ${apiKey.userId}`);


    const gateio = createCcxtExchange('gateio', {
      apiKey: decrypt(apiKey.encryptedKey),
      secret: decrypt(apiKey.encryptedSecret),
      options: { defaultType: 'swap' },
    });

    // 載入市場
    console.log('\n📊 載入市場資訊...');
    await gateio.loadMarkets();

    // 獲取當前價格
    const ccxtSymbol = symbol.replace('USDT', '/USDT:USDT');
    const ticker = await gateio.fetchTicker(ccxtSymbol);
    const currentPrice = ticker.last || 0;

    console.log(`💰 當前價格: ${currentPrice}`);

    // 檢查市場精度
    const market = gateio.markets[ccxtSymbol];
    if (market) {
      console.log(`📐 價格精度: ${market.precision?.price}`);
      console.log(`📐 數量精度: ${market.precision?.amount}`);
    }

    // 計算停損停利價格
    const stopLossPrice = new Decimal(currentPrice).times(0.9); // -10%
    const takeProfitPrice = new Decimal(currentPrice).times(1.1); // +10%

    console.log(`\n🎯 測試價格:`);
    console.log(`   原始停損: ${stopLossPrice.toString()}`);
    console.log(`   原始停利: ${takeProfitPrice.toString()}`);

    // 格式化價格
    const formattedSL = gateio.priceToPrecision(ccxtSymbol, stopLossPrice.toNumber());
    const formattedTP = gateio.priceToPrecision(ccxtSymbol, takeProfitPrice.toNumber());

    console.log(`   格式化停損: ${formattedSL}`);
    console.log(`   格式化停利: ${formattedTP}`);

    // 創建適配器並測試
    const adapter = new GateioConditionalOrderAdapter(gateio);

    console.log('\n🔴 測試停損單...');
    const slResult = await adapter.setStopLossOrder({
      symbol,
      side: 'LONG',
      quantity: new Decimal(1),
      triggerPrice: stopLossPrice,
    });

    if (slResult.success) {
      console.log(`✅ 停損單創建成功! Order ID: ${slResult.orderId}`);

      // 取消訂單
      await adapter.cancelConditionalOrder(symbol, slResult.orderId!);
      console.log(`🗑️ 已取消停損單`);
    } else {
      console.log(`❌ 停損單失敗: ${slResult.error}`);
    }

    console.log('\n🟢 測試停利單...');
    const tpResult = await adapter.setTakeProfitOrder({
      symbol,
      side: 'LONG',
      quantity: new Decimal(1),
      triggerPrice: takeProfitPrice,
    });

    if (tpResult.success) {
      console.log(`✅ 停利單創建成功! Order ID: ${tpResult.orderId}`);

      // 取消訂單
      await adapter.cancelConditionalOrder(symbol, tpResult.orderId!);
      console.log(`🗑️ 已取消停利單`);
    } else {
      console.log(`❌ 停利單失敗: ${tpResult.error}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ 測試完成');

  } catch (error) {
    console.error('❌ 測試失敗:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
