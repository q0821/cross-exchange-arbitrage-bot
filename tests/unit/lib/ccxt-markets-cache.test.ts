/**
 * CCXT Markets Cache 單元測試
 *
 * 測試重點：
 * 1. 基本快取功能（get/set/clear）
 * 2. Singleflight Pattern（loadMarketsWithCache 並發去重）
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCachedMarkets,
  setCachedMarkets,
  clearCachedMarkets,
  clearAllCachedMarkets,
  getMarketsCacheStats,
  loadMarketsWithCache,
  getInflightLoadsCount,
  clearInflightLoads,
} from '@/lib/ccxt-markets-cache';

/**
 * 建立 Mock CCXT Exchange
 */
function createMockExchange(
  loadMarketsDelay = 100,
  markets: Record<string, unknown> = { 'BTC/USDT': { id: 'btcusdt' } }
) {
  const mockExchange = {
    markets: null as Record<string, unknown> | null,
    markets_by_id: null,
    marketsById: null,
    indexBy: vi.fn((items: Record<string, unknown>, key: string) => {
      const result: Record<string, unknown> = {};
      for (const [, value] of Object.entries(items)) {
        const item = value as Record<string, unknown>;
        if (item[key]) {
          result[item[key] as string] = item;
        }
      }
      return result;
    }),
    loadMarkets: vi.fn(async () => {
      // 模擬網路延遲
      await new Promise(resolve => setTimeout(resolve, loadMarketsDelay));
      // CCXT loadMarkets 會設定 exchange.markets
      mockExchange.markets = markets;
      return Object.values(markets);
    }),
  };

  return mockExchange as any;
}

