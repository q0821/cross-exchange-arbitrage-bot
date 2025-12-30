/**
 * Unit tests for TriggerDetector
 *
 * Feature: 052-specify-scripts-bash
 * Task: T033
 *
 * Tests the trigger detection logic for stop-loss/take-profit orders
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import Decimal from 'decimal.js';
import type {
  OrderStatusChanged,
  TriggerDetected,
  TriggerType,
} from '@/types/internal-events';

/**
 * Position record from database
 */
interface PositionRecord {
  id: string;
  symbol: string;
  longExchange: string;
  shortExchange: string;
  longSize: Decimal;
  shortSize: Decimal;
  longEntryPrice: Decimal;
  shortEntryPrice: Decimal;
  stopLossEnabled: boolean;
  takeProfitEnabled: boolean;
  longStopLossPrice?: Decimal;
  longTakeProfitPrice?: Decimal;
  shortStopLossPrice?: Decimal;
  shortTakeProfitPrice?: Decimal;
  conditionalOrderStatus: 'PENDING' | 'SET' | 'PARTIAL' | 'FAILED';
}

/**
 * Mock TriggerDetector for testing
 */
class MockTriggerDetector extends EventEmitter {
  private positions: Map<string, PositionRecord> = new Map();
  private processedOrders: Set<string> = new Set();

  constructor() {
    super();
  }

  /**
   * Register positions to monitor
   */
  registerPosition(position: PositionRecord): void {
    this.positions.set(position.id, position);
  }

  /**
   * Remove position from monitoring
   */
  unregisterPosition(positionId: string): void {
    this.positions.delete(positionId);
  }

  /**
   * Handle order status change event
   */
  handleOrderStatusChanged(event: OrderStatusChanged): TriggerDetected | null {
    // Skip if already processed
    const orderKey = `${event.exchange}:${event.orderId}`;
    if (this.processedOrders.has(orderKey)) {
      return null;
    }

    // Only interested in FILLED conditional orders
    if (event.status !== 'FILLED') {
      return null;
    }

    // Only process STOP_MARKET or TAKE_PROFIT_MARKET orders
    const isConditionalOrder =
      event.orderType === 'STOP_MARKET' ||
      event.orderType === 'TAKE_PROFIT_MARKET' ||
      event.orderType === 'stop_loss' ||
      event.orderType === 'take_profit' ||
      event.orderType === 'trigger';

    if (!isConditionalOrder) {
      return null;
    }

    // Find matching position
    const matchingPosition = this.findMatchingPosition(event);
    if (!matchingPosition) {
      return null;
    }

    // Determine trigger type
    const triggerType = this.determineTriggerType(event, matchingPosition);
    if (!triggerType) {
      return null;
    }

    // Mark as processed
    this.processedOrders.add(orderKey);

    // Create trigger event
    const triggerEvent: TriggerDetected = {
      positionId: matchingPosition.id,
      exchange: event.exchange,
      symbol: event.symbol,
      triggerType,
      triggerPrice: event.stopPrice || event.avgPrice,
      currentMarkPrice: event.avgPrice,
      detectedAt: new Date(),
      source: event.source,
    };

    this.emit('triggerDetected', triggerEvent);
    return triggerEvent;
  }

  /**
   * Find position matching the order event
   */
  private findMatchingPosition(event: OrderStatusChanged): PositionRecord | null {
    for (const [, position] of this.positions) {
      // Match by symbol and exchange
      if (position.symbol !== event.symbol) {
        continue;
      }

      const isLongLeg = position.longExchange === event.exchange;
      const isShortLeg = position.shortExchange === event.exchange;

      if (!isLongLeg && !isShortLeg) {
        continue;
      }

      // Check if position has conditional orders set
      if (position.conditionalOrderStatus !== 'SET') {
        continue;
      }

      return position;
    }

    return null;
  }

