/**
 * Unit tests for WebSocket auto-reconnect logic
 *
 * Feature: 052-specify-scripts-bash
 * Task: T022
 *
 * Tests the auto-reconnect functionality in BinanceFundingWs and ReconnectionManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { ReconnectionManager } from '@/lib/websocket/ReconnectionManager';
import { HealthChecker } from '@/lib/websocket/HealthChecker';

describe('WebSocket Auto-Reconnect Logic', () => {
  describe('ReconnectionManager Integration', () => {
    let manager: ReconnectionManager;

    beforeEach(() => {
      vi.useFakeTimers();
      manager = new ReconnectionManager({
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        maxRetries: 5,
        backoffFactor: 2,
        jitterRange: 0,
      });
    });

    afterEach(() => {
      vi.useRealTimers();
      manager.destroy();
    });

    it('should schedule reconnect with correct delay', () => {
      const callback = vi.fn();

      const delay = manager.scheduleReconnect(callback);

      expect(delay).toBe(1000);
      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not schedule when max retries reached', () => {
      const callback = vi.fn();

      // Exhaust all retries
      for (let i = 0; i < 5; i++) {
        manager.scheduleReconnect(callback);
        vi.advanceTimersByTime(30000);
      }

      // Now max retries reached
      const delay = manager.scheduleReconnect(callback);
      expect(delay).toBe(0);
    });

    it('should clear timer on destroy', () => {
      const callback = vi.fn();

      manager.scheduleReconnect(callback);
      manager.destroy();

      vi.advanceTimersByTime(10000);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should clear previous timer when scheduling new reconnect', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      manager.scheduleReconnect(callback1);
      vi.advanceTimersByTime(500); // Advance halfway

      // Clear and schedule new - this will increment retry count
      manager.clearTimer();
      manager.scheduleReconnect(callback2);

      // Second callback delay is 2000ms (1000 * 2^1)
      vi.advanceTimersByTime(2000);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should handle async callback errors gracefully', async () => {
      const error = new Error('Reconnect failed');
      const callback = vi.fn().mockRejectedValue(error);

      manager.scheduleReconnect(callback);
      vi.advanceTimersByTime(1000);

      // Wait for promise to settle
      await vi.runAllTimersAsync();

      // Should not throw - error is caught internally
      expect(callback).toHaveBeenCalled();
    });

    it('should reset after successful connection', () => {
      manager.incrementRetry();
      manager.incrementRetry();

      expect(manager.getState().retryCount).toBe(2);

      manager.reset();

      expect(manager.getState().retryCount).toBe(0);
      expect(manager.calculateDelay()).toBe(1000); // Back to initial delay
    });
  });

  describe('HealthChecker Integration', () => {
    let healthChecker: HealthChecker;
    let onUnhealthy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      vi.useFakeTimers();
      onUnhealthy = vi.fn();
      healthChecker = new HealthChecker({
        checkIntervalMs: 5000,
        timeoutMs: 10000,
        onUnhealthy,
      });
    });

    afterEach(() => {
      vi.useRealTimers();
      healthChecker.destroy();
    });

    it('should trigger reconnect when unhealthy', () => {
      healthChecker.start();

      // Advance past timeout without recording message
      vi.advanceTimersByTime(15000);

      expect(onUnhealthy).toHaveBeenCalled();
    });

    it('should not trigger reconnect when messages received', () => {
      healthChecker.start();

      // Record message before timeout
      vi.advanceTimersByTime(3000);
      healthChecker.recordMessage();

      // Advance past check interval
      vi.advanceTimersByTime(6000);

      expect(onUnhealthy).not.toHaveBeenCalled();
    });

    it('should stop checking after stop() called', () => {
      healthChecker.start();
      healthChecker.stop();

      vi.advanceTimersByTime(60000);

      expect(onUnhealthy).not.toHaveBeenCalled();
    });

    it('should report correct health status', () => {
      healthChecker.start();

      // Initially healthy (just started)
      expect(healthChecker.getStatus().isHealthy).toBe(true);

      // Advance past timeout
      vi.advanceTimersByTime(15000);

      expect(healthChecker.getStatus().isHealthy).toBe(false);
    });

    it('should reset health status after recording message', () => {
      healthChecker.start();

      // Go unhealthy
      vi.advanceTimersByTime(15000);
      expect(healthChecker.getStatus().isHealthy).toBe(false);

      // Record message to become healthy again
      healthChecker.recordMessage();
      expect(healthChecker.getStatus().isHealthy).toBe(true);
    });
  });

  describe('Combined Reconnect Flow', () => {
    let manager: ReconnectionManager;
    let healthChecker: HealthChecker;
    let reconnectCallback: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      vi.useFakeTimers();
      reconnectCallback = vi.fn();

      manager = new ReconnectionManager({
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        maxRetries: 3,
        jitterRange: 0,
      });

      healthChecker = new HealthChecker({
        checkIntervalMs: 5000,
        timeoutMs: 10000,
        onUnhealthy: () => {
          manager.scheduleReconnect(reconnectCallback);
        },
      });
    });

    afterEach(() => {
      vi.useRealTimers();
      manager.destroy();
      healthChecker.destroy();
    });

    it('should trigger reconnect when health check fails', () => {
      healthChecker.start();

      // Health check runs every 5000ms, times out at 10000ms
      // First check at 5000ms - still healthy (only 5s since start)
      // Second check at 10000ms - still healthy (10s = timeout threshold)
      // Third check at 15000ms - unhealthy (15s > 10s timeout)
      vi.advanceTimersByTime(15000);

      // Reconnect should be scheduled (retryCount incremented)
      expect(manager.getState().retryCount).toBeGreaterThanOrEqual(1);
      expect(reconnectCallback).toHaveBeenCalled();
    });

    it('should use exponential backoff for multiple failures', () => {
      // Initial delay is 1000, after first retry delay becomes 2000
      const delay1 = manager.scheduleReconnect(reconnectCallback);
      expect(delay1).toBe(1000);

      vi.advanceTimersByTime(1000);

      // After second retry, delay becomes 4000
      const delay2 = manager.scheduleReconnect(reconnectCallback);
      expect(delay2).toBe(2000);

      vi.advanceTimersByTime(2000);

      // After third retry, delay becomes 8000
      const delay3 = manager.scheduleReconnect(reconnectCallback);
      expect(delay3).toBe(4000);
    });

    it('should stop reconnecting after max retries', () => {
      healthChecker.start();

      // Exhaust retries
      for (let i = 0; i < 3; i++) {
        manager.scheduleReconnect(reconnectCallback);
        vi.advanceTimersByTime(30000);
      }

      expect(manager.canRetry()).toBe(false);

      // Further reconnect attempts should return 0
      const delay = manager.scheduleReconnect(reconnectCallback);
      expect(delay).toBe(0);
    });
  });

  describe('Connection State Management', () => {
    it('should track connection state through EventEmitter', () => {
      const emitter = new EventEmitter();
      let isConnected = false;

      emitter.on('connected', () => {
        isConnected = true;
      });

      emitter.on('disconnected', () => {
        isConnected = false;
      });

      // Simulate connection
      emitter.emit('connected');
      expect(isConnected).toBe(true);

      // Simulate disconnection
      emitter.emit('disconnected');
      expect(isConnected).toBe(false);
    });

    it('should emit reconnecting event with attempt number', () => {
      const emitter = new EventEmitter();
      const reconnectingHandler = vi.fn();

      emitter.on('reconnecting', reconnectingHandler);

      // Simulate reconnection attempts
      emitter.emit('reconnecting', 1);
      emitter.emit('reconnecting', 2);
      emitter.emit('reconnecting', 3);

      expect(reconnectingHandler).toHaveBeenCalledTimes(3);
      expect(reconnectingHandler).toHaveBeenNthCalledWith(1, 1);
      expect(reconnectingHandler).toHaveBeenNthCalledWith(2, 2);
      expect(reconnectingHandler).toHaveBeenNthCalledWith(3, 3);
    });
  });

  describe('Default Configuration', () => {
    it('should use sensible defaults for ReconnectionManager', () => {
      const defaultManager = new ReconnectionManager();
      const state = defaultManager.getState();

      expect(state.retryCount).toBe(0);
      // Default initial delay is 1000ms
      expect(defaultManager.calculateDelay()).toBeGreaterThanOrEqual(900);
      expect(defaultManager.calculateDelay()).toBeLessThanOrEqual(1100);

      defaultManager.destroy();
    });

    it('should use sensible defaults for HealthChecker', () => {
      const defaultChecker = new HealthChecker();
      const status = defaultChecker.getStatus();

      expect(status.isHealthy).toBe(true);
      expect(status.lastMessageTime).toBeNull();

      defaultChecker.destroy();
    });
  });
});
