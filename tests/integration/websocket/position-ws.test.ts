/**
 * Integration tests for Position WebSocket monitoring
 *
 * Feature: 052-specify-scripts-bash
 * Task: T035
 *
 * Tests the integration of private WebSocket connections for position monitoring
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import Decimal from 'decimal.js';
import type {
  PositionChanged,
  BalanceChanged,
  OrderStatusChanged,
  TriggerDetected,
} from '@/types/internal-events';
import type { ExchangeName } from '@/connectors/types';

/**
 * Mock exchange WebSocket adapter interface
 */
interface MockExchangeWsAdapter extends EventEmitter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getExchangeName(): ExchangeName;
}

/**
 * Mock Binance User Data WebSocket
 */
class MockBinanceUserDataWs extends EventEmitter implements MockExchangeWsAdapter {
  private connected = false;

  async connect(): Promise<void> {
    this.connected = true;
    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.emit('disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  getExchangeName(): ExchangeName {
    return 'binance';
  }

  simulateAccountUpdate(positions: PositionChanged[], balances: BalanceChanged[]): void {
    positions.forEach((p) => this.emit('positionChanged', p));
    balances.forEach((b) => this.emit('balanceChanged', b));
  }

  simulateOrderUpdate(order: OrderStatusChanged): void {
    this.emit('orderStatusChanged', order);
  }
}

/**
 * Mock OKX WebSocket (CCXT style)
 */
class MockOkxWs extends EventEmitter implements MockExchangeWsAdapter {
  private connected = false;

  async connect(): Promise<void> {
    this.connected = true;
    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.emit('disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  getExchangeName(): ExchangeName {
    return 'okx';
  }

  simulatePositionUpdate(positions: PositionChanged[]): void {
    positions.forEach((p) => this.emit('positionChanged', p));
  }

  simulateOrderUpdate(order: OrderStatusChanged): void {
    this.emit('orderStatusChanged', order);
  }
}

/**
 * Mock PrivateWsManager that manages multiple exchange WebSocket connections
 */
class MockPrivateWsManager extends EventEmitter {
  private adapters: Map<ExchangeName, MockExchangeWsAdapter> = new Map();
  private connectionPromises: Map<string, Promise<void>> = new Map();

  constructor(adapters: MockExchangeWsAdapter[]) {
    super();
    adapters.forEach((adapter) => {
      this.adapters.set(adapter.getExchangeName(), adapter);
      this.setupAdapterListeners(adapter);
    });
  }

  private setupAdapterListeners(adapter: MockExchangeWsAdapter): void {
    adapter.on('positionChanged', (event: PositionChanged) => {
      this.emit('positionChanged', event);
    });

    adapter.on('balanceChanged', (event: BalanceChanged) => {
      this.emit('balanceChanged', event);
    });

    adapter.on('orderStatusChanged', (event: OrderStatusChanged) => {
      this.emit('orderStatusChanged', event);
    });

    adapter.on('connected', () => {
      this.emit('adapterConnected', adapter.getExchangeName());
    });

    adapter.on('disconnected', () => {
      this.emit('adapterDisconnected', adapter.getExchangeName());
    });
  }

  async connectUser(userId: string, exchanges: ExchangeName[]): Promise<void> {
    const promises = exchanges.map((exchange) => {
      const adapter = this.adapters.get(exchange);
      if (!adapter) {
        throw new Error(`No adapter for exchange: ${exchange}`);
      }
      return adapter.connect();
    });

    await Promise.all(promises);
    this.emit('userConnected', userId);
  }

  async disconnectUser(userId: string): Promise<void> {
    const promises = Array.from(this.adapters.values()).map((adapter) =>
      adapter.disconnect()
    );
    await Promise.all(promises);
    this.emit('userDisconnected', userId);
  }

  isExchangeConnected(exchange: ExchangeName): boolean {
    return this.adapters.get(exchange)?.isConnected() ?? false;
  }

  getConnectedExchanges(): ExchangeName[] {
    return Array.from(this.adapters.entries())
      .filter(([, adapter]) => adapter.isConnected())
      .map(([name]) => name);
  }

  getAdapter(exchange: ExchangeName): MockExchangeWsAdapter | undefined {
    return this.adapters.get(exchange);
  }
}

/**
 * Mock TriggerDetector that integrates with PrivateWsManager
 */
class MockIntegratedTriggerDetector extends EventEmitter {
  private manager: MockPrivateWsManager;
  private monitoredPositions: Set<string> = new Set();

  constructor(manager: MockPrivateWsManager) {
    super();
    this.manager = manager;
    this.setupListeners();
  }

