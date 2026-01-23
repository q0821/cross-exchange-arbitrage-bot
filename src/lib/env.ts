/**
 * 統一環境變數驗證模組
 *
 * 在應用啟動時驗證所有環境變數，提供型別安全的存取方式。
 * 驗證失敗時會提供清楚的錯誤訊息。
 */
import dns from 'dns';
import dotenv from 'dotenv';
import { z } from 'zod';

// 設定 DNS 優先使用 IPv4
// 解決 Squid proxy 無法連接 IPv6 的問題（OKX、BingX 等交易所）
dns.setDefaultResultOrder('ipv4first');

// 確保在驗證前載入 .env 檔案
dotenv.config();

// ============================================================================
// 輔助函式
// ============================================================================

/**
 * 將字串轉換為布林值
 * 支援: 'true', '1', 'yes' -> true
 * 其他值 -> false
 */
const booleanString = z
  .string()
  .optional()
  .transform((val) => val === 'true' || val === '1' || val === 'yes');

/**
 * 將字串轉換為數字，支援預設值
 */
const numericString = (defaultValue: number) =>
  z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return defaultValue;
      const parsed = parseFloat(val);
      return isNaN(parsed) ? defaultValue : parsed;
    });

/**
 * 將字串轉換為整數，支援預設值
 */
const integerString = (defaultValue: number) =>
  z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return defaultValue;
      const parsed = parseInt(val, 10);
      return isNaN(parsed) ? defaultValue : parsed;
    });

/**
 * 可選字串，預設為空字串
 */
const optionalString = z.string().optional().default('');

// ============================================================================
// 伺服器端環境變數 Schema
// ============================================================================

