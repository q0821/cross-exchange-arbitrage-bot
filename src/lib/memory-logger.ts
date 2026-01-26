/**
 * Memory Logger
 *
 * 記憶體監控專用日誌，輸出到獨立的 logs/memory/ 目錄
 * Feature: 066-memory-monitoring
 */

import pino from 'pino';
import fs from 'fs';
import path from 'path';

const isDevelopment = process.env.NODE_ENV === 'development';
const isNextRuntime = !!process.env.NEXT_RUNTIME;

/**
 * 取得當天日期作為檔名
 */
function getDateFilename(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}.log`;
}

/**
 * 確保目錄存在
 */
function ensureLogDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Log 目錄路徑
const logsBaseDir = path.join(process.cwd(), 'logs');
const memoryDir = path.join(logsBaseDir, 'memory');

/**
 * 建立記憶體專用 logger 實例
 */
function createMemoryLogger(): pino.Logger {
  const baseOptions: pino.LoggerOptions = {
    level: 'info',
    formatters: {
      level: (label: string) => {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  // Next.js runtime：不寫入檔案（避免 worker thread 問題）
  if (isNextRuntime) {
    // 返回一個禁用的 logger，不輸出任何東西
    return pino({
      ...baseOptions,
      level: 'silent',
    });
  }

  // 確保目錄存在
  ensureLogDir(logsBaseDir);
  ensureLogDir(memoryDir);

  const dateFilename = getDateFilename();

  // 建立串流
  const streams: pino.StreamEntry[] = [
    // 記憶體日誌 → logs/memory/
    {
      level: 'info',
      stream: pino.destination({
        dest: path.join(memoryDir, dateFilename),
        sync: false,
      }),
    },
  ];

  // 開發環境也輸出到 stdout
  if (isDevelopment) {
    streams.push({
      level: 'info',
      stream: process.stdout,
    });
  }

  return pino(baseOptions, pino.multistream(streams));
}

/**
 * 記憶體監控專用 logger
 *
 * 輸出到 logs/memory/YYYY-MM-DD.log
 */
export const memoryLogger = createMemoryLogger();

/**
 * 建立子 logger 的輔助函式
 */
export function createMemoryChildLogger(context: string) {
  return memoryLogger.child({ context });
}

export default memoryLogger;
