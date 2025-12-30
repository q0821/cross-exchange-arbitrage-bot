/**
 * Unit tests for PositionWsHandler
 *
 * Feature: 052-specify-scripts-bash
 * Task: T034
 *
 * Tests the position change handling from WebSocket events
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import Decimal from 'decimal.js';
import type { PositionChanged, PositionClosed } from '@/types/internal-events';
import type { ExchangeName } from '@/connectors/types';

/**
 * Position state for tracking
 */
interface PositionState {
  exchange: ExchangeName;
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: Decimal;
  entryPrice: Decimal;
  markPrice: Decimal;
  unrealizedPnl: Decimal;
  lastUpdate: Date;
}

/**
 * Position snapshot for database update
 */
interface PositionSnapshot {
  exchange: ExchangeName;
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: string;
  entryPrice: string;
  markPrice: string;
  unrealizedPnl: string;
  updatedAt: Date;
}

/**
 * Mock PositionWsHandler for testing
 */
class MockPositionWsHandler extends EventEmitter {
  private positions: Map<string, PositionState> = new Map();
  private updateThrottleMs = 1000;
  private lastUpdateTimes: Map<string, number> = new Map();
  private pendingUpdates: Map<string, PositionState> = new Map();

  constructor(options?: { updateThrottleMs?: number }) {
    super();
    this.updateThrottleMs = options?.updateThrottleMs ?? 1000;
  }

  /**
   * Handle position changed event from WebSocket
   */
  handlePositionChanged(event: PositionChanged): void {
    const key = this.getPositionKey(event.exchange, event.symbol, event.side);
    const existing = this.positions.get(key);

    // Check if position was closed (size went to 0)
    if (event.size.isZero()) {
      if (existing) {
        this.handlePositionClosed(existing, event);
      }
      return;
    }

    // Update position state
    const newState: PositionState = {
      exchange: event.exchange,
      symbol: event.symbol,
      side: event.side,
      size: event.size,
      entryPrice: event.entryPrice,
      markPrice: event.markPrice,
      unrealizedPnl: event.unrealizedPnl,
      lastUpdate: event.receivedAt,
    };

    this.positions.set(key, newState);

    // Check if this is a new position
    if (!existing || existing.size.isZero()) {
      this.emit('positionOpened', newState);
    }

    // Throttle database updates
    this.scheduleUpdate(key, newState);
  }

  /**
   * Handle position closed
   */
  private handlePositionClosed(existing: PositionState, event: PositionChanged): void {
    const key = this.getPositionKey(event.exchange, event.symbol, event.side);

    // Remove from tracking
    this.positions.delete(key);
    this.lastUpdateTimes.delete(key);
    this.pendingUpdates.delete(key);

    // Emit closed event
    const closedEvent: PositionClosed = {
      exchange: event.exchange,
      symbol: event.symbol,
      side: event.side,
      closedSize: existing.size,
      entryPrice: existing.entryPrice,
      exitPrice: event.markPrice,
      realizedPnl: existing.unrealizedPnl, // Approximation
      reason: 'MANUAL',
      source: event.source,
      receivedAt: event.receivedAt,
    };

    this.emit('positionClosed', closedEvent);
  }

  /**
   * Schedule throttled database update
   */
  private scheduleUpdate(key: string, state: PositionState): void {
    const now = Date.now();
    const lastUpdate = this.lastUpdateTimes.get(key) || 0;

    if (now - lastUpdate >= this.updateThrottleMs) {
      // Immediate update
      this.lastUpdateTimes.set(key, now);
      this.emitDatabaseUpdate(state);
    } else {
      // Queue for later
      this.pendingUpdates.set(key, state);
    }
  }

  /**
   * Flush pending updates
   */
  flushPendingUpdates(): void {
    const now = Date.now();

    for (const [key, state] of this.pendingUpdates) {
      this.lastUpdateTimes.set(key, now);
      this.emitDatabaseUpdate(state);
    }

    this.pendingUpdates.clear();
  }