const serverEnvSchema = z.object({
  // -------------------------------------------------------------------------
  // 應用程式配置
  // -------------------------------------------------------------------------
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: integerString(3000),
  HOSTNAME: z.string().optional().default('localhost'),

  // -------------------------------------------------------------------------
  // 資料庫
  // -------------------------------------------------------------------------
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // -------------------------------------------------------------------------
  // Redis（可選）
  // -------------------------------------------------------------------------
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().optional().default('localhost'),
  REDIS_PORT: integerString(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: integerString(0),

  // -------------------------------------------------------------------------
  // 認證與安全
  // -------------------------------------------------------------------------
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().optional().default('24h'),
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY must be 64 hex characters (32 bytes)'),

  // -------------------------------------------------------------------------
  // 交易所 API - Binance
  // -------------------------------------------------------------------------
  BINANCE_API_KEY: optionalString,
  BINANCE_API_SECRET: optionalString,
  BINANCE_TESTNET: booleanString,

  // -------------------------------------------------------------------------
  // 交易所 API - OKX
  // -------------------------------------------------------------------------
  OKX_API_KEY: optionalString,
  OKX_API_SECRET: optionalString,
  OKX_PASSPHRASE: optionalString,
  OKX_TESTNET: booleanString,

  // -------------------------------------------------------------------------
  // 交易所 API - MEXC
  // -------------------------------------------------------------------------
  MEXC_API_KEY: optionalString,
  MEXC_API_SECRET: optionalString,
  MEXC_TESTNET: booleanString,

  // -------------------------------------------------------------------------
  // 交易所 API - Gate.io
  // -------------------------------------------------------------------------
  GATEIO_API_KEY: optionalString,
  GATEIO_API_SECRET: optionalString,
  GATEIO_TESTNET: booleanString,

  // -------------------------------------------------------------------------
  // 交易所 API - BingX
  // -------------------------------------------------------------------------
  BINGX_API_KEY: optionalString,
  BINGX_API_SECRET: optionalString,
  BINGX_TESTNET: booleanString,

  // -------------------------------------------------------------------------
  // 通知服務
  // -------------------------------------------------------------------------
  TELEGRAM_BOT_TOKEN: optionalString,
  TELEGRAM_CHAT_ID: optionalString,

  // -------------------------------------------------------------------------
  // 郵件服務（密碼重設功能）
  // -------------------------------------------------------------------------
  SMTP_HOST: optionalString,
  SMTP_PORT: integerString(587),
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  SMTP_FROM: optionalString,

  // -------------------------------------------------------------------------
  // 密碼管理配置
  // -------------------------------------------------------------------------
  PASSWORD_RESET_EXPIRY_HOURS: integerString(1),
  PASSWORD_RESET_RATE_LIMIT_SECONDS: integerString(60),
  ACCOUNT_LOCKOUT_THRESHOLD: integerString(5),
  ACCOUNT_LOCKOUT_DURATION_MINUTES: integerString(15),

  // -------------------------------------------------------------------------
  // 交易配置
  // -------------------------------------------------------------------------
  MIN_SPREAD_THRESHOLD: numericString(0.0005),
  MAX_POSITION_SIZE_USD: numericString(10000),
  DEFAULT_LEVERAGE: integerString(1).pipe(z.number().int().min(1).max(20)),
  OPPORTUNITY_THRESHOLD_ANNUALIZED: numericString(800),

  // -------------------------------------------------------------------------
  // 風險管理
  // -------------------------------------------------------------------------
  MAX_DAILY_LOSS: numericString(1000),
  MAX_DRAWDOWN: numericString(0.1).pipe(z.number().min(0).max(1)),
  POSITION_SIZE_PERCENT: numericString(0.1).pipe(z.number().min(0).max(1)),

  // -------------------------------------------------------------------------
  // 監控配置
  // -------------------------------------------------------------------------
  HEALTH_CHECK_INTERVAL_MS: integerString(60000),
  PRICE_UPDATE_INTERVAL_MS: integerString(1000),
  FUNDING_RATE_CHECK_INTERVAL_MS: integerString(300000),
  OI_REFRESH_INTERVAL_MS: integerString(1800000),
  OI_DEFAULT_TOP_N: integerString(100),
  OI_TOP_N: integerString(30),
  OI_MIN_THRESHOLD: numericString(0),
  MONITORED_EXCHANGES: z
    .string()
    .optional()
    .default('binance,okx,mexc,gateio,bingx')
    .transform((val) => val.split(',').map((s) => s.trim())),

  // -------------------------------------------------------------------------
  // 日誌配置
  // -------------------------------------------------------------------------
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_PRETTY: z
    .string()
    .optional()
    .default('true')
    .transform((val) => val === 'true' || val === '1' || val === 'yes'),

  // -------------------------------------------------------------------------
  // 功能開關
  // -------------------------------------------------------------------------
  ENABLE_ASSET_SNAPSHOT: z
    .string()
    .optional()
    .transform((val) => val !== 'false'),
  ASSET_SNAPSHOT_INTERVAL_MS: integerString(3600000),
  ENABLE_OI_REFRESH: booleanString,
  ENABLE_CONDITIONAL_ORDER_MONITOR: booleanString,

  // -------------------------------------------------------------------------
  // 測試配置
  // -------------------------------------------------------------------------
  API_BASE_URL: z.string().optional().default('http://localhost:3000'),
  TEST_TOKEN: optionalString,
  TRADING_VALIDATION_ALLOW_PROD: booleanString,

  // -------------------------------------------------------------------------
  // Proxy 配置
  // -------------------------------------------------------------------------
  PROXY_URL: optionalString,
});

// ============================================================================
// 客戶端環境變數 Schema (NEXT_PUBLIC_*)
// ============================================================================

const clientEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().optional().default(''),
  NEXT_PUBLIC_WS_URL: z.string().optional().default(''),
});

// ============================================================================
// 類型定義
// ============================================================================

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type Env = ServerEnv & ClientEnv;

// ============================================================================
// 驗證與匯出
// ============================================================================

/**
 * 驗證環境變數
 * 在 Next.js 建置階段或測試環境跳過嚴格驗證
 */