describe('ccxt-markets-cache', () => {
  beforeEach(() => {
    // 每個測試前清空所有快取
    clearAllCachedMarkets();
    clearInflightLoads();
    vi.clearAllMocks();
  });

  describe('基本快取功能', () => {
    it('should return null for non-existent cache', () => {
      const result = getCachedMarkets('binance');
      expect(result).toBeNull();
    });

    it('should cache and retrieve markets', () => {
      const markets = { 'BTC/USDT': { id: 'btcusdt', symbol: 'BTC/USDT' } };
      setCachedMarkets('okx', markets);

      const cached = getCachedMarkets('okx');
      expect(cached).toEqual(markets);
    });

    it('should return null for expired cache', async () => {
      const markets = { 'BTC/USDT': { id: 'btcusdt' } };
      // 設定 1ms TTL
      setCachedMarkets('mexc', markets, 1);

      // 等待過期
      await new Promise(resolve => setTimeout(resolve, 10));

      const cached = getCachedMarkets('mexc');
      expect(cached).toBeNull();
    });

    it('should clear specific exchange cache', () => {
      setCachedMarkets('gateio', { 'BTC/USDT': {} });
      setCachedMarkets('bingx', { 'ETH/USDT': {} });

      clearCachedMarkets('gateio');

      expect(getCachedMarkets('gateio')).toBeNull();
      expect(getCachedMarkets('bingx')).not.toBeNull();
    });

    it('should clear all caches', () => {
      setCachedMarkets('okx', { 'BTC/USDT': {} });
      setCachedMarkets('mexc', { 'ETH/USDT': {} });

      clearAllCachedMarkets();

      const stats = getMarketsCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.exchanges).toEqual([]);
    });

    it('should return correct cache stats', () => {
      setCachedMarkets('binance', { 'BTC/USDT': {} });
      setCachedMarkets('okx', { 'ETH/USDT': {}, 'BTC/USDT': {} });

      const stats = getMarketsCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.exchanges).toContain('binance');
      expect(stats.exchanges).toContain('okx');
    });
  });

  describe('loadMarketsWithCache - Singleflight Pattern', () => {
    it('should use cache when available', async () => {
      const markets = { 'BTC/USDT': { id: 'btcusdt' } };
      setCachedMarkets('okx', markets);

      const mockExchange = createMockExchange();
      const result = await loadMarketsWithCache(mockExchange, 'okx');

      expect(result).toEqual(markets);
      expect(mockExchange.loadMarkets).not.toHaveBeenCalled();
      expect(mockExchange.markets).toEqual(markets);
    });

    it('should load markets and cache when cache is empty', async () => {
      const markets = { 'BTC/USDT': { id: 'btcusdt' } };
      const mockExchange = createMockExchange(50, markets);

      const result = await loadMarketsWithCache(mockExchange, 'mexc');

      expect(result).toEqual(markets);
      expect(mockExchange.loadMarkets).toHaveBeenCalledTimes(1);
      // 確認快取已設定
      expect(getCachedMarkets('mexc')).toEqual(markets);
    });

    it('should deduplicate concurrent loadMarkets calls (Singleflight)', async () => {
      const markets = { 'BTC/USDT': { id: 'btcusdt' } };

      // 建立多個 mock exchange，共享相同的 loadMarkets 實作
      const loadMarketsFn = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return Object.values(markets);
      });

      const createExchange = () => {
        const ex = {
          markets: null as Record<string, unknown> | null,
          markets_by_id: null,
          marketsById: null,
          indexBy: vi.fn(() => ({})),
          loadMarkets: async () => {
            const result = await loadMarketsFn();
            ex.markets = markets;
            return result;
          },
        };
        return ex as any;
      };

      // 並發 5 個請求
      const exchanges = Array(5).fill(null).map(() => createExchange());
      const promises = exchanges.map(ex => loadMarketsWithCache(ex, 'gateio'));

      await Promise.all(promises);

      // loadMarkets 只應該被呼叫 1 次
      expect(loadMarketsFn).toHaveBeenCalledTimes(1);

      // 所有 exchange 都應該有 markets
      for (const ex of exchanges) {
        expect(ex.markets).toEqual(markets);
      }

      // 快取應該已設定
      expect(getCachedMarkets('gateio')).toEqual(markets);
    });

    it('should handle 10 concurrent requests with single loadMarkets call', async () => {
      const markets = { 'BTC/USDT': { id: 'btcusdt' }, 'ETH/USDT': { id: 'ethusdt' } };
      const loadMarketsFn = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return Object.values(markets);
      });

      const createExchange = () => {
        const ex = {
          markets: null as Record<string, unknown> | null,
          indexBy: vi.fn(() => ({})),
          loadMarkets: async () => {
            const result = await loadMarketsFn();
            ex.markets = markets;
            return result;
          },
        };
        return ex as any;
      };

      // 並發 10 個請求
      const exchanges = Array(10).fill(null).map(() => createExchange());
      const promises = exchanges.map(ex => loadMarketsWithCache(ex, 'binance'));

      await Promise.all(promises);

      // 只呼叫 1 次
      expect(loadMarketsFn).toHaveBeenCalledTimes(1);
    });

    it('should clear inflight after completion', async () => {
      const markets = { 'BTC/USDT': { id: 'btcusdt' } };
      const mockExchange = createMockExchange(10, markets);

      expect(getInflightLoadsCount()).toBe(0);

      const promise = loadMarketsWithCache(mockExchange, 'bingx');

      // 請求進行中時應該有 1 個 inflight
      // 注意：由於 async 執行順序，這裡可能已經完成
      // 所以我們只測試最終結果

      await promise;

      // 完成後 inflight 應該被清理
      expect(getInflightLoadsCount()).toBe(0);
    });

    it('should clear inflight even if loadMarkets fails', async () => {
      const mockExchange = {
        markets: null,
        indexBy: vi.fn(() => ({})),
        loadMarkets: vi.fn(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          throw new Error('Network error');
        }),
      } as any;

      await expect(loadMarketsWithCache(mockExchange, 'okx')).rejects.toThrow('Network error');

      // 失敗後 inflight 也應該被清理
      expect(getInflightLoadsCount()).toBe(0);
    });

    it('should handle different exchanges independently', async () => {
      const okxMarkets = { 'BTC/USDT': { id: 'okx-btc' } };
      const mexcMarkets = { 'BTC/USDT': { id: 'mexc-btc' } };

      const okxLoadFn = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return Object.values(okxMarkets);
      });

      const mexcLoadFn = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return Object.values(mexcMarkets);
      });

      const createOkxExchange = () => {
        const ex = {
          markets: null as Record<string, unknown> | null,
          indexBy: vi.fn(() => ({})),
          loadMarkets: async () => {
            await okxLoadFn();
            ex.markets = okxMarkets;
            return Object.values(okxMarkets);
          },
        };
        return ex as any;
      };

      const createMexcExchange = () => {
        const ex = {
          markets: null as Record<string, unknown> | null,
          indexBy: vi.fn(() => ({})),
          loadMarkets: async () => {
            await mexcLoadFn();
            ex.markets = mexcMarkets;
            return Object.values(mexcMarkets);
          },
        };
        return ex as any;
      };

      // 各 3 個請求
      const okxExchanges = Array(3).fill(null).map(() => createOkxExchange());
      const mexcExchanges = Array(3).fill(null).map(() => createMexcExchange());

      const promises = [
        ...okxExchanges.map(ex => loadMarketsWithCache(ex, 'okx')),
        ...mexcExchanges.map(ex => loadMarketsWithCache(ex, 'mexc')),
      ];

      await Promise.all(promises);

      // 每個交易所各只呼叫 1 次
      expect(okxLoadFn).toHaveBeenCalledTimes(1);
      expect(mexcLoadFn).toHaveBeenCalledTimes(1);

      // 驗證快取
      expect(getCachedMarkets('okx')).toEqual(okxMarkets);
      expect(getCachedMarkets('mexc')).toEqual(mexcMarkets);
    });
  });
});
