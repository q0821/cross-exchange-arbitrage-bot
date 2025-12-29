#!/usr/bin/env node
/**
 * 交易操作驗證腳本 CLI
 * Feature: 049-trading-validation-script
 *
 * 使用方式：
 *
 * 1. 互動模式（推薦）
 * pnpm validate-trading
 *
 * 2. 完整驗證（開倉→停損停利→平倉）
 * pnpm validate-trading run \
 *   --exchange gateio \
 *   --symbol BTCUSDT \
 *   --quantity 10 \
 *   --leverage 1 \
 *   --stop-loss 5 \
 *   --take-profit 5 \
 *   --email user@example.com
 *
 * 3. 查詢驗證（驗證現有持倉）
 * pnpm validate-trading verify \
 *   --position-id <positionId>
 *
 * 4. JSON 輸出
 * pnpm validate-trading run \
 *   --exchange gateio \
 *   --symbol BTCUSDT \
 *   --quantity 10 \
 *   --json
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import { TradingValidator } from './TradingValidator';
import { SUPPORTED_EXCHANGES, type ExchangeName, type RunParams, type VerifyParams } from './types';

/**
 * 安全檢查：僅允許在開發環境執行
 */
function checkEnvironment(): void {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const allowedEnvs = ['development', 'test'];

  if (!allowedEnvs.includes(nodeEnv)) {
    console.error('');
    console.error('══════════════════════════════════════════════════════════════════════');
    console.error('❌ 安全警告：此腳本僅允許在開發環境中執行');
    console.error('══════════════════════════════════════════════════════════════════════');
    console.error(`   當前環境: NODE_ENV=${nodeEnv}`);
    console.error(`   允許環境: ${allowedEnvs.join(', ')}`);
    console.error('');
    console.error('   如果您確實需要在正式環境執行，請設定:');
    console.error('   TRADING_VALIDATION_ALLOW_PROD=true');
    console.error('══════════════════════════════════════════════════════════════════════');
    console.error('');

    // 提供覆蓋選項（需要明確設定環境變數）
    if (process.env.TRADING_VALIDATION_ALLOW_PROD !== 'true') {
      process.exit(1);
    }

    console.warn('⚠️  警告：正式環境保護已被覆蓋，請謹慎操作');
  }
}

// 執行安全檢查
checkEnvironment();

const program = new Command();

program
  .name('validate-trading')
  .description('交易操作驗證腳本 - 驗證開倉、停損停利、平倉流程')
  .version('1.0.0');

/**
 * run 命令 - 完整驗證流程
 */
program
  .command('run')
  .description('執行完整驗證流程（開倉→停損停利→平倉）')
  .requiredOption('-e, --exchange <exchange>', `交易所 (${SUPPORTED_EXCHANGES.join(', ')})`)
  .requiredOption('-s, --symbol <symbol>', '交易對 (e.g., BTCUSDT)')
  .requiredOption('-q, --quantity <quantity>', '開倉金額 (USDT)', parseFloat)
  .requiredOption('-m, --email <email>', '用戶 Email')
  .option('-l, --leverage <leverage>', '槓桿倍數', parseFloat, 1)
  .option('--stop-loss <percent>', '停損百分比', parseFloat)
  .option('--take-profit <percent>', '停利百分比', parseFloat)
  .option('--json', '輸出 JSON 格式')
  .action(async (options) => {
    try {
      // 驗證交易所
      const exchange = options.exchange.toLowerCase() as ExchangeName;
      if (!SUPPORTED_EXCHANGES.includes(exchange)) {
        console.error(`錯誤: 不支援的交易所 "${options.exchange}"`);
        console.error(`支援的交易所: ${SUPPORTED_EXCHANGES.join(', ')}`);
        process.exit(2);
      }

      // 驗證數量
      if (options.quantity <= 0) {
        console.error('錯誤: 開倉金額必須大於 0');
        process.exit(2);
      }

      // 驗證槓桿
      if (options.leverage < 1 || options.leverage > 125) {
        console.error('錯誤: 槓桿倍數必須在 1-125 之間');
        process.exit(2);
      }

      // 驗證停損停利百分比
      if (options.stopLoss !== undefined && (options.stopLoss <= 0 || options.stopLoss > 100)) {
        console.error('錯誤: 停損百分比必須在 0-100 之間');
        process.exit(2);
      }

      if (options.takeProfit !== undefined && (options.takeProfit <= 0 || options.takeProfit > 100)) {
        console.error('錯誤: 停利百分比必須在 0-100 之間');
        process.exit(2);
      }

      const params: RunParams = {
        exchange,
        symbol: options.symbol.toUpperCase(),
        quantity: options.quantity,
        leverage: options.leverage,
        stopLossPercent: options.stopLoss,
        takeProfitPercent: options.takeProfit,
        email: options.email,
        json: options.json,
      };

      console.log('');
      console.log('══════════════════════════════════════════════════════════════════════');
      console.log('交易操作驗證腳本');
      console.log('══════════════════════════════════════════════════════════════════════');
      console.log(`交易所: ${exchange}`);
      console.log(`交易對: ${params.symbol}`);
      console.log(`開倉金額: ${params.quantity} USDT`);
      console.log(`槓桿倍數: ${params.leverage}x`);
      if (params.stopLossPercent) {
        console.log(`停損百分比: ${params.stopLossPercent}%`);
      }
      if (params.takeProfitPercent) {
        console.log(`停利百分比: ${params.takeProfitPercent}%`);
      }
      console.log('══════════════════════════════════════════════════════════════════════');

      const validator = new TradingValidator();
      await validator.runFullValidation(params);

    } catch (error) {
      console.error('執行錯誤:', error instanceof Error ? error.message : error);
      process.exit(2);
    }
  });

