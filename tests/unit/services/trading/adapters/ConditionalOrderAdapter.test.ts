/**
 * Test: ConditionalOrderAdapter
 *
 * 條件單適配器介面與工具函數單元測試
 */
import { describe, it, expect } from 'vitest';
import {
  getClosingSide,
  convertSymbolForExchange,
} from '@/services/trading/adapters/ConditionalOrderAdapter';

describe('ConditionalOrderAdapter Utilities', () => {
  describe('getClosingSide', () => {
    it('should return SELL for LONG position', () => {
      const result = getClosingSide('LONG');
      expect(result).toBe('SELL');
    });

    it('should return BUY for SHORT position', () => {
      const result = getClosingSide('SHORT');
      expect(result).toBe('BUY');
    });
  });

  describe('convertSymbolForExchange', () => {
    describe('Binance format', () => {
      it('should convert BTCUSDT to BTCUSDT', () => {
        const result = convertSymbolForExchange('BTCUSDT', 'binance');
        expect(result).toBe('BTCUSDT');
      });

      it('should convert BTC/USDT to BTCUSDT', () => {
        const result = convertSymbolForExchange('BTC/USDT', 'binance');
        expect(result).toBe('BTCUSDT');
      });

      it('should convert BTC-USDT to BTCUSDT', () => {
        const result = convertSymbolForExchange('BTC-USDT', 'binance');
        expect(result).toBe('BTCUSDT');
      });

      it('should convert BTC_USDT to BTCUSDT', () => {
        const result = convertSymbolForExchange('BTC_USDT', 'binance');
        expect(result).toBe('BTCUSDT');
      });

      it('should handle ETHUSDT', () => {
        const result = convertSymbolForExchange('ETHUSDT', 'binance');
        expect(result).toBe('ETHUSDT');
      });
    });

    describe('OKX format', () => {
      it('should convert BTCUSDT to BTC-USDT-SWAP', () => {
        const result = convertSymbolForExchange('BTCUSDT', 'okx');
        expect(result).toBe('BTC-USDT-SWAP');
      });

      it('should convert BTC/USDT to BTC-USDT-SWAP', () => {
        const result = convertSymbolForExchange('BTC/USDT', 'okx');
        expect(result).toBe('BTC-USDT-SWAP');
      });

      it('should convert ETH-USDT to ETH-USDT-SWAP', () => {
        const result = convertSymbolForExchange('ETH-USDT', 'okx');
        expect(result).toBe('ETH-USDT-SWAP');
      });
    });

    describe('Gate.io format', () => {
      it('should convert BTCUSDT to BTC_USDT', () => {
        const result = convertSymbolForExchange('BTCUSDT', 'gateio');
        expect(result).toBe('BTC_USDT');
      });

      it('should convert BTC/USDT to BTC_USDT', () => {
        const result = convertSymbolForExchange('BTC/USDT', 'gateio');
        expect(result).toBe('BTC_USDT');
      });

      it('should convert ETH-USDC to ETH_USDC', () => {
        const result = convertSymbolForExchange('ETH-USDC', 'gateio');
        expect(result).toBe('ETH_USDC');
      });
    });

    describe('MEXC format', () => {
      it('should convert BTCUSDT to BTCUSDT', () => {
        const result = convertSymbolForExchange('BTCUSDT', 'mexc');
        expect(result).toBe('BTCUSDT');
      });

      it('should convert BTC/USDT to BTCUSDT', () => {
        const result = convertSymbolForExchange('BTC/USDT', 'mexc');
        expect(result).toBe('BTCUSDT');
      });
    });

    describe('BingX format', () => {
      it('should convert BTCUSDT to BTC/USDT:USDT', () => {
        const result = convertSymbolForExchange('BTCUSDT', 'bingx');
        expect(result).toBe('BTC/USDT:USDT');
      });

      it('should convert BTC/USDT to BTC/USDT:USDT', () => {
        const result = convertSymbolForExchange('BTC/USDT', 'bingx');
        expect(result).toBe('BTC/USDT:USDT');
      });

      it('should convert ETH-USDC to ETH/USDC:USDC', () => {
        const result = convertSymbolForExchange('ETH-USDC', 'bingx');
        expect(result).toBe('ETH/USDC:USDC');
      });
    });

    describe('Various quote currencies', () => {
      it('should handle USDC quote', () => {
        const result = convertSymbolForExchange('BTCUSDC', 'binance');
        expect(result).toBe('BTCUSDC');
      });

      it('should handle BUSD quote', () => {
        const result = convertSymbolForExchange('ETHBUSD', 'binance');
        expect(result).toBe('ETHBUSD');
      });

      it('should handle USD quote', () => {
        const result = convertSymbolForExchange('BTCUSD', 'binance');
        expect(result).toBe('BTCUSD');
      });

      it('should handle BTC quote', () => {
        const result = convertSymbolForExchange('ETHBTC', 'binance');
        expect(result).toBe('ETHBTC');
      });

      it('should handle ETH quote', () => {
        const result = convertSymbolForExchange('LINKETH', 'binance');
        expect(result).toBe('LINKETH');
      });
    });

    describe('Edge cases', () => {
      it('should handle unknown symbol format', () => {
        const result = convertSymbolForExchange('UNKNOWNSYMBOL', 'binance');
        // Cannot parse quote, returns as-is with USDT appended
        expect(result).toBe('UNKNOWNSYMBOLUSDT');
      });

      it('should handle OKX swap symbol input', () => {
        // BTC-USDT-SWAP should be parsed as base=BTC, quote=USDT
        const result = convertSymbolForExchange('BTC-USDT-SWAP', 'binance');
        expect(result).toBe('BTCUSDT');
      });

      it('should handle symbols with numbers', () => {
        const result = convertSymbolForExchange('1000PEPEUSDT', 'binance');
        expect(result).toBe('1000PEPEUSDT');
      });

      it('should handle 1000PEPE/USDT format', () => {
        const result = convertSymbolForExchange('1000PEPE/USDT', 'okx');
        expect(result).toBe('1000PEPE-USDT-SWAP');
      });
    });
  });
});
