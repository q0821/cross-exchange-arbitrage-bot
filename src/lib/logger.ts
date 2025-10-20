import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || 'info';
const prettyPrint = process.env.LOG_PRETTY === 'true' || !isProduction;

export const logger = pino({
  level: logLevel,
  ...(prettyPrint && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        singleLine: false,
      },
    },
  }),
  ...(!prettyPrint && {
    formatters: {
      level: (label: string) => {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
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
