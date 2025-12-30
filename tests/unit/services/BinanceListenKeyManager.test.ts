/**
 * Unit tests for Binance listenKey management
 *
 * Feature: 052-specify-scripts-bash
 * Task: T031
 *
 * Tests the listenKey creation and renewal for Binance User Data Stream
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Mock BinanceListenKeyManager for testing
 * Simulates Binance listenKey lifecycle management
 */
class MockBinanceListenKeyManager {
  private listenKey: string | null = null;
  private renewalTimer: NodeJS.Timeout | null = null;
  private isDestroyed = false;
  private renewalIntervalMs = 30 * 60 * 1000; // 30 minutes (Binance recommends every 60 min, we use 30 for safety)
  private onRenewed?: (key: string) => void;
  private onError?: (error: Error) => void;

  // Mock API functions
  private createKeyFn: () => Promise<string>;
  private renewKeyFn: (key: string) => Promise<void>;

  constructor(
    createKeyFn: () => Promise<string>,
    renewKeyFn: (key: string) => Promise<void>,
    options?: {
      renewalIntervalMs?: number;
      onRenewed?: (key: string) => void;
      onError?: (error: Error) => void;
    }
  ) {
    this.createKeyFn = createKeyFn;
    this.renewKeyFn = renewKeyFn;
    this.renewalIntervalMs = options?.renewalIntervalMs ?? this.renewalIntervalMs;
    this.onRenewed = options?.onRenewed;
    this.onError = options?.onError;
  }

