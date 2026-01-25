import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { Writable } from 'stream';

const logLevel = process.env.LOG_LEVEL || 'info';
const isDevelopment = process.env.NODE_ENV === 'development';
const isNextRuntime = !!process.env.NEXT_RUNTIME;

// Pino level 數值對照
const LEVEL_VALUES = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
} as const;

// 取得當天日期作為檔名
function getDateFilename(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}.log`;
}

// 確保目錄存在
function ensureLogDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 建立過濾特定 level 的 stream
function createFilteredStream(
  destPath: string,
  filterFn: (level: number) => boolean
): Writable {
  const dest = pino.destination({ dest: destPath, sync: false });

  return new Writable({
    write(chunk: Buffer, _encoding, callback) {
      try {
        const log = JSON.parse(chunk.toString());
        const levelValue = typeof log.level === 'number'
          ? log.level
          : LEVEL_VALUES[log.level as keyof typeof LEVEL_VALUES] || 30;

        if (filterFn(levelValue)) {
          dest.write(chunk.toString());
        }
        callback();
      } catch {
        // 無法解析時直接寫入
        dest.write(chunk.toString());
        callback();
      }
    },
  });
}

// Log 目錄路徑
const logsBaseDir = path.join(process.cwd(), 'logs');
const criticalDir = path.join(logsBaseDir, 'critical');
const warningDir = path.join(logsBaseDir, 'warning');

// 建立 logger 實例
function createPinoLogger(): pino.Logger {
  const baseOptions: pino.LoggerOptions = {
    level: logLevel,
    formatters: {
      level: (label: string) => {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  // Next.js runtime：只輸出到 stdout，不寫入檔案（避免 worker thread 問題）
  if (isNextRuntime) {
    return pino(baseOptions);
  }

  // 確保目錄存在
  ensureLogDir(logsBaseDir);
  ensureLogDir(criticalDir);
  ensureLogDir(warningDir);

  const dateFilename = getDateFilename();

  // 建立多重串流（精確過濾）
  const streams: pino.StreamEntry[] = [
    // 完整 log（所有 level）→ logs/
    {
      level: 'trace',
      stream: pino.destination({
        dest: path.join(logsBaseDir, dateFilename),
        sync: false,
      }),
    },
    // Warning only → logs/warning/
    {
      level: 'warn',
      stream: createFilteredStream(
        path.join(warningDir, dateFilename),
        (level) => level === LEVEL_VALUES.warn // warn only
      ),
    },
    // Error/Fatal → logs/critical/
    {
      level: 'error',
      stream: createFilteredStream(
        path.join(criticalDir, dateFilename),
        (level) => level >= LEVEL_VALUES.error // error, fatal
      ),
    },
  ];

  // 開發環境也輸出到 stdout（所有 level）
  if (isDevelopment) {
    streams.push({
      level: 'trace',
      stream: process.stdout,
    });
  }

  return pino(baseOptions, pino.multistream(streams));
}

export const logger = createPinoLogger();

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
