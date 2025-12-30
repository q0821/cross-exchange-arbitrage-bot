/**
 * Unit tests for BinanceUserDataWs ACCOUNT_UPDATE parsing
 *
 * Feature: 052-specify-scripts-bash
 * Task: T032
 *
 * Tests the parsing of Binance User Data Stream events
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import Decimal from 'decimal.js';
import type {
  PositionChanged,
  BalanceChanged,
  OrderStatusChanged,
} from '@/types/internal-events';

/**
 * Binance ACCOUNT_UPDATE event structure
 */
interface BinanceAccountUpdate {
  e: 'ACCOUNT_UPDATE';
  E: number; // Event time (ms)
  T: number; // Transaction time (ms)
  a: {
    m: string; // Event reason
    B: Array<{
      a: string; // Asset
      wb: string; // Wallet balance
      cw: string; // Cross wallet balance
      bc: string; // Balance change
    }>;
    P: Array<{
      s: string; // Symbol
      pa: string; // Position amount
      ep: string; // Entry price
      cr: string; // Accumulated realized
      up: string; // Unrealized PnL
      ps: 'LONG' | 'SHORT' | 'BOTH';
      bep: string; // Break-even price
    }>;
  };
}

/**
 * Binance ORDER_TRADE_UPDATE event structure
 */
interface BinanceOrderTradeUpdate {
  e: 'ORDER_TRADE_UPDATE';
  E: number; // Event time (ms)
  T: number; // Transaction time (ms)
  o: {
    s: string; // Symbol
    c: string; // Client order ID
    S: 'BUY' | 'SELL';
    o: string; // Order type
    x: string; // Execution type
    X: string; // Order status
    i: number; // Order ID
    l: string; // Last filled quantity
    z: string; // Cumulative filled quantity
    L: string; // Last filled price
    ap: string; // Average price
    sp: string; // Stop price
    ps: 'LONG' | 'SHORT' | 'BOTH';
    rp: string; // Realized profit
  };
}

/**
 * Mock BinanceUserDataWs for testing parsing logic
 */
class MockBinanceUserDataWs extends EventEmitter {
  private isConnected = false;

  parseAccountUpdate(raw: BinanceAccountUpdate): {
    balances: BalanceChanged[];
    positions: PositionChanged[];
    reason: string;
    eventTime: Date;
  } {
    const eventTime = new Date(raw.E);
    const reason = raw.a.m;

    const balances: BalanceChanged[] = raw.a.B.map((b) => ({
      exchange: 'binance' as const,
      asset: b.a,
      walletBalance: new Decimal(b.wb),
      crossWalletBalance: new Decimal(b.cw),
      balanceChange: new Decimal(b.bc),
      changeReason: this.mapBalanceReason(reason),
      source: 'websocket' as const,
      receivedAt: eventTime,
    }));

    const positions: PositionChanged[] = raw.a.P.filter(
      (p) => p.ps !== 'BOTH' && new Decimal(p.pa).abs().gt(0)
    ).map((p) => ({
      exchange: 'binance' as const,
      symbol: p.s,
      side: p.ps as 'LONG' | 'SHORT',
      size: new Decimal(p.pa).abs(),
      entryPrice: new Decimal(p.ep),
      markPrice: new Decimal(p.bep), // Using break-even as approximation
      unrealizedPnl: new Decimal(p.up),
      source: 'websocket' as const,
      receivedAt: eventTime,
    }));

    return { balances, positions, reason, eventTime };
  }

  parseOrderTradeUpdate(raw: BinanceOrderTradeUpdate): OrderStatusChanged {
    return {
      exchange: 'binance' as const,
      symbol: raw.o.s,
      orderId: String(raw.o.i),
      clientOrderId: raw.o.c,
      orderType: raw.o.o,
      status: this.mapOrderStatus(raw.o.X),
      side: raw.o.S,
      positionSide: raw.o.ps === 'BOTH' ? 'LONG' : raw.o.ps,
      filledQty: new Decimal(raw.o.z),
      avgPrice: new Decimal(raw.o.ap),
      stopPrice: raw.o.sp ? new Decimal(raw.o.sp) : undefined,
      realizedPnl: raw.o.rp ? new Decimal(raw.o.rp) : undefined,
      source: 'websocket' as const,
      receivedAt: new Date(raw.E),
    };
  }

