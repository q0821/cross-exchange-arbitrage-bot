/**
 * PositionExitEmitter Unit Tests
 *
 * Feature: 067-position-exit-monitor
 * Phase: 2 - User Story 1
 *
 * 測試 WebSocket 推送：
 * - emitExitSuggested() 發送正確事件格式
 * - emitExitCanceled() 發送正確事件格式
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to define mock functions before vi.mock is hoisted
const { _mockEmitToUser, mockGetIo } = vi.hoisted(() => ({
  _mockEmitToUser: vi.fn(),
  mockGetIo: vi.fn(),
}));

// Mock Socket.io
vi.mock('@/lib/socket-manager', () => ({
  getIo: mockGetIo,
}));

// Import after mocks
import { PositionExitEmitter, positionExitEmitter } from '@/services/websocket/PositionExitEmitter';
import { ExitSuggestionReason } from '@/services/monitor/types';
import type { ExitSuggestedEvent, ExitCanceledEvent } from '@/services/monitor/types';

describe('PositionExitEmitter', () => {
  let emitter: PositionExitEmitter;
  let mockIo: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // 建立 mock Socket.io 實例
    mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    };
    mockGetIo.mockReturnValue(mockIo);

    emitter = new PositionExitEmitter();
  });

  describe('emitExitSuggested()', () => {
    it('應該發送 position:exit:suggested 事件到指定用戶', () => {
      const userId = 'user-test-001';
      const event: ExitSuggestedEvent = {
        positionId: 'position-test-001',
        symbol: 'BTCUSDT',
        reason: ExitSuggestionReason.APY_NEGATIVE,
        reasonDescription: 'APY 已轉負，繼續持有會虧損',
        currentAPY: -50.2,
        fundingPnL: 12.35,
        priceDiffLoss: 8.2,
        netProfit: 4.15,
        longExchange: 'binance',
        shortExchange: 'okx',
        currentLongPrice: 65000,
        currentShortPrice: 65050,
        stalePrice: false,
        suggestedAt: new Date().toISOString(),
      };

      emitter.emitExitSuggested(userId, event);

      // 驗證發送到正確的用戶房間
      expect(mockIo.to).toHaveBeenCalledWith(`user:${userId}`);

      // 驗證事件名稱和內容
      expect(mockIo.emit).toHaveBeenCalledWith('position:exit:suggested', event);
    });

    it('應該正確處理 PROFIT_LOCKABLE 原因', () => {
      const userId = 'user-test-002';
      const event: ExitSuggestedEvent = {
        positionId: 'position-test-002',
        symbol: 'ETHUSDT',
        reason: ExitSuggestionReason.PROFIT_LOCKABLE,
        reasonDescription: 'APY 低於閾值但整體有獲利可鎖定',
        currentAPY: 50.0,
        fundingPnL: 25.0,
        priceDiffLoss: 10.0,
        netProfit: 15.0,
        longExchange: 'okx',
        shortExchange: 'binance',
        currentLongPrice: 3500,
        currentShortPrice: 3505,
        stalePrice: false,
        suggestedAt: new Date().toISOString(),
      };

      emitter.emitExitSuggested(userId, event);

      expect(mockIo.emit).toHaveBeenCalledWith(
        'position:exit:suggested',
        expect.objectContaining({
          reason: ExitSuggestionReason.PROFIT_LOCKABLE,
        })
      );
    });

    it('Socket.io 未初始化時不應該拋出錯誤', () => {
      mockGetIo.mockReturnValue(null);

      const userId = 'user-test-003';
      const event: ExitSuggestedEvent = {
        positionId: 'position-test-003',
        symbol: 'BTCUSDT',
        reason: ExitSuggestionReason.APY_NEGATIVE,
        reasonDescription: 'APY 已轉負',
        currentAPY: -10,
        fundingPnL: 5,
        priceDiffLoss: 3,
        netProfit: 2,
        longExchange: 'binance',
        shortExchange: 'okx',
        currentLongPrice: 65000,
        currentShortPrice: 65050,
        stalePrice: false,
        suggestedAt: new Date().toISOString(),
      };

      // 不應該拋出錯誤
      expect(() => emitter.emitExitSuggested(userId, event)).not.toThrow();
    });
  });

  describe('emitExitCanceled()', () => {
    it('應該發送 position:exit:canceled 事件到指定用戶', () => {
      const userId = 'user-test-001';
      const event: ExitCanceledEvent = {
        positionId: 'position-test-001',
        symbol: 'BTCUSDT',
        currentAPY: 200.0,
        canceledAt: new Date().toISOString(),
      };

      emitter.emitExitCanceled(userId, event);

      // 驗證發送到正確的用戶房間
      expect(mockIo.to).toHaveBeenCalledWith(`user:${userId}`);

      // 驗證事件名稱和內容
      expect(mockIo.emit).toHaveBeenCalledWith('position:exit:canceled', event);
    });

    it('Socket.io 未初始化時不應該拋出錯誤', () => {
      mockGetIo.mockReturnValue(null);

      const userId = 'user-test-003';
      const event: ExitCanceledEvent = {
        positionId: 'position-test-003',
        symbol: 'BTCUSDT',
        currentAPY: 150,
        canceledAt: new Date().toISOString(),
      };

      expect(() => emitter.emitExitCanceled(userId, event)).not.toThrow();
    });
  });

  describe('singleton instance', () => {
    it('positionExitEmitter 應該是單例實例', () => {
      expect(positionExitEmitter).toBeDefined();
      expect(positionExitEmitter).toBeInstanceOf(PositionExitEmitter);
    });
  });

  describe('事件格式驗證', () => {
    it('ExitSuggestedEvent 應該包含所有必要欄位', () => {
      const userId = 'user-test-001';
      const event: ExitSuggestedEvent = {
        positionId: 'position-test-001',
        symbol: 'BTCUSDT',
        reason: ExitSuggestionReason.APY_NEGATIVE,
        reasonDescription: 'APY 已轉負，繼續持有會虧損',
        currentAPY: -50.2,
        fundingPnL: 12.35,
        priceDiffLoss: 8.2,
        netProfit: 4.15,
        longExchange: 'binance',
        shortExchange: 'okx',
        currentLongPrice: 65000,
        currentShortPrice: 65050,
        stalePrice: false,
        suggestedAt: new Date().toISOString(),
      };

      emitter.emitExitSuggested(userId, event);

      const emittedEvent = mockIo.emit.mock.calls[0][1];

      // 驗證所有必要欄位存在
      expect(emittedEvent).toHaveProperty('positionId');
      expect(emittedEvent).toHaveProperty('symbol');
      expect(emittedEvent).toHaveProperty('reason');
      expect(emittedEvent).toHaveProperty('reasonDescription');
      expect(emittedEvent).toHaveProperty('currentAPY');
      expect(emittedEvent).toHaveProperty('fundingPnL');
      expect(emittedEvent).toHaveProperty('priceDiffLoss');
      expect(emittedEvent).toHaveProperty('netProfit');
      expect(emittedEvent).toHaveProperty('longExchange');
      expect(emittedEvent).toHaveProperty('shortExchange');
      expect(emittedEvent).toHaveProperty('currentLongPrice');
      expect(emittedEvent).toHaveProperty('currentShortPrice');
      expect(emittedEvent).toHaveProperty('stalePrice');
      expect(emittedEvent).toHaveProperty('suggestedAt');
    });

    it('ExitCanceledEvent 應該包含所有必要欄位', () => {
      const userId = 'user-test-001';
      const event: ExitCanceledEvent = {
        positionId: 'position-test-001',
        symbol: 'BTCUSDT',
        currentAPY: 200.0,
        canceledAt: new Date().toISOString(),
      };

      emitter.emitExitCanceled(userId, event);

      const emittedEvent = mockIo.emit.mock.calls[0][1];

      // 驗證所有必要欄位存在
      expect(emittedEvent).toHaveProperty('positionId');
      expect(emittedEvent).toHaveProperty('symbol');
      expect(emittedEvent).toHaveProperty('currentAPY');
      expect(emittedEvent).toHaveProperty('canceledAt');
    });
  });
});
