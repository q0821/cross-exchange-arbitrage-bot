/**
 * Test: BalanceUpdateEmitter
 *
 * 餘額更新 WebSocket 推送服務單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BalanceUpdateEmitter } from '@/services/websocket/BalanceUpdateEmitter';
import type { BalanceUpdateData, TotalBalanceUpdateData, BalanceSnapshotData } from '@/services/websocket/BalanceUpdateEmitter';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('BalanceUpdateEmitter', () => {
  let emitter: BalanceUpdateEmitter;
  let mockIO: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockIO = {
      emit: vi.fn(),
      to: vi.fn().mockReturnThis(),
    };

    emitter = new BalanceUpdateEmitter(mockIO);
  });

  describe('emitBalanceUpdate', () => {
    it('should emit balance:update event', () => {
      const data: BalanceUpdateData = {
        exchange: 'binance',
        asset: 'USDT',
        balance: '1000.50',
        change: '+50.00',
        timestamp: '2024-01-15T10:00:00Z',
      };

      emitter.emitBalanceUpdate(data);

      expect(mockIO.emit).toHaveBeenCalledWith('balance:update', data);
    });

    it('should log debug message with balance details', async () => {
      const { logger } = await import('@/lib/logger');
      const data: BalanceUpdateData = {
        exchange: 'okx',
        asset: 'BTC',
        balance: '1.5',
        change: '-0.1',
        timestamp: '2024-01-15T10:00:00Z',
      };

      emitter.emitBalanceUpdate(data);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          exchange: 'okx',
          asset: 'BTC',
          balance: '1.5',
        }),
        'Balance update emitted',
      );
    });
  });

  describe('emitTotalBalanceUpdate', () => {
    it('should emit balance:total event', () => {
      const data: TotalBalanceUpdateData = {
        asset: 'USDT',
        total: '5000.00',
        byExchange: {
          binance: '2000.00',
          okx: '1500.00',
          gateio: '1500.00',
        },
        timestamp: '2024-01-15T10:00:00Z',
      };

      emitter.emitTotalBalanceUpdate(data);

      expect(mockIO.emit).toHaveBeenCalledWith('balance:total', data);
    });

    it('should log debug message with total balance', async () => {
      const { logger } = await import('@/lib/logger');
      const data: TotalBalanceUpdateData = {
        asset: 'USDT',
        total: '10000.00',
        byExchange: { binance: '10000.00' },
        timestamp: '2024-01-15T10:00:00Z',
      };

      emitter.emitTotalBalanceUpdate(data);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          asset: 'USDT',
          total: '10000.00',
        }),
        'Total balance update emitted',
      );
    });
  });

  describe('emitBalanceSnapshot', () => {
    it('should emit balance:snapshot event', () => {
      const data: BalanceSnapshotData = {
        balances: {
          binance: { USDT: '1000', BTC: '0.5' },
          okx: { USDT: '2000', ETH: '10' },
        },
        timestamp: '2024-01-15T10:00:00Z',
      };

      emitter.emitBalanceSnapshot(data);

      expect(mockIO.emit).toHaveBeenCalledWith('balance:snapshot', data);
    });

    it('should log debug message', async () => {
      const { logger } = await import('@/lib/logger');
      const data: BalanceSnapshotData = {
        balances: {},
        timestamp: '2024-01-15T10:00:00Z',
      };

      emitter.emitBalanceSnapshot(data);

      expect(logger.debug).toHaveBeenCalledWith('Balance snapshot emitted');
    });
  });

  describe('emitToUser', () => {
    it('should emit event to specific user room', () => {
      const userId = 'user-123';
      const event = 'custom:event';
      const data = { message: 'test' };

      emitter.emitToUser(userId, event, data);

      expect(mockIO.to).toHaveBeenCalledWith('user:user-123');
      expect(mockIO.emit).toHaveBeenCalledWith(event, data);
    });

    it('should log debug message with user and event', async () => {
      const { logger } = await import('@/lib/logger');
      const userId = 'user-456';
      const event = 'balance:custom';
      const data = { value: 100 };

      emitter.emitToUser(userId, event, data);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-456',
          event: 'balance:custom',
        }),
        'Balance event emitted to user',
      );
    });
  });

  describe('emitBalanceChangeNotification', () => {
    it('should emit balance:notification event', () => {
      vi.useFakeTimers();
      const now = new Date('2024-01-15T10:00:00Z');
      vi.setSystemTime(now);

      emitter.emitBalanceChangeNotification('binance', 'USDT', '+100.00', 'DEPOSIT');

      expect(mockIO.emit).toHaveBeenCalledWith('balance:notification', {
        exchange: 'binance',
        asset: 'USDT',
        change: '+100.00',
        reason: 'DEPOSIT',
        timestamp: now.toISOString(),
      });

      vi.useRealTimers();
    });

    it('should log info message with change details', async () => {
      const { logger } = await import('@/lib/logger');

      emitter.emitBalanceChangeNotification('okx', 'BTC', '-0.01', 'WITHDRAWAL');

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          exchange: 'okx',
          asset: 'BTC',
          change: '-0.01',
          reason: 'WITHDRAWAL',
        }),
        'Balance change notification emitted',
      );
    });
  });

  describe('Constructor', () => {
    it('should store Socket.IO server reference', () => {
      const newEmitter = new BalanceUpdateEmitter(mockIO);

      // Verify it works by calling a method
      newEmitter.emitBalanceUpdate({
        exchange: 'binance',
        asset: 'USDT',
        balance: '100',
        change: '0',
        timestamp: new Date().toISOString(),
      });

      expect(mockIO.emit).toHaveBeenCalled();
    });
  });
});
