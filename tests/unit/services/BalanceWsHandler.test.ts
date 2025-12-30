/**
 * BalanceWsHandler Unit Tests
 * Feature: 052-specify-scripts-bash
 * Task: T066
 *
 * 測試餘額 WebSocket 事件處理
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BalanceWsHandler } from '../../../src/services/websocket/BalanceWsHandler';
import Decimal from 'decimal.js';
import type { BalanceChanged } from '../../../src/types/internal-events';

describe('BalanceWsHandler', () => {
  let handler: BalanceWsHandler;

  beforeEach(() => {
    handler = new BalanceWsHandler();
  });

  describe('handleBalanceChanged', () => {
    it('should emit balanceUpdate event when balance changes', () => {
      const eventHandler = vi.fn();
      handler.on('balanceUpdate', eventHandler);

      const balanceEvent: BalanceChanged = {
        exchange: 'binance',
        asset: 'USDT',
        walletBalance: new Decimal('10000.00'),
        crossWalletBalance: new Decimal('9500.00'),
        balanceChange: new Decimal('-100.00'),
        changeReason: 'ORDER',
        source: 'websocket',
        receivedAt: new Date(),
      };

      handler.handleBalanceChanged(balanceEvent);

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          exchange: 'binance',
          asset: 'USDT',
          balance: '10000',
          change: '-100',
        })
      );
    });

    it('should aggregate balances by exchange and asset', () => {
      const event1: BalanceChanged = {
        exchange: 'binance',
        asset: 'USDT',
        walletBalance: new Decimal('10000.00'),
        crossWalletBalance: new Decimal('9500.00'),
        balanceChange: new Decimal('1000.00'),
        changeReason: 'DEPOSIT',
        source: 'websocket',
        receivedAt: new Date(),
      };

      const event2: BalanceChanged = {
        exchange: 'binance',
        asset: 'BTC',
        walletBalance: new Decimal('1.5'),
        crossWalletBalance: new Decimal('1.5'),
        balanceChange: new Decimal('0.5'),
        changeReason: 'ORDER',
        source: 'websocket',
        receivedAt: new Date(),
      };

      handler.handleBalanceChanged(event1);
      handler.handleBalanceChanged(event2);

      const balances = handler.getBalances();
      expect(balances.binance.USDT).toBe('10000');
      expect(balances.binance.BTC).toBe('1.5');
    });

    it('should track balance history', () => {
      const event: BalanceChanged = {
        exchange: 'okx',
        asset: 'USDT',
        walletBalance: new Decimal('5000.00'),
        crossWalletBalance: new Decimal('5000.00'),
        balanceChange: new Decimal('500.00'),
        changeReason: 'FUNDING_FEE',
        source: 'websocket',
        receivedAt: new Date(),
      };

      handler.handleBalanceChanged(event);

      const history = handler.getBalanceHistory('okx', 'USDT');
      expect(history.length).toBe(1);
      expect(history[0].balance).toBe('5000');
      expect(history[0].change).toBe('500');
    });
  });

  describe('getBalances', () => {
    it('should return empty object when no balances', () => {
      const balances = handler.getBalances();
      expect(balances).toEqual({});
    });

    it('should return balances grouped by exchange', () => {
      handler.handleBalanceChanged({
        exchange: 'binance',
        asset: 'USDT',
        walletBalance: new Decimal('1000'),
        crossWalletBalance: new Decimal('1000'),
        balanceChange: new Decimal('1000'),
        changeReason: 'DEPOSIT',
        source: 'websocket',
        receivedAt: new Date(),
      });

      handler.handleBalanceChanged({
        exchange: 'okx',
        asset: 'USDT',
        walletBalance: new Decimal('2000'),
        crossWalletBalance: new Decimal('2000'),
        balanceChange: new Decimal('2000'),
        changeReason: 'DEPOSIT',
        source: 'websocket',
        receivedAt: new Date(),
      });

      const balances = handler.getBalances();
      expect(balances.binance.USDT).toBe('1000');
      expect(balances.okx.USDT).toBe('2000');
    });
  });

  describe('getTotalBalance', () => {
    it('should calculate total balance for an asset', () => {
      handler.handleBalanceChanged({
        exchange: 'binance',
        asset: 'USDT',
        walletBalance: new Decimal('1000'),
        crossWalletBalance: new Decimal('1000'),
        balanceChange: new Decimal('1000'),
        changeReason: 'DEPOSIT',
        source: 'websocket',
        receivedAt: new Date(),
      });

      handler.handleBalanceChanged({
        exchange: 'okx',
        asset: 'USDT',
        walletBalance: new Decimal('2000'),
        crossWalletBalance: new Decimal('2000'),
        balanceChange: new Decimal('2000'),
        changeReason: 'DEPOSIT',
        source: 'websocket',
        receivedAt: new Date(),
      });

      const total = handler.getTotalBalance('USDT');
      expect(total).toBe('3000');
    });

    it('should return 0 for unknown asset', () => {
      const total = handler.getTotalBalance('ETH');
      expect(total).toBe('0');
    });
  });

  describe('clear', () => {
    it('should clear all balances', () => {
      handler.handleBalanceChanged({
        exchange: 'binance',
        asset: 'USDT',
        walletBalance: new Decimal('1000'),
        crossWalletBalance: new Decimal('1000'),
        balanceChange: new Decimal('1000'),
        changeReason: 'DEPOSIT',
        source: 'websocket',
        receivedAt: new Date(),
      });

      handler.clear();

      const balances = handler.getBalances();
      expect(balances).toEqual({});
    });
  });
});