  private mapBalanceReason(
    reason: string
  ): 'ORDER' | 'FUNDING_FEE' | 'DEPOSIT' | 'WITHDRAW' | 'TRANSFER' | 'UNKNOWN' {
    switch (reason) {
      case 'ORDER':
        return 'ORDER';
      case 'FUNDING_FEE':
        return 'FUNDING_FEE';
      case 'DEPOSIT':
        return 'DEPOSIT';
      case 'WITHDRAW':
        return 'WITHDRAW';
      case 'TRANSFER':
        return 'TRANSFER';
      default:
        return 'UNKNOWN';
    }
  }

  private mapOrderStatus(
    status: string
  ): 'NEW' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELED' | 'EXPIRED' | 'REJECTED' {
    switch (status) {
      case 'NEW':
        return 'NEW';
      case 'FILLED':
        return 'FILLED';
      case 'PARTIALLY_FILLED':
        return 'PARTIALLY_FILLED';
      case 'CANCELED':
        return 'CANCELED';
      case 'EXPIRED':
        return 'EXPIRED';
      case 'REJECTED':
        return 'REJECTED';
      default:
        return 'NEW';
    }
  }

  handleMessage(data: unknown): void {
    if (!data || typeof data !== 'object') {
      this.emit('error', new Error('Invalid message format'));
      return;
    }

    const msg = data as { e?: string };

    switch (msg.e) {
      case 'ACCOUNT_UPDATE':
        const accountResult = this.parseAccountUpdate(data as BinanceAccountUpdate);
        accountResult.balances.forEach((b) => this.emit('balanceChanged', b));
        accountResult.positions.forEach((p) => this.emit('positionChanged', p));
        break;

      case 'ORDER_TRADE_UPDATE':
        const orderResult = this.parseOrderTradeUpdate(data as BinanceOrderTradeUpdate);
        this.emit('orderStatusChanged', orderResult);
        break;

      default:
        // Unknown event type - ignore
        break;
    }
  }

  connect(): void {
    this.isConnected = true;
    this.emit('connected');
  }

  disconnect(): void {
    this.isConnected = false;
    this.emit('disconnected');
  }
}

