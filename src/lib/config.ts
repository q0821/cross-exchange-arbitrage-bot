import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import dotenv from 'dotenv';

// 載入環境變數
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 配置 schema 定義
const ExchangeConfigSchema = z.object({
  name: z.string(),
  testnet: z.boolean(),
  apiEndpoint: z.string().url(),
  wsEndpoint: z.string().url(),
  rateLimit: z.object({
    ordersPerSecond: z.number().positive(),
    requestsPerMinute: z.number().positive(),
  }),
});

const TradingConfigSchema = z.object({
  minSpreadThreshold: z.number().positive(),
  maxPositionSizeUsd: z.number().positive(),
  defaultLeverage: z.number().int().min(1).max(20),
  orderTimeoutMs: z.number().positive(),
  slippageTolerance: z.number().positive(),
});

const RiskConfigSchema = z.object({
  maxDailyLoss: z.number().positive(),
  maxDrawdown: z.number().positive().max(1),
  positionSizePercent: z.number().positive().max(1),
  stopLossPercent: z.number().positive(),
  emergencyStopLoss: z.number().positive(),
});

const MonitoringConfigSchema = z.object({
  healthCheckIntervalMs: z.number().positive(),
  priceUpdateIntervalMs: z.number().positive(),
  fundingRateCheckIntervalMs: z.number().positive(),
  maxPriceDeviationPercent: z.number().positive(),
});

const ConfigSchema = z.object({
  app: z.object({
    name: z.string(),
    version: z.string(),
    env: z.enum(['development', 'production', 'test']),
  }),
  server: z.object({
    port: z.number().int().positive(),
    host: z.string(),
  }),
  exchanges: z.object({
    binance: ExchangeConfigSchema,
    okx: ExchangeConfigSchema,
  }),
  trading: TradingConfigSchema,
  risk: RiskConfigSchema,
  monitoring: MonitoringConfigSchema,
  database: z.object({
    connectionPoolMin: z.number().int().positive(),
    connectionPoolMax: z.number().int().positive(),
    queryTimeout: z.number().int().positive(),
    enableLogging: z.boolean(),
  }),
  redis: z.object({
    keyPrefix: z.string(),
    ttl: z.object({
      fundingRate: z.number().int().positive(),
      price: z.number().int().positive(),
      opportunity: z.number().int().positive(),
    }),
  }),
  logging: z.object({
    level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']),
    pretty: z.boolean(),
    file: z.object({
      enabled: z.boolean(),
      path: z.string(),
      maxSize: z.string(),
      maxFiles: z.number().int().positive(),
    }),
  }),
  notifications: z.object({
    telegram: z.object({
      enabled: z.boolean(),
      notifyOnOpportunity: z.boolean(),
      notifyOnTrade: z.boolean(),
      notifyOnError: z.boolean(),
      minOpportunitySpread: z.number().positive(),
    }),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

// 載入配置檔案
function loadConfig(): Config {
  const configPath = join(__dirname, '../../config/default.json');
  const configFile = readFileSync(configPath, 'utf-8');
  const configJson = JSON.parse(configFile);

  // 從環境變數覆蓋配置
  const config = {
    ...configJson,
    app: {
      ...configJson.app,
      env: process.env.NODE_ENV || configJson.app.env,
    },
    trading: {
      ...configJson.trading,
      minSpreadThreshold:
        parseFloat(process.env.MIN_SPREAD_THRESHOLD || '') ||
        configJson.trading.minSpreadThreshold,
      maxPositionSizeUsd:
        parseFloat(process.env.MAX_POSITION_SIZE_USD || '') ||
        configJson.trading.maxPositionSizeUsd,
      defaultLeverage:
        parseInt(process.env.DEFAULT_LEVERAGE || '', 10) || configJson.trading.defaultLeverage,
    },
    risk: {
      ...configJson.risk,
      maxDailyLoss:
        parseFloat(process.env.MAX_DAILY_LOSS || '') || configJson.risk.maxDailyLoss,
      maxDrawdown: parseFloat(process.env.MAX_DRAWDOWN || '') || configJson.risk.maxDrawdown,
      positionSizePercent:
        parseFloat(process.env.POSITION_SIZE_PERCENT || '') ||
        configJson.risk.positionSizePercent,
    },
    monitoring: {
      ...configJson.monitoring,
      healthCheckIntervalMs:
        parseInt(process.env.HEALTH_CHECK_INTERVAL_MS || '', 10) ||
        configJson.monitoring.healthCheckIntervalMs,
      priceUpdateIntervalMs:
        parseInt(process.env.PRICE_UPDATE_INTERVAL_MS || '', 10) ||
        configJson.monitoring.priceUpdateIntervalMs,
      fundingRateCheckIntervalMs:
        parseInt(process.env.FUNDING_RATE_CHECK_INTERVAL_MS || '', 10) ||
        configJson.monitoring.fundingRateCheckIntervalMs,
    },
    logging: {
      ...configJson.logging,
      level: process.env.LOG_LEVEL || configJson.logging.level,
      pretty:
        process.env.LOG_PRETTY === 'true' ||
        process.env.LOG_PRETTY === 'false'
          ? process.env.LOG_PRETTY === 'true'
          : configJson.logging.pretty,
    },
  };

  // 驗證配置
  const result = ConfigSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid configuration: ${result.error.message}`);
  }

  return result.data;
}

// 匯出配置實例
export const config = loadConfig();

// API 金鑰配置 (從環境變數讀取，不放在配置檔案中)
export const apiKeys = {
  binance: {
    apiKey: process.env.BINANCE_API_KEY || '',
    apiSecret: process.env.BINANCE_API_SECRET || '',
    testnet: process.env.BINANCE_TESTNET === 'true',
  },
  okx: {
    apiKey: process.env.OKX_API_KEY || '',
    apiSecret: process.env.OKX_API_SECRET || '',
    passphrase: process.env.OKX_PASSPHRASE || '',
    testnet: process.env.OKX_TESTNET === 'true',
  },
  mexc: {
    apiKey: process.env.MEXC_API_KEY || '',
    apiSecret: process.env.MEXC_API_SECRET || '',
    testnet: process.env.MEXC_TESTNET === 'true',
  },
  gateio: {
    apiKey: process.env.GATEIO_API_KEY || '',
    apiSecret: process.env.GATEIO_API_SECRET || '',
    testnet: process.env.GATEIO_TESTNET === 'true',
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  },
};

// 驗證必要的 API 金鑰是否存在
export function validateApiKeys(): void {
  const missingKeys: string[] = [];

  if (!apiKeys.binance.apiKey) missingKeys.push('BINANCE_API_KEY');
  if (!apiKeys.binance.apiSecret) missingKeys.push('BINANCE_API_SECRET');
  if (!apiKeys.okx.apiKey) missingKeys.push('OKX_API_KEY');
  if (!apiKeys.okx.apiSecret) missingKeys.push('OKX_API_SECRET');
  if (!apiKeys.okx.passphrase) missingKeys.push('OKX_PASSPHRASE');

  if (missingKeys.length > 0) {
    throw new Error(
      `Missing required API keys: ${missingKeys.join(', ')}. Please check your .env file.`
    );
  }
}

export default config;
