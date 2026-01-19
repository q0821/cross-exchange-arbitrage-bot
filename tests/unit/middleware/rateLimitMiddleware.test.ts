import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

describe('rateLimitMiddleware', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('正常請求', () => {
    it('應允許未超限的請求通過', async () => {
      const { rateLimitMiddleware } = await import('@/middleware/rateLimitMiddleware');

      const request = new NextRequest('http://localhost:3000/api/public/opportunities', {
        headers: { 'x-forwarded-for': '1.2.3.4' },
      });

      const result = rateLimitMiddleware(request);

      expect(result).toBeNull(); // null 表示請求通過
    });
  });

  describe('超限請求', () => {
    it('應拒絕超限的請求並回傳 429', async () => {
      const { rateLimitMiddleware } = await import('@/middleware/rateLimitMiddleware');

      const request = new NextRequest('http://localhost:3000/api/public/opportunities', {
        headers: { 'x-forwarded-for': '1.2.3.5' },
      });

      // 發送 31 次請求（超過 30 的限制）
      let result = null;
      for (let i = 0; i < 31; i++) {
        result = rateLimitMiddleware(request);
      }

      // 最後一次應該被拒絕
      expect(result).not.toBeNull();
      expect(result?.status).toBe(429);

      const body = await result?.json();
      expect(body).toHaveProperty('error');
      expect(body.error).toContain('Too many requests');
    });

    it('應設定正確的 Retry-After header', async () => {
      const { rateLimitMiddleware } = await import('@/middleware/rateLimitMiddleware');

      const request = new NextRequest('http://localhost:3000/api/public/opportunities', {
        headers: { 'x-forwarded-for': '1.2.3.6' },
      });

      // 發送 31 次請求
      let result = null;
      for (let i = 0; i < 31; i++) {
        result = rateLimitMiddleware(request);
      }

      expect(result?.headers.get('Retry-After')).toBe('60');
      expect(result?.headers.get('X-RateLimit-Limit')).toBe('30');
      expect(result?.headers.get('X-RateLimit-Remaining')).toBe('0');
    });
  });

  describe('IP 獲取', () => {
    it('應從 x-forwarded-for header 獲取 IP', async () => {
      const { rateLimitMiddleware } = await import('@/middleware/rateLimitMiddleware');

      const request = new NextRequest('http://localhost:3000/api/public/opportunities', {
        headers: { 'x-forwarded-for': '1.2.3.7, 5.6.7.8' },
      });

      const result = rateLimitMiddleware(request);
      expect(result).toBeNull(); // 正常通過
    });

    it('應在缺少 x-forwarded-for 時使用備用 IP', async () => {
      const { rateLimitMiddleware } = await import('@/middleware/rateLimitMiddleware');

      const request = new NextRequest('http://localhost:3000/api/public/opportunities');

      const result = rateLimitMiddleware(request);

      // 應使用預設 IP 或 request IP
      expect(result).toBeNull(); // 正常流程
    });
  });
});