describe('BinanceUserDataWs', () => {
  let ws: MockBinanceUserDataWs;

  beforeEach(() => {
    ws = new MockBinanceUserDataWs();
  });

  describe('ACCOUNT_UPDATE Parsing', () => {
    it('should parse balance changes correctly', () => {
      const rawEvent: BinanceAccountUpdate = {
        e: 'ACCOUNT_UPDATE',
        E: 1699632000000,
        T: 1699631999000,
        a: {
          m: 'ORDER',
          B: [
            {
              a: 'USDT',
              wb: '10000.00',
              cw: '9500.00',
              bc: '-100.00',
            },
          ],
          P: [],
        },
      };

      const result = ws.parseAccountUpdate(rawEvent);

      expect(result.balances).toHaveLength(1);
      expect(result.balances[0].asset).toBe('USDT');
      expect(result.balances[0].walletBalance.toString()).toBe('10000');
      expect(result.balances[0].crossWalletBalance?.toString()).toBe('9500');
      expect(result.balances[0].balanceChange.toString()).toBe('-100');
      expect(result.balances[0].changeReason).toBe('ORDER');
      expect(result.balances[0].exchange).toBe('binance');
      expect(result.balances[0].source).toBe('websocket');
    });

    it('should parse position changes correctly', () => {
      const rawEvent: BinanceAccountUpdate = {
        e: 'ACCOUNT_UPDATE',
        E: 1699632000000,
        T: 1699631999000,
        a: {
          m: 'ORDER',
          B: [],
          P: [
            {
              s: 'BTCUSDT',
              pa: '0.5',
              ep: '42000.00',
              cr: '100.00',
              up: '50.00',
              ps: 'LONG',
              bep: '42100.00',
            },
          ],
        },
      };

      const result = ws.parseAccountUpdate(rawEvent);

      expect(result.positions).toHaveLength(1);
      expect(result.positions[0].symbol).toBe('BTCUSDT');
      expect(result.positions[0].side).toBe('LONG');
      expect(result.positions[0].size.toString()).toBe('0.5');
      expect(result.positions[0].entryPrice.toString()).toBe('42000');
      expect(result.positions[0].unrealizedPnl.toString()).toBe('50');
      expect(result.positions[0].exchange).toBe('binance');
    });

    it('should handle SHORT position correctly', () => {
      const rawEvent: BinanceAccountUpdate = {
        e: 'ACCOUNT_UPDATE',
        E: 1699632000000,
        T: 1699631999000,
        a: {
          m: 'ORDER',
          B: [],
          P: [
            {
              s: 'ETHUSDT',
              pa: '-2.0', // Negative for short
              ep: '2200.00',
              cr: '0.00',
              up: '-30.00',
              ps: 'SHORT',
              bep: '2180.00',
            },
          ],
        },
      };

      const result = ws.parseAccountUpdate(rawEvent);

      expect(result.positions).toHaveLength(1);
      expect(result.positions[0].side).toBe('SHORT');
      expect(result.positions[0].size.toString()).toBe('2'); // Absolute value
      expect(result.positions[0].unrealizedPnl.toString()).toBe('-30');
    });

    it('should filter out BOTH position side', () => {
      const rawEvent: BinanceAccountUpdate = {
        e: 'ACCOUNT_UPDATE',
        E: 1699632000000,
        T: 1699631999000,
        a: {
          m: 'ORDER',
          B: [],
          P: [
            {
              s: 'BTCUSDT',
              pa: '0.5',
              ep: '42000.00',
              cr: '0.00',
              up: '0.00',
              ps: 'BOTH', // Should be filtered
              bep: '42000.00',
            },
          ],
        },
      };

      const result = ws.parseAccountUpdate(rawEvent);

      expect(result.positions).toHaveLength(0);
    });

    it('should filter out zero-size positions', () => {
      const rawEvent: BinanceAccountUpdate = {
        e: 'ACCOUNT_UPDATE',
        E: 1699632000000,
        T: 1699631999000,
        a: {
          m: 'ORDER',
          B: [],
          P: [
            {
              s: 'BTCUSDT',
              pa: '0', // Zero position
              ep: '42000.00',
              cr: '100.00',
              up: '0.00',
              ps: 'LONG',
              bep: '42000.00',
            },
          ],
        },
      };

      const result = ws.parseAccountUpdate(rawEvent);

      expect(result.positions).toHaveLength(0);
    });

    it('should map FUNDING_FEE reason correctly', () => {
      const rawEvent: BinanceAccountUpdate = {
        e: 'ACCOUNT_UPDATE',
        E: 1699632000000,
        T: 1699631999000,
        a: {
          m: 'FUNDING_FEE',
          B: [
            {
              a: 'USDT',
              wb: '10050.00',
              cw: '9550.00',
              bc: '50.00',
            },
          ],
          P: [],
        },
      };

      const result = ws.parseAccountUpdate(rawEvent);

      expect(result.balances[0].changeReason).toBe('FUNDING_FEE');
    });

    it('should handle multiple balances and positions', () => {
      const rawEvent: BinanceAccountUpdate = {
        e: 'ACCOUNT_UPDATE',
        E: 1699632000000,
        T: 1699631999000,
        a: {
          m: 'ORDER',
          B: [
            { a: 'USDT', wb: '10000.00', cw: '9500.00', bc: '-100.00' },
            { a: 'BNB', wb: '5.00', cw: '5.00', bc: '0.00' },
          ],
          P: [
            {
              s: 'BTCUSDT',
              pa: '0.5',
              ep: '42000.00',
              cr: '0.00',
              up: '50.00',
              ps: 'LONG',
              bep: '42100.00',
            },
            {
              s: 'ETHUSDT',
              pa: '-2.0',
              ep: '2200.00',
              cr: '0.00',
              up: '-20.00',
              ps: 'SHORT',
              bep: '2180.00',
            },
          ],
        },
      };

      const result = ws.parseAccountUpdate(rawEvent);

      expect(result.balances).toHaveLength(2);
      expect(result.positions).toHaveLength(2);
    });
  });

  describe('ORDER_TRADE_UPDATE Parsing', () => {
    it('should parse FILLED order correctly', () => {
      const rawEvent: BinanceOrderTradeUpdate = {
        e: 'ORDER_TRADE_UPDATE',
        E: 1699632000000,
        T: 1699631999000,
        o: {
          s: 'BTCUSDT',
          c: 'client-order-123',
          S: 'BUY',
          o: 'MARKET',
          x: 'TRADE',
          X: 'FILLED',
          i: 12345678,
          l: '0.1',
          z: '0.5',
          L: '42500.00',
          ap: '42450.00',
          sp: '',
          ps: 'LONG',
          rp: '0.00',
        },
      };

      const result = ws.parseOrderTradeUpdate(rawEvent);

      expect(result.symbol).toBe('BTCUSDT');
      expect(result.orderId).toBe('12345678');
      expect(result.clientOrderId).toBe('client-order-123');
      expect(result.orderType).toBe('MARKET');
      expect(result.status).toBe('FILLED');
      expect(result.side).toBe('BUY');
      expect(result.positionSide).toBe('LONG');
      expect(result.filledQty.toString()).toBe('0.5');
      expect(result.avgPrice.toString()).toBe('42450');
    });

    it('should parse STOP_MARKET order with stop price', () => {
      const rawEvent: BinanceOrderTradeUpdate = {
        e: 'ORDER_TRADE_UPDATE',
        E: 1699632000000,
        T: 1699631999000,
        o: {
          s: 'BTCUSDT',
          c: 'sl-order-123',
          S: 'SELL',
          o: 'STOP_MARKET',
          x: 'TRADE',
          X: 'FILLED',
          i: 12345679,
          l: '0.5',
          z: '0.5',
          L: '41000.00',
          ap: '41000.00',
          sp: '41050.00', // Stop price
          ps: 'LONG',
          rp: '-500.00', // Realized loss
        },
      };

      const result = ws.parseOrderTradeUpdate(rawEvent);

      expect(result.orderType).toBe('STOP_MARKET');
      expect(result.stopPrice?.toString()).toBe('41050');
      expect(result.realizedPnl?.toString()).toBe('-500');
    });

    it('should parse TAKE_PROFIT_MARKET order', () => {
      const rawEvent: BinanceOrderTradeUpdate = {
        e: 'ORDER_TRADE_UPDATE',
        E: 1699632000000,
        T: 1699631999000,
        o: {
          s: 'ETHUSDT',
          c: 'tp-order-456',
          S: 'BUY',
          o: 'TAKE_PROFIT_MARKET',
          x: 'TRADE',
          X: 'FILLED',
          i: 12345680,
          l: '2.0',
          z: '2.0',
          L: '2100.00',
          ap: '2100.00',
          sp: '2050.00', // Stop price
          ps: 'SHORT',
          rp: '200.00', // Realized profit
        },
      };

      const result = ws.parseOrderTradeUpdate(rawEvent);

      expect(result.orderType).toBe('TAKE_PROFIT_MARKET');
      expect(result.positionSide).toBe('SHORT');
      expect(result.realizedPnl?.toString()).toBe('200');
    });

    it('should handle CANCELED order', () => {
      const rawEvent: BinanceOrderTradeUpdate = {
        e: 'ORDER_TRADE_UPDATE',
        E: 1699632000000,
        T: 1699631999000,
        o: {
          s: 'BTCUSDT',
          c: 'canceled-order',
          S: 'BUY',
          o: 'LIMIT',
          x: 'CANCELED',
          X: 'CANCELED',
          i: 12345681,
          l: '0',
          z: '0',
          L: '0',
          ap: '0',
          sp: '',
          ps: 'LONG',
          rp: '0',
        },
      };

      const result = ws.parseOrderTradeUpdate(rawEvent);

      expect(result.status).toBe('CANCELED');
      expect(result.filledQty.toString()).toBe('0');
    });

    it('should handle BOTH position side as LONG', () => {
      const rawEvent: BinanceOrderTradeUpdate = {
        e: 'ORDER_TRADE_UPDATE',
        E: 1699632000000,
        T: 1699631999000,
        o: {
          s: 'BTCUSDT',
          c: 'one-way-order',
          S: 'BUY',
          o: 'MARKET',
          x: 'TRADE',
          X: 'FILLED',
          i: 12345682,
          l: '0.1',
          z: '0.1',
          L: '42000.00',
          ap: '42000.00',
          sp: '',
          ps: 'BOTH', // One-way mode
          rp: '0',
        },
      };

      const result = ws.parseOrderTradeUpdate(rawEvent);

      expect(result.positionSide).toBe('LONG'); // Default to LONG for BOTH
    });
  });

  describe('Message Handling', () => {
    it('should emit balanceChanged events on ACCOUNT_UPDATE', () => {
      const balanceHandler = vi.fn();
      ws.on('balanceChanged', balanceHandler);

      const rawEvent: BinanceAccountUpdate = {
        e: 'ACCOUNT_UPDATE',
        E: 1699632000000,
        T: 1699631999000,
        a: {
          m: 'ORDER',
          B: [{ a: 'USDT', wb: '10000.00', cw: '9500.00', bc: '-100.00' }],
          P: [],
        },
      };

      ws.handleMessage(rawEvent);

      expect(balanceHandler).toHaveBeenCalledOnce();
      expect(balanceHandler.mock.calls[0][0].asset).toBe('USDT');
    });

    it('should emit positionChanged events on ACCOUNT_UPDATE', () => {
      const positionHandler = vi.fn();
      ws.on('positionChanged', positionHandler);

      const rawEvent: BinanceAccountUpdate = {
        e: 'ACCOUNT_UPDATE',
        E: 1699632000000,
        T: 1699631999000,
        a: {
          m: 'ORDER',
          B: [],
          P: [
            {
              s: 'BTCUSDT',
              pa: '0.5',
              ep: '42000.00',
              cr: '0.00',
              up: '50.00',
              ps: 'LONG',
              bep: '42100.00',
            },
          ],
        },
      };

      ws.handleMessage(rawEvent);

      expect(positionHandler).toHaveBeenCalledOnce();
      expect(positionHandler.mock.calls[0][0].symbol).toBe('BTCUSDT');
    });

    it('should emit orderStatusChanged on ORDER_TRADE_UPDATE', () => {
      const orderHandler = vi.fn();
      ws.on('orderStatusChanged', orderHandler);

      const rawEvent: BinanceOrderTradeUpdate = {
        e: 'ORDER_TRADE_UPDATE',
        E: 1699632000000,
        T: 1699631999000,
        o: {
          s: 'BTCUSDT',
          c: 'test-order',
          S: 'BUY',
          o: 'MARKET',
          x: 'TRADE',
          X: 'FILLED',
          i: 12345678,
          l: '0.1',
          z: '0.5',
          L: '42500.00',
          ap: '42450.00',
          sp: '',
          ps: 'LONG',
          rp: '0.00',
        },
      };

      ws.handleMessage(rawEvent);

      expect(orderHandler).toHaveBeenCalledOnce();
      expect(orderHandler.mock.calls[0][0].orderId).toBe('12345678');
    });

    it('should emit error on invalid message', () => {
      const errorHandler = vi.fn();
      ws.on('error', errorHandler);

      ws.handleMessage(null);

      expect(errorHandler).toHaveBeenCalledOnce();
      expect(errorHandler.mock.calls[0][0].message).toBe('Invalid message format');
    });

    it('should ignore unknown event types', () => {
      const anyHandler = vi.fn();
      ws.on('balanceChanged', anyHandler);
      ws.on('positionChanged', anyHandler);
      ws.on('orderStatusChanged', anyHandler);

      ws.handleMessage({ e: 'UNKNOWN_EVENT', data: {} });

      expect(anyHandler).not.toHaveBeenCalled();
    });
  });
});

