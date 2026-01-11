/**
 * Test: TriggerProgressEmitter
 *
 * 觸發事件 WebSocket 推送服務單元測試
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TriggerProgressEmitter, TRIGGER_WS_EVENTS } from '@/services/websocket/TriggerProgressEmitter';
import type {
  TriggerDetectedEvent,
  TriggerCloseSuccessEvent,
  TriggerCloseFailedEvent,
} from '@/services/websocket/TriggerProgressEmitter';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('TriggerProgressEmitter', () => {
  let emitter: TriggerProgressEmitter;
  let mockIO: any;
  let mockToReturn: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton for testing
    (TriggerProgressEmitter as any).instance = null;

    mockToReturn = {
      emit: vi.fn(),
    };

    mockIO = {
      emit: vi.fn(),
      to: vi.fn().mockReturnValue(mockToReturn),
    };

    emitter = TriggerProgressEmitter.getInstance();
  });

  afterEach(() => {
    // Reset singleton after each test
    (TriggerProgressEmitter as any).instance = null;
  });

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const instance1 = TriggerProgressEmitter.getInstance();
      const instance2 = TriggerProgressEmitter.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('should store Socket.IO server reference', () => {
      expect(emitter.isInitialized()).toBe(false);

      emitter.initialize(mockIO);

      expect(emitter.isInitialized()).toBe(true);
    });

    it('should log info message on initialization', async () => {
      const { logger } = await import('@/lib/logger');

      emitter.initialize(mockIO);

      expect(logger.info).toHaveBeenCalledWith('TriggerProgressEmitter initialized');
    });
  });

  describe('emitTriggerDetected', () => {
    it('should warn when not initialized', async () => {
      const { logger } = await import('@/lib/logger');

      const event: TriggerDetectedEvent = {
        positionId: 'pos-123',
        triggerType: 'LONG_SL',
        triggeredExchange: 'binance',
        triggeredSide: 'LONG',
        detectedAt: new Date(),
      };

      emitter.emitTriggerDetected(event);

      expect(logger.warn).toHaveBeenCalledWith('TriggerProgressEmitter not initialized');
      expect(mockIO.to).not.toHaveBeenCalled();
    });

    it('should emit to position room', () => {
      emitter.initialize(mockIO);

      const event: TriggerDetectedEvent = {
        positionId: 'pos-123',
        triggerType: 'LONG_SL',
        triggeredExchange: 'binance',
        triggeredSide: 'LONG',
        detectedAt: new Date('2024-01-15T10:00:00Z'),
      };

      emitter.emitTriggerDetected(event);

      expect(mockIO.to).toHaveBeenCalledWith('position:pos-123');
      expect(mockToReturn.emit).toHaveBeenCalledWith(
        TRIGGER_WS_EVENTS.TRIGGER_DETECTED,
        event
      );
    });

    it('should log debug message', async () => {
      const { logger } = await import('@/lib/logger');
      emitter.initialize(mockIO);

      const event: TriggerDetectedEvent = {
        positionId: 'pos-456',
        triggerType: 'SHORT_TP',
        triggeredExchange: 'okx',
        triggeredSide: 'SHORT',
        detectedAt: new Date(),
      };

      emitter.emitTriggerDetected(event);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          positionId: 'pos-456',
          triggerType: 'SHORT_TP',
          triggeredExchange: 'okx',
        }),
        'Trigger detected event emitted'
      );
    });
  });

  describe('emitTriggerCloseProgress', () => {
    it('should warn when not initialized', async () => {
      const { logger } = await import('@/lib/logger');

      emitter.emitTriggerCloseProgress({
        positionId: 'pos-123',
        step: 'detected',
      });

      expect(logger.warn).toHaveBeenCalledWith('TriggerProgressEmitter not initialized');
    });

    it('should emit with default progress and message', () => {
      emitter.initialize(mockIO);

      emitter.emitTriggerCloseProgress({
        positionId: 'pos-123',
        step: 'detected',
      });

      expect(mockToReturn.emit).toHaveBeenCalledWith(
        TRIGGER_WS_EVENTS.TRIGGER_CLOSE_PROGRESS,
        expect.objectContaining({
          positionId: 'pos-123',
          step: 'detected',
          progress: 10,
          message: '偵測到條件單觸發',
        })
      );
    });

    it('should use custom progress and message', () => {
      emitter.initialize(mockIO);

      emitter.emitTriggerCloseProgress({
        positionId: 'pos-123',
        step: 'closing_opposite',
        progress: 45,
        message: 'Custom message',
        exchange: 'binance',
      });

      expect(mockToReturn.emit).toHaveBeenCalledWith(
        TRIGGER_WS_EVENTS.TRIGGER_CLOSE_PROGRESS,
        expect.objectContaining({
          positionId: 'pos-123',
          step: 'closing_opposite',
          progress: 45,
          message: 'Custom message',
          exchange: 'binance',
        })
      );
    });

    it('should emit correct progress for each step', () => {
      emitter.initialize(mockIO);

      const steps = ['detected', 'closing_opposite', 'canceling_orders', 'completing', 'completed'] as const;
      const expectedProgress = [10, 40, 70, 90, 100];

      steps.forEach((step, index) => {
        vi.clearAllMocks();
        mockIO.to.mockReturnValue(mockToReturn);

        emitter.emitTriggerCloseProgress({
          positionId: 'pos-123',
          step,
        });

        expect(mockToReturn.emit).toHaveBeenCalledWith(
          TRIGGER_WS_EVENTS.TRIGGER_CLOSE_PROGRESS,
          expect.objectContaining({
            progress: expectedProgress[index],
          })
        );
      });
    });
  });

  describe('emitTriggerCloseSuccess', () => {
    it('should warn when not initialized', async () => {
      const { logger } = await import('@/lib/logger');

      const event: TriggerCloseSuccessEvent = {
        positionId: 'pos-123',
        triggerType: 'LONG_SL',
        closedSide: {
          exchange: 'okx',
          side: 'SHORT',
          orderId: 'order-789',
          price: 95000,
          quantity: 0.1,
          fee: 2.5,
        },
        pnl: {
          priceDiffPnL: 50,
          fundingRatePnL: 10,
          totalFees: 5,
          totalPnL: 55,
          roi: 2.5,
        },
      };

      emitter.emitTriggerCloseSuccess(event);

      expect(logger.warn).toHaveBeenCalledWith('TriggerProgressEmitter not initialized');
    });

    it('should emit success event to position room', () => {
      emitter.initialize(mockIO);

      const event: TriggerCloseSuccessEvent = {
        positionId: 'pos-123',
        triggerType: 'LONG_TP',
        closedSide: {
          exchange: 'okx',
          side: 'SHORT',
          orderId: 'order-789',
          price: 105000,
          quantity: 0.1,
          fee: 2.5,
        },
        pnl: {
          priceDiffPnL: 150,
          fundingRatePnL: 20,
          totalFees: 6,
          totalPnL: 164,
          roi: 5.5,
        },
      };

      emitter.emitTriggerCloseSuccess(event);

      expect(mockIO.to).toHaveBeenCalledWith('position:pos-123');
      expect(mockToReturn.emit).toHaveBeenCalledWith(
        TRIGGER_WS_EVENTS.TRIGGER_CLOSE_SUCCESS,
        event
      );
    });

    it('should log info message with pnl details', async () => {
      const { logger } = await import('@/lib/logger');
      emitter.initialize(mockIO);

      const event: TriggerCloseSuccessEvent = {
        positionId: 'pos-456',
        triggerType: 'BOTH',
        closedSide: {
          exchange: 'binance',
          side: 'LONG',
          orderId: 'order-111',
          price: 95000,
          quantity: 0.2,
          fee: 5,
        },
        pnl: {
          priceDiffPnL: 100,
          fundingRatePnL: 15,
          totalFees: 10,
          totalPnL: 105,
          roi: 3.5,
        },
      };

      emitter.emitTriggerCloseSuccess(event);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          positionId: 'pos-456',
          triggerType: 'BOTH',
          closedExchange: 'binance',
          totalPnL: 105,
        }),
        'Trigger close success event emitted'
      );
    });
  });

  describe('emitTriggerCloseFailed', () => {
    it('should warn when not initialized', async () => {
      const { logger } = await import('@/lib/logger');

      const event: TriggerCloseFailedEvent = {
        positionId: 'pos-123',
        triggerType: 'SHORT_SL',
        error: 'Insufficient balance',
        errorCode: 'INSUFFICIENT_BALANCE',
        requiresManualIntervention: true,
      };

      emitter.emitTriggerCloseFailed(event);

      expect(logger.warn).toHaveBeenCalledWith('TriggerProgressEmitter not initialized');
    });

    it('should emit failed event to position room', () => {
      emitter.initialize(mockIO);

      const event: TriggerCloseFailedEvent = {
        positionId: 'pos-123',
        triggerType: 'SHORT_SL',
        error: 'Order rejected',
        errorCode: 'ORDER_REJECTED',
        requiresManualIntervention: false,
      };

      emitter.emitTriggerCloseFailed(event);

      expect(mockIO.to).toHaveBeenCalledWith('position:pos-123');
      expect(mockToReturn.emit).toHaveBeenCalledWith(
        TRIGGER_WS_EVENTS.TRIGGER_CLOSE_FAILED,
        event
      );
    });

    it('should log warning message', async () => {
      const { logger } = await import('@/lib/logger');
      emitter.initialize(mockIO);

      const event: TriggerCloseFailedEvent = {
        positionId: 'pos-789',
        triggerType: 'LONG_SL',
        error: 'Network error',
        errorCode: 'NETWORK_ERROR',
        requiresManualIntervention: true,
      };

      emitter.emitTriggerCloseFailed(event);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          positionId: 'pos-789',
          triggerType: 'LONG_SL',
          error: 'Network error',
          requiresManualIntervention: true,
        }),
        'Trigger close failed event emitted'
      );
    });
  });

  describe('emitToUser', () => {
    it('should warn when not initialized', async () => {
      const { logger } = await import('@/lib/logger');

      emitter.emitToUser('user-123', 'custom:event', { data: 'test' });

      expect(logger.warn).toHaveBeenCalledWith('TriggerProgressEmitter not initialized');
    });

    it('should emit to user room', () => {
      emitter.initialize(mockIO);

      const data = { message: 'Hello user' };
      emitter.emitToUser('user-456', 'notification', data);

      expect(mockIO.to).toHaveBeenCalledWith('user:user-456');
      expect(mockToReturn.emit).toHaveBeenCalledWith('notification', data);
    });
  });

  describe('TRIGGER_WS_EVENTS constants', () => {
    it('should have correct event names', () => {
      expect(TRIGGER_WS_EVENTS.TRIGGER_DETECTED).toBe('position:trigger:detected');
      expect(TRIGGER_WS_EVENTS.TRIGGER_CLOSE_PROGRESS).toBe('position:trigger:close:progress');
      expect(TRIGGER_WS_EVENTS.TRIGGER_CLOSE_SUCCESS).toBe('position:trigger:close:success');
      expect(TRIGGER_WS_EVENTS.TRIGGER_CLOSE_FAILED).toBe('position:trigger:close:failed');
    });
  });
});
