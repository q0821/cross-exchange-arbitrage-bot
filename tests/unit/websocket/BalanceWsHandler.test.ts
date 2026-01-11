/**
 * Test: BalanceWsHandler
 *
 * 餘額 WebSocket 處理器單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import { BalanceWsHandler } from '@/services/websocket/BalanceWsHandler';
import type { BalanceChanged } from '@/types/internal-events';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('BalanceWsHandler', () => {
  let handler: BalanceWsHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new BalanceWsHandler();
  });

  describe('handleBalanceChanged', () => {
    it('should store balance for new exchange', () => {
      const event: BalanceChanged = {
        exchange: 'binance',
        asset: 'USDT',
        walletBalance: new Decimal(1000),
        balanceChange: new Decimal(100),
        changeReason: 'DEPOSIT',
        receivedAt: new Date(),
      };

      handler.handleBalanceChanged(event);

      const balances = handler.getBalances();
      expect(balances.binance).toBeDefined();
      expect(balances.binance.USDT).toBe('1000');
    });

    it('should update existing balance', () => {
      const event1: BalanceChanged = {
        exchange: 'binance',
        asset: 'USDT',
        walletBalance: new Decimal(1000),
        balanceChange: new Decimal(1000),
        changeReason: 'DEPOSIT',
        receivedAt: new Date(),
      };

      const event2: BalanceChanged = {
        exchange: 'binance',
        asset: 'USDT',
        walletBalance: new Decimal(1500),
        balanceChange: new Decimal(500),
        changeReason: 'DEPOSIT',
        receivedAt: new Date(),
      };

      handler.handleBalanceChanged(event1);
      handler.handleBalanceChanged(event2);

      const balances = handler.getBalances();
      expect(balances.binance.USDT).toBe('1500');
    });

    it('should track multiple assets for same exchange', () => {
      const usdtEvent: BalanceChanged = {
        exchange: 'okx',
        asset: 'USDT',
        walletBalance: new Decimal(2000),
        balanceChange: new Decimal(2000),
        changeReason: 'DEPOSIT',
        receivedAt: new Date(),
      };

      const btcEvent: BalanceChanged = {
        exchange: 'okx',
        asset: 'BTC',
        walletBalance: new Decimal(0.5),
        balanceChange: new Decimal(0.5),
        changeReason: 'DEPOSIT',
        receivedAt: new Date(),
      };

      handler.handleBalanceChanged(usdtEvent);
      handler.handleBalanceChanged(btcEvent);

      const balances = handler.getBalances();
      expect(balances.okx.USDT).toBe('2000');
      expect(balances.okx.BTC).toBe('0.5');
    });

    it('should emit balanceUpdate event', () => {
      const eventListener = vi.fn();
      handler.on('balanceUpdate', eventListener);

      const event: BalanceChanged = {
        exchange: 'gateio',
        asset: 'ETH',
        walletBalance: new Decimal(10),
        balanceChange: new Decimal(5),
        changeReason: 'TRADE',
        receivedAt: new Date('2024-01-15T10:00:00Z'),
      };

      handler.handleBalanceChanged(event);

      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          exchange: 'gateio',
          asset: 'ETH',
          balance: '10',
          change: '5',
          reason: 'TRADE',
        })
      );
    });

    it('should use UNKNOWN as default reason', () => {
      const eventListener = vi.fn();
      handler.on('balanceUpdate', eventListener);

      const event: BalanceChanged = {
        exchange: 'binance',
        asset: 'USDT',
        walletBalance: new Decimal(100),
        balanceChange: new Decimal(10),
        changeReason: undefined,
        receivedAt: new Date(),
      };

      handler.handleBalanceChanged(event);

      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'UNKNOWN',
        })
      );
    });

    it('should record history entry', () => {
      const event: BalanceChanged = {
        exchange: 'binance',
        asset: 'USDT',
        walletBalance: new Decimal(1000),
        balanceChange: new Decimal(100),
        changeReason: 'DEPOSIT',
        receivedAt: new Date('2024-01-15T10:00:00Z'),
      };

      handler.handleBalanceChanged(event);

      const history = handler.getBalanceHistory('binance', 'USDT');
      expect(history).toHaveLength(1);
      expect(history[0].balance).toBe('1000');
      expect(history[0].change).toBe('100');
      expect(history[0].reason).toBe('DEPOSIT');
    });

    it('should limit history length to 100 entries', () => {
      // Add 105 events
      for (let i = 0; i < 105; i++) {
        const event: BalanceChanged = {
          exchange: 'binance',
          asset: 'USDT',
          walletBalance: new Decimal(i * 100),
          balanceChange: new Decimal(100),
          changeReason: 'TRADE',
          receivedAt: new Date(),
        };
        handler.handleBalanceChanged(event);
      }

      const history = handler.getBalanceHistory('binance', 'USDT');
      expect(history).toHaveLength(100);
      // First entry should be removed (i=5), so first balance is 500
      expect(history[0].balance).toBe('500');
    });

    it('should format balance by removing trailing zeros', () => {
      const event: BalanceChanged = {
        exchange: 'binance',
        asset: 'USDT',
        walletBalance: new Decimal('1000.50000000'),
        balanceChange: new Decimal('100.10000000'),
        changeReason: 'DEPOSIT',
        receivedAt: new Date(),
      };

      handler.handleBalanceChanged(event);

      const balances = handler.getBalances();
      expect(balances.binance.USDT).toBe('1000.5');
    });
  });

  describe('getBalances', () => {
    it('should return empty object when no balances', () => {
      const balances = handler.getBalances();
      expect(balances).toEqual({});
    });

    it('should return all balances across exchanges', () => {
      handler.handleBalanceChanged({
        exchange: 'binance',
        asset: 'USDT',
        walletBalance: new Decimal(1000),
        balanceChange: new Decimal(1000),
        changeReason: 'DEPOSIT',
        receivedAt: new Date(),
      });

      handler.handleBalanceChanged({
        exchange: 'okx',
        asset: 'USDT',
        walletBalance: new Decimal(2000),
        balanceChange: new Decimal(2000),
        changeReason: 'DEPOSIT',
        receivedAt: new Date(),
      });

      const balances = handler.getBalances();
      expect(Object.keys(balances)).toHaveLength(2);
      expect(balances.binance.USDT).toBe('1000');
      expect(balances.okx.USDT).toBe('2000');
    });
  });

  describe('getExchangeBalances', () => {
    it('should return empty object for unknown exchange', () => {
      const balances = handler.getExchangeBalances('binance');
      expect(balances).toEqual({});
    });

    it('should return balances for specific exchange', () => {
      handler.handleBalanceChanged({
        exchange: 'binance',
        asset: 'USDT',
        walletBalance: new Decimal(1000),
        balanceChange: new Decimal(1000),
        changeReason: 'DEPOSIT',
        receivedAt: new Date(),
      });

      handler.handleBalanceChanged({
        exchange: 'binance',
        asset: 'BTC',
        walletBalance: new Decimal(0.5),
        balanceChange: new Decimal(0.5),
        changeReason: 'DEPOSIT',
        receivedAt: new Date(),
      });

      handler.handleBalanceChanged({
        exchange: 'okx',
        asset: 'USDT',
        walletBalance: new Decimal(2000),
        balanceChange: new Decimal(2000),
        changeReason: 'DEPOSIT',
        receivedAt: new Date(),
      });

      const binanceBalances = handler.getExchangeBalances('binance');
      expect(Object.keys(binanceBalances)).toHaveLength(2);
      expect(binanceBalances.USDT).toBe('1000');
      expect(binanceBalances.BTC).toBe('0.5');
    });
  });

  describe('getTotalBalance', () => {
    it('should return 0 for unknown asset', () => {
      const total = handler.getTotalBalance('USDT');
      expect(total).toBe('0');
    });

    it('should sum balances across exchanges', () => {
      handler.handleBalanceChanged({
        exchange: 'binance',
        asset: 'USDT',
        walletBalance: new Decimal(1000),
        balanceChange: new Decimal(1000),
        changeReason: 'DEPOSIT',
        receivedAt: new Date(),
      });

      handler.handleBalanceChanged({
        exchange: 'okx',
        asset: 'USDT',
        walletBalance: new Decimal(2000),
        balanceChange: new Decimal(2000),
        changeReason: 'DEPOSIT',
        receivedAt: new Date(),
      });

      handler.handleBalanceChanged({
        exchange: 'gateio',
        asset: 'USDT',
        walletBalance: new Decimal(500),
        balanceChange: new Decimal(500),
        changeReason: 'DEPOSIT',
        receivedAt: new Date(),
      });

      const total = handler.getTotalBalance('USDT');
      expect(total).toBe('3500');
    });

    it('should only sum specified asset', () => {
      handler.handleBalanceChanged({
        exchange: 'binance',
        asset: 'USDT',
        walletBalance: new Decimal(1000),
        balanceChange: new Decimal(1000),
        changeReason: 'DEPOSIT',
        receivedAt: new Date(),
      });

      handler.handleBalanceChanged({
        exchange: 'binance',
        asset: 'BTC',
        walletBalance: new Decimal(0.5),
        balanceChange: new Decimal(0.5),
        changeReason: 'DEPOSIT',
        receivedAt: new Date(),
      });

      const usdtTotal = handler.getTotalBalance('USDT');
      const btcTotal = handler.getTotalBalance('BTC');
      expect(usdtTotal).toBe('1000');
      expect(btcTotal).toBe('0.5');
    });
  });

  describe('getBalanceHistory', () => {
    it('should return empty array for unknown exchange/asset', () => {
      const history = handler.getBalanceHistory('binance', 'USDT');
      expect(history).toEqual([]);
    });

    it('should return history for specific exchange and asset', () => {
      const timestamp1 = new Date('2024-01-15T10:00:00Z');
      const timestamp2 = new Date('2024-01-15T11:00:00Z');

      handler.handleBalanceChanged({
        exchange: 'binance',
        asset: 'USDT',
        walletBalance: new Decimal(1000),
        balanceChange: new Decimal(1000),
        changeReason: 'DEPOSIT',
        receivedAt: timestamp1,
      });

      handler.handleBalanceChanged({
        exchange: 'binance',
        asset: 'USDT',
        walletBalance: new Decimal(900),
        balanceChange: new Decimal(-100),
        changeReason: 'WITHDRAWAL',
        receivedAt: timestamp2,
      });

      const history = handler.getBalanceHistory('binance', 'USDT');
      expect(history).toHaveLength(2);
      expect(history[0]).toEqual({
        balance: '1000',
        change: '1000',
        reason: 'DEPOSIT',
        timestamp: timestamp1,
      });
      expect(history[1]).toEqual({
        balance: '900',
        change: '-100',
        reason: 'WITHDRAWAL',
        timestamp: timestamp2,
      });
    });
  });

  describe('clear', () => {
    it('should clear all balances and history', () => {
      handler.handleBalanceChanged({
        exchange: 'binance',
        asset: 'USDT',
        walletBalance: new Decimal(1000),
        balanceChange: new Decimal(1000),
        changeReason: 'DEPOSIT',
        receivedAt: new Date(),
      });

      handler.clear();

      expect(handler.getBalances()).toEqual({});
      expect(handler.getBalanceHistory('binance', 'USDT')).toEqual([]);
    });
  });

  describe('Event Emission', () => {
    it('should allow multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      handler.on('balanceUpdate', listener1);
      handler.on('balanceUpdate', listener2);

      handler.handleBalanceChanged({
        exchange: 'binance',
        asset: 'USDT',
        walletBalance: new Decimal(1000),
        balanceChange: new Decimal(100),
        changeReason: 'DEPOSIT',
        receivedAt: new Date(),
      });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should allow removing listeners', () => {
      const listener = vi.fn();

      handler.on('balanceUpdate', listener);
      handler.off('balanceUpdate', listener);

      handler.handleBalanceChanged({
        exchange: 'binance',
        asset: 'USDT',
        walletBalance: new Decimal(1000),
        balanceChange: new Decimal(100),
        changeReason: 'DEPOSIT',
        receivedAt: new Date(),
      });

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