function validateEnv(): Env {
  // Next.js 建置階段跳過驗證
  const isNextBuild = process.env.NEXT_PHASE === 'phase-production-build';
  // 測試環境使用寬鬆驗證
  const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

  if (isNextBuild || isTest) {
    // 建置階段或測試環境返回預設值，與實際環境變數合併
    const defaults = {
      ...getDefaultServerEnv(),
      ...getDefaultClientEnv(),
    };
    // 嘗試解析，失敗時使用預設值
    const serverResult = serverEnvSchema.safeParse({
      ...defaults,
      ...process.env,
    });
    if (serverResult.success) {
      const clientResult = clientEnvSchema.safeParse(process.env);
      return {
        ...serverResult.data,
        ...(clientResult.success ? clientResult.data : getDefaultClientEnv()),
      };
    }
    // 測試環境直接返回預設值
    return defaults as Env;
  }

  // 伺服器端驗證
  const serverResult = serverEnvSchema.safeParse(process.env);
  if (!serverResult.success) {
    const errors = serverResult.error.flatten().fieldErrors;
    const errorMessages = Object.entries(errors)
      .map(([key, messages]) => `  ${key}: ${messages?.join(', ')}`)
      .join('\n');

    // 在開發環境顯示詳細錯誤
    if (process.env.NODE_ENV !== 'production') {
      console.error('\n========================================');
      console.error('Environment Variable Validation Failed:');
      console.error('========================================');
      console.error(errorMessages);
      console.error('========================================\n');
    }

    throw new Error(`Invalid environment variables:\n${errorMessages}`);
  }

  // 客戶端環境變數（在伺服器端也可存取）
  const clientResult = clientEnvSchema.safeParse(process.env);
  if (!clientResult.success) {
    console.warn('Client environment variables validation warning:', clientResult.error.flatten());
  }

  return {
    ...serverResult.data,
    ...(clientResult.success ? clientResult.data : getDefaultClientEnv()),
  };
}

/**
 * 取得伺服器端預設值（用於建置階段）
 */
function getDefaultServerEnv(): Partial<ServerEnv> {
  return {
    NODE_ENV: 'development',
    PORT: 3000,
    HOSTNAME: 'localhost',
    DATABASE_URL: '',
    JWT_SECRET: 'build-time-placeholder-secret-32chars',
    JWT_EXPIRES_IN: '24h',
    ENCRYPTION_KEY: '0'.repeat(64),
    BINANCE_API_KEY: '',
    BINANCE_API_SECRET: '',
    BINANCE_TESTNET: false,
    OKX_API_KEY: '',
    OKX_API_SECRET: '',
    OKX_PASSPHRASE: '',
    OKX_TESTNET: false,
    MEXC_API_KEY: '',
    MEXC_API_SECRET: '',
    MEXC_TESTNET: false,
    GATEIO_API_KEY: '',
    GATEIO_API_SECRET: '',
    GATEIO_TESTNET: false,
    BINGX_API_KEY: '',
    BINGX_API_SECRET: '',
    BINGX_TESTNET: false,
    TELEGRAM_BOT_TOKEN: '',
    TELEGRAM_CHAT_ID: '',
    // 郵件服務預設值
    SMTP_HOST: '',
    SMTP_PORT: 587,
    SMTP_USER: '',
    SMTP_PASS: '',
    SMTP_FROM: '',
    // 密碼管理預設值
    PASSWORD_RESET_EXPIRY_HOURS: 1,
    PASSWORD_RESET_RATE_LIMIT_SECONDS: 60,
    ACCOUNT_LOCKOUT_THRESHOLD: 5,
    ACCOUNT_LOCKOUT_DURATION_MINUTES: 15,
    // 交易配置預設值
    MIN_SPREAD_THRESHOLD: 0.0005,
    MAX_POSITION_SIZE_USD: 10000,
    DEFAULT_LEVERAGE: 1,
    OPPORTUNITY_THRESHOLD_ANNUALIZED: 800,
    // 風險管理預設值
    MAX_DAILY_LOSS: 1000,
    MAX_DRAWDOWN: 0.1,
    POSITION_SIZE_PERCENT: 0.1,
    // 監控配置預設值
    HEALTH_CHECK_INTERVAL_MS: 60000,
    PRICE_UPDATE_INTERVAL_MS: 1000,
    FUNDING_RATE_CHECK_INTERVAL_MS: 300000,
    OI_REFRESH_INTERVAL_MS: 1800000,
    OI_DEFAULT_TOP_N: 100,
    OI_TOP_N: 30,
    OI_MIN_THRESHOLD: 0,
    // 日誌配置
    LOG_LEVEL: 'info',
    LOG_PRETTY: true,
    MONITORED_EXCHANGES: ['binance', 'okx', 'mexc', 'gateio', 'bingx'],
    // 功能開關
    ENABLE_ASSET_SNAPSHOT: true,
    ASSET_SNAPSHOT_INTERVAL_MS: 3600000,
    ENABLE_OI_REFRESH: false,
    ENABLE_CONDITIONAL_ORDER_MONITOR: false,
    // Redis
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_DB: 0,
    // 其他
    API_BASE_URL: 'http://localhost:3000',
    TEST_TOKEN: '',
    TRADING_VALIDATION_ALLOW_PROD: false,
    // Proxy
    PROXY_URL: '',
  };
}

