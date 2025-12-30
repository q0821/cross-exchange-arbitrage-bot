/**
 * Unit tests for exponential backoff algorithm
 *
 * Feature: 052-specify-scripts-bash
 * Task: T023
 *
 * Tests the ReconnectionManager's exponential backoff and jitter implementation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReconnectionManager } from '@/lib/websocket/ReconnectionManager';

describe('Exponential Backoff Algorithm', () => {
  let manager: ReconnectionManager;

  beforeEach(() => {
    manager = new ReconnectionManager({
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      maxRetries: 10,
      backoffFactor: 2,
      jitterRange: 0, // Disable jitter for deterministic tests
    });
  });

  describe('Basic Delay Calculation', () => {
    it('should calculate initial delay correctly', () => {
      // With jitter = 0, delay should be exactly initialDelayMs
      const delay = manager.calculateDelay();
      expect(delay).toBe(1000);
    });

    it('should double delay after first retry', () => {
      manager.incrementRetry();
      const delay = manager.calculateDelay();
      // 1000 * 2^1 = 2000
      expect(delay).toBe(2000);
    });

    it('should quadruple delay after second retry', () => {
      manager.incrementRetry();
      manager.incrementRetry();
      const delay = manager.calculateDelay();
      // 1000 * 2^2 = 4000
      expect(delay).toBe(4000);
    });

    it('should respect max delay cap', () => {
      // After 5 retries: 1000 * 2^5 = 32000, but max is 30000
      for (let i = 0; i < 5; i++) {
        manager.incrementRetry();
      }
      const delay = manager.calculateDelay();
      expect(delay).toBe(30000);
    });

    it('should not exceed max delay even after many retries', () => {
      for (let i = 0; i < 100; i++) {
        manager.incrementRetry();
      }
      const delay = manager.calculateDelay();
      expect(delay).toBe(30000);
    });
  });

  describe('Jitter', () => {
    it('should add jitter within expected range', () => {
      const managerWithJitter = new ReconnectionManager({
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        maxRetries: 10,
        backoffFactor: 2,
        jitterRange: 0.1, // ±10%
      });

      const delays = new Set<number>();
      // Calculate delay multiple times to verify jitter creates variation
      for (let i = 0; i < 10; i++) {
        delays.add(managerWithJitter.calculateDelay());
      }

      // With jitter, we should see different delays
      // Base delay is 1000, with ±10% jitter, range is 900-1100
      for (const delay of delays) {
        expect(delay).toBeGreaterThanOrEqual(900);
        expect(delay).toBeLessThanOrEqual(1100);
      }
    });

    it('should apply jitter to exponential delay', () => {
      const managerWithJitter = new ReconnectionManager({
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        maxRetries: 10,
        backoffFactor: 2,
        jitterRange: 0.2, // ±20%
      });

      managerWithJitter.incrementRetry();
      managerWithJitter.incrementRetry();
      // Base delay is 4000 (1000 * 2^2), with ±20% jitter, range is 3200-4800

      const delay = managerWithJitter.calculateDelay();
      expect(delay).toBeGreaterThanOrEqual(3200);
      expect(delay).toBeLessThanOrEqual(4800);
    });
  });

  describe('Custom Backoff Factor', () => {
    it('should work with backoff factor 1.5', () => {
      const customManager = new ReconnectionManager({
        initialDelayMs: 1000,
        maxDelayMs: 100000,
        maxRetries: 10,
        backoffFactor: 1.5,
        jitterRange: 0,
      });

      // Initial: 1000
      expect(customManager.calculateDelay()).toBe(1000);

      // After 1 retry: 1000 * 1.5 = 1500
      customManager.incrementRetry();
      expect(customManager.calculateDelay()).toBe(1500);

      // After 2 retries: 1000 * 1.5^2 = 2250
      customManager.incrementRetry();
      expect(customManager.calculateDelay()).toBe(2250);
    });

    it('should work with backoff factor 3', () => {
      const customManager = new ReconnectionManager({
        initialDelayMs: 1000,
        maxDelayMs: 100000,
        maxRetries: 10,
        backoffFactor: 3,
        jitterRange: 0,
      });

      customManager.incrementRetry();
      customManager.incrementRetry();
      // 1000 * 3^2 = 9000
      expect(customManager.calculateDelay()).toBe(9000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero initial delay', () => {
      const zeroDelayManager = new ReconnectionManager({
        initialDelayMs: 0,
        maxDelayMs: 30000,
        maxRetries: 10,
        backoffFactor: 2,
        jitterRange: 0,
      });

      expect(zeroDelayManager.calculateDelay()).toBe(0);
    });

    it('should handle very small delays', () => {
      const smallDelayManager = new ReconnectionManager({
        initialDelayMs: 1,
        maxDelayMs: 30000,
        maxRetries: 10,
        backoffFactor: 2,
        jitterRange: 0,
      });

      expect(smallDelayManager.calculateDelay()).toBe(1);
      smallDelayManager.incrementRetry();
      expect(smallDelayManager.calculateDelay()).toBe(2);
    });

    it('should handle max delay equal to initial delay', () => {
      const sameDelayManager = new ReconnectionManager({
        initialDelayMs: 1000,
        maxDelayMs: 1000,
        maxRetries: 10,
        backoffFactor: 2,
        jitterRange: 0,
      });

      // All delays should be capped at 1000
      expect(sameDelayManager.calculateDelay()).toBe(1000);
      sameDelayManager.incrementRetry();
      expect(sameDelayManager.calculateDelay()).toBe(1000);
      sameDelayManager.incrementRetry();
      expect(sameDelayManager.calculateDelay()).toBe(1000);
    });
  });

  describe('Delay Sequence', () => {
    it('should follow expected exponential sequence', () => {
      const expectedSequence = [1000, 2000, 4000, 8000, 16000, 30000, 30000];

      expectedSequence.forEach((expected, index) => {
        if (index > 0) {
          manager.incrementRetry();
        }
        expect(manager.calculateDelay()).toBe(expected);
      });
    });
  });

  describe('State Management', () => {
    it('should report correct state', () => {
      const state = manager.getState();
      expect(state.retryCount).toBe(0);
      expect(state.maxRetriesReached).toBe(false);
    });

    it('should track retry count correctly', () => {
      manager.incrementRetry();
      manager.incrementRetry();
      manager.incrementRetry();

      const state = manager.getState();
      expect(state.retryCount).toBe(3);
    });

    it('should detect max retries reached', () => {
      for (let i = 0; i < 10; i++) {
        manager.incrementRetry();
      }

      const state = manager.getState();
      expect(state.maxRetriesReached).toBe(true);
    });

    it('should reset state correctly', () => {
      manager.incrementRetry();
      manager.incrementRetry();
      manager.reset();

      const state = manager.getState();
      expect(state.retryCount).toBe(0);
      expect(state.maxRetriesReached).toBe(false);
    });
  });

  describe('canRetry', () => {
    it('should return true when retries remaining', () => {
      expect(manager.canRetry()).toBe(true);

      manager.incrementRetry();
      expect(manager.canRetry()).toBe(true);
    });

    it('should return false when max retries reached', () => {
      for (let i = 0; i < 10; i++) {
        manager.incrementRetry();
      }
      expect(manager.canRetry()).toBe(false);
    });

    it('should return true always when maxRetries is 0 (unlimited)', () => {
      const unlimitedManager = new ReconnectionManager({
        maxRetries: 0, // Unlimited
      });

      for (let i = 0; i < 100; i++) {
        expect(unlimitedManager.canRetry()).toBe(true);
        unlimitedManager.incrementRetry();
      }
    });
  });
});
