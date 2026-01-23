/**
 * 環境變數與 Proxy 配置測試
 *
 * 測試 env.ts 中的 proxy 相關函數
 *
 * 重要說明：
 * env.ts 在模組載入時會執行 dotenv.config() 並快取環境變數。
 * 因此：
 * 1. 使用快取 env 物件的函數（getProxyUrl, isProxyConfigured, isSocksProxy 等）
 *    無法測試動態環境變數變更，這裡測試的是函數邏輯和當前環境配置。
 * 2. 直接使用 process.env 的函數（isRedisConfigured, isSmtpConfigured）
 *    可以測試動態變更，但 dotenv 會覆寫 process.env。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// 直接導入模組（使用快取值）
import {
  getProxyUrl,
  isProxyConfigured,
  isSocksProxy,
  getCcxtHttpsProxyConfig,
  getCcxtProxyConfig,
  createProxyAgent,
  createProxyAgentSync,
  isRedisConfigured,
  isSmtpConfigured,
  getRedisUrl,
  getApiKeys,
  env,
} from '@lib/env';

// 保存原始環境變數（用於 process.env 直接讀取的測試）
const originalRedisUrl = process.env.REDIS_URL;
const originalRedisHost = process.env.REDIS_HOST;
const originalSmtpHost = process.env.SMTP_HOST;
const originalSmtpUser = process.env.SMTP_USER;

describe('env proxy functions', () => {
  afterEach(() => {
    // 恢復原始環境變數（僅針對 process.env 直接讀取的測試）
    if (originalRedisUrl !== undefined) {
      process.env.REDIS_URL = originalRedisUrl;
    } else {
      delete process.env.REDIS_URL;
    }
    if (originalRedisHost !== undefined) {
      process.env.REDIS_HOST = originalRedisHost;
    } else {
      delete process.env.REDIS_HOST;
    }
    if (originalSmtpHost !== undefined) {
      process.env.SMTP_HOST = originalSmtpHost;
    } else {
      delete process.env.SMTP_HOST;
    }
    if (originalSmtpUser !== undefined) {
      process.env.SMTP_USER = originalSmtpUser;
    } else {
      delete process.env.SMTP_USER;
    }
  });

  describe('getProxyUrl', () => {
    it('應該返回 string 或 undefined', () => {
      const result = getProxyUrl();
      expect(result === undefined || typeof result === 'string').toBe(true);
    });

    it('空字串應視為未設定（返回 undefined）', () => {
      // 測試函數邏輯：env.PROXY_URL || undefined
      // 如果 env.PROXY_URL 是空字串，|| undefined 會返回 undefined
      const result = getProxyUrl();
      if (env.PROXY_URL === '') {
        expect(result).toBeUndefined();
      }
    });
  });

  describe('isProxyConfigured', () => {
    it('應該返回布林值', () => {
      const result = isProxyConfigured();
      expect(typeof result).toBe('boolean');
    });

    it('應該與 getProxyUrl 結果一致', () => {
      const proxyUrl = getProxyUrl();
      const isConfigured = isProxyConfigured();
      expect(isConfigured).toBe(!!proxyUrl);
    });
  });

  describe('isSocksProxy', () => {
    it('應該返回布林值', () => {
      const result = isSocksProxy();
      expect(typeof result).toBe('boolean');
    });

    it('未設定 proxy 時應返回 false', () => {
      const proxyUrl = getProxyUrl();
      if (!proxyUrl) {
        expect(isSocksProxy()).toBe(false);
      }
    });

    it('HTTP/HTTPS proxy 應返回 false', () => {
      const proxyUrl = getProxyUrl();
      if (proxyUrl && (proxyUrl.startsWith('http://') || proxyUrl.startsWith('https://'))) {
        expect(isSocksProxy()).toBe(false);
      }
    });

    it('SOCKS proxy 應返回 true', () => {
      const proxyUrl = getProxyUrl();
      if (
        proxyUrl &&
        (proxyUrl.startsWith('socks4://') ||
          proxyUrl.startsWith('socks5://') ||
          proxyUrl.startsWith('socks5h://'))
      ) {
        expect(isSocksProxy()).toBe(true);
      }
    });
  });

  describe('getCcxtHttpsProxyConfig', () => {
    it('應該返回物件', () => {
      const result = getCcxtHttpsProxyConfig();
      expect(typeof result).toBe('object');
    });

    it('未設定 proxy 時應返回空物件', () => {
      const proxyUrl = getProxyUrl();
      if (!proxyUrl) {
        expect(getCcxtHttpsProxyConfig()).toEqual({});
      }
    });

    it('HTTP/HTTPS proxy 應返回 httpsProxy 配置', () => {
      const proxyUrl = getProxyUrl();
      if (proxyUrl && !isSocksProxy()) {
        expect(getCcxtHttpsProxyConfig()).toEqual({ httpsProxy: proxyUrl });
      }
    });

    it('SOCKS proxy 應返回 socksProxy 配置', () => {
      const proxyUrl = getProxyUrl();
      if (proxyUrl && isSocksProxy()) {
        expect(getCcxtHttpsProxyConfig()).toEqual({ socksProxy: proxyUrl });
      }
    });
  });

  describe('getCcxtProxyConfig (deprecated)', () => {
    it('應該返回物件', () => {
      const result = getCcxtProxyConfig();
      expect(typeof result).toBe('object');
    });

    it('未設定 proxy 時應返回空物件', () => {
      const proxyUrl = getProxyUrl();
      if (!proxyUrl) {
        expect(getCcxtProxyConfig()).toEqual({});
      }
    });

    it('HTTP proxy 應返回 httpProxy 配置', () => {
      const proxyUrl = getProxyUrl();
      if (proxyUrl && !isSocksProxy()) {
        expect(getCcxtProxyConfig()).toEqual({ httpProxy: proxyUrl });
      }
    });

    it('SOCKS proxy 應返回 socksProxy 配置', () => {
      const proxyUrl = getProxyUrl();
      if (proxyUrl && isSocksProxy()) {
        expect(getCcxtProxyConfig()).toEqual({ socksProxy: proxyUrl });
      }
    });
  });

  describe('createProxyAgent', () => {
    it('未設定 proxy 時應返回 null', async () => {
      const proxyUrl = getProxyUrl();
      if (!proxyUrl) {
        const agent = await createProxyAgent();
        expect(agent).toBeNull();
      }
    });

    it('HTTP proxy 應創建 HttpsProxyAgent', async () => {
      const proxyUrl = getProxyUrl();
      if (proxyUrl && !isSocksProxy()) {
        const agent = await createProxyAgent();
        expect(agent).not.toBeNull();
        expect(agent?.constructor.name).toBe('HttpsProxyAgent');
      }
    });

    it('SOCKS proxy 應創建 SocksProxyAgent', async () => {
      const proxyUrl = getProxyUrl();
      if (proxyUrl && isSocksProxy()) {
        const agent = await createProxyAgent();
        expect(agent).not.toBeNull();
        expect(agent?.constructor.name).toBe('SocksProxyAgent');
      }
    });
  });

  describe('createProxyAgentSync', () => {
    it('未設定 proxy 時應返回 null', () => {
      const proxyUrl = getProxyUrl();
      if (!proxyUrl) {
        const agent = createProxyAgentSync();
        expect(agent).toBeNull();
      }
    });

    it('HTTP proxy 應創建 HttpsProxyAgent', () => {
      const proxyUrl = getProxyUrl();
      if (proxyUrl && !isSocksProxy()) {
        const agent = createProxyAgentSync();
        expect(agent).not.toBeNull();
        expect(agent?.constructor.name).toBe('HttpsProxyAgent');
      }
    });

    it('SOCKS proxy 應創建 SocksProxyAgent', () => {
      const proxyUrl = getProxyUrl();
      if (proxyUrl && isSocksProxy()) {
        const agent = createProxyAgentSync();
        expect(agent).not.toBeNull();
        expect(agent?.constructor.name).toBe('SocksProxyAgent');
      }
    });
  });

  describe('isRedisConfigured', () => {
    // 這個函數直接讀取 process.env，可以測試動態變更
    // 但注意 dotenv 會在模組載入時覆寫 process.env

    beforeEach(() => {
      // 清除 Redis 相關環境變數
      delete process.env.REDIS_URL;
      delete process.env.REDIS_HOST;
    });

    it('設定 REDIS_URL 時應返回 true', () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      expect(isRedisConfigured()).toBe(true);
    });

    it('設定 REDIS_HOST 時應返回 true', () => {
      process.env.REDIS_HOST = 'localhost';
      expect(isRedisConfigured()).toBe(true);
    });

    it('未設定 Redis 時應返回 false', () => {
      delete process.env.REDIS_URL;
      delete process.env.REDIS_HOST;
      expect(isRedisConfigured()).toBe(false);
    });
  });

  describe('isSmtpConfigured', () => {
    // 這個函數直接讀取 process.env

    beforeEach(() => {
      // 清除 SMTP 相關環境變數
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
    });

    it('設定 SMTP_HOST 和 SMTP_USER 時應返回 true', () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user@example.com';
      expect(isSmtpConfigured()).toBe(true);
    });

    it('只設定 SMTP_HOST 時應返回 false', () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      delete process.env.SMTP_USER;
      expect(isSmtpConfigured()).toBe(false);
    });

    it('未設定 SMTP 時應返回 false', () => {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      expect(isSmtpConfigured()).toBe(false);
    });
  });

  describe('getRedisUrl', () => {
    it('應該返回 string 或 null', () => {
      const result = getRedisUrl();
      expect(result === null || typeof result === 'string').toBe(true);
    });

    it('有 REDIS_URL 時應返回該值', () => {
      if (env.REDIS_URL) {
        expect(getRedisUrl()).toBe(env.REDIS_URL);
      }
    });

    it('有 REDIS_HOST 時應返回建構的 URL', () => {
      if (env.REDIS_HOST && !env.REDIS_URL) {
        const result = getRedisUrl();
        expect(result).toContain(env.REDIS_HOST);
        expect(result).toContain(`:${env.REDIS_PORT}`);
      }
    });
  });

  describe('getApiKeys', () => {
    it('應該返回包含所有交易所的物件', () => {
      const keys = getApiKeys();

      // 驗證結構
      expect(keys).toHaveProperty('binance');
      expect(keys).toHaveProperty('okx');
      expect(keys).toHaveProperty('mexc');
      expect(keys).toHaveProperty('gateio');
      expect(keys).toHaveProperty('bingx');
      expect(keys).toHaveProperty('telegram');

      // 驗證各交易所有必要的屬性
      expect(keys.binance).toHaveProperty('apiKey');
      expect(keys.binance).toHaveProperty('apiSecret');
      expect(keys.binance).toHaveProperty('testnet');
      expect(keys.okx).toHaveProperty('passphrase');
    });

    it('各交易所的 apiKey 和 apiSecret 應為字串', () => {
      const keys = getApiKeys();

      expect(typeof keys.binance.apiKey).toBe('string');
      expect(typeof keys.binance.apiSecret).toBe('string');
      expect(typeof keys.okx.apiKey).toBe('string');
      expect(typeof keys.okx.apiSecret).toBe('string');
      expect(typeof keys.mexc.apiKey).toBe('string');
      expect(typeof keys.mexc.apiSecret).toBe('string');
      expect(typeof keys.gateio.apiKey).toBe('string');
      expect(typeof keys.gateio.apiSecret).toBe('string');
      expect(typeof keys.bingx.apiKey).toBe('string');
      expect(typeof keys.bingx.apiSecret).toBe('string');
    });

    it('testnet 屬性應為布林值', () => {
      const keys = getApiKeys();

      expect(typeof keys.binance.testnet).toBe('boolean');
      expect(typeof keys.okx.testnet).toBe('boolean');
      expect(typeof keys.mexc.testnet).toBe('boolean');
      expect(typeof keys.gateio.testnet).toBe('boolean');
      expect(typeof keys.bingx.testnet).toBe('boolean');
    });
  });

  describe('env 物件', () => {
    it('應該有 NODE_ENV 屬性', () => {
      expect(env.NODE_ENV).toBeDefined();
      expect(['development', 'production', 'test']).toContain(env.NODE_ENV);
    });

    it('應該有 PORT 屬性且為數字', () => {
      expect(typeof env.PORT).toBe('number');
    });

    it('應該有 DATABASE_URL 屬性', () => {
      expect(env.DATABASE_URL).toBeDefined();
    });

    it('應該有 LOG_LEVEL 屬性', () => {
      expect(env.LOG_LEVEL).toBeDefined();
      expect(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).toContain(env.LOG_LEVEL);
    });

    it('應該有 MONITORED_EXCHANGES 陣列', () => {
      expect(Array.isArray(env.MONITORED_EXCHANGES)).toBe(true);
    });
  });
});
