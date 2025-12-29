#!/usr/bin/env node
/**
 * 直接執行測試腳本
 * 繞過 inquirer 互動介面
 */

import { TradingValidator } from './TradingValidator';
import type { RunParams, ExchangeName } from './types';

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 7) {
    console.log('Usage: pnpm tsx src/scripts/trading-validation/run-test.ts <longExchange> <shortExchange> <symbol> <quantity> <stopLoss%> <takeProfit%> <email>');
    console.log('Example: pnpm tsx src/scripts/trading-validation/run-test.ts gateio bingx SUIUSDT 5 5 5 user@example.com');
    process.exit(1);
  }

  const [longExchange, shortExchange, symbol, quantity, stopLoss, takeProfit, email] = args;

  const params: RunParams = {
    longExchange: longExchange as ExchangeName,
    shortExchange: shortExchange as ExchangeName,
    symbol: symbol.toUpperCase(),
    quantity: parseFloat(quantity),
    leverage: 1,
    stopLossPercent: parseFloat(stopLoss),
    takeProfitPercent: parseFloat(takeProfit),
    email: email,
    json: false,
  };

  console.log('');
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('交易操作驗證腳本 - 直接執行模式');
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log(`做多交易所: ${params.longExchange}`);
  console.log(`做空交易所: ${params.shortExchange}`);
  console.log(`交易對: ${params.symbol}`);
  console.log(`開倉數量: ${params.quantity} (幣本位)`);
  console.log(`槓桿倍數: ${params.leverage}x`);
  console.log(`停損: ${params.stopLossPercent}%`);
  console.log(`停利: ${params.takeProfitPercent}%`);
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('');

  const validator = new TradingValidator();
  await validator.runFullValidation(params);
}

main().catch((error) => {
  console.error('執行錯誤:', error instanceof Error ? error.message : error);
  process.exit(2);
});