/**
 * 取得客戶端預設值
 */
function getDefaultClientEnv(): ClientEnv {
  return {
    NEXT_PUBLIC_API_URL: '',
    NEXT_PUBLIC_WS_URL: '',
  };
}

/**
 * 已驗證的環境變數
 * 匯入此模組時會自動執行驗證
 */
export const env = validateEnv();

// ============================================================================
// 向後相容的輔助函式
// ============================================================================

/**
 * 檢查 Redis 是否已配置
 * 使用 process.env 而非 env 來避免預設值影響判斷
 */
export function isRedisConfigured(): boolean {
  // 只有明確設定 REDIS_URL 或 REDIS_HOST 時才啟用 Redis
  return !!(process.env.REDIS_URL || process.env.REDIS_HOST);
}

/**
 * 檢查 SMTP 郵件服務是否已配置
 * 需要同時設定 host 和 user 才視為已配置
 */
export function isSmtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER);
}

/**
 * 取得 Redis 連線 URL
 */
export function getRedisUrl(): string | null {
  if (env.REDIS_URL) {
    return env.REDIS_URL;
  }
  if (env.REDIS_HOST) {
    const auth = env.REDIS_PASSWORD ? `:${env.REDIS_PASSWORD}@` : '';
    return `redis://${auth}${env.REDIS_HOST}:${env.REDIS_PORT}/${env.REDIS_DB}`;
  }
  return null;
}

/**
 * 驗證必要的交易所 API 金鑰
 * 用於交易功能啟用前的檢查
 */
export function validateTradingApiKeys(): void {
  const missingKeys: string[] = [];

  if (!env.BINANCE_API_KEY) missingKeys.push('BINANCE_API_KEY');
  if (!env.BINANCE_API_SECRET) missingKeys.push('BINANCE_API_SECRET');
  if (!env.OKX_API_KEY) missingKeys.push('OKX_API_KEY');
  if (!env.OKX_API_SECRET) missingKeys.push('OKX_API_SECRET');
  if (!env.OKX_PASSPHRASE) missingKeys.push('OKX_PASSPHRASE');

  if (missingKeys.length > 0) {
    throw new Error(
      `Missing required API keys for trading: ${missingKeys.join(', ')}. Please check your .env file.`
    );
  }
}

/**
 * 取得交易所 API 金鑰配置
 * 向後相容 config.ts 的 apiKeys 格式
 */
export function getApiKeys() {
  return {
    binance: {
      apiKey: env.BINANCE_API_KEY,
      apiSecret: env.BINANCE_API_SECRET,
      testnet: env.BINANCE_TESTNET,
    },
    okx: {
      apiKey: env.OKX_API_KEY,
      apiSecret: env.OKX_API_SECRET,
      passphrase: env.OKX_PASSPHRASE,
      testnet: env.OKX_TESTNET,
    },
    mexc: {
      apiKey: env.MEXC_API_KEY,
      apiSecret: env.MEXC_API_SECRET,
      testnet: env.MEXC_TESTNET,
    },
    gateio: {
      apiKey: env.GATEIO_API_KEY,
      apiSecret: env.GATEIO_API_SECRET,
      testnet: env.GATEIO_TESTNET,
    },
    bingx: {
      apiKey: env.BINGX_API_KEY,
      apiSecret: env.BINGX_API_SECRET,
      testnet: env.BINGX_TESTNET,
    },
    telegram: {
      botToken: env.TELEGRAM_BOT_TOKEN,
      chatId: env.TELEGRAM_CHAT_ID,
    },
  };
}

/**
 * 取得 Proxy 配置
 * 支援 HTTP/HTTPS/SOCKS5 proxy
 *
 * @returns proxy URL 或 undefined（未設定時）
 */
export function getProxyUrl(): string | undefined {
  return env.PROXY_URL || undefined;
}

/**
 * 檢查 Proxy 是否已配置
 */
export function isProxyConfigured(): boolean {
  return !!env.PROXY_URL;
}

/**
 * 檢查是否為 SOCKS proxy
 */
export function isSocksProxy(): boolean {
  const proxyUrl = getProxyUrl();
  if (!proxyUrl) return false;
  return proxyUrl.startsWith('socks4://') || proxyUrl.startsWith('socks5://') || proxyUrl.startsWith('socks5h://');
}

