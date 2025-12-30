/**
 * BalanceUpdateEmitter Unit Tests
 * Feature: 052-specify-scripts-bash
 * Task: T067
 *
 * 測試餘額更新推送至前端
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BalanceUpdateEmitter } from '../../../src/services/websocket/BalanceUpdateEmitter';
import type { Server as SocketIOServer } from 'socket.io';

describe('BalanceUpdateEmitter', () => {
  let emitter: BalanceUpdateEmitter;
  let mockIo: SocketIOServer;

  beforeEach(() => {
    mockIo = {
      emit: vi.fn(),
      to: vi.fn().mockReturnThis(),
    } as unknown as SocketIOServer;

    emitter = new BalanceUpdateEmitter(mockIo);
  });

  describe('emitBalanceUpdate', () => {
    it('should emit balance:update event to all clients', () => {
      const update = {
        exchange: 'binance' as const,
        asset: 'USDT',
        balance: '10000.00',
        change: '-100.00',
        timestamp: new Date().toISOString(),
      };

      emitter.emitBalanceUpdate(update);

      expect(mockIo.emit).toHaveBeenCalledWith('balance:update', update);
    });

    it('should include all required fields', () => {
      const update = {
        exchange: 'okx' as const,
        asset: 'BTC',
        balance: '1.5',
        change: '0.5',
        timestamp: new Date().toISOString(),
      };

      emitter.emitBalanceUpdate(update);

      expect(mockIo.emit).toHaveBeenCalledWith(
        'balance:update',
        expect.objectContaining({
          exchange: 'okx',
          asset: 'BTC',
          balance: '1.5',
          change: '0.5',
        })
      );
    });
  });

  describe('emitTotalBalanceUpdate', () => {
    it('should emit balance:total event', () => {
      const totalUpdate = {
        asset: 'USDT',
        total: '15000.00',
        byExchange: {
          binance: '10000.00',
          okx: '5000.00',
        },
        timestamp: new Date().toISOString(),
      };

      emitter.emitTotalBalanceUpdate(totalUpdate);

      expect(mockIo.emit).toHaveBeenCalledWith('balance:total', totalUpdate);
    });
  });

  describe('emitBalanceSnapshot', () => {
    it('should emit balance:snapshot with all balances', () => {
      const snapshot = {
        balances: {
          binance: { USDT: '10000.00', BTC: '1.5' },
          okx: { USDT: '5000.00' },
        },
        timestamp: new Date().toISOString(),
      };

      emitter.emitBalanceSnapshot(snapshot);

      expect(mockIo.emit).toHaveBeenCalledWith('balance:snapshot', snapshot);
    });
  });

  describe('emitToUser', () => {
    it('should emit to specific user room', () => {
      const userId = 'user-123';
      const update = {
        exchange: 'binance' as const,
        asset: 'USDT',
        balance: '10000.00',
        change: '-100.00',
        timestamp: new Date().toISOString(),
      };

      emitter.emitToUser(userId, 'balance:update', update);

      expect(mockIo.to).toHaveBeenCalledWith(`user:${userId}`);
      expect(mockIo.emit).toHaveBeenCalledWith('balance:update', update);
    });
  });
});