  /**
   * Emit database update event
   */
  private emitDatabaseUpdate(state: PositionState): void {
    const snapshot: PositionSnapshot = {
      exchange: state.exchange,
      symbol: state.symbol,
      side: state.side,
      size: state.size.toString(),
      entryPrice: state.entryPrice.toString(),
      markPrice: state.markPrice.toString(),
      unrealizedPnl: state.unrealizedPnl.toString(),
      updatedAt: state.lastUpdate,
    };

    this.emit('databaseUpdate', snapshot);
  }

  /**
   * Get position key
   */
  private getPositionKey(exchange: ExchangeName, symbol: string, side: string): string {
    return `${exchange}:${symbol}:${side}`;
  }

  /**
   * Get all tracked positions
   */
  getPositions(): Map<string, PositionState> {
    return new Map(this.positions);
  }

  /**
   * Get specific position
   */
  getPosition(exchange: ExchangeName, symbol: string, side: 'LONG' | 'SHORT'): PositionState | undefined {
    const key = this.getPositionKey(exchange, symbol, side);
    return this.positions.get(key);
  }

  /**
   * Get pending update count
   */
  getPendingUpdateCount(): number {
    return this.pendingUpdates.size;
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.positions.clear();
    this.lastUpdateTimes.clear();
    this.pendingUpdates.clear();
  }
}