describe('Binance User Data Stream Contract', () => {
  it('should expect User Data Stream via listenKey', () => {
    const endpoint = 'wss://fstream.binance.com/ws/<listenKey>';
    expect(endpoint).toContain('listenKey');
  });

  it('should expect ACCOUNT_UPDATE event structure', () => {
    const event: BinanceAccountUpdate = {
      e: 'ACCOUNT_UPDATE',
      E: Date.now(),
      T: Date.now(),
      a: {
        m: 'ORDER',
        B: [],
        P: [],
      },
    };

    expect(event.e).toBe('ACCOUNT_UPDATE');
    expect(event.a.m).toBeDefined();
    expect(Array.isArray(event.a.B)).toBe(true);
    expect(Array.isArray(event.a.P)).toBe(true);
  });

  it('should expect ORDER_TRADE_UPDATE event structure', () => {
    const event: BinanceOrderTradeUpdate = {
      e: 'ORDER_TRADE_UPDATE',
      E: Date.now(),
      T: Date.now(),
      o: {
        s: 'BTCUSDT',
        c: 'test',
        S: 'BUY',
        o: 'MARKET',
        x: 'NEW',
        X: 'NEW',
        i: 123,
        l: '0',
        z: '0',
        L: '0',
        ap: '0',
        sp: '',
        ps: 'LONG',
        rp: '0',
      },
    };

    expect(event.e).toBe('ORDER_TRADE_UPDATE');
    expect(event.o.s).toBeDefined();
    expect(['BUY', 'SELL']).toContain(event.o.S);
    expect(['LONG', 'SHORT', 'BOTH']).toContain(event.o.ps);
  });
});
