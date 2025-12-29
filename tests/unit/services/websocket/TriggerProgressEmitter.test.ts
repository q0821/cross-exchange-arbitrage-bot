/**
 * Test: TriggerProgressEmitter
 * Feature: 050-sl-tp-trigger-monitor (Phase 6: US4)
 *
 * TDD: 測試觸發事件 WebSocket 推送服務
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock Socket.IO
const mockSocketTo = vi.fn().mockReturnThis();
const mockSocketEmit = vi.fn();
const mockSocketOn = vi.fn();

const mockIO = {
  to: mockSocketTo,
  emit: mockSocketEmit,
  on: mockSocketOn,
};

mockSocketTo.mockReturnValue({ emit: mockSocketEmit });

// ==================== T032: WebSocket 事件類型定義 ====================
describe('T032: WebSocket trigger event types', () => {
  it('should have TriggerDetectedEvent type', async () => {
    const types = await import('@/services/websocket/TriggerProgressEmitter');
    // 類型在編譯時檢查，這裡確認模組可以正常導入
    expect(types).toBeDefined();
  });

  it('should define trigger event names', async () => {
    const { TRIGGER_WS_EVENTS } = await import('@/services/websocket/TriggerProgressEmitter');

    expect(TRIGGER_WS_EVENTS).toBeDefined();
    expect(TRIGGER_WS_EVENTS.TRIGGER_DETECTED).toBeDefined();
    expect(TRIGGER_WS_EVENTS.TRIGGER_CLOSE_PROGRESS).toBeDefined();
    expect(TRIGGER_WS_EVENTS.TRIGGER_CLOSE_SUCCESS).toBeDefined();
    expect(TRIGGER_WS_EVENTS.TRIGGER_CLOSE_FAILED).toBeDefined();
  });
});

// ==================== T033: TriggerProgressEmitter 類別 ====================
describe('T033: TriggerProgressEmitter class', () => {
  let TriggerProgressEmitter: any;
  let emitter: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import('@/services/websocket/TriggerProgressEmitter');
    TriggerProgressEmitter = module.TriggerProgressEmitter;
    emitter = new TriggerProgressEmitter();
  });

  it('should be instantiable', () => {
    expect(emitter).toBeDefined();
  });

  it('should have initialize method', () => {
    expect(typeof emitter.initialize).toBe('function');
  });

  it('should have isInitialized method', () => {
    expect(typeof emitter.isInitialized).toBe('function');
  });

  it('should return false when not initialized', () => {
    expect(emitter.isInitialized()).toBe(false);
  });

  it('should return true after initialization', () => {
    emitter.initialize(mockIO as any);
    expect(emitter.isInitialized()).toBe(true);
  });
});

// ==================== T034: emitTriggerDetected ====================
describe('T034: emitTriggerDetected', () => {
  let emitter: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import('@/services/websocket/TriggerProgressEmitter');
    emitter = new module.TriggerProgressEmitter();
    emitter.initialize(mockIO as any);
  });

  it('should have emitTriggerDetected method', () => {
    expect(typeof emitter.emitTriggerDetected).toBe('function');
  });

  it('should emit trigger detected event to position room', () => {
    emitter.emitTriggerDetected({
      positionId: 'pos-123',
      triggerType: 'LONG_SL',
      triggeredExchange: 'binance',
      triggeredSide: 'LONG',
      detectedAt: new Date(),
    });

    expect(mockSocketTo).toHaveBeenCalledWith('position:pos-123');
    expect(mockSocketEmit).toHaveBeenCalledWith(
      'position:trigger:detected',
      expect.objectContaining({
        positionId: 'pos-123',
        triggerType: 'LONG_SL',
      }),
    );
  });
});

// ==================== T035: emitTriggerCloseProgress ====================
describe('T035: emitTriggerCloseProgress', () => {
  let emitter: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import('@/services/websocket/TriggerProgressEmitter');
    emitter = new module.TriggerProgressEmitter();
    emitter.initialize(mockIO as any);
  });

  it('should have emitTriggerCloseProgress method', () => {
    expect(typeof emitter.emitTriggerCloseProgress).toBe('function');
  });

  it('should emit close progress event', () => {
    emitter.emitTriggerCloseProgress({
      positionId: 'pos-123',
      step: 'closing_opposite',
      progress: 50,
      message: '正在平倉對沖方...',
    });

    expect(mockSocketTo).toHaveBeenCalledWith('position:pos-123');
    expect(mockSocketEmit).toHaveBeenCalledWith(
      'position:trigger:close:progress',
      expect.objectContaining({
        positionId: 'pos-123',
        step: 'closing_opposite',
        progress: 50,
      }),
    );
  });
});

// ==================== T036: emitTriggerCloseSuccess ====================
describe('T036: emitTriggerCloseSuccess', () => {
  let emitter: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import('@/services/websocket/TriggerProgressEmitter');
    emitter = new module.TriggerProgressEmitter();
    emitter.initialize(mockIO as any);
  });

  it('should have emitTriggerCloseSuccess method', () => {
    expect(typeof emitter.emitTriggerCloseSuccess).toBe('function');
  });

  it('should emit close success event with trade details', () => {
    emitter.emitTriggerCloseSuccess({
      positionId: 'pos-123',
      triggerType: 'LONG_SL',
      closedSide: {
        exchange: 'okx',
        side: 'SHORT',
        orderId: 'order-456',
        price: 94000,
        quantity: 0.001,
        fee: 0.1,
      },
      pnl: {
        priceDiffPnL: -10,
        fundingRatePnL: 5,
        totalFees: 2,
        totalPnL: -7,
        roi: -0.5,
      },
    });

    expect(mockSocketTo).toHaveBeenCalledWith('position:pos-123');
    expect(mockSocketEmit).toHaveBeenCalledWith(
      'position:trigger:close:success',
      expect.objectContaining({
        positionId: 'pos-123',
        triggerType: 'LONG_SL',
      }),
    );
  });
});

// ==================== T037: emitTriggerCloseFailed ====================
describe('T037: emitTriggerCloseFailed', () => {
  let emitter: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import('@/services/websocket/TriggerProgressEmitter');
    emitter = new module.TriggerProgressEmitter();
    emitter.initialize(mockIO as any);
  });

  it('should have emitTriggerCloseFailed method', () => {
    expect(typeof emitter.emitTriggerCloseFailed).toBe('function');
  });

  it('should emit close failed event with error details', () => {
    emitter.emitTriggerCloseFailed({
      positionId: 'pos-123',
      triggerType: 'LONG_SL',
      error: 'Insufficient balance',
      errorCode: 'INSUFFICIENT_BALANCE',
      requiresManualIntervention: true,
    });

    expect(mockSocketTo).toHaveBeenCalledWith('position:pos-123');
    expect(mockSocketEmit).toHaveBeenCalledWith(
      'position:trigger:close:failed',
      expect.objectContaining({
        positionId: 'pos-123',
        error: 'Insufficient balance',
        requiresManualIntervention: true,
      }),
    );
  });
});
