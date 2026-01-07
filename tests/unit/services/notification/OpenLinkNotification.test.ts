/**
 * 開倉連結通知測試
 * Feature 058: 通知加入開倉連結
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateOpenPositionUrl,
  generateExchangeUrl,
} from '../../../../src/services/notification/utils';

describe('Feature 058: 開倉連結生成', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // 重置環境變數
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('generateOpenPositionUrl', () => {
    it('應該使用 NEXT_PUBLIC_BASE_URL 生成正確的 URL', () => {
      process.env.NEXT_PUBLIC_BASE_URL = 'https://example.com';

      const url = generateOpenPositionUrl('BTCUSDT', 'binance', 'okx');

      expect(url).toBe('https://example.com/market-monitor?symbol=BTCUSDT&long=binance&short=okx');
    });

    it('應該使用 NEXT_PUBLIC_WS_URL 作為 fallback', () => {
      delete process.env.NEXT_PUBLIC_BASE_URL;
      process.env.NEXT_PUBLIC_WS_URL = 'https://ws.example.com';

      const url = generateOpenPositionUrl('ETHUSDT', 'gateio', 'mexc');

      expect(url).toBe('https://ws.example.com/market-monitor?symbol=ETHUSDT&long=gateio&short=mexc');
    });

    it('應該使用預設值 http://localhost:3000 當環境變數都不存在時', () => {
      delete process.env.NEXT_PUBLIC_BASE_URL;
      delete process.env.NEXT_PUBLIC_WS_URL;

      const url = generateOpenPositionUrl('SOLUSDT', 'bybit', 'htx');

      expect(url).toBe('http://localhost:3000/market-monitor?symbol=SOLUSDT&long=bybit&short=htx');
    });

    it('應該將交易所名稱轉換為小寫', () => {
      process.env.NEXT_PUBLIC_BASE_URL = 'https://example.com';

      const url = generateOpenPositionUrl('BTCUSDT', 'BINANCE', 'OKX');

      expect(url).toBe('https://example.com/market-monitor?symbol=BTCUSDT&long=binance&short=okx');
    });

    it('應該正確編碼特殊字元', () => {
      process.env.NEXT_PUBLIC_BASE_URL = 'https://example.com';

      // 測試包含斜線的 symbol（雖然實際上不太可能）
      const url = generateOpenPositionUrl('BTC/USDT', 'binance', 'okx');

      // URLSearchParams 會自動編碼
      expect(url).toContain('symbol=BTC%2FUSDT');
    });

    it('應該包含正確的 query parameters', () => {
      process.env.NEXT_PUBLIC_BASE_URL = 'https://example.com';

      const url = generateOpenPositionUrl('DOGEUSDT', 'mexc', 'gateio');
      const urlObj = new URL(url);

      expect(urlObj.searchParams.get('symbol')).toBe('DOGEUSDT');
      expect(urlObj.searchParams.get('long')).toBe('mexc');
      expect(urlObj.searchParams.get('short')).toBe('gateio');
    });

    it('應該生成 /market-monitor 路徑', () => {
      process.env.NEXT_PUBLIC_BASE_URL = 'https://example.com';

      const url = generateOpenPositionUrl('AVAXUSDT', 'binance', 'bybit');
      const urlObj = new URL(url);

      expect(urlObj.pathname).toBe('/market-monitor');
    });
  });

  describe('generateExchangeUrl（現有功能回歸測試）', () => {
    it('應該為 Binance 生成正確的 URL', () => {
      const url = generateExchangeUrl('binance', 'BTCUSDT');
      expect(url).toBe('https://www.binance.com/zh-TC/futures/BTCUSDT');
    });

    it('應該為 OKX 生成正確的 URL', () => {
      const url = generateExchangeUrl('okx', 'ETHUSDT');
      expect(url).toBe('https://www.okx.com/zh-hant/trade-swap/ETH-USDT-SWAP');
    });

    it('應該為 Gate.io 生成正確的 URL', () => {
      const url = generateExchangeUrl('gate', 'SOLUSDT');
      expect(url).toBe('https://www.gate.io/zh-tw/futures_trade/USDT/SOL_USDT');
    });

    it('應該為 MEXC 生成正確的 URL', () => {
      const url = generateExchangeUrl('mexc', 'DOGEUSDT');
      expect(url).toBe('https://futures.mexc.com/zh-TW/exchange/DOGE_USDT');
    });

    it('應該為未知交易所返回預設 URL', () => {
      const url = generateExchangeUrl('unknown', 'BTCUSDT');
      expect(url).toBe('https://www.unknown.com');
    });
  });
});
