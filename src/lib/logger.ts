import pino from 'pino';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const logLevel = process.env.LOG_LEVEL || 'info';

// 確保 logs 目錄存在
const logFilePath = 'logs/monitor.log';
mkdirSync(dirname(logFilePath), { recursive: true });

export const logger = pino({
  level: logLevel,
  transport: {
    target: 'pino/file',
    options: {
      destination: logFilePath,
      mkdir: true
    }
  },
  formatters: {
    level: (label: string) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
}) as pino.Logger;

// 建立子 logger 的輔助函式
export function createLogger(context: string) {
  return logger.child({ context });
}

// 常用的領域 logger
export const exchangeLogger = createLogger('exchange');
export const tradingLogger = createLogger('trading');
export const arbitrageLogger = createLogger('arbitrage');
export const riskLogger = createLogger('risk');
export const wsLogger = createLogger('websocket');
export const dbLogger = createLogger('database');
export const cliLogger = createLogger('cli');

export default logger;