/**
 * 取得 CCXT proxy 配置（舊版，使用 httpProxy/socksProxy）
 * 注意：httpProxy 在某些環境下可能不起作用，建議使用 getCcxtAgentConfig
 *
 * @deprecated 建議使用 getCcxtAgentConfig
 * @returns CCXT proxy 配置物件，可直接展開到 CCXT 建構函數
 */
export function getCcxtProxyConfig(): { httpProxy?: string; socksProxy?: string } {
  const proxyUrl = getProxyUrl();
  if (!proxyUrl) {
    return {};
  }

  if (isSocksProxy()) {
    return { socksProxy: proxyUrl };
  }

  return { httpProxy: proxyUrl };
}

/**
 * 取得 CCXT agent 配置
 * 使用 https-proxy-agent 或 socks-proxy-agent 建立 agent
 *
 * 注意：此方法在某些情況下可能無法正確使用 proxy
 * 建議使用 getCcxtHttpsProxyConfig
 *
 * @deprecated 建議使用 getCcxtHttpsProxyConfig
 * @returns Promise<{ agent?: Agent }> - CCXT agent 配置物件
 */
export async function getCcxtAgentConfig(): Promise<{ agent?: import('http').Agent }> {
  const agent = await createProxyAgent();
  if (!agent) {
    return {};
  }
  return { agent };
}

/**
 * 取得 CCXT httpsProxy 配置（推薦方式）
 *
 * 經過測試，這是 CCXT 4.x 最可靠的 proxy 配置方式：
 * - 使用 `httpsProxy` 屬性（即使是 http:// 協議的 proxy）
 * - 同時支援 HTTP 和 SOCKS proxy
 *
 * @returns CCXT proxy 配置物件，可直接展開到 CCXT 建構函數
 */
export function getCcxtHttpsProxyConfig(): { httpsProxy?: string; socksProxy?: string } {
  const proxyUrl = getProxyUrl();
  if (!proxyUrl) {
    return {};
  }

  // SOCKS proxy 使用 socksProxy 屬性
  if (isSocksProxy()) {
    return { socksProxy: proxyUrl };
  }

  // HTTP/HTTPS proxy 使用 httpsProxy 屬性（這是 CCXT 4.x 的正確方式）
  return { httpsProxy: proxyUrl };
}

/**
 * 建立 Proxy Agent
 * 根據 proxy URL 的協議自動選擇正確的 agent 類型
 *
 * 支援：
 * - HTTP/HTTPS proxy: http://, https://
 * - SOCKS4/SOCKS5 proxy: socks4://, socks5://, socks5h://
 *
 * @returns Promise<Agent | null> - proxy agent 或 null（未設定時）
 */
export async function createProxyAgent(): Promise<import('http').Agent | null> {
  const proxyUrl = getProxyUrl();
  if (!proxyUrl) {
    return null;
  }

  // 檢查是否為 SOCKS proxy
  if (proxyUrl.startsWith('socks4://') || proxyUrl.startsWith('socks5://') || proxyUrl.startsWith('socks5h://')) {
    // 動態匯入 socks-proxy-agent
    const { SocksProxyAgent } = await import('socks-proxy-agent');
    return new SocksProxyAgent(proxyUrl);
  }

  // HTTP/HTTPS proxy
  const { HttpsProxyAgent } = await import('https-proxy-agent');
  return new HttpsProxyAgent(proxyUrl);
}

/**
 * 同步版本的 Proxy Agent 建立函數
 * 注意：此函數假設模組已經被載入
 *
 * @returns Agent | null - proxy agent 或 null（未設定時）
 */
export function createProxyAgentSync(): import('http').Agent | null {
  const proxyUrl = getProxyUrl();
  if (!proxyUrl) {
    return null;
  }

  // 檢查是否為 SOCKS proxy
  if (proxyUrl.startsWith('socks4://') || proxyUrl.startsWith('socks5://') || proxyUrl.startsWith('socks5h://')) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SocksProxyAgent } = require('socks-proxy-agent');
    return new SocksProxyAgent(proxyUrl);
  }

  // HTTP/HTTPS proxy
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { HttpsProxyAgent } = require('https-proxy-agent');
  return new HttpsProxyAgent(proxyUrl);
}

export default env;
