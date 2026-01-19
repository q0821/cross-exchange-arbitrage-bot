import { NextRequest, NextResponse } from 'next/server';
import { RateLimiter } from '@/lib/rate-limiter';

// 全域速率限制器實例（30 req/min）
const rateLimiter = new RateLimiter(30, 60 * 1000);

/**
 * 從請求中獲取客戶端 IP
 */
function getClientIp(request: NextRequest): string {
  // 嘗試從 x-forwarded-for header 獲取（通常由 proxy 設定）
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for 可能包含多個 IP，取第一個
    const firstIp = forwardedFor.split(',')[0]?.trim();
    if (firstIp) return firstIp;
  }

  // 嘗試從 x-real-ip header 獲取
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  // Fallback 到 localhost（開發環境）
  return '127.0.0.1';
}

/**
 * 速率限制中間件
 *
 * @param request Next.js 請求物件
 * @returns 如果允許通過則回傳 null，否則回傳 429 回應
 */
export function rateLimitMiddleware(request: NextRequest): NextResponse | null {
  const ip = getClientIp(request);
  const allowed = rateLimiter.check(ip);

  if (!allowed) {
    // 超過限制，回傳 429
    return NextResponse.json(
      {
        error: 'Too many requests. Please try again later.',
      },
      {
        status: 429,
        headers: {
          'Retry-After': '60', // 建議 60 秒後重試
          'X-RateLimit-Limit': '30',
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  // 允許通過
  return null;
}
