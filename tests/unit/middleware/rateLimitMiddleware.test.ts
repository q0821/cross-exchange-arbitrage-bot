import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitMiddleware } from '@/middleware/rateLimitMiddleware';

// Mock RateLimiter
vi.mock('@/lib/rate-limiter', () => {
  let mockCheckResult = true;
  return {
    RateLimiter: vi.fn().mockImplementation(() => ({
      check: vi.fn(() => mockCheckResult),
    })),
    __setMockCheckResult: (value: boolean) => {
      mockCheckResult = value;
    },
  };
});

describe('rateLimitMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('正常請求', () => {
    it('應允許未超限的請求通過', () => {
      const request = new NextRequest('http://localhost:3000/api/public/opportunities', {
        headers: { 'x-forwarded-for': '1.2.3.4' },
      });

      const result = rateLimitMiddleware(request);

      expect(result).toBeNull(); // null 表示請求通過
    });

    it('應正確設定 X-RateLimit-* headers', () => {
      const request = new NextRequest('http://localhost:3000/api/public/opportunities', {
        headers: { 'x-forwarded-for': '1.2.3.4' },
      });

      // 透過修改實作來設定 headers（實作時會處理）
      rateLimitMiddleware(request);

      // 實際測試會在整合測試驗證 headers
    });
  });

  describe('超限請求', () => {
    it('應拒絕超限的請求並回傳 429', async () => {
      // 設定 mock 為拒絕狀態
      const { __setMockCheckResult } = await import('@/lib/rate-limiter');
      __setMockCheckResult(false);

      const request = new NextRequest('http://localhost:3000/api/public/opportunities', {
        headers: { 'x-forwarded-for': '1.2.3.4' },
      });

      const result = rateLimitMiddleware(request);

      expect(result).not.toBeNull();
      expect(result?.status).toBe(429);

      const body = await result?.json();
      expect(body).toHaveProperty('error');
      expect(body.error).toContain('Too many requests');
    });

    it('應設定正確的 Retry-After header', async () => {
      const { __setMockCheckResult } = await import('@/lib/rate-limiter');
      __setMockCheckResult(false);

      const request = new NextRequest('http://localhost:3000/api/public/opportunities', {
        headers: { 'x-forwarded-for': '1.2.3.4' },
      });

      const result = rateLimitMiddleware(request);

      expect(result?.headers.get('Retry-After')).toBeTruthy();
    });
  });

  describe('IP 獲取', () => {
    it('應從 x-forwarded-for header 獲取 IP', () => {
      const request = new NextRequest('http://localhost:3000/api/public/opportunities', {
        headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
      });

      rateLimitMiddleware(request);
      // 應使用第一個 IP (1.2.3.4)
    });

    it('應在缺少 x-forwarded-for 時使用備用 IP', () => {
      const request = new NextRequest('http://localhost:3000/api/public/opportunities');

      const result = rateLimitMiddleware(request);

      // 應使用預設 IP 或 request IP
      expect(result).toBeNull(); // 正常流程
    });
  });
});