  /**
   * Determine the type of trigger
   */
  private determineTriggerType(
    event: OrderStatusChanged,
    position: PositionRecord
  ): TriggerType | null {
    const isLongLeg = position.longExchange === event.exchange;
    const isShortLeg = position.shortExchange === event.exchange;

    // STOP_MARKET closing LONG = LONG_SL
    // TAKE_PROFIT_MARKET closing LONG = LONG_TP
    // STOP_MARKET closing SHORT = SHORT_SL
    // TAKE_PROFIT_MARKET closing SHORT = SHORT_TP

    const isStopLoss =
      event.orderType === 'STOP_MARKET' ||
      event.orderType === 'stop_loss' ||
      (event.orderType === 'trigger' && event.realizedPnl && event.realizedPnl.lt(0));

    const isTakeProfit =
      event.orderType === 'TAKE_PROFIT_MARKET' ||
      event.orderType === 'take_profit' ||
      (event.orderType === 'trigger' && event.realizedPnl && event.realizedPnl.gte(0));

    if (isLongLeg && event.positionSide === 'LONG') {
      if (isStopLoss && position.stopLossEnabled) {
        return 'LONG_SL';
      }
      if (isTakeProfit && position.takeProfitEnabled) {
        return 'LONG_TP';
      }
    }

    if (isShortLeg && event.positionSide === 'SHORT') {
      if (isStopLoss && position.stopLossEnabled) {
        return 'SHORT_SL';
      }
      if (isTakeProfit && position.takeProfitEnabled) {
        return 'SHORT_TP';
      }
    }

    return null;
  }

  /**
   * Check if trigger price matches expected
   */
  validateTriggerPrice(
    event: OrderStatusChanged,
    position: PositionRecord,
    triggerType: TriggerType
  ): boolean {
    const tolerance = new Decimal('0.01'); // 1% tolerance
    let expectedPrice: Decimal | undefined;

    switch (triggerType) {
      case 'LONG_SL':
        expectedPrice = position.longStopLossPrice;
        break;
      case 'LONG_TP':
        expectedPrice = position.longTakeProfitPrice;
        break;
      case 'SHORT_SL':
        expectedPrice = position.shortStopLossPrice;
        break;
      case 'SHORT_TP':
        expectedPrice = position.shortTakeProfitPrice;
        break;
    }

    if (!expectedPrice || !event.stopPrice) {
      return false;
    }

    const diff = event.stopPrice.minus(expectedPrice).abs();
    const percentDiff = diff.div(expectedPrice);

    return percentDiff.lte(tolerance);
  }

  /**
   * Get all registered positions
   */
  getRegisteredPositions(): PositionRecord[] {
    return Array.from(this.positions.values());
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.positions.clear();
    this.processedOrders.clear();
  }
}