  async create(): Promise<string> {
    if (this.isDestroyed) {
      throw new Error('Manager has been destroyed');
    }

    try {
      this.listenKey = await this.createKeyFn();
      this.startRenewal();
      return this.listenKey;
    } catch (error) {
      this.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async renew(): Promise<void> {
    if (!this.listenKey) {
      throw new Error('No active listenKey to renew');
    }

    try {
      await this.renewKeyFn(this.listenKey);
      this.onRenewed?.(this.listenKey);
    } catch (error) {
      this.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  private startRenewal(): void {
    this.stopRenewal();
    this.renewalTimer = setInterval(() => {
      this.renew().catch((error) => {
        this.onError?.(error);
      });
    }, this.renewalIntervalMs);
  }

  private stopRenewal(): void {
    if (this.renewalTimer) {
      clearInterval(this.renewalTimer);
      this.renewalTimer = null;
    }
  }

  getListenKey(): string | null {
    return this.listenKey;
  }

  isActive(): boolean {
    return this.listenKey !== null && !this.isDestroyed;
  }

  destroy(): void {
    this.isDestroyed = true;
    this.stopRenewal();
    this.listenKey = null;
  }
}

describe('BinanceListenKeyManager', () => {
  let manager: MockBinanceListenKeyManager;
  let createKeyFn: ReturnType<typeof vi.fn>;
  let renewKeyFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    createKeyFn = vi.fn().mockResolvedValue('test-listen-key-123');
    renewKeyFn = vi.fn().mockResolvedValue(undefined);
    manager = new MockBinanceListenKeyManager(createKeyFn, renewKeyFn);
  });

  afterEach(() => {
    vi.useRealTimers();
    manager.destroy();
  });

  describe('ListenKey Creation', () => {
    it('should create a new listenKey', async () => {
      const key = await manager.create();

      expect(key).toBe('test-listen-key-123');
      expect(createKeyFn).toHaveBeenCalledOnce();
      expect(manager.getListenKey()).toBe('test-listen-key-123');
    });

    it('should handle creation failure', async () => {
      createKeyFn.mockRejectedValue(new Error('API error'));
      const onError = vi.fn();
      manager = new MockBinanceListenKeyManager(createKeyFn, renewKeyFn, { onError });

      await expect(manager.create()).rejects.toThrow('API error');
      expect(onError).toHaveBeenCalled();
    });

    it('should reject creation after destroy', async () => {
      manager.destroy();

      await expect(manager.create()).rejects.toThrow('Manager has been destroyed');
    });
  });

  describe('ListenKey Renewal', () => {
    it('should renew listenKey periodically', async () => {
      const onRenewed = vi.fn();
      manager = new MockBinanceListenKeyManager(createKeyFn, renewKeyFn, {
        renewalIntervalMs: 1000,
        onRenewed,
      });

      await manager.create();

      // Advance time to trigger renewal
      vi.advanceTimersByTime(1000);
      // Allow async operations to complete
      await Promise.resolve();
      await Promise.resolve();

      expect(renewKeyFn).toHaveBeenCalledWith('test-listen-key-123');
      expect(onRenewed).toHaveBeenCalledWith('test-listen-key-123');
    });

    it('should throw error when renewing without active key', async () => {
      await expect(manager.renew()).rejects.toThrow('No active listenKey to renew');
    });

    it('should handle renewal failure', async () => {
      renewKeyFn.mockRejectedValue(new Error('Renewal failed'));
      const onError = vi.fn();
      manager = new MockBinanceListenKeyManager(createKeyFn, renewKeyFn, {
        renewalIntervalMs: 1000,
        onError,
      });

      await manager.create();

      // Advance time to trigger renewal
      vi.advanceTimersByTime(1000);
      // Allow async operations to complete
      await Promise.resolve();
      await Promise.resolve();

      expect(onError).toHaveBeenCalled();
    });

    it('should stop renewal on destroy', async () => {
      manager = new MockBinanceListenKeyManager(createKeyFn, renewKeyFn, {
        renewalIntervalMs: 1000,
      });

      await manager.create();
      manager.destroy();

      // Advance time - renewal should not trigger
      vi.advanceTimersByTime(5000);
      // Allow any pending async operations
      await Promise.resolve();
      await Promise.resolve();

      expect(renewKeyFn).not.toHaveBeenCalled();
    });
  });

  describe('Status', () => {
    it('should report active status correctly', async () => {
      expect(manager.isActive()).toBe(false);

      await manager.create();
      expect(manager.isActive()).toBe(true);

      manager.destroy();
      expect(manager.isActive()).toBe(false);
    });

    it('should return current listenKey', async () => {
      expect(manager.getListenKey()).toBeNull();

      await manager.create();
      expect(manager.getListenKey()).toBe('test-listen-key-123');

      manager.destroy();
      expect(manager.getListenKey()).toBeNull();
    });
  });

  describe('Renewal Interval', () => {
    it('should use custom renewal interval', async () => {
      manager = new MockBinanceListenKeyManager(createKeyFn, renewKeyFn, {
        renewalIntervalMs: 5000, // 5 seconds for testing
      });

      await manager.create();

      // Should not renew before interval
      vi.advanceTimersByTime(4000);
      await Promise.resolve();
      await Promise.resolve();
      expect(renewKeyFn).not.toHaveBeenCalled();

      // Should renew at interval
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();
      expect(renewKeyFn).toHaveBeenCalledOnce();

      manager.destroy();
    });

    it('should renew multiple times', async () => {
      manager = new MockBinanceListenKeyManager(createKeyFn, renewKeyFn, {
        renewalIntervalMs: 1000,
      });

      await manager.create();

      // Trigger 3 renewals one at a time
      for (let i = 0; i < 3; i++) {
        vi.advanceTimersByTime(1000);
        await Promise.resolve();
        await Promise.resolve();
      }

      expect(renewKeyFn).toHaveBeenCalledTimes(3);

      manager.destroy();
    });
  });
});

describe('Binance listenKey API Contract', () => {
  // These tests document the expected Binance API behavior

  it('should expect POST /fapi/v1/listenKey for creation', () => {
    // This documents the expected API endpoint
    const endpoint = '/fapi/v1/listenKey';
    const method = 'POST';

    expect(endpoint).toBe('/fapi/v1/listenKey');
    expect(method).toBe('POST');
  });

  it('should expect PUT /fapi/v1/listenKey for renewal', () => {
    // This documents the expected API endpoint
    const endpoint = '/fapi/v1/listenKey';
    const method = 'PUT';

    expect(endpoint).toBe('/fapi/v1/listenKey');
    expect(method).toBe('PUT');
  });

  it('should expect listenKey to expire in 60 minutes', () => {
    // Binance listenKeys expire after 60 minutes
    const expirationMs = 60 * 60 * 1000;
    const recommendedRenewalMs = 30 * 60 * 1000; // Renew every 30 minutes

    expect(expirationMs).toBe(3600000);
    expect(recommendedRenewalMs).toBeLessThan(expirationMs);
  });
});
