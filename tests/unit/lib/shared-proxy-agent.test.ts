import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock 用的變數
let proxyUrlValue: string | null = null;
const mockCloseFn = vi.fn().mockResolvedValue(undefined);

// Mock undici ProxyAgent - 使用 class 形式
vi.mock('undici', () => {
  return {
    ProxyAgent: class MockProxyAgent {
      url: string;
      close = mockCloseFn;
      constructor(url: string) {
        this.url = url;
      }
    },
  };
});

// Mock env module
vi.mock('@/lib/env', () => ({
  getProxyUrl: () => proxyUrlValue,
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  getSharedProxyAgent,
  closeSharedProxyAgent,
  resetSharedProxyAgent,
  isProxyAgentInitialized,
} from '@/lib/shared-proxy-agent';

describe('shared-proxy-agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedProxyAgent();
    proxyUrlValue = null;
    mockCloseFn.mockResolvedValue(undefined);
  });

  afterEach(() => {
    resetSharedProxyAgent();
  });

  describe('getSharedProxyAgent', () => {
    it('當沒有設定 proxy URL 時應該返回 null', () => {
      proxyUrlValue = null;

      const agent = getSharedProxyAgent();

      expect(agent).toBeNull();
      expect(isProxyAgentInitialized()).toBe(true);
    });

    it('當有設定 proxy URL 時應該創建 ProxyAgent', () => {
      proxyUrlValue = 'http://proxy.example.com:8080';

      const agent = getSharedProxyAgent();

      expect(agent).not.toBeNull();
      expect((agent as { url: string }).url).toBe('http://proxy.example.com:8080');
    });

    it('多次呼叫應該返回相同的實例（單例模式）', () => {
      proxyUrlValue = 'http://proxy.example.com:8080';

      const agent1 = getSharedProxyAgent();
      const agent2 = getSharedProxyAgent();
      const agent3 = getSharedProxyAgent();

      expect(agent1).toBe(agent2);
      expect(agent2).toBe(agent3);
    });
  });

  describe('closeSharedProxyAgent', () => {
    it('當有 ProxyAgent 時應該呼叫 close()', async () => {
      proxyUrlValue = 'http://proxy.example.com:8080';

      // 先創建 ProxyAgent
      getSharedProxyAgent();
      expect(isProxyAgentInitialized()).toBe(true);

      // 關閉它
      await closeSharedProxyAgent();

      expect(mockCloseFn).toHaveBeenCalledTimes(1);
      expect(isProxyAgentInitialized()).toBe(false);
    });

    it('當沒有 ProxyAgent 時應該安全地完成', async () => {
      proxyUrlValue = null;

      // 初始化但沒有 ProxyAgent
      getSharedProxyAgent();

      // 關閉應該不會報錯
      await expect(closeSharedProxyAgent()).resolves.toBeUndefined();
    });

    it('關閉後再次呼叫 getSharedProxyAgent 應該重新創建', async () => {
      proxyUrlValue = 'http://proxy.example.com:8080';

      // 創建
      const agent1 = getSharedProxyAgent();
      await closeSharedProxyAgent();

      // 再創建
      const agent2 = getSharedProxyAgent();

      // 應該是不同的實例
      expect(agent1).not.toBe(agent2);
    });

    it('關閉時發生錯誤應該被捕獲並記錄警告', async () => {
      proxyUrlValue = 'http://proxy.example.com:8080';

      // 讓 close 拋出錯誤
      mockCloseFn.mockRejectedValueOnce(new Error('Close failed'));

      getSharedProxyAgent();

      // 不應該拋出錯誤
      await expect(closeSharedProxyAgent()).resolves.toBeUndefined();
    });
  });

  describe('resetSharedProxyAgent', () => {
    it('應該重置初始化狀態', () => {
      proxyUrlValue = 'http://proxy.example.com:8080';

      getSharedProxyAgent();
      expect(isProxyAgentInitialized()).toBe(true);

      resetSharedProxyAgent();
      expect(isProxyAgentInitialized()).toBe(false);
    });

    it('重置後應該重新創建 ProxyAgent', () => {
      proxyUrlValue = 'http://proxy.example.com:8080';

      const agent1 = getSharedProxyAgent();

      resetSharedProxyAgent();

      // 修改 proxy URL
      proxyUrlValue = 'http://new-proxy.example.com:9090';

      const agent2 = getSharedProxyAgent();

      // 應該是不同的實例
      expect(agent1).not.toBe(agent2);
      // 應該使用新的 URL
      expect((agent2 as { url: string }).url).toBe('http://new-proxy.example.com:9090');
    });
  });

  describe('isProxyAgentInitialized', () => {
    it('初始狀態應該是 false', () => {
      expect(isProxyAgentInitialized()).toBe(false);
    });

    it('呼叫 getSharedProxyAgent 後應該是 true', () => {
      proxyUrlValue = null;

      getSharedProxyAgent();
      expect(isProxyAgentInitialized()).toBe(true);
    });

    it('關閉後應該是 false', async () => {
      proxyUrlValue = 'http://proxy.example.com:8080';

      getSharedProxyAgent();
      expect(isProxyAgentInitialized()).toBe(true);

      await closeSharedProxyAgent();
      expect(isProxyAgentInitialized()).toBe(false);
    });
  });
});
