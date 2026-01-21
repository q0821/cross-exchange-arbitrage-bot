/**
 * CCXT Factory 測試
 *
 * 測試 CCXT 交易所實例創建工廠函數
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock ccxt 模組
vi.mock('ccxt', () => {
  const createMockExchange = (id: string) => {
    return class MockExchange {
      id = id;
      enableRateLimit: boolean;
      timeout: number;
      httpsProxy?: string;
      socksProxy?: string;
      apiKey?: string;
      secret?: string;
      password?: string;
      sandbox?: boolean;
      options: Record<string, unknown>;

      constructor(config: Record<string, unknown>) {
        this.enableRateLimit = config.enableRateLimit as boolean ?? true;
        this.timeout = config.timeout as number ?? 30000;
        this.httpsProxy = config.httpsProxy as string | undefined;
        this.socksProxy = config.socksProxy as string | undefined;
        this.apiKey = config.apiKey as string | undefined;
        this.secret = config.secret as string | undefined;
        this.password = config.password as string | undefined;
        this.sandbox = config.sandbox as boolean | undefined;
        this.options = config.options as Record<string, unknown> ?? {};
      }
    };
  };

  return {
    default: {
      binance: createMockExchange('binance'),
      okx: createMockExchange('okx'),
      gateio: createMockExchange('gateio'),
      mexc: createMockExchange('mexc'),
      bingx: createMockExchange('bingx'),
    },
  };
});

// Mock env 模組
vi.mock('@lib/env', () => ({
  getCcxtHttpsProxyConfig: vi.fn(() => ({})),
  getProxyUrl: vi.fn(() => undefined),
}));

// Mock logger
vi.mock('@lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  createCcxtExchange,
  createAuthenticatedExchange,
  createPublicExchange,
  type SupportedExchange,
} from '@lib/ccxt-factory';
import { getCcxtHttpsProxyConfig, getProxyUrl } from '@lib/env';

describe('ccxt-factory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 重設環境變數
    delete process.env.BINANCE_PORTFOLIO_MARGIN;
  });

  afterEach(() => {
    delete process.env.BINANCE_PORTFOLIO_MARGIN;
  });

  describe('createCcxtExchange', () => {
    it('應該為每個支援的交易所創建實例', () => {
      const exchanges: SupportedExchange[] = ['binance', 'okx', 'gateio', 'mexc', 'bingx'];

      for (const exchangeId of exchanges) {
        const exchange = createCcxtExchange(exchangeId);
        expect(exchange).toBeDefined();
        expect(exchange.id).toBe(exchangeId);
      }
    });

    it('應該設定預設 timeout 為 30000ms', () => {
      const exchange = createCcxtExchange('binance');
      expect(exchange.timeout).toBe(30000);
    });

    it('應該預設啟用 rate limit', () => {
      const exchange = createCcxtExchange('binance');
      expect(exchange.enableRateLimit).toBe(true);
    });

    it('應該允許覆蓋 enableRateLimit 設定', () => {
      const exchange = createCcxtExchange('binance', { enableRateLimit: false });
      expect(exchange.enableRateLimit).toBe(false);
    });

    it('應該設定 defaultType 為 swap', () => {
      const exchange = createCcxtExchange('binance');
      expect(exchange.options.defaultType).toBe('swap');
    });

    it('應該在不支援的交易所拋出錯誤', () => {
      expect(() => {
        createCcxtExchange('unsupported' as SupportedExchange);
      }).toThrow('Unsupported exchange: unsupported');
    });

    describe('Proxy 配置', () => {
      it('應該套用 https proxy 配置', () => {
        vi.mocked(getCcxtHttpsProxyConfig).mockReturnValue({ httpsProxy: 'http://proxy:8080' });
        vi.mocked(getProxyUrl).mockReturnValue('http://proxy:8080');

        const exchange = createCcxtExchange('binance');
        expect(exchange.httpsProxy).toBe('http://proxy:8080');
      });

      it('應該套用 socks proxy 配置', () => {
        vi.mocked(getCcxtHttpsProxyConfig).mockReturnValue({ socksProxy: 'socks5://proxy:1080' });
        vi.mocked(getProxyUrl).mockReturnValue('socks5://proxy:1080');

        const exchange = createCcxtExchange('binance');
        expect(exchange.socksProxy).toBe('socks5://proxy:1080');
      });

      it('無 proxy 時不應設定 proxy 屬性', () => {
        vi.mocked(getCcxtHttpsProxyConfig).mockReturnValue({});
        vi.mocked(getProxyUrl).mockReturnValue(undefined);

        const exchange = createCcxtExchange('binance');
        expect(exchange.httpsProxy).toBeUndefined();
        expect(exchange.socksProxy).toBeUndefined();
      });
    });

    describe('Binance Portfolio Margin', () => {
      it('BINANCE_PORTFOLIO_MARGIN=true 時應啟用 portfolioMargin', () => {
        process.env.BINANCE_PORTFOLIO_MARGIN = 'true';

        const exchange = createCcxtExchange('binance');
        expect(exchange.options.portfolioMargin).toBe(true);
      });

      it('BINANCE_PORTFOLIO_MARGIN=false 時不應啟用 portfolioMargin', () => {
        process.env.BINANCE_PORTFOLIO_MARGIN = 'false';

        const exchange = createCcxtExchange('binance');
        expect(exchange.options.portfolioMargin).toBeUndefined();
      });

      it('未設定 BINANCE_PORTFOLIO_MARGIN 時不應啟用 portfolioMargin', () => {
        const exchange = createCcxtExchange('binance');
        expect(exchange.options.portfolioMargin).toBeUndefined();
      });

      it('非 Binance 交易所不應受 BINANCE_PORTFOLIO_MARGIN 影響', () => {
        process.env.BINANCE_PORTFOLIO_MARGIN = 'true';

        const exchange = createCcxtExchange('okx');
        expect(exchange.options.portfolioMargin).toBeUndefined();
      });
    });

    describe('認證參數', () => {
      it('應該傳遞 apiKey 和 secret', () => {
        const exchange = createCcxtExchange('binance', {
          apiKey: 'test-api-key',
          secret: 'test-secret',
        });
        expect(exchange.apiKey).toBe('test-api-key');
        expect(exchange.secret).toBe('test-secret');
      });

      it('應該傳遞 password (OKX passphrase)', () => {
        const exchange = createCcxtExchange('okx', {
          apiKey: 'test-api-key',
          secret: 'test-secret',
          password: 'test-passphrase',
        });
        expect(exchange.password).toBe('test-passphrase');
      });

      it('未提供認證時不應設定 apiKey', () => {
        const exchange = createCcxtExchange('binance');
        expect(exchange.apiKey).toBeUndefined();
        expect(exchange.secret).toBeUndefined();
      });
    });

    describe('自訂 options', () => {
      it('應該合併自訂 options', () => {
        const exchange = createCcxtExchange('binance', {
          options: { customOption: 'value' },
        });
        expect(exchange.options.customOption).toBe('value');
        expect(exchange.options.defaultType).toBe('swap'); // 預設值仍存在
      });

      it('自訂 options 應覆蓋預設值', () => {
        const exchange = createCcxtExchange('binance', {
          options: { defaultType: 'spot' },
        });
        expect(exchange.options.defaultType).toBe('spot');
      });
    });
  });

  describe('createAuthenticatedExchange', () => {
    it('應該創建帶認證的交易所實例', () => {
      const exchange = createAuthenticatedExchange('binance', {
        apiKey: 'my-api-key',
        apiSecret: 'my-api-secret',
      });

      expect(exchange.apiKey).toBe('my-api-key');
      expect(exchange.secret).toBe('my-api-secret');
    });

    it('應該傳遞 OKX passphrase', () => {
      const exchange = createAuthenticatedExchange('okx', {
        apiKey: 'my-api-key',
        apiSecret: 'my-api-secret',
        passphrase: 'my-passphrase',
      });

      expect(exchange.password).toBe('my-passphrase');
    });

    it('應該支援 sandbox 模式', () => {
      const exchange = createAuthenticatedExchange(
        'binance',
        { apiKey: 'key', apiSecret: 'secret' },
        { sandbox: true }
      );

      expect(exchange.sandbox).toBe(true);
    });

    it('應該支援自訂 enableRateLimit', () => {
      const exchange = createAuthenticatedExchange(
        'binance',
        { apiKey: 'key', apiSecret: 'secret' },
        { enableRateLimit: false }
      );

      expect(exchange.enableRateLimit).toBe(false);
    });
  });

  describe('createPublicExchange', () => {
    it('應該創建不帶認證的公開 API 實例', () => {
      const exchange = createPublicExchange('binance');

      expect(exchange).toBeDefined();
      expect(exchange.apiKey).toBeUndefined();
      expect(exchange.secret).toBeUndefined();
    });

    it('應該支援 sandbox 模式', () => {
      const exchange = createPublicExchange('binance', { sandbox: true });
      expect(exchange.sandbox).toBe(true);
    });

    it('應該支援自訂 enableRateLimit', () => {
      const exchange = createPublicExchange('binance', { enableRateLimit: false });
      expect(exchange.enableRateLimit).toBe(false);
    });
  });
});
