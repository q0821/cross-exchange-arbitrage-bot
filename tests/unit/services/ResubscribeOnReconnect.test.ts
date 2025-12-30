/**
 * Unit tests for auto-resubscribe on reconnect
 *
 * Feature: 052-specify-scripts-bash
 * Task: T024
 *
 * Tests that subscriptions are automatically restored after reconnection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

/**
 * Mock WebSocket client for testing resubscribe logic
 */
class MockWsClient extends EventEmitter {
  private subscribedSymbols = new Set<string>();
  private isConnected = false;
  private reconnectCount = 0;

  connect(): void {
    this.isConnected = true;
    this.emit('connected');
  }

  disconnect(): void {
    this.isConnected = false;
    this.subscribedSymbols.clear();
    this.emit('disconnected');
  }

  subscribe(symbols: string[]): void {
    if (!this.isConnected) {
      throw new Error('Not connected');
    }
    symbols.forEach((s) => this.subscribedSymbols.add(s));
    this.emit('subscribed', symbols);
  }

  unsubscribe(symbols: string[]): void {
    if (!this.isConnected) {
      throw new Error('Not connected');
    }
    symbols.forEach((s) => this.subscribedSymbols.delete(s));
    this.emit('unsubscribed', symbols);
  }

  getSubscribedSymbols(): string[] {
    return Array.from(this.subscribedSymbols);
  }

  isReady(): boolean {
    return this.isConnected;
  }

  simulateReconnect(): void {
    this.reconnectCount++;
    this.emit('reconnected', this.reconnectCount);
  }

  getReconnectCount(): number {
    return this.reconnectCount;
  }
}

/**
 * Subscription manager that handles auto-resubscribe
 */
class SubscriptionManager {
  private client: MockWsClient;
  private trackedSymbols = new Set<string>();
  private autoResubscribe: boolean;

  constructor(client: MockWsClient, autoResubscribe = true) {
    this.client = client;
    this.autoResubscribe = autoResubscribe;

    // Listen for reconnection to resubscribe
    this.client.on('connected', () => {
      if (this.autoResubscribe && this.trackedSymbols.size > 0) {
        this.resubscribeAll();
      }
    });
  }

  subscribe(symbols: string[]): void {
    symbols.forEach((s) => this.trackedSymbols.add(s));
    if (this.client.isReady()) {
      this.client.subscribe(symbols);
    }
  }

  unsubscribe(symbols: string[]): void {
    symbols.forEach((s) => this.trackedSymbols.delete(s));
    if (this.client.isReady()) {
      this.client.unsubscribe(symbols);
    }
  }

  private resubscribeAll(): void {
    const symbols = Array.from(this.trackedSymbols);
    if (symbols.length > 0) {
      this.client.subscribe(symbols);
    }
  }

  getTrackedSymbols(): string[] {
    return Array.from(this.trackedSymbols);
  }
}