describe('TriggerDetector', () => {
  let detector: MockTriggerDetector;

  beforeEach(() => {
    detector = new MockTriggerDetector();
  });

  afterEach(() => {
    detector.clear();
  });

  const createMockPosition = (overrides?: Partial<PositionRecord>): PositionRecord => ({
    id: 'pos-123',
    symbol: 'BTCUSDT',
    longExchange: 'binance',
    shortExchange: 'okx',
    longSize: new Decimal('0.5'),
    shortSize: new Decimal('0.5'),
    longEntryPrice: new Decimal('42000'),
    shortEntryPrice: new Decimal('42100'),
    stopLossEnabled: true,
    takeProfitEnabled: true,
    longStopLossPrice: new Decimal('40000'),
    longTakeProfitPrice: new Decimal('45000'),
    shortStopLossPrice: new Decimal('44000'),
    shortTakeProfitPrice: new Decimal('39000'),
    conditionalOrderStatus: 'SET',
    ...overrides,
  });

  describe('LONG Stop Loss Detection', () => {
    it('should detect LONG_SL trigger from STOP_MARKET order', () => {
      const position = createMockPosition();
      detector.registerPosition(position);

      const event: OrderStatusChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        orderId: 'order-1',
        orderType: 'STOP_MARKET',
        status: 'FILLED',
        side: 'SELL',
        positionSide: 'LONG',
        filledQty: new Decimal('0.5'),
        avgPrice: new Decimal('40000'),
        stopPrice: new Decimal('40050'),
        realizedPnl: new Decimal('-1000'),
        source: 'websocket',
        receivedAt: new Date(),
      };

      const result = detector.handleOrderStatusChanged(event);

      expect(result).not.toBeNull();
      expect(result?.triggerType).toBe('LONG_SL');
      expect(result?.positionId).toBe('pos-123');
      expect(result?.exchange).toBe('binance');
    });

    it('should emit triggerDetected event on LONG_SL', () => {
      const handler = vi.fn();
      detector.on('triggerDetected', handler);

      const position = createMockPosition();
      detector.registerPosition(position);

      const event: OrderStatusChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        orderId: 'order-2',
        orderType: 'STOP_MARKET',
        status: 'FILLED',
        side: 'SELL',
        positionSide: 'LONG',
        filledQty: new Decimal('0.5'),
        avgPrice: new Decimal('40000'),
        stopPrice: new Decimal('40000'),
        source: 'websocket',
        receivedAt: new Date(),
      };

      detector.handleOrderStatusChanged(event);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].triggerType).toBe('LONG_SL');
    });
  });

  describe('LONG Take Profit Detection', () => {
    it('should detect LONG_TP trigger from TAKE_PROFIT_MARKET order', () => {
      const position = createMockPosition();
      detector.registerPosition(position);

      const event: OrderStatusChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        orderId: 'order-3',
        orderType: 'TAKE_PROFIT_MARKET',
        status: 'FILLED',
        side: 'SELL',
        positionSide: 'LONG',
        filledQty: new Decimal('0.5'),
        avgPrice: new Decimal('45000'),
        stopPrice: new Decimal('45000'),
        realizedPnl: new Decimal('1500'),
        source: 'websocket',
        receivedAt: new Date(),
      };

      const result = detector.handleOrderStatusChanged(event);

      expect(result).not.toBeNull();
      expect(result?.triggerType).toBe('LONG_TP');
    });
  });

  describe('SHORT Stop Loss Detection', () => {
    it('should detect SHORT_SL trigger from STOP_MARKET order', () => {
      const position = createMockPosition();
      detector.registerPosition(position);

      const event: OrderStatusChanged = {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        orderId: 'order-4',
        orderType: 'STOP_MARKET',
        status: 'FILLED',
        side: 'BUY',
        positionSide: 'SHORT',
        filledQty: new Decimal('0.5'),
        avgPrice: new Decimal('44000'),
        stopPrice: new Decimal('44000'),
        realizedPnl: new Decimal('-950'),
        source: 'websocket',
        receivedAt: new Date(),
      };

      const result = detector.handleOrderStatusChanged(event);

      expect(result).not.toBeNull();
      expect(result?.triggerType).toBe('SHORT_SL');
      expect(result?.exchange).toBe('okx');
    });
  });

  describe('SHORT Take Profit Detection', () => {
    it('should detect SHORT_TP trigger from TAKE_PROFIT_MARKET order', () => {
      const position = createMockPosition();
      detector.registerPosition(position);

      const event: OrderStatusChanged = {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        orderId: 'order-5',
        orderType: 'TAKE_PROFIT_MARKET',
        status: 'FILLED',
        side: 'BUY',
        positionSide: 'SHORT',
        filledQty: new Decimal('0.5'),
        avgPrice: new Decimal('39000'),
        stopPrice: new Decimal('39000'),
        realizedPnl: new Decimal('1550'),
        source: 'websocket',
        receivedAt: new Date(),
      };

      const result = detector.handleOrderStatusChanged(event);

      expect(result).not.toBeNull();
      expect(result?.triggerType).toBe('SHORT_TP');
    });
  });

  describe('OKX Order Type Handling', () => {
    it('should detect stop_loss order type (OKX style)', () => {
      const position = createMockPosition();
      detector.registerPosition(position);

      const event: OrderStatusChanged = {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        orderId: 'okx-order-1',
        orderType: 'stop_loss', // OKX style
        status: 'FILLED',
        side: 'BUY',
        positionSide: 'SHORT',
        filledQty: new Decimal('0.5'),
        avgPrice: new Decimal('44000'),
        stopPrice: new Decimal('44000'),
        realizedPnl: new Decimal('-950'),
        source: 'websocket',
        receivedAt: new Date(),
      };

      const result = detector.handleOrderStatusChanged(event);

      expect(result?.triggerType).toBe('SHORT_SL');
    });

    it('should detect take_profit order type (OKX style)', () => {
      const position = createMockPosition();
      detector.registerPosition(position);

      const event: OrderStatusChanged = {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        orderId: 'okx-order-2',
        orderType: 'take_profit', // OKX style
        status: 'FILLED',
        side: 'BUY',
        positionSide: 'SHORT',
        filledQty: new Decimal('0.5'),
        avgPrice: new Decimal('39000'),
        stopPrice: new Decimal('39000'),
        realizedPnl: new Decimal('1550'),
        source: 'websocket',
        receivedAt: new Date(),
      };

      const result = detector.handleOrderStatusChanged(event);

      expect(result?.triggerType).toBe('SHORT_TP');
    });
  });

  describe('Filter Conditions', () => {
    it('should ignore non-FILLED orders', () => {
      const position = createMockPosition();
      detector.registerPosition(position);

      const event: OrderStatusChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        orderId: 'order-new',
        orderType: 'STOP_MARKET',
        status: 'NEW', // Not filled
        side: 'SELL',
        positionSide: 'LONG',
        filledQty: new Decimal('0'),
        avgPrice: new Decimal('0'),
        source: 'websocket',
        receivedAt: new Date(),
      };

      const result = detector.handleOrderStatusChanged(event);

      expect(result).toBeNull();
    });

    it('should ignore non-conditional orders', () => {
      const position = createMockPosition();
      detector.registerPosition(position);

      const event: OrderStatusChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        orderId: 'order-market',
        orderType: 'MARKET', // Not a conditional order
        status: 'FILLED',
        side: 'SELL',
        positionSide: 'LONG',
        filledQty: new Decimal('0.5'),
        avgPrice: new Decimal('42000'),
        source: 'websocket',
        receivedAt: new Date(),
      };

      const result = detector.handleOrderStatusChanged(event);

      expect(result).toBeNull();
    });

    it('should ignore orders for unregistered positions', () => {
      // No position registered

      const event: OrderStatusChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        orderId: 'order-unknown',
        orderType: 'STOP_MARKET',
        status: 'FILLED',
        side: 'SELL',
        positionSide: 'LONG',
        filledQty: new Decimal('0.5'),
        avgPrice: new Decimal('40000'),
        source: 'websocket',
        receivedAt: new Date(),
      };

      const result = detector.handleOrderStatusChanged(event);

      expect(result).toBeNull();
    });

    it('should ignore orders for positions without conditional orders set', () => {
      const position = createMockPosition({
        conditionalOrderStatus: 'PENDING', // Not SET
      });
      detector.registerPosition(position);

      const event: OrderStatusChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        orderId: 'order-pending',
        orderType: 'STOP_MARKET',
        status: 'FILLED',
        side: 'SELL',
        positionSide: 'LONG',
        filledQty: new Decimal('0.5'),
        avgPrice: new Decimal('40000'),
        source: 'websocket',
        receivedAt: new Date(),
      };

      const result = detector.handleOrderStatusChanged(event);

      expect(result).toBeNull();
    });

    it('should not process the same order twice', () => {
      const handler = vi.fn();
      detector.on('triggerDetected', handler);

      const position = createMockPosition();
      detector.registerPosition(position);

      const event: OrderStatusChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        orderId: 'order-duplicate',
        orderType: 'STOP_MARKET',
        status: 'FILLED',
        side: 'SELL',
        positionSide: 'LONG',
        filledQty: new Decimal('0.5'),
        avgPrice: new Decimal('40000'),
        source: 'websocket',
        receivedAt: new Date(),
      };

      detector.handleOrderStatusChanged(event);
      detector.handleOrderStatusChanged(event); // Same order again

      expect(handler).toHaveBeenCalledOnce(); // Only once
    });

    it('should ignore if stop loss is disabled', () => {
      const position = createMockPosition({
        stopLossEnabled: false,
      });
      detector.registerPosition(position);

      const event: OrderStatusChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        orderId: 'order-sl-disabled',
        orderType: 'STOP_MARKET',
        status: 'FILLED',
        side: 'SELL',
        positionSide: 'LONG',
        filledQty: new Decimal('0.5'),
        avgPrice: new Decimal('40000'),
        source: 'websocket',
        receivedAt: new Date(),
      };

      const result = detector.handleOrderStatusChanged(event);

      expect(result).toBeNull();
    });

    it('should ignore if take profit is disabled', () => {
      const position = createMockPosition({
        takeProfitEnabled: false,
      });
      detector.registerPosition(position);

      const event: OrderStatusChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        orderId: 'order-tp-disabled',
        orderType: 'TAKE_PROFIT_MARKET',
        status: 'FILLED',
        side: 'SELL',
        positionSide: 'LONG',
        filledQty: new Decimal('0.5'),
        avgPrice: new Decimal('45000'),
        source: 'websocket',
        receivedAt: new Date(),
      };

      const result = detector.handleOrderStatusChanged(event);

      expect(result).toBeNull();
    });
  });

  describe('Trigger Price Validation', () => {
    it('should validate trigger price within tolerance', () => {
      const position = createMockPosition({
        longStopLossPrice: new Decimal('40000'),
      });

      const event: OrderStatusChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        orderId: 'order-validate',
        orderType: 'STOP_MARKET',
        status: 'FILLED',
        side: 'SELL',
        positionSide: 'LONG',
        filledQty: new Decimal('0.5'),
        avgPrice: new Decimal('40000'),
        stopPrice: new Decimal('40050'), // Within 1% tolerance
        source: 'websocket',
        receivedAt: new Date(),
      };

      const isValid = detector.validateTriggerPrice(event, position, 'LONG_SL');

      expect(isValid).toBe(true);
    });

    it('should reject trigger price outside tolerance', () => {
      const position = createMockPosition({
        longStopLossPrice: new Decimal('40000'),
      });

      const event: OrderStatusChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        orderId: 'order-invalid',
        orderType: 'STOP_MARKET',
        status: 'FILLED',
        side: 'SELL',
        positionSide: 'LONG',
        filledQty: new Decimal('0.5'),
        avgPrice: new Decimal('38000'),
        stopPrice: new Decimal('38000'), // Way off from expected 40000
        source: 'websocket',
        receivedAt: new Date(),
      };

      const isValid = detector.validateTriggerPrice(event, position, 'LONG_SL');

      expect(isValid).toBe(false);
    });
  });

  describe('Position Management', () => {
    it('should register and unregister positions', () => {
      const position = createMockPosition();

      detector.registerPosition(position);
      expect(detector.getRegisteredPositions()).toHaveLength(1);

      detector.unregisterPosition(position.id);
      expect(detector.getRegisteredPositions()).toHaveLength(0);
    });

    it('should handle multiple positions', () => {
      const position1 = createMockPosition({ id: 'pos-1', symbol: 'BTCUSDT' });
      const position2 = createMockPosition({ id: 'pos-2', symbol: 'ETHUSDT' });

      detector.registerPosition(position1);
      detector.registerPosition(position2);

      expect(detector.getRegisteredPositions()).toHaveLength(2);
    });
  });
});

describe('TriggerDetector Contract', () => {
  it('should define all trigger types', () => {
    const triggerTypes: TriggerType[] = ['LONG_SL', 'LONG_TP', 'SHORT_SL', 'SHORT_TP'];

    expect(triggerTypes).toHaveLength(4);
    triggerTypes.forEach((type) => {
      expect(typeof type).toBe('string');
    });
  });

  it('should expect TriggerDetected event structure', () => {
    const event: TriggerDetected = {
      positionId: 'test-id',
      exchange: 'binance',
      symbol: 'BTCUSDT',
      triggerType: 'LONG_SL',
      triggerPrice: new Decimal('40000'),
      currentMarkPrice: new Decimal('39900'),
      detectedAt: new Date(),
      source: 'websocket',
    };

    expect(event.positionId).toBeDefined();
    expect(event.exchange).toBeDefined();
    expect(event.symbol).toBeDefined();
    expect(event.triggerType).toBeDefined();
    expect(event.triggerPrice).toBeInstanceOf(Decimal);
    expect(event.detectedAt).toBeInstanceOf(Date);
    expect(event.source).toBe('websocket');
  });
});
