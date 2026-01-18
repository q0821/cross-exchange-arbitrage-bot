import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RateLimiter } from '@/lib/rate-limiter';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    // 30 requests per 60 seconds (1 minute)
    rateLimiter = new RateLimiter(30, 60000);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('請求計數', () => {
    it('應正確計算單一 key 的請求次數', () => {
      const key = 'test-ip-1';

      // 前 30 次請求應該通過
      for (let i = 0; i < 30; i++) {
        expect(rateLimiter.check(key)).toBe(true);
      }

      // 第 31 次請求應該被拒絕
      expect(rateLimiter.check(key)).toBe(false);
    });

    it('應獨立追蹤不同 key 的請求', () => {
      const key1 = 'ip-1';
      const key2 = 'ip-2';

      // key1 發送 30 次請求
      for (let i = 0; i < 30; i++) {
        expect(rateLimiter.check(key1)).toBe(true);
      }

      // key1 被限制
      expect(rateLimiter.check(key1)).toBe(false);

      // key2 仍然可以發送請求
      expect(rateLimiter.check(key2)).toBe(true);
    });
  });

  describe('窗口過期', () => {
    it('應在窗口過期後重置計數', () => {
      const key = 'test-ip';

      // 發送 30 次請求（達到上限）
      for (let i = 0; i < 30; i++) {
        expect(rateLimiter.check(key)).toBe(true);
      }

      // 被限制
      expect(rateLimiter.check(key)).toBe(false);

      // 時間前進 60 秒（窗口過期）
      vi.advanceTimersByTime(60000);

      // 應該重置，再次允許請求
      expect(rateLimiter.check(key)).toBe(true);
    });

    it('應在窗口內累積計數', () => {
      const key = 'test-ip';

      // 發送 15 次請求
      for (let i = 0; i < 15; i++) {
        rateLimiter.check(key);
      }

      // 時間前進 30 秒（窗口未過期）
      vi.advanceTimersByTime(30000);

      // 再發送 15 次請求（總共 30 次）
      for (let i = 0; i < 15; i++) {
        expect(rateLimiter.check(key)).toBe(true);
      }

      // 第 31 次被拒絕
      expect(rateLimiter.check(key)).toBe(false);
    });
  });

  describe('超過限制', () => {
    it('超過限制時應回傳 false', () => {
      const key = 'test-ip';

      // 發送 30 次請求
      for (let i = 0; i < 30; i++) {
        rateLimiter.check(key);
      }

      // 所有超過限制的請求都應回傳 false
      expect(rateLimiter.check(key)).toBe(false);
      expect(rateLimiter.check(key)).toBe(false);
      expect(rateLimiter.check(key)).toBe(false);
    });
  });

  describe('手動重置', () => {
    it('應允許手動重置特定 key 的計數', () => {
      const key = 'test-ip';

      // 發送 30 次請求（達到上限）
      for (let i = 0; i < 30; i++) {
        rateLimiter.check(key);
      }

      // 被限制
      expect(rateLimiter.check(key)).toBe(false);

      // 手動重置
      rateLimiter.reset(key);

      // 應該允許請求
      expect(rateLimiter.check(key)).toBe(true);
    });
  });
});