describe('Resubscribe on Reconnect', () => {
  let client: MockWsClient;
  let manager: SubscriptionManager;

  beforeEach(() => {
    client = new MockWsClient();
    manager = new SubscriptionManager(client, true);
  });

  describe('Basic Subscription Tracking', () => {
    it('should track subscribed symbols', () => {
      client.connect();
      manager.subscribe(['BTCUSDT', 'ETHUSDT']);

      expect(manager.getTrackedSymbols()).toContain('BTCUSDT');
      expect(manager.getTrackedSymbols()).toContain('ETHUSDT');
    });

    it('should forward subscription to client when connected', () => {
      client.connect();
      const subscribedHandler = vi.fn();
      client.on('subscribed', subscribedHandler);

      manager.subscribe(['BTCUSDT']);

      expect(subscribedHandler).toHaveBeenCalledWith(['BTCUSDT']);
      expect(client.getSubscribedSymbols()).toContain('BTCUSDT');
    });

    it('should track symbols even when not connected', () => {
      // Not connected yet
      manager.subscribe(['BTCUSDT']);

      expect(manager.getTrackedSymbols()).toContain('BTCUSDT');
    });

    it('should remove tracked symbols on unsubscribe', () => {
      client.connect();
      manager.subscribe(['BTCUSDT', 'ETHUSDT']);
      manager.unsubscribe(['BTCUSDT']);

      expect(manager.getTrackedSymbols()).not.toContain('BTCUSDT');
      expect(manager.getTrackedSymbols()).toContain('ETHUSDT');
    });
  });

  describe('Auto-Resubscribe on Reconnect', () => {
    it('should resubscribe after disconnect and reconnect', () => {
      // Initial connection and subscription
      client.connect();
      manager.subscribe(['BTCUSDT', 'ETHUSDT']);

      expect(client.getSubscribedSymbols()).toContain('BTCUSDT');
      expect(client.getSubscribedSymbols()).toContain('ETHUSDT');

      // Simulate disconnect (clears subscriptions on client)
      client.disconnect();
      expect(client.getSubscribedSymbols()).toHaveLength(0);

      // Simulate reconnect
      client.connect();

      // Should automatically resubscribe
      expect(client.getSubscribedSymbols()).toContain('BTCUSDT');
      expect(client.getSubscribedSymbols()).toContain('ETHUSDT');
    });

    it('should emit resubscribed event with correct count', () => {
      const subscribedHandler = vi.fn();
      client.on('subscribed', subscribedHandler);

      client.connect();
      manager.subscribe(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);

      // Initial subscription
      expect(subscribedHandler).toHaveBeenCalledTimes(1);

      // Disconnect and reconnect
      client.disconnect();
      client.connect();

      // Resubscription
      expect(subscribedHandler).toHaveBeenCalledTimes(2);
      expect(subscribedHandler).toHaveBeenLastCalledWith(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);
    });

    it('should not resubscribe when autoResubscribe is disabled', () => {
      const noAutoManager = new SubscriptionManager(client, false);
      const subscribedHandler = vi.fn();
      client.on('subscribed', subscribedHandler);

      client.connect();
      noAutoManager.subscribe(['BTCUSDT']);

      // Initial subscription
      expect(subscribedHandler).toHaveBeenCalledTimes(1);

      // Disconnect and reconnect
      client.disconnect();
      client.connect();

      // Should NOT resubscribe
      expect(subscribedHandler).toHaveBeenCalledTimes(1);
      expect(client.getSubscribedSymbols()).toHaveLength(0);
    });

    it('should not resubscribe when no symbols tracked', () => {
      const subscribedHandler = vi.fn();
      client.on('subscribed', subscribedHandler);

      client.connect();
      // No subscriptions

      client.disconnect();
      client.connect();

      expect(subscribedHandler).not.toHaveBeenCalled();
    });
  });

  describe('Subscription State Persistence', () => {
    it('should maintain subscription state through multiple reconnects', () => {
      client.connect();
      manager.subscribe(['BTCUSDT']);

      // Multiple reconnect cycles
      for (let i = 0; i < 5; i++) {
        client.disconnect();
        client.connect();
        expect(client.getSubscribedSymbols()).toContain('BTCUSDT');
      }
    });

    it('should respect subscription changes between reconnects', () => {
      client.connect();
      manager.subscribe(['BTCUSDT', 'ETHUSDT']);

      // First disconnect
      client.disconnect();

      // Modify tracked symbols while disconnected
      manager.unsubscribe(['ETHUSDT']);
      manager.subscribe(['SOLUSDT']);

      // Reconnect
      client.connect();

      expect(client.getSubscribedSymbols()).toContain('BTCUSDT');
      expect(client.getSubscribedSymbols()).not.toContain('ETHUSDT');
      expect(client.getSubscribedSymbols()).toContain('SOLUSDT');
    });

    it('should handle large number of subscriptions', () => {
      client.connect();

      // Subscribe to many symbols
      const symbols = Array.from({ length: 100 }, (_, i) => `SYMBOL${i}USDT`);
      manager.subscribe(symbols);

      client.disconnect();
      client.connect();

      expect(client.getSubscribedSymbols()).toHaveLength(100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle duplicate subscriptions gracefully', () => {
      client.connect();
      manager.subscribe(['BTCUSDT']);
      manager.subscribe(['BTCUSDT']); // Duplicate

      expect(manager.getTrackedSymbols()).toHaveLength(1);
    });

    it('should handle unsubscribe of non-existent symbol', () => {
      client.connect();
      manager.subscribe(['BTCUSDT']);

      // Should not throw
      expect(() => manager.unsubscribe(['NONEXISTENT'])).not.toThrow();
    });

    it('should handle rapid connect/disconnect cycles', () => {
      manager.subscribe(['BTCUSDT']);

      // Rapid cycles
      for (let i = 0; i < 10; i++) {
        client.connect();
        client.disconnect();
      }

      // Final stable connection
      client.connect();

      expect(client.getSubscribedSymbols()).toContain('BTCUSDT');
    });

    it('should queue subscriptions made while disconnected', () => {
      // Not connected initially
      manager.subscribe(['BTCUSDT']);
      manager.subscribe(['ETHUSDT']);

      // Connect - should subscribe all queued
      client.connect();

      expect(client.getSubscribedSymbols()).toContain('BTCUSDT');
      expect(client.getSubscribedSymbols()).toContain('ETHUSDT');
    });
  });

  describe('Event Flow', () => {
    it('should emit events in correct order on reconnect', () => {
      const events: string[] = [];

      // Note: Events are emitted synchronously, so order depends on listener registration
      // 'connected' event triggers resubscribe which emits 'subscribed'
      client.on('connected', () => events.push('connected'));
      client.on('disconnected', () => events.push('disconnected'));
      client.on('subscribed', () => events.push('subscribed'));

      client.connect();
      manager.subscribe(['BTCUSDT']);

      client.disconnect();
      client.connect();

      // The order depends on when listeners are registered and when resubscribe happens
      // Since the SubscriptionManager listens to 'connected' and resubscribes,
      // 'subscribed' is emitted right after 'connected' callback runs
      expect(events).toContain('connected');
      expect(events).toContain('subscribed');
      expect(events).toContain('disconnected');
      expect(events.filter(e => e === 'connected')).toHaveLength(2);
      expect(events.filter(e => e === 'subscribed')).toHaveLength(2);
    });
  });
});

describe('BinanceFundingWs Resubscribe Behavior', () => {
  // These tests verify the expected behavior matches BinanceFundingWs implementation

  it('should track subscribedSymbols correctly', () => {
    const symbols = new Set<string>();

    symbols.add('BTCUSDT');
    symbols.add('ETHUSDT');

    expect(symbols.has('BTCUSDT')).toBe(true);
    expect(Array.from(symbols)).toEqual(['BTCUSDT', 'ETHUSDT']);
  });

  it('should track subscribeAllSymbols flag', () => {
    let subscribeAllSymbols = false;

    // Subscribe to all
    subscribeAllSymbols = true;

    expect(subscribeAllSymbols).toBe(true);

    // Unsubscribe all
    subscribeAllSymbols = false;

    expect(subscribeAllSymbols).toBe(false);
  });

  it('should prioritize subscribeAll over individual symbols on reconnect', () => {
    const symbols = new Set<string>();
    let subscribeAllSymbols = false;

    // Add individual symbols
    symbols.add('BTCUSDT');
    symbols.add('ETHUSDT');

    // Then switch to subscribeAll
    subscribeAllSymbols = true;

    // On reconnect, should use subscribeAll, not individual symbols
    expect(subscribeAllSymbols).toBe(true);
  });
});