describe('PositionWsHandler', () => {
  let handler: MockPositionWsHandler;

  beforeEach(() => {
    vi.useFakeTimers();
    handler = new MockPositionWsHandler({ updateThrottleMs: 1000 });
  });

  afterEach(() => {
    vi.useRealTimers();
    handler.clear();
  });

  describe('Position Tracking', () => {
    it('should track new position', () => {
      const event: PositionChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        side: 'LONG',
        size: new Decimal('0.5'),
        entryPrice: new Decimal('42000'),
        markPrice: new Decimal('42500'),
        unrealizedPnl: new Decimal('250'),
        source: 'websocket',
        receivedAt: new Date(),
      };

      handler.handlePositionChanged(event);

      const position = handler.getPosition('binance', 'BTCUSDT', 'LONG');
      expect(position).toBeDefined();
      expect(position?.size.toString()).toBe('0.5');
      expect(position?.entryPrice.toString()).toBe('42000');
    });

    it('should update existing position', () => {
      const initialEvent: PositionChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        side: 'LONG',
        size: new Decimal('0.5'),
        entryPrice: new Decimal('42000'),
        markPrice: new Decimal('42000'),
        unrealizedPnl: new Decimal('0'),
        source: 'websocket',
        receivedAt: new Date(),
      };

      handler.handlePositionChanged(initialEvent);

      // Price moves up
      const updateEvent: PositionChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        side: 'LONG',
        size: new Decimal('0.5'),
        entryPrice: new Decimal('42000'),
        markPrice: new Decimal('43000'),
        unrealizedPnl: new Decimal('500'),
        source: 'websocket',
        receivedAt: new Date(),
      };

      handler.handlePositionChanged(updateEvent);

      const position = handler.getPosition('binance', 'BTCUSDT', 'LONG');
      expect(position?.markPrice.toString()).toBe('43000');
      expect(position?.unrealizedPnl.toString()).toBe('500');
    });

    it('should track multiple positions', () => {
      const events: PositionChanged[] = [
        {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          side: 'LONG',
          size: new Decimal('0.5'),
          entryPrice: new Decimal('42000'),
          markPrice: new Decimal('42000'),
          unrealizedPnl: new Decimal('0'),
          source: 'websocket',
          receivedAt: new Date(),
        },
        {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          side: 'SHORT',
          size: new Decimal('0.5'),
          entryPrice: new Decimal('42100'),
          markPrice: new Decimal('42100'),
          unrealizedPnl: new Decimal('0'),
          source: 'websocket',
          receivedAt: new Date(),
        },
      ];

      events.forEach((e) => handler.handlePositionChanged(e));

      expect(handler.getPositions().size).toBe(2);
    });
  });

  describe('Position Opened Events', () => {
    it('should emit positionOpened for new position', () => {
      const openedHandler = vi.fn();
      handler.on('positionOpened', openedHandler);

      const event: PositionChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        side: 'LONG',
        size: new Decimal('0.5'),
        entryPrice: new Decimal('42000'),
        markPrice: new Decimal('42000'),
        unrealizedPnl: new Decimal('0'),
        source: 'websocket',
        receivedAt: new Date(),
      };

      handler.handlePositionChanged(event);

      expect(openedHandler).toHaveBeenCalledOnce();
      expect(openedHandler.mock.calls[0][0].symbol).toBe('BTCUSDT');
    });

    it('should not emit positionOpened for updates', () => {
      const openedHandler = vi.fn();

      // First create a position
      const initialEvent: PositionChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        side: 'LONG',
        size: new Decimal('0.5'),
        entryPrice: new Decimal('42000'),
        markPrice: new Decimal('42000'),
        unrealizedPnl: new Decimal('0'),
        source: 'websocket',
        receivedAt: new Date(),
      };
      handler.handlePositionChanged(initialEvent);

      // Now add listener
      handler.on('positionOpened', openedHandler);

      // Update the position
      const updateEvent: PositionChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        side: 'LONG',
        size: new Decimal('0.5'),
        entryPrice: new Decimal('42000'),
        markPrice: new Decimal('43000'),
        unrealizedPnl: new Decimal('500'),
        source: 'websocket',
        receivedAt: new Date(),
      };
      handler.handlePositionChanged(updateEvent);

      expect(openedHandler).not.toHaveBeenCalled();
    });
  });

  describe('Position Closed Events', () => {
    it('should emit positionClosed when size goes to 0', () => {
      const closedHandler = vi.fn();
      handler.on('positionClosed', closedHandler);

      // Create position
      const openEvent: PositionChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        side: 'LONG',
        size: new Decimal('0.5'),
        entryPrice: new Decimal('42000'),
        markPrice: new Decimal('43000'),
        unrealizedPnl: new Decimal('500'),
        source: 'websocket',
        receivedAt: new Date(),
      };
      handler.handlePositionChanged(openEvent);

      // Close position
      const closeEvent: PositionChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        side: 'LONG',
        size: new Decimal('0'), // Closed
        entryPrice: new Decimal('0'),
        markPrice: new Decimal('43000'),
        unrealizedPnl: new Decimal('0'),
        source: 'websocket',
        receivedAt: new Date(),
      };
      handler.handlePositionChanged(closeEvent);

      expect(closedHandler).toHaveBeenCalledOnce();
      expect(closedHandler.mock.calls[0][0].closedSize.toString()).toBe('0.5');
    });

    it('should remove position from tracking after close', () => {
      // Create position
      const openEvent: PositionChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        side: 'LONG',
        size: new Decimal('0.5'),
        entryPrice: new Decimal('42000'),
        markPrice: new Decimal('42000'),
        unrealizedPnl: new Decimal('0'),
        source: 'websocket',
        receivedAt: new Date(),
      };
      handler.handlePositionChanged(openEvent);

      expect(handler.getPositions().size).toBe(1);

      // Close position
      const closeEvent: PositionChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        side: 'LONG',
        size: new Decimal('0'),
        entryPrice: new Decimal('0'),
        markPrice: new Decimal('43000'),
        unrealizedPnl: new Decimal('0'),
        source: 'websocket',
        receivedAt: new Date(),
      };
      handler.handlePositionChanged(closeEvent);

      expect(handler.getPositions().size).toBe(0);
    });

    it('should not emit positionClosed for non-existent position', () => {
      const closedHandler = vi.fn();
      handler.on('positionClosed', closedHandler);

      const closeEvent: PositionChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        side: 'LONG',
        size: new Decimal('0'),
        entryPrice: new Decimal('0'),
        markPrice: new Decimal('0'),
        unrealizedPnl: new Decimal('0'),
        source: 'websocket',
        receivedAt: new Date(),
      };
      handler.handlePositionChanged(closeEvent);

      expect(closedHandler).not.toHaveBeenCalled();
    });
  });

  describe('Database Update Throttling', () => {
    it('should emit immediate update for first event', () => {
      const dbUpdateHandler = vi.fn();
      handler.on('databaseUpdate', dbUpdateHandler);

      const event: PositionChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        side: 'LONG',
        size: new Decimal('0.5'),
        entryPrice: new Decimal('42000'),
        markPrice: new Decimal('42000'),
        unrealizedPnl: new Decimal('0'),
        source: 'websocket',
        receivedAt: new Date(),
      };

      handler.handlePositionChanged(event);

      expect(dbUpdateHandler).toHaveBeenCalledOnce();
    });

    it('should throttle rapid updates', () => {
      const dbUpdateHandler = vi.fn();
      handler.on('databaseUpdate', dbUpdateHandler);

      // First event
      const event1: PositionChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        side: 'LONG',
        size: new Decimal('0.5'),
        entryPrice: new Decimal('42000'),
        markPrice: new Decimal('42000'),
        unrealizedPnl: new Decimal('0'),
        source: 'websocket',
        receivedAt: new Date(),
      };
      handler.handlePositionChanged(event1);

      // Second event immediately after (should be throttled)
      const event2: PositionChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        side: 'LONG',
        size: new Decimal('0.5'),
        entryPrice: new Decimal('42000'),
        markPrice: new Decimal('42100'),
        unrealizedPnl: new Decimal('50'),
        source: 'websocket',
        receivedAt: new Date(),
      };
      handler.handlePositionChanged(event2);

      // Only first should be immediate
      expect(dbUpdateHandler).toHaveBeenCalledOnce();
      expect(handler.getPendingUpdateCount()).toBe(1);
    });

    it('should allow update after throttle period', () => {
      const dbUpdateHandler = vi.fn();
      handler.on('databaseUpdate', dbUpdateHandler);

      // First event
      const event1: PositionChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        side: 'LONG',
        size: new Decimal('0.5'),
        entryPrice: new Decimal('42000'),
        markPrice: new Decimal('42000'),
        unrealizedPnl: new Decimal('0'),
        source: 'websocket',
        receivedAt: new Date(),
      };
      handler.handlePositionChanged(event1);

      // Advance time past throttle
      vi.advanceTimersByTime(1100);

      // Second event after throttle period
      const event2: PositionChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        side: 'LONG',
        size: new Decimal('0.5'),
        entryPrice: new Decimal('42000'),
        markPrice: new Decimal('42100'),
        unrealizedPnl: new Decimal('50'),
        source: 'websocket',
        receivedAt: new Date(),
      };
      handler.handlePositionChanged(event2);

      expect(dbUpdateHandler).toHaveBeenCalledTimes(2);
    });

    it('should flush pending updates', () => {
      const dbUpdateHandler = vi.fn();
      handler.on('databaseUpdate', dbUpdateHandler);

      // First event
      const event1: PositionChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        side: 'LONG',
        size: new Decimal('0.5'),
        entryPrice: new Decimal('42000'),
        markPrice: new Decimal('42000'),
        unrealizedPnl: new Decimal('0'),
        source: 'websocket',
        receivedAt: new Date(),
      };
      handler.handlePositionChanged(event1);

      // Second event (throttled)
      const event2: PositionChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        side: 'LONG',
        size: new Decimal('0.5'),
        entryPrice: new Decimal('42000'),
        markPrice: new Decimal('42100'),
        unrealizedPnl: new Decimal('50'),
        source: 'websocket',
        receivedAt: new Date(),
      };
      handler.handlePositionChanged(event2);

      expect(handler.getPendingUpdateCount()).toBe(1);

      // Flush pending
      handler.flushPendingUpdates();

      expect(handler.getPendingUpdateCount()).toBe(0);
      expect(dbUpdateHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('Database Snapshot Format', () => {
    it('should emit correct snapshot format', () => {
      const dbUpdateHandler = vi.fn();
      handler.on('databaseUpdate', dbUpdateHandler);

      const event: PositionChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        side: 'LONG',
        size: new Decimal('0.5'),
        entryPrice: new Decimal('42000'),
        markPrice: new Decimal('42500'),
        unrealizedPnl: new Decimal('250'),
        source: 'websocket',
        receivedAt: new Date(),
      };

      handler.handlePositionChanged(event);

      expect(dbUpdateHandler).toHaveBeenCalledOnce();
      const snapshot: PositionSnapshot = dbUpdateHandler.mock.calls[0][0];

      expect(snapshot.exchange).toBe('binance');
      expect(snapshot.symbol).toBe('BTCUSDT');
      expect(snapshot.side).toBe('LONG');
      expect(snapshot.size).toBe('0.5');
      expect(snapshot.entryPrice).toBe('42000');
      expect(snapshot.markPrice).toBe('42500');
      expect(snapshot.unrealizedPnl).toBe('250');
      expect(snapshot.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('Multi-Exchange Positions', () => {
    it('should track same symbol on different exchanges', () => {
      const events: PositionChanged[] = [
        {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          side: 'LONG',
          size: new Decimal('0.5'),
          entryPrice: new Decimal('42000'),
          markPrice: new Decimal('42000'),
          unrealizedPnl: new Decimal('0'),
          source: 'websocket',
          receivedAt: new Date(),
        },
        {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          side: 'LONG',
          size: new Decimal('0.3'),
          entryPrice: new Decimal('42100'),
          markPrice: new Decimal('42100'),
          unrealizedPnl: new Decimal('0'),
          source: 'websocket',
          receivedAt: new Date(),
        },
      ];

      events.forEach((e) => handler.handlePositionChanged(e));

      const binancePos = handler.getPosition('binance', 'BTCUSDT', 'LONG');
      const okxPos = handler.getPosition('okx', 'BTCUSDT', 'LONG');

      expect(binancePos?.size.toString()).toBe('0.5');
      expect(okxPos?.size.toString()).toBe('0.3');
    });

    it('should track LONG and SHORT separately', () => {
      const events: PositionChanged[] = [
        {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          side: 'LONG',
          size: new Decimal('0.5'),
          entryPrice: new Decimal('42000'),
          markPrice: new Decimal('42000'),
          unrealizedPnl: new Decimal('0'),
          source: 'websocket',
          receivedAt: new Date(),
        },
        {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          side: 'SHORT',
          size: new Decimal('0.3'),
          entryPrice: new Decimal('42500'),
          markPrice: new Decimal('42500'),
          unrealizedPnl: new Decimal('0'),
          source: 'websocket',
          receivedAt: new Date(),
        },
      ];

      events.forEach((e) => handler.handlePositionChanged(e));

      const longPos = handler.getPosition('binance', 'BTCUSDT', 'LONG');
      const shortPos = handler.getPosition('binance', 'BTCUSDT', 'SHORT');

      expect(longPos?.size.toString()).toBe('0.5');
      expect(shortPos?.size.toString()).toBe('0.3');
    });
  });
});

describe('PositionWsHandler Contract', () => {
  it('should expect PositionChanged event structure', () => {
    const event: PositionChanged = {
      exchange: 'binance',
      symbol: 'BTCUSDT',
      side: 'LONG',
      size: new Decimal('0.5'),
      entryPrice: new Decimal('42000'),
      markPrice: new Decimal('42000'),
      unrealizedPnl: new Decimal('0'),
      source: 'websocket',
      receivedAt: new Date(),
    };

    expect(event.exchange).toBeDefined();
    expect(event.symbol).toBeDefined();
    expect(['LONG', 'SHORT']).toContain(event.side);
    expect(event.size).toBeInstanceOf(Decimal);
    expect(event.source).toBe('websocket');
  });

  it('should expect PositionClosed event structure', () => {
    const event: PositionClosed = {
      exchange: 'binance',
      symbol: 'BTCUSDT',
      side: 'LONG',
      closedSize: new Decimal('0.5'),
      entryPrice: new Decimal('42000'),
      exitPrice: new Decimal('43000'),
      realizedPnl: new Decimal('500'),
      reason: 'MANUAL',
      source: 'websocket',
      receivedAt: new Date(),
    };

    expect(event.closedSize).toBeInstanceOf(Decimal);
    expect(event.realizedPnl).toBeInstanceOf(Decimal);
    expect(['MANUAL', 'TRIGGER', 'LIQUIDATION']).toContain(event.reason);
  });
});