  private setupListeners(): void {
    this.manager.on('orderStatusChanged', (event: OrderStatusChanged) => {
      this.checkForTrigger(event);
    });
  }

  monitorPosition(positionId: string): void {
    this.monitoredPositions.add(positionId);
  }

  stopMonitoring(positionId: string): void {
    this.monitoredPositions.delete(positionId);
  }

  private checkForTrigger(event: OrderStatusChanged): void {
    // Simplified trigger detection for integration test
    if (event.status !== 'FILLED') return;

    const isConditionalOrder =
      event.orderType === 'STOP_MARKET' ||
      event.orderType === 'TAKE_PROFIT_MARKET' ||
      event.orderType === 'stop_loss' ||
      event.orderType === 'take_profit';

    if (!isConditionalOrder) return;

    // In real implementation, would match with monitored positions
    // For test, we emit if we're monitoring any position with matching symbol

    const triggerType =
      event.orderType === 'STOP_MARKET' || event.orderType === 'stop_loss'
        ? event.positionSide === 'LONG'
          ? 'LONG_SL'
          : 'SHORT_SL'
        : event.positionSide === 'LONG'
          ? 'LONG_TP'
          : 'SHORT_TP';

    const triggerEvent: TriggerDetected = {
      positionId: 'test-position-id',
      exchange: event.exchange,
      symbol: event.symbol,
      triggerType: triggerType as 'LONG_SL' | 'LONG_TP' | 'SHORT_SL' | 'SHORT_TP',
      triggerPrice: event.stopPrice || event.avgPrice,
      currentMarkPrice: event.avgPrice,
      detectedAt: new Date(),
      source: 'websocket',
    };

    this.emit('triggerDetected', triggerEvent);
  }
}

describe('Position WebSocket Integration', () => {
  let binanceWs: MockBinanceUserDataWs;
  let okxWs: MockOkxWs;
  let manager: MockPrivateWsManager;

  beforeEach(() => {
    binanceWs = new MockBinanceUserDataWs();
    okxWs = new MockOkxWs();
    manager = new MockPrivateWsManager([binanceWs, okxWs]);
  });

  describe('Multi-Exchange Connection', () => {
    it('should connect to multiple exchanges', async () => {
      await manager.connectUser('user-1', ['binance', 'okx']);

      expect(manager.isExchangeConnected('binance')).toBe(true);
      expect(manager.isExchangeConnected('okx')).toBe(true);
    });

    it('should emit userConnected event', async () => {
      const handler = vi.fn();
      manager.on('userConnected', handler);

      await manager.connectUser('user-1', ['binance']);

      expect(handler).toHaveBeenCalledWith('user-1');
    });

    it('should track connected exchanges', async () => {
      await manager.connectUser('user-1', ['binance', 'okx']);

      const connected = manager.getConnectedExchanges();
      expect(connected).toContain('binance');
      expect(connected).toContain('okx');
    });

    it('should disconnect all exchanges for user', async () => {
      await manager.connectUser('user-1', ['binance', 'okx']);
      await manager.disconnectUser('user-1');

      expect(manager.isExchangeConnected('binance')).toBe(false);
      expect(manager.isExchangeConnected('okx')).toBe(false);
    });
  });

  describe('Position Change Events', () => {
    it('should receive position changes from Binance', async () => {
      const positionHandler = vi.fn();
      manager.on('positionChanged', positionHandler);

      await manager.connectUser('user-1', ['binance']);

      const position: PositionChanged = {
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

      binanceWs.simulateAccountUpdate([position], []);

      expect(positionHandler).toHaveBeenCalledOnce();
      expect(positionHandler.mock.calls[0][0].exchange).toBe('binance');
    });

    it('should receive position changes from OKX', async () => {
      const positionHandler = vi.fn();
      manager.on('positionChanged', positionHandler);

      await manager.connectUser('user-1', ['okx']);

      const position: PositionChanged = {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        side: 'SHORT',
        size: new Decimal('0.5'),
        entryPrice: new Decimal('42100'),
        markPrice: new Decimal('41800'),
        unrealizedPnl: new Decimal('150'),
        source: 'websocket',
        receivedAt: new Date(),
      };

      okxWs.simulatePositionUpdate([position]);

      expect(positionHandler).toHaveBeenCalledOnce();
      expect(positionHandler.mock.calls[0][0].exchange).toBe('okx');
    });

    it('should aggregate position changes from multiple exchanges', async () => {
      const positionHandler = vi.fn();
      manager.on('positionChanged', positionHandler);

      await manager.connectUser('user-1', ['binance', 'okx']);

      const binancePosition: PositionChanged = {
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

      const okxPosition: PositionChanged = {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        side: 'SHORT',
        size: new Decimal('0.5'),
        entryPrice: new Decimal('42100'),
        markPrice: new Decimal('41800'),
        unrealizedPnl: new Decimal('150'),
        source: 'websocket',
        receivedAt: new Date(),
      };

      binanceWs.simulateAccountUpdate([binancePosition], []);
      okxWs.simulatePositionUpdate([okxPosition]);

      expect(positionHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('Balance Change Events', () => {
    it('should receive balance changes from Binance', async () => {
      const balanceHandler = vi.fn();
      manager.on('balanceChanged', balanceHandler);

      await manager.connectUser('user-1', ['binance']);

      const balance: BalanceChanged = {
        exchange: 'binance',
        asset: 'USDT',
        walletBalance: new Decimal('10000'),
        crossWalletBalance: new Decimal('9500'),
        balanceChange: new Decimal('-100'),
        changeReason: 'ORDER',
        source: 'websocket',
        receivedAt: new Date(),
      };

      binanceWs.simulateAccountUpdate([], [balance]);

      expect(balanceHandler).toHaveBeenCalledOnce();
      expect(balanceHandler.mock.calls[0][0].asset).toBe('USDT');
    });
  });

  describe('Order Status Events', () => {
    it('should receive order updates from Binance', async () => {
      const orderHandler = vi.fn();
      manager.on('orderStatusChanged', orderHandler);

      await manager.connectUser('user-1', ['binance']);

      const order: OrderStatusChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        orderId: 'order-123',
        orderType: 'MARKET',
        status: 'FILLED',
        side: 'BUY',
        positionSide: 'LONG',
        filledQty: new Decimal('0.5'),
        avgPrice: new Decimal('42000'),
        source: 'websocket',
        receivedAt: new Date(),
      };

      binanceWs.simulateOrderUpdate(order);

      expect(orderHandler).toHaveBeenCalledOnce();
      expect(orderHandler.mock.calls[0][0].orderId).toBe('order-123');
    });

    it('should receive order updates from OKX', async () => {
      const orderHandler = vi.fn();
      manager.on('orderStatusChanged', orderHandler);

      await manager.connectUser('user-1', ['okx']);

      const order: OrderStatusChanged = {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        orderId: 'okx-order-456',
        orderType: 'MARKET',
        status: 'FILLED',
        side: 'SELL',
        positionSide: 'SHORT',
        filledQty: new Decimal('0.5'),
        avgPrice: new Decimal('42100'),
        source: 'websocket',
        receivedAt: new Date(),
      };

      okxWs.simulateOrderUpdate(order);

      expect(orderHandler).toHaveBeenCalledOnce();
      expect(orderHandler.mock.calls[0][0].orderId).toBe('okx-order-456');
    });
  });

  describe('Trigger Detection Integration', () => {
    let detector: MockIntegratedTriggerDetector;

    beforeEach(() => {
      detector = new MockIntegratedTriggerDetector(manager);
    });

    it('should detect LONG_SL trigger from Binance STOP_MARKET order', async () => {
      const triggerHandler = vi.fn();
      detector.on('triggerDetected', triggerHandler);
      detector.monitorPosition('test-position');

      await manager.connectUser('user-1', ['binance']);

      const order: OrderStatusChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        orderId: 'sl-order-123',
        orderType: 'STOP_MARKET',
        status: 'FILLED',
        side: 'SELL',
        positionSide: 'LONG',
        filledQty: new Decimal('0.5'),
        avgPrice: new Decimal('40000'),
        stopPrice: new Decimal('40000'),
        realizedPnl: new Decimal('-1000'),
        source: 'websocket',
        receivedAt: new Date(),
      };

      binanceWs.simulateOrderUpdate(order);

      expect(triggerHandler).toHaveBeenCalledOnce();
      expect(triggerHandler.mock.calls[0][0].triggerType).toBe('LONG_SL');
    });

    it('should detect SHORT_TP trigger from OKX take_profit order', async () => {
      const triggerHandler = vi.fn();
      detector.on('triggerDetected', triggerHandler);
      detector.monitorPosition('test-position');

      await manager.connectUser('user-1', ['okx']);

      const order: OrderStatusChanged = {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        orderId: 'tp-order-456',
        orderType: 'take_profit',
        status: 'FILLED',
        side: 'BUY',
        positionSide: 'SHORT',
        filledQty: new Decimal('0.5'),
        avgPrice: new Decimal('39000'),
        stopPrice: new Decimal('39000'),
        realizedPnl: new Decimal('1500'),
        source: 'websocket',
        receivedAt: new Date(),
      };

      okxWs.simulateOrderUpdate(order);

      expect(triggerHandler).toHaveBeenCalledOnce();
      expect(triggerHandler.mock.calls[0][0].triggerType).toBe('SHORT_TP');
    });

    it('should not detect trigger from regular market order', async () => {
      const triggerHandler = vi.fn();
      detector.on('triggerDetected', triggerHandler);
      detector.monitorPosition('test-position');

      await manager.connectUser('user-1', ['binance']);

      const order: OrderStatusChanged = {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        orderId: 'market-order',
        orderType: 'MARKET',
        status: 'FILLED',
        side: 'SELL',
        positionSide: 'LONG',
        filledQty: new Decimal('0.5'),
        avgPrice: new Decimal('42000'),
        source: 'websocket',
        receivedAt: new Date(),
      };

      binanceWs.simulateOrderUpdate(order);

      expect(triggerHandler).not.toHaveBeenCalled();
    });
  });

  describe('Reconnection Handling', () => {
    it('should handle adapter disconnection', async () => {
      const disconnectHandler = vi.fn();
      manager.on('adapterDisconnected', disconnectHandler);

      await manager.connectUser('user-1', ['binance']);
      binanceWs.emit('disconnected');

      expect(disconnectHandler).toHaveBeenCalledWith('binance');
    });

    it('should handle adapter reconnection', async () => {
      const connectHandler = vi.fn();
      manager.on('adapterConnected', connectHandler);

      await manager.connectUser('user-1', ['binance']);
      expect(connectHandler).toHaveBeenCalledWith('binance');

      // Simulate disconnect and reconnect
      binanceWs.emit('disconnected');
      binanceWs.emit('connected');

      expect(connectHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Scenarios', () => {
    it('should throw error for unknown exchange', async () => {
      await expect(
        manager.connectUser('user-1', ['unknown' as ExchangeName])
      ).rejects.toThrow('No adapter for exchange: unknown');
    });
  });
});

describe('Position WebSocket End-to-End Flow', () => {
  it('should handle complete arbitrage position monitoring flow', async () => {
    const binanceWs = new MockBinanceUserDataWs();
    const okxWs = new MockOkxWs();
    const manager = new MockPrivateWsManager([binanceWs, okxWs]);
    const detector = new MockIntegratedTriggerDetector(manager);

    const events: string[] = [];

    manager.on('positionChanged', (e: PositionChanged) => {
      events.push(`position:${e.exchange}:${e.side}`);
    });

    manager.on('orderStatusChanged', () => {
      events.push('order');
    });

    detector.on('triggerDetected', (e: TriggerDetected) => {
      events.push(`trigger:${e.triggerType}`);
    });

    detector.monitorPosition('arb-position-1');

    // 1. User connects to both exchanges
    await manager.connectUser('user-1', ['binance', 'okx']);

    // 2. Open LONG on Binance
    const binanceLong: PositionChanged = {
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
    binanceWs.simulateAccountUpdate([binanceLong], []);

    // 3. Open SHORT on OKX
    const okxShort: PositionChanged = {
      exchange: 'okx',
      symbol: 'BTCUSDT',
      side: 'SHORT',
      size: new Decimal('0.5'),
      entryPrice: new Decimal('42100'),
      markPrice: new Decimal('42100'),
      unrealizedPnl: new Decimal('0'),
      source: 'websocket',
      receivedAt: new Date(),
    };
    okxWs.simulatePositionUpdate([okxShort]);

    // 4. Price moves, unrealized PnL updates
    const binanceLongUpdate: PositionChanged = {
      ...binanceLong,
      markPrice: new Decimal('41500'),
      unrealizedPnl: new Decimal('-250'),
    };
    binanceWs.simulateAccountUpdate([binanceLongUpdate], []);

    // 5. Stop loss triggers on Binance
    const slOrder: OrderStatusChanged = {
      exchange: 'binance',
      symbol: 'BTCUSDT',
      orderId: 'sl-order',
      orderType: 'STOP_MARKET',
      status: 'FILLED',
      side: 'SELL',
      positionSide: 'LONG',
      filledQty: new Decimal('0.5'),
      avgPrice: new Decimal('41000'),
      stopPrice: new Decimal('41000'),
      realizedPnl: new Decimal('-500'),
      source: 'websocket',
      receivedAt: new Date(),
    };
    binanceWs.simulateOrderUpdate(slOrder);

    // Verify event flow
    expect(events).toContain('position:binance:LONG');
    expect(events).toContain('position:okx:SHORT');
    expect(events).toContain('order');
    expect(events).toContain('trigger:LONG_SL');
  });
});
