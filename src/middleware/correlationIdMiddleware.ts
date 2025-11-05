import { NextRequest, NextResponse } from 'next/server';
import { getOrGenerateCorrelationId } from '@lib/correlationId';

/**
 * Correlation ID 中介軟體
 * 為每個請求產生或提取追蹤 ID
 */

export const CORRELATION_ID_HEADER = 'X-Correlation-Id';

/**
 * 從請求中取得 Correlation ID
 */
export function getCorrelationId(request: NextRequest): string {
  const headers: Record<string, string | string[] | undefined> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return getOrGenerateCorrelationId(headers);
}

/**
 * Correlation ID 中介軟體
 * 在回應 header 中加入 Correlation ID
 */
export function withCorrelationId(
  handler: (request: NextRequest, correlationId: string) => Promise<NextResponse>,
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const correlationId = getCorrelationId(request);

    const response = await handler(request, correlationId);

    // 在回應 header 中加入 Correlation ID
    response.headers.set(CORRELATION_ID_HEADER, correlationId);

    return response;
  };
}

/**
 * 將 Correlation ID 加入 NextResponse
 */
export function addCorrelationIdToResponse(
  response: NextResponse,
  correlationId: string,
): NextResponse {
  response.headers.set(CORRELATION_ID_HEADER, correlationId);
  return response;
}
