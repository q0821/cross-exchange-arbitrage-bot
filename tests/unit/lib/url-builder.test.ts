/**
 * URL Builder Unit Tests
 *
 * Feature: 008-specify-scripts-bash
 * Purpose: Test exchange URL generation and symbol validation
 */

import { describe, it, expect } from 'vitest';
import {
  getExchangeContractUrl,
  validateSymbol,
  buildExchangeUrls,
} from '@/lib/exchanges/url-builder';

describe('validateSymbol', () => {
  it('should validate correct BASEQUOTE symbol format', () => {
    const result = validateSymbol('BTCUSDT');
    expect(result.isValid).toBe(true);
    expect(result.base).toBe('BTC');
    expect(result.quote).toBe('USDT');
    expect(result.error).toBeUndefined();
  });

  it('should validate symbol with numbers', () => {
    const result = validateSymbol('1000PEPEUSDT');
    expect(result.isValid).toBe(true);
    expect(result.base).toBe('1000PEPE');
    expect(result.quote).toBe('USDT');
  });

  it('should reject empty symbol', () => {
    const result = validateSymbol('');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('should accept symbol with multiple quote currencies', () => {
    const resultUsdt = validateSymbol('LINKUSDT');
    expect(resultUsdt.isValid).toBe(true);
    expect(resultUsdt.base).toBe('LINK');
    expect(resultUsdt.quote).toBe('USDT');

    const resultUsdc = validateSymbol('BTCUSDC');
    expect(resultUsdc.isValid).toBe(true);
    expect(resultUsdc.base).toBe('BTC');
    expect(resultUsdc.quote).toBe('USDC');
  });

  it('should reject lowercase symbol', () => {
    const result = validateSymbol('btcusdt');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Invalid symbol format');
  });

  it('should reject symbol with slash separator', () => {
    const result = validateSymbol('BTC/USDT');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Invalid symbol format');
  });

  it('should reject symbol with dash separator', () => {
    const result = validateSymbol('BTC-USDT');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Invalid symbol format');
  });
});

describe('getExchangeContractUrl', () => {
  describe('Binance', () => {
    it('should generate correct URL for BTCUSDT', () => {
      const result = getExchangeContractUrl('binance', 'BTCUSDT');
      expect(result.isValid).toBe(true);
      expect(result.url).toBe(
        'https://www.binance.com/zh-TC/futures/BTCUSDT'
      );
      expect(result.formattedSymbol).toBe('BTCUSDT');
      expect(result.error).toBeUndefined();
    });

    it('should generate correct URL for ETHUSDT', () => {
      const result = getExchangeContractUrl('binance', 'ETHUSDT');
      expect(result.isValid).toBe(true);
      expect(result.url).toBe(
        'https://www.binance.com/zh-TC/futures/ETHUSDT'
      );
      expect(result.formattedSymbol).toBe('ETHUSDT');
    });

    it('should generate correct URL for 1000PEPEUSDT', () => {
      const result = getExchangeContractUrl('binance', '1000PEPEUSDT');
      expect(result.isValid).toBe(true);
      expect(result.formattedSymbol).toBe('1000PEPEUSDT');
    });
  });

  describe('OKX', () => {
    it('should generate correct URL for BTCUSDT', () => {
      const result = getExchangeContractUrl('okx', 'BTCUSDT');
      expect(result.isValid).toBe(true);
      expect(result.url).toBe(
        'https://www.okx.com/zh-hant/trade-swap/BTC-USDT-SWAP'
      );
      expect(result.formattedSymbol).toBe('BTC-USDT-SWAP');
    });

    it('should generate correct URL for ETHUSDT', () => {
      const result = getExchangeContractUrl('okx', 'ETHUSDT');
      expect(result.isValid).toBe(true);
      expect(result.url).toBe(
        'https://www.okx.com/zh-hant/trade-swap/ETH-USDT-SWAP'
      );
      expect(result.formattedSymbol).toBe('ETH-USDT-SWAP');
    });
  });

  describe('MEXC', () => {
    it('should generate correct URL for BTCUSDT', () => {
      const result = getExchangeContractUrl('mexc', 'BTCUSDT');
      expect(result.isValid).toBe(true);
      expect(result.url).toBe(
        'https://futures.mexc.com/zh-TW/exchange/BTC_USDT'
      );
      expect(result.formattedSymbol).toBe('BTC_USDT');
    });

    it('should generate correct URL for SOLUSDT', () => {
      const result = getExchangeContractUrl('mexc', 'SOLUSDT');
      expect(result.isValid).toBe(true);
      expect(result.url).toBe(
        'https://futures.mexc.com/zh-TW/exchange/SOL_USDT'
      );
      expect(result.formattedSymbol).toBe('SOL_USDT');
    });
  });

  describe('Gate.io', () => {
    it('should generate correct URL for BTCUSDT', () => {
      const result = getExchangeContractUrl('gateio', 'BTCUSDT');
      expect(result.isValid).toBe(true);
      expect(result.url).toBe(
        'https://www.gate.io/zh-tw/futures_trade/USDT/BTC_USDT'
      );
      expect(result.formattedSymbol).toBe('BTC_USDT');
    });

    it('should generate correct URL for BNBUSDT', () => {
      const result = getExchangeContractUrl('gateio', 'BNBUSDT');
      expect(result.isValid).toBe(true);
      expect(result.url).toBe(
        'https://www.gate.io/zh-tw/futures_trade/USDT/BNB_USDT'
      );
      expect(result.formattedSymbol).toBe('BNB_USDT');
    });
  });

  describe('Error Handling', () => {
    it('should reject unsupported exchange', () => {
      const result = getExchangeContractUrl('unknown', 'BTCUSDT');
      expect(result.isValid).toBe(false);
      expect(result.url).toBe('');
      expect(result.error).toContain('Unsupported exchange');
    });

    it('should reject symbol with slash format', () => {
      const result = getExchangeContractUrl('binance', 'BTC/USDT');
      expect(result.isValid).toBe(false);
      expect(result.url).toBe('');
      expect(result.error).toContain('Invalid symbol format');
    });

    it('should reject truly invalid symbol format', () => {
      const result = getExchangeContractUrl('binance', 'INVALID');
      expect(result.isValid).toBe(false);
      expect(result.url).toBe('');
      expect(result.error).toContain('Invalid symbol format');
    });

    it('should reject empty symbol', () => {
      const result = getExchangeContractUrl('binance', '');
      expect(result.isValid).toBe(false);
      expect(result.url).toBe('');
      expect(result.error).toContain('empty');
    });
  });
});

describe('buildExchangeUrls', () => {
  it('should build URLs for all exchanges', () => {
    const results = buildExchangeUrls('BTCUSDT');

    expect(results.binance.isValid).toBe(true);
    expect(results.binance.url).toContain('binance.com');
    expect(results.binance.formattedSymbol).toBe('BTCUSDT');

    expect(results.okx.isValid).toBe(true);
    expect(results.okx.url).toContain('okx.com');
    expect(results.okx.formattedSymbol).toBe('BTC-USDT-SWAP');

    expect(results.mexc.isValid).toBe(true);
    expect(results.mexc.url).toContain('mexc.com');
    expect(results.mexc.formattedSymbol).toBe('BTC_USDT');

    expect(results.gateio.isValid).toBe(true);
    expect(results.gateio.url).toContain('gate.io');
    expect(results.gateio.formattedSymbol).toBe('BTC_USDT');
  });

  it('should build URLs for specific exchanges', () => {
    const results = buildExchangeUrls('ETHUSDT', ['binance', 'okx']);

    expect(results.binance).toBeDefined();
    expect(results.okx).toBeDefined();
    expect(results.mexc).toBeUndefined();
    expect(results.gateio).toBeUndefined();

    expect(results.binance.isValid).toBe(true);
    expect(results.okx.isValid).toBe(true);
  });

  it('should handle invalid symbol for all exchanges', () => {
    const results = buildExchangeUrls('INVALID');

    expect(results.binance.isValid).toBe(false);
    expect(results.okx.isValid).toBe(false);
    expect(results.mexc.isValid).toBe(false);
    expect(results.gateio.isValid).toBe(false);
  });
});
