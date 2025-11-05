import crypto from 'crypto';

/**
 * Correlation ID 工具
 * 用於追蹤完整的請求鏈
 */

/**
 * 生成唯一的 Correlation ID
 * @returns UUID v4 格式的字串
 */
export function generateCorrelationId(): string {
  return crypto.randomUUID();
}

/**
 * 從 HTTP 請求頭中提取 Correlation ID
 * @param headers HTTP 請求頭
 * @returns Correlation ID 或 null
 */
export function extractCorrelationId(headers: Record<string, string | string[] | undefined>): string | null {
  const correlationId = headers['x-correlation-id'] || headers['X-Correlation-Id'];

  if (Array.isArray(correlationId)) {
    return correlationId[0] || null;
  }

  return correlationId || null;
}

/**
 * 取得或生成 Correlation ID
 * @param headers HTTP 請求頭
 * @returns Correlation ID
 */
export function getOrGenerateCorrelationId(headers: Record<string, string | string[] | undefined>): string {
  return extractCorrelationId(headers) || generateCorrelationId();
}
