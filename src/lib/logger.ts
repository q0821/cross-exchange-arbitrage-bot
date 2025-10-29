import pino from 'pino';

const logLevel = process.env.LOG_LEVEL || 'info';
const isDevelopment = process.env.NODE_ENV === 'development';

// Next.js 環境中使用簡單的 stdout 配置，避免 worker thread 問題
export const logger = pino({
  level: logLevel,
  formatters: {
    level: (label: string) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // 開發環境使用 pretty print，但不使用 transport（避免 worker thread）
  ...(isDevelopment && !process.env.NEXT_RUNTIME && {
    transport: undefined,
  }),
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