/**
 * verify 命令 - 查詢驗證
 */
program
  .command('verify')
  .description('驗證現有持倉的交易所狀態')
  .requiredOption('-p, --position-id <positionId>', '持倉 ID')
  .option('--json', '輸出 JSON 格式')
  .action(async (options) => {
    try {
      const params: VerifyParams = {
        positionId: options.positionId,
        json: options.json,
      };

      console.log('');
      console.log('══════════════════════════════════════════════════════════════════════');
      console.log('交易操作驗證腳本 - 查詢模式');
      console.log('══════════════════════════════════════════════════════════════════════');
      console.log(`持倉 ID: ${params.positionId}`);
      console.log('══════════════════════════════════════════════════════════════════════');

      const validator = new TradingValidator();
      await validator.verifyPosition(params);

    } catch (error) {
      console.error('執行錯誤:', error instanceof Error ? error.message : error);
      process.exit(2);
    }
  });

/**
 * 互動模式
 */
async function runInteractiveMode(): Promise<void> {
  console.log('');
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('交易操作驗證腳本 - 互動模式');
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('');

  // 1. 選擇驗證模式
  const { mode } = await inquirer.prompt([
    {
      type: 'rawlist',
      name: 'mode',
      message: '請選擇驗證模式 (輸入數字):',
      choices: [
        { name: '完整驗證 (開倉 → 停損停利 → 平倉)', value: 'run' },
        { name: '查詢驗證 (驗證現有持倉)', value: 'verify' },
      ],
    },
  ]);

  if (mode === 'verify') {
    // 查詢驗證模式
    const { positionId } = await inquirer.prompt([
      {
        type: 'input',
        name: 'positionId',
        message: '請輸入持倉 ID:',
        validate: (input: string) => input.trim() !== '' || '持倉 ID 不能為空',
      },
    ]);

    const params: VerifyParams = {
      positionId: positionId.trim(),
      json: false,
    };

    const validator = new TradingValidator();
    await validator.verifyPosition(params);
    return;
  }

  // 2. 完整驗證模式 - 收集參數
  const answers = await inquirer.prompt([
    {
      type: 'rawlist',
      name: 'longExchange',
      message: '請選擇做多交易所 (輸入數字):',
      choices: [
        { name: 'Binance', value: 'binance' },
        { name: 'OKX', value: 'okx' },
        { name: 'Gate.io', value: 'gateio' },
        { name: 'BingX', value: 'bingx' },
      ],
    },
    {
      type: 'rawlist',
      name: 'shortExchange',
      message: '請選擇做空交易所 (輸入數字):',
      choices: [
        { name: 'Binance', value: 'binance' },
        { name: 'OKX', value: 'okx' },
        { name: 'Gate.io', value: 'gateio' },
        { name: 'BingX', value: 'bingx' },
      ],
    },
    {
      type: 'input',
      name: 'symbol',
      message: '請輸入交易對 (例如 BTCUSDT):',
      default: 'BTCUSDT',
      validate: (input: string) => input.trim() !== '' || '交易對不能為空',
      filter: (input: string) => input.toUpperCase().trim(),
    },
    {
      type: 'input',
      name: 'email',
      message: '請輸入用戶 Email:',
      validate: (input: string) => {
        if (input.trim() === '') return 'Email 不能為空';
        if (!input.includes('@')) return '請輸入有效的 Email 格式';
        return true;
      },
    },
    {
      type: 'input',
      name: 'quantity',
      message: '請輸入開倉數量 (幣本位，如 BTC 輸入 0.001，注意當前幣價!):',
      default: '0.001',
      validate: (input: string) => {
        const num = parseFloat(input);
        if (isNaN(num) || num <= 0) return '數量必須大於 0';
        return true;
      },
      filter: (input: string) => parseFloat(input),
    },
    {
      type: 'number',
      name: 'leverage',
      message: '請輸入槓桿倍數:',
      default: 1,
      validate: (input: number) => (input >= 1 && input <= 125) || '槓桿必須在 1-125 之間',
    },
    {
      type: 'confirm',
      name: 'enableStopLoss',
      message: '是否啟用停損?',
      default: true,
    },
    {
      type: 'number',
      name: 'stopLossPercent',
      message: '請輸入停損百分比 (%):',
      default: 5,
      when: (answers: any) => answers.enableStopLoss,
      validate: (input: number) => (input > 0 && input <= 100) || '停損百分比必須在 0-100 之間',
    },
    {
      type: 'confirm',
      name: 'enableTakeProfit',
      message: '是否啟用停利?',
      default: true,
    },
    {
      type: 'number',
      name: 'takeProfitPercent',
      message: '請輸入停利百分比 (%):',
      default: 5,
      when: (answers: any) => answers.enableTakeProfit,
      validate: (input: number) => (input > 0 && input <= 100) || '停利百分比必須在 0-100 之間',
    },
  ]);

  // 3. 確認參數
  console.log('');
  console.log('──────────────────────────────────────────────────────────────────────');
  console.log('📋 驗證參數確認');
  console.log('──────────────────────────────────────────────────────────────────────');
  const coinName = answers.symbol.replace('USDT', '');
  console.log(`   做多交易所: ${answers.longExchange}`);
  console.log(`   做空交易所: ${answers.shortExchange}`);
  console.log(`   交易對: ${answers.symbol}`);
  console.log(`   Email: ${answers.email}`);
  console.log(`   開倉數量: ${answers.quantity} ${coinName}`);
  console.log(`   槓桿倍數: ${answers.leverage}x`);
  if (answers.enableStopLoss) {
    console.log(`   停損: ${answers.stopLossPercent}%`);
  }
  if (answers.enableTakeProfit) {
    console.log(`   停利: ${answers.takeProfitPercent}%`);
  }
  console.log('──────────────────────────────────────────────────────────────────────');
  console.log('');

  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: '確認開始驗證? (這將會執行真實交易)',
      default: false,
    },
  ]);

  if (!confirmed) {
    console.log('已取消驗證');
    process.exit(0);
  }

  // 4. 執行驗證
  const params: RunParams = {
    longExchange: answers.longExchange as ExchangeName,
    shortExchange: answers.shortExchange as ExchangeName,
    symbol: answers.symbol,
    quantity: answers.quantity,
    leverage: answers.leverage,
    stopLossPercent: answers.enableStopLoss ? answers.stopLossPercent : undefined,
    takeProfitPercent: answers.enableTakeProfit ? answers.takeProfitPercent : undefined,
    email: answers.email,
    json: false,
  };

  const validator = new TradingValidator();
  await validator.runFullValidation(params);
}

// 如果沒有提供任何命令，進入互動模式
if (process.argv.length <= 2) {
  runInteractiveMode().catch((error) => {
    console.error('執行錯誤:', error instanceof Error ? error.message : error);
    process.exit(2);
  });
} else {
  // 解析命令列參數
  program.parse();
}
