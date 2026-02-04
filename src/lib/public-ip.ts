/**
 * 公開 IP 查詢工具
 *
 * @description 使用 ipify API 查詢公開 IP，支援快取和 timeout 處理
 * @feature 071-cli-status-dashboard
 */

import { logger } from './logger';

/** 快取的 IP 資訊 */
interface IpCache {
  ip: string;
  cachedAt: number;
}

/** 快取有效期（毫秒）- 5 分鐘 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** 請求 timeout（毫秒）- 5 秒 */
const REQUEST_TIMEOUT_MS = 5000;

/** ipify API 端點 */
const IPIFY_API_URL = 'https://api.ipify.org?format=json';

/** 備用 API 端點 */
const FALLBACK_API_URL = 'https://icanhazip.com';

/** IP 快取實例 */
let ipCache: IpCache | null = null;

/**
 * 查詢公開 IP 位址
 *
 * @returns 公開 IP 位址，失敗時回傳 null
 */
export async function getPublicIp(): Promise<string | null> {
  // 檢查快取是否有效
  if (ipCache && Date.now() - ipCache.cachedAt < CACHE_TTL_MS) {
    return ipCache.ip;
  }

  // 嘗試主要 API
  const ip = await fetchFromIpify();
  if (ip) {
    ipCache = { ip, cachedAt: Date.now() };
    return ip;
  }

  // 嘗試備用 API
  const fallbackIp = await fetchFromFallback();
  if (fallbackIp) {
    ipCache = { ip: fallbackIp, cachedAt: Date.now() };
    return fallbackIp;
  }

  logger.warn({ context: 'public-ip' }, '無法取得公開 IP');
  return null;
}

/**
 * 從 ipify API 取得 IP
 */
async function fetchFromIpify(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(IPIFY_API_URL, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.debug(
        { context: 'public-ip', status: response.status },
        'ipify API 回應錯誤'
      );
      return null;
    }

    const data = (await response.json()) as { ip: string };
    return data.ip || null;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.debug({ context: 'public-ip' }, 'ipify API 請求 timeout');
    } else {
      logger.debug(
        { context: 'public-ip', error: String(error) },
        'ipify API 請求失敗'
      );
    }
    return null;
  }
}

/**
 * 從備用 API 取得 IP
 */
async function fetchFromFallback(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(FALLBACK_API_URL, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.debug(
        { context: 'public-ip', status: response.status },
        '備用 API 回應錯誤'
      );
      return null;
    }

    const text = await response.text();
    return text.trim() || null;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.debug({ context: 'public-ip' }, '備用 API 請求 timeout');
    } else {
      logger.debug(
        { context: 'public-ip', error: String(error) },
        '備用 API 請求失敗'
      );
    }
    return null;
  }
}

/**
 * 清除快取（主要用於測試）
 */
export function clearPublicIpCache(): void {
  ipCache = null;
}

/**
 * 取得快取資訊（主要用於測試）
 */
export function getPublicIpCacheInfo(): {
  hasCached: boolean;
  cachedAt: number | null;
} {
  return {
    hasCached: ipCache !== null,
    cachedAt: ipCache?.cachedAt ?? null,
  };
}
