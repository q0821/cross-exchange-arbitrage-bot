/**
 * 共享 ProxyAgent 單例模組
 *
 * ProxyAgent 是連接池管理器，可以安全地被多個請求共享。
 * 使用單例模式避免每次 API 請求都創建新的 ProxyAgent，
 * 防止 AssetSnapshot 執行時累積大量 ProxyAgent 實例導致記憶體洩漏。
 *
 * @module shared-proxy-agent
 */

import { ProxyAgent } from 'undici';
import { getProxyUrl } from './env';
import { logger } from './logger';

let sharedProxyAgent: ProxyAgent | null = null;
let isInitialized = false;

/**
 * 取得共享的 ProxyAgent 單例
 *
 * ProxyAgent 是連接池，可以安全地被多個請求共享。
 * 首次呼叫時會根據環境變數 PROXY_URL 創建實例，
 * 後續呼叫會返回相同的實例。
 *
 * @returns ProxyAgent 實例，如果沒有設定 proxy 則返回 null
 */
export function getSharedProxyAgent(): ProxyAgent | null {
  if (isInitialized) {
    return sharedProxyAgent;
  }

  const proxyUrl = getProxyUrl();
  if (proxyUrl) {
    sharedProxyAgent = new ProxyAgent(proxyUrl);
    logger.info({ proxy: proxyUrl }, 'Shared ProxyAgent initialized');
  }

  isInitialized = true;
  return sharedProxyAgent;
}

/**
 * 關閉共享的 ProxyAgent
 *
 * 應該在應用程式關閉時呼叫，釋放連接池資源。
 * 呼叫後，下次 getSharedProxyAgent() 會重新創建實例。
 */
export async function closeSharedProxyAgent(): Promise<void> {
  if (sharedProxyAgent) {
    try {
      await sharedProxyAgent.close();
      logger.info('Shared ProxyAgent closed');
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Error closing shared ProxyAgent (non-blocking)'
      );
    }
    sharedProxyAgent = null;
  }
  isInitialized = false;
}

/**
 * 重置共享 ProxyAgent 狀態（僅供測試使用）
 *
 * @internal
 */
export function resetSharedProxyAgent(): void {
  sharedProxyAgent = null;
  isInitialized = false;
}

/**
 * 檢查是否已初始化（僅供測試使用）
 *
 * @internal
 */
export function isProxyAgentInitialized(): boolean {
  return isInitialized;
}
