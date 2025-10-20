#!/usr/bin/env node
import { Command } from 'commander';
import { createMonitorStartCommand } from './commands/monitor/start.js';
import { createMonitorStatusCommand } from './commands/monitor/status.js';
import { logger } from '../lib/logger.js';

const program = new Command();

program
  .name('arbitrage-bot')
  .description('Cross-Exchange Arbitrage Bot - 跨交易所資金費率套利機器人')
  .version('1.0.0');

// Monitor 指令群組
const monitorCommand = new Command('monitor');
monitorCommand.description('資金費率監控相關指令');

// 註冊 monitor 子指令
monitorCommand.addCommand(createMonitorStartCommand());
monitorCommand.addCommand(createMonitorStatusCommand());

// 註冊主指令
program.addCommand(monitorCommand);

// 錯誤處理
program.exitOverride();

try {
  program.parse(process.argv);
} catch (error) {
  if (error instanceof Error) {
    const errorCode = (error as { code?: string }).code;

    // 忽略 help 和 version 相關的錯誤
    if (errorCode === 'commander.helpDisplayed' ||
        errorCode === 'commander.version' ||
        errorCode === 'commander.help') {
      process.exit(0);
    }

    logger.error({
      error: error.message,
      code: errorCode,
    }, 'CLI error');

    console.error('\n❌ 執行失敗:', error.message);
  }
  process.exit(1);
}

// 如果沒有提供任何指令，顯示幫助
if (process.argv.length === 2) {
  program.help();
}
