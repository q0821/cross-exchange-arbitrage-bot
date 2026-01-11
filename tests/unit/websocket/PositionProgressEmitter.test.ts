/**
 * Test: PositionProgressEmitter
 *
 * 持倉進度 WebSocket 推送服務單元測試
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PositionProgressEmitter } from '@/services/websocket/PositionProgressEmitter';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('PositionProgressEmitter', () => {
  let emitter: PositionProgressEmitter;
  let mockIO: any;
  let mockToReturn: any;
  let mockSocket: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton for testing
    (PositionProgressEmitter as any).instance = null;

    mockToReturn = {
      emit: vi.fn(),
    };

    mockSocket = {
      id: 'socket-123',
      join: vi.fn(),
      leave: vi.fn(),
      on: vi.fn(),
    };

    mockIO = {
      emit: vi.fn(),
      to: vi.fn().mockReturnValue(mockToReturn),
      on: vi.fn(),
    };

    emitter = PositionProgressEmitter.getInstance();
  });

  afterEach(() => {
    // Reset singleton after each test
    (PositionProgressEmitter as any).instance = null;
  });

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const instance1 = PositionProgressEmitter.getInstance();
      const instance2 = PositionProgressEmitter.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('should store Socket.IO server reference', () => {
      expect(emitter.isInitialized()).toBe(false);

      emitter.initialize(mockIO);

      expect(emitter.isInitialized()).toBe(true);
    });

    it('should setup connection event handler', () => {
      emitter.initialize(mockIO);

      expect(mockIO.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('should log info message on initialization', async () => {
      const { logger } = await import('@/lib/logger');

      emitter.initialize(mockIO);

      expect(logger.info).toHaveBeenCalledWith('PositionProgressEmitter initialized');
    });
  });

  describe('emitProgress', () => {
    it('should warn when not initialized', async () => {
      const { logger } = await import('@/lib/logger');

      emitter.emitProgress('pos-123', 'validating');

      expect(logger.warn).toHaveBeenCalledWith('PositionProgressEmitter not initialized');
      expect(mockIO.to).not.toHaveBeenCalled();
    });

    it('should emit progress to position room', () => {
      emitter.initialize(mockIO);

      emitter.emitProgress('pos-123', 'validating');

      expect(mockIO.to).toHaveBeenCalledWith('position:pos-123');
      expect(mockToReturn.emit).toHaveBeenCalledWith(
        'position:progress',
        expect.objectContaining({
          positionId: 'pos-123',
          step: 'validating',
          progress: 10,
          message: '驗證餘額中...',
        })
      );
    });

    it('should include exchange when provided', () => {
      emitter.initialize(mockIO);

      emitter.emitProgress('pos-123', 'executing_long', 'binance');

      expect(mockToReturn.emit).toHaveBeenCalledWith(
        'position:progress',
        expect.objectContaining({
          step: 'executing_long',
          progress: 30,
          message: '執行做多開倉...',
          exchange: 'binance',
        })
      );
    });

    it('should use custom message when provided', () => {
      emitter.initialize(mockIO);

      emitter.emitProgress('pos-123', 'executing_short', 'okx', 'Custom executing message');

      expect(mockToReturn.emit).toHaveBeenCalledWith(
        'position:progress',
        expect.objectContaining({
          step: 'executing_short',
          progress: 60,
          message: 'Custom executing message',
        })
      );
    });

    it('should emit correct progress for each step', () => {
      emitter.initialize(mockIO);

      const steps = ['validating', 'executing_long', 'executing_short', 'completing', 'rolling_back'] as const;
      const expectedProgress = [10, 30, 60, 90, 50];

      steps.forEach((step, index) => {
        vi.clearAllMocks();
        mockIO.to.mockReturnValue(mockToReturn);

        emitter.emitProgress('pos-123', step);

        expect(mockToReturn.emit).toHaveBeenCalledWith(
          'position:progress',
          expect.objectContaining({
            progress: expectedProgress[index],
          })
        );
      });
    });
  });

  describe('emitSuccess', () => {
    it('should warn when not initialized', async () => {
      const { logger } = await import('@/lib/logger');

      emitter.emitSuccess(
        'pos-123',
        { exchange: 'binance', orderId: 'order-1', price: '95000', quantity: '0.1', fee: '2' },
        { exchange: 'okx', orderId: 'order-2', price: '95050', quantity: '0.1', fee: '2' }
      );

      expect(logger.warn).toHaveBeenCalledWith('PositionProgressEmitter not initialized');
    });

    it('should emit success event to position room', () => {
      emitter.initialize(mockIO);

      const longTrade = { exchange: 'binance' as const, orderId: 'order-1', price: '95000', quantity: '0.1', fee: '2' };
      const shortTrade = { exchange: 'okx' as const, orderId: 'order-2', price: '95050', quantity: '0.1', fee: '2' };

      emitter.emitSuccess('pos-123', longTrade, shortTrade);

      expect(mockIO.to).toHaveBeenCalledWith('position:pos-123');
      expect(mockToReturn.emit).toHaveBeenCalledWith('position:success', {
        positionId: 'pos-123',
        longTrade,
        shortTrade,
      });
    });

    it('should log info message', async () => {
      const { logger } = await import('@/lib/logger');
      emitter.initialize(mockIO);

      emitter.emitSuccess(
        'pos-456',
        { exchange: 'binance', orderId: 'order-1', price: '95000', quantity: '0.1', fee: '2' },
        { exchange: 'okx', orderId: 'order-2', price: '95050', quantity: '0.1', fee: '2' }
      );

      expect(logger.info).toHaveBeenCalledWith(
        { positionId: 'pos-456' },
        'Position success event emitted'
      );
    });
  });

  describe('emitFailed', () => {
    it('should warn when not initialized', async () => {
      const { logger } = await import('@/lib/logger');

      emitter.emitFailed('pos-123', 'Test error', 'TEST_ERROR');

      expect(logger.warn).toHaveBeenCalledWith('PositionProgressEmitter not initialized');
    });

    it('should emit failed event to position room', () => {
      emitter.initialize(mockIO);

      emitter.emitFailed('pos-123', 'Insufficient balance', 'INSUFFICIENT_BALANCE', {
        exchange: 'binance',
        rolledBack: true,
      });

      expect(mockIO.to).toHaveBeenCalledWith('position:pos-123');
      expect(mockToReturn.emit).toHaveBeenCalledWith('position:failed', {
        positionId: 'pos-123',
        error: 'Insufficient balance',
        errorCode: 'INSUFFICIENT_BALANCE',
        details: {
          exchange: 'binance',
          rolledBack: true,
        },
      });
    });

    it('should emit without details when not provided', () => {
      emitter.initialize(mockIO);

      emitter.emitFailed('pos-123', 'Generic error', 'GENERIC_ERROR');

      expect(mockToReturn.emit).toHaveBeenCalledWith('position:failed', {
        positionId: 'pos-123',
        error: 'Generic error',
        errorCode: 'GENERIC_ERROR',
        details: undefined,
      });
    });

    it('should log warning message', async () => {
      const { logger } = await import('@/lib/logger');
      emitter.initialize(mockIO);

      emitter.emitFailed('pos-789', 'Order rejected', 'ORDER_REJECTED');

      expect(logger.warn).toHaveBeenCalledWith(
        { positionId: 'pos-789', error: 'Order rejected', errorCode: 'ORDER_REJECTED' },
        'Position failed event emitted'
      );
    });
  });

  describe('emitRollbackFailed', () => {
    it('should warn when not initialized', async () => {
      const { logger } = await import('@/lib/logger');

      emitter.emitRollbackFailed('pos-123', 'binance', 'order-123', 'LONG', '0.1');

      expect(logger.warn).toHaveBeenCalledWith('PositionProgressEmitter not initialized');
    });

    it('should emit rollback failed event with message', () => {
      emitter.initialize(mockIO);

      emitter.emitRollbackFailed('pos-123', 'okx', 'order-456', 'SHORT', '0.5');

      expect(mockIO.to).toHaveBeenCalledWith('position:pos-123');
      expect(mockToReturn.emit).toHaveBeenCalledWith('position:rollback_failed', {
        positionId: 'pos-123',
        exchange: 'okx',
        orderId: 'order-456',
        side: 'SHORT',
        quantity: '0.5',
        message: '無法自動回滾 okx SHORT 倉位（訂單 order-456），請手動處理',
      });
    });

    it('should log error message', async () => {
      const { logger } = await import('@/lib/logger');
      emitter.initialize(mockIO);

      emitter.emitRollbackFailed('pos-789', 'binance', 'order-111', 'LONG', '1.0');

      expect(logger.error).toHaveBeenCalledWith(
        {
          positionId: 'pos-789',
          exchange: 'binance',
          orderId: 'order-111',
          side: 'LONG',
          quantity: '1.0',
        },
        'Rollback failed event emitted'
      );
    });
  });

  describe('emitToUser', () => {
    it('should warn when not initialized', async () => {
      const { logger } = await import('@/lib/logger');

      emitter.emitToUser('user-123', 'custom:event', { data: 'test' });

      expect(logger.warn).toHaveBeenCalledWith('PositionProgressEmitter not initialized');
    });

    it('should emit to user room', () => {
      emitter.initialize(mockIO);

      const data = { notification: 'Position opened' };
      emitter.emitToUser('user-456', 'position:notification', data);

      expect(mockIO.to).toHaveBeenCalledWith('user:user-456');
      expect(mockToReturn.emit).toHaveBeenCalledWith('position:notification', data);
    });
  });

  describe('joinUserRoom', () => {
    it('should join socket to user room', () => {
      emitter.initialize(mockIO);

      emitter.joinUserRoom(mockSocket, 'user-789');

      expect(mockSocket.join).toHaveBeenCalledWith('user:user-789');
    });

    it('should log debug message', async () => {
      const { logger } = await import('@/lib/logger');
      emitter.initialize(mockIO);

      emitter.joinUserRoom(mockSocket, 'user-abc');

      expect(logger.debug).toHaveBeenCalledWith(
        { socketId: 'socket-123', userId: 'user-abc', userRoom: 'user:user-abc' },
        'Client joined user room'
      );
    });
  });

  // ============================================================================
  // Close Position Events Tests
  // ============================================================================

  describe('emitCloseProgress', () => {
    it('should warn when not initialized', async () => {
      const { logger } = await import('@/lib/logger');

      emitter.emitCloseProgress('pos-123', 'validating');

      expect(logger.warn).toHaveBeenCalledWith('PositionProgressEmitter not initialized');
    });

    it('should emit close progress to position room', () => {
      emitter.initialize(mockIO);

      emitter.emitCloseProgress('pos-123', 'validating');

      expect(mockIO.to).toHaveBeenCalledWith('position:pos-123');
      expect(mockToReturn.emit).toHaveBeenCalledWith(
        'position:close:progress',
        expect.objectContaining({
          positionId: 'pos-123',
          step: 'validating',
          progress: 10,
          message: '驗證持倉狀態...',
        })
      );
    });

    it('should emit correct progress for each close step', () => {
      emitter.initialize(mockIO);

      const steps = ['validating', 'closing_long', 'closing_short', 'calculating_pnl', 'completing'] as const;
      const expectedProgress = [10, 30, 60, 80, 100];

      steps.forEach((step, index) => {
        vi.clearAllMocks();
        mockIO.to.mockReturnValue(mockToReturn);

        emitter.emitCloseProgress('pos-123', step);

        expect(mockToReturn.emit).toHaveBeenCalledWith(
          'position:close:progress',
          expect.objectContaining({
            progress: expectedProgress[index],
          })
        );
      });
    });
  });

  describe('emitCloseSuccess', () => {
    it('should emit close success event', () => {
      emitter.initialize(mockIO);

      const trade = {
        id: 'trade-123',
        priceDiffPnL: '50.00',
        fundingRatePnL: '10.00',
        totalPnL: '55.00',
        roi: '2.5',
        holdingDuration: 3600,
      };

      const longClose = { exchange: 'binance' as const, orderId: 'order-1', price: '95000', quantity: '0.1', fee: '2.5' };
      const shortClose = { exchange: 'okx' as const, orderId: 'order-2', price: '95050', quantity: '0.1', fee: '2.5' };

      emitter.emitCloseSuccess('pos-123', trade, longClose, shortClose);

      expect(mockToReturn.emit).toHaveBeenCalledWith('position:close:success', {
        positionId: 'pos-123',
        trade,
        longClose,
        shortClose,
      });
    });

    it('should log info message with pnl', async () => {
      const { logger } = await import('@/lib/logger');
      emitter.initialize(mockIO);

      const trade = {
        id: 'trade-456',
        priceDiffPnL: '100.00',
        fundingRatePnL: '20.00',
        totalPnL: '110.00',
        roi: '5.0',
        holdingDuration: 7200,
      };

      emitter.emitCloseSuccess(
        'pos-456',
        trade,
        { exchange: 'binance', orderId: 'order-1', price: '95000', quantity: '0.1', fee: '2' },
        { exchange: 'okx', orderId: 'order-2', price: '95050', quantity: '0.1', fee: '2' }
      );

      expect(logger.info).toHaveBeenCalledWith(
        { positionId: 'pos-456', tradeId: 'trade-456', totalPnL: '110.00' },
        'Close success event emitted'
      );
    });
  });

  describe('emitCloseFailed', () => {
    it('should emit close failed event', () => {
      emitter.initialize(mockIO);

      emitter.emitCloseFailed('pos-123', 'Failed to close position', 'CLOSE_ERROR', {
        exchange: 'binance',
      });

      expect(mockToReturn.emit).toHaveBeenCalledWith('position:close:failed', {
        positionId: 'pos-123',
        error: 'Failed to close position',
        errorCode: 'CLOSE_ERROR',
        details: { exchange: 'binance' },
      });
    });
  });

  describe('emitClosePartial', () => {
    it('should emit partial close event', () => {
      emitter.initialize(mockIO);

      const closedSide = {
        exchange: 'binance' as const,
        side: 'LONG' as const,
        orderId: 'order-1',
        price: '95000',
        quantity: '0.1',
        fee: '2.5',
      };

      const failedSide = {
        exchange: 'okx' as const,
        side: 'SHORT' as const,
        error: 'Insufficient liquidity',
        errorCode: 'INSUFFICIENT_LIQUIDITY',
      };

      emitter.emitClosePartial('pos-123', 'Partial close completed', closedSide, failedSide);

      expect(mockToReturn.emit).toHaveBeenCalledWith('position:close:partial', {
        positionId: 'pos-123',
        message: 'Partial close completed',
        closedSide,
        failedSide,
      });
    });

    it('should log warning with exchange info', async () => {
      const { logger } = await import('@/lib/logger');
      emitter.initialize(mockIO);

      emitter.emitClosePartial(
        'pos-789',
        'Partial close',
        { exchange: 'gateio', side: 'SHORT', orderId: 'order-1', price: '95000', quantity: '0.1', fee: '2' },
        { exchange: 'binance', side: 'LONG', error: 'Error', errorCode: 'ERR' }
      );

      expect(logger.warn).toHaveBeenCalledWith(
        { positionId: 'pos-789', closedExchange: 'gateio', failedExchange: 'binance' },
        'Close partial event emitted'
      );
    });
  });

  // ============================================================================
  // Conditional Order Events Tests
  // ============================================================================

  describe('emitConditionalOrderProgress', () => {
    it('should emit conditional order progress', () => {
      emitter.initialize(mockIO);

      emitter.emitConditionalOrderProgress('pos-123', 'SETTING', 'Setting stop loss...', 'binance');

      expect(mockToReturn.emit).toHaveBeenCalledWith(
        'position:conditional:progress',
        expect.objectContaining({
          positionId: 'pos-123',
          status: 'SETTING',
          message: 'Setting stop loss...',
          exchange: 'binance',
        })
      );
    });
  });

  describe('emitConditionalOrderSuccess', () => {
    it('should emit conditional order success', () => {
      emitter.initialize(mockIO);

      const details = {
        stopLossEnabled: true,
        stopLossPercent: 2,
        takeProfitEnabled: true,
        takeProfitPercent: 3,
        longStopLossPrice: 93000,
        shortStopLossPrice: 97000,
        longTakeProfitPrice: 103000,
        shortTakeProfitPrice: 88000,
      };

      emitter.emitConditionalOrderSuccess('pos-123', details);

      expect(mockToReturn.emit).toHaveBeenCalledWith(
        'position:conditional:success',
        expect.objectContaining({
          positionId: 'pos-123',
          status: 'SET',
          message: '條件單設定成功',
          ...details,
        })
      );
    });
  });

  describe('emitConditionalOrderFailed', () => {
    it('should emit conditional order failed', () => {
      emitter.initialize(mockIO);

      emitter.emitConditionalOrderFailed('pos-123', 'Invalid price', {
        exchange: 'okx',
        side: 'LONG',
      });

      expect(mockToReturn.emit).toHaveBeenCalledWith(
        'position:conditional:failed',
        expect.objectContaining({
          positionId: 'pos-123',
          status: 'FAILED',
          error: 'Invalid price',
          message: '條件單設定失敗: Invalid price',
          details: { exchange: 'okx', side: 'LONG' },
        })
      );
    });
  });

  describe('emitConditionalOrderPartial', () => {
    it('should emit conditional order partial', () => {
      emitter.initialize(mockIO);

      const successDetails = [
        { exchange: 'binance' as const, type: 'stopLoss' as const, price: 93000, orderId: 'order-1' },
      ];

      const failedDetails = [
        { exchange: 'okx' as const, type: 'takeProfit' as const, error: 'Price out of range' },
      ];

      emitter.emitConditionalOrderPartial('pos-123', 'Partial success', successDetails, failedDetails);

      expect(mockToReturn.emit).toHaveBeenCalledWith(
        'position:conditional:partial',
        expect.objectContaining({
          positionId: 'pos-123',
          status: 'PARTIAL',
          message: 'Partial success',
          successDetails,
          failedDetails,
        })
      );
    });

    it('should log warning with counts', async () => {
      const { logger } = await import('@/lib/logger');
      emitter.initialize(mockIO);

      emitter.emitConditionalOrderPartial(
        'pos-456',
        'Partial',
        [{ exchange: 'binance', type: 'stopLoss', price: 93000 }],
        [
          { exchange: 'okx', type: 'takeProfit', error: 'Error 1' },
          { exchange: 'gateio', type: 'stopLoss', error: 'Error 2' },
        ]
      );

      expect(logger.warn).toHaveBeenCalledWith(
        { positionId: 'pos-456', successCount: 1, failedCount: 2 },
        'Conditional order partial event emitted'
      );
    });
  });
});
