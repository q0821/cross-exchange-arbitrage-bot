/**
 * Funding Fee Adapter Contract Tests
 *
 * 共用 contract test suite：所有 FundingFeeAdapter 實作必須通過
 * 確保介面一致性，不論底層交易所 API 差異
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Decimal } from 'decimal.js';
import type { FundingFeeAdapter } from '@/services/trading/adapters/FundingFeeAdapter';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ─── Contract Test Factory ─────────────────────────────────────────

interface AdapterMockSetup {
  /** 建立 mock exchange 物件 */
  createMockExchange: () => Record<string, ReturnType<typeof vi.fn>>;
  /** 設定 mock 回傳包含 entries 的回應 */
  withEntries: (exchange: Record<string, ReturnType<typeof vi.fn>>, entries: MockEntry[]) => void;
  /** 設定 mock 回傳空回應 */
  withEmpty: (exchange: Record<string, ReturnType<typeof vi.fn>>) => void;
  /** 設定 mock 拋出錯誤 */
  withError: (exchange: Record<string, ReturnType<typeof vi.fn>>, error: Error) => void;
}

interface MockEntry {
  id: string;
  amount: number;
  timestamp: number;
}

export function describeFundingFeeAdapterContract(
  adapterName: string,
  createAdapter: (mockExchange: Record<string, ReturnType<typeof vi.fn>>) => FundingFeeAdapter,
  setup: AdapterMockSetup,
) {
  describe(`${adapterName} - Contract Tests`, () => {
    let adapter: FundingFeeAdapter;
    let mockExchange: Record<string, ReturnType<typeof vi.fn>>;

    const startTime = new Date('2024-01-01T00:00:00Z');
    const endTime = new Date('2024-01-01T08:00:00Z');
    const inRangeTs = startTime.getTime() + 3600000; // 1 hour after start

    beforeEach(() => {
      mockExchange = setup.createMockExchange();
      adapter = createAdapter(mockExchange);
    });

    it('should return FundingFeeEntry[] with amount as Decimal', async () => {
      setup.withEntries(mockExchange, [
        { id: 'c-001', amount: -0.05, timestamp: inRangeTs },
      ]);

      const entries = await adapter.fetchFundingFees({ symbol: 'BTCUSDT', startTime, endTime });

      expect(entries).toBeInstanceOf(Array);
      expect(entries.length).toBeGreaterThan(0);
      const entry = entries[0];
      expect(entry.amount).toBeInstanceOf(Decimal);
      expect(typeof entry.timestamp).toBe('number');
      expect(typeof entry.datetime).toBe('string');
      expect(typeof entry.id).toBe('string');
      expect(typeof entry.symbol).toBe('string');
    });

    it('should return empty array for empty API response', async () => {
      setup.withEmpty(mockExchange);

      const entries = await adapter.fetchFundingFees({ symbol: 'BTCUSDT', startTime, endTime });

      expect(entries).toBeInstanceOf(Array);
      expect(entries).toHaveLength(0);
    });

    it('should throw on API error (not swallow)', async () => {
      setup.withError(mockExchange, new Error('Contract test: API failure'));

      await expect(
        adapter.fetchFundingFees({ symbol: 'BTCUSDT', startTime, endTime }),
      ).rejects.toThrow(/Contract test: API failure/);
    });

    it('should include entries at boundary timestamps', async () => {
      setup.withEntries(mockExchange, [
        { id: 'boundary-start', amount: 0.01, timestamp: startTime.getTime() },
        { id: 'boundary-end', amount: 0.02, timestamp: endTime.getTime() },
      ]);

      const entries = await adapter.fetchFundingFees({ symbol: 'BTCUSDT', startTime, endTime });

      expect(entries.length).toBeGreaterThanOrEqual(2);
      const ids = entries.map((e) => e.id);
      expect(ids).toContain('boundary-start');
      expect(ids).toContain('boundary-end');
    });

    it('should maintain Decimal precision', async () => {
      setup.withEntries(mockExchange, [
        { id: 'precision-1', amount: 0.00000001, timestamp: inRangeTs },
        { id: 'precision-2', amount: 0.00000002, timestamp: inRangeTs + 1000 },
      ]);

      const entries = await adapter.fetchFundingFees({ symbol: 'BTCUSDT', startTime, endTime });

      const total = entries.reduce((sum, e) => sum.plus(e.amount), new Decimal(0));
      expect(total.toFixed(8)).toBe('0.00000003');
    });

    it('should have correct exchangeName', () => {
      expect(typeof adapter.exchangeName).toBe('string');
      expect(adapter.exchangeName.length).toBeGreaterThan(0);
    });
  });
}

// ─── Binance Contract ──────────────────────────────────────────────

import { BinanceFundingFeeAdapter } from '@/services/trading/adapters/BinanceFundingFeeAdapter';

describeFundingFeeAdapterContract(
  'BinanceFundingFeeAdapter',
  (mock) => new BinanceFundingFeeAdapter(mock as any),
  {
    createMockExchange: () => ({ fetchFundingHistory: vi.fn() }),
    withEntries: (ex, entries) => {
      ex.fetchFundingHistory!.mockResolvedValue(
        entries.map((e) => ({
          id: e.id,
          symbol: 'BTC/USDT:USDT',
          timestamp: e.timestamp,
          datetime: new Date(e.timestamp).toISOString(),
          amount: e.amount,
        })),
      );
    },
    withEmpty: (ex) => { ex.fetchFundingHistory!.mockResolvedValue([]); },
    withError: (ex, err) => { ex.fetchFundingHistory!.mockRejectedValue(err); },
  },
);

// ─── MEXC Contract ─────────────────────────────────────────────────

import { MexcFundingFeeAdapter } from '@/services/trading/adapters/MexcFundingFeeAdapter';

describeFundingFeeAdapterContract(
  'MexcFundingFeeAdapter',
  (mock) => new MexcFundingFeeAdapter(mock as any),
  {
    createMockExchange: () => ({ fetchFundingHistory: vi.fn() }),
    withEntries: (ex, entries) => {
      ex.fetchFundingHistory!.mockResolvedValue(
        entries.map((e) => ({
          id: e.id,
          symbol: 'BTC/USDT:USDT',
          timestamp: e.timestamp,
          datetime: new Date(e.timestamp).toISOString(),
          amount: e.amount,
        })),
      );
    },
    withEmpty: (ex) => { ex.fetchFundingHistory!.mockResolvedValue([]); },
    withError: (ex, err) => { ex.fetchFundingHistory!.mockRejectedValue(err); },
  },
);

// ─── OKX Contract ──────────────────────────────────────────────────

import { OkxFundingFeeAdapter } from '@/services/trading/adapters/OkxFundingFeeAdapter';

describeFundingFeeAdapterContract(
  'OkxFundingFeeAdapter',
  (mock) => new OkxFundingFeeAdapter(mock as any),
  {
    createMockExchange: () => ({ privateGetAccountBills: vi.fn() }),
    withEntries: (ex, entries) => {
      ex.privateGetAccountBills!.mockResolvedValue({
        data: entries.map((e) => ({
          billId: e.id,
          instId: 'BTC-USDT-SWAP',
          balChg: String(e.amount),
          pnl: String(e.amount),
          ts: String(e.timestamp),
          subType: e.amount < 0 ? '173' : '174',
        })),
      });
    },
    withEmpty: (ex) => { ex.privateGetAccountBills!.mockResolvedValue({ data: [] }); },
    withError: (ex, err) => { ex.privateGetAccountBills!.mockRejectedValue(err); },
  },
);

// ─── Gate.io Contract ──────────────────────────────────────────────

import { GateioFundingFeeAdapter } from '@/services/trading/adapters/GateioFundingFeeAdapter';

describeFundingFeeAdapterContract(
  'GateioFundingFeeAdapter',
  (mock) => new GateioFundingFeeAdapter(mock as any),
  {
    createMockExchange: () => ({ privateFuturesGetSettleAccountBook: vi.fn() }),
    withEntries: (ex, entries) => {
      ex.privateFuturesGetSettleAccountBook!.mockResolvedValue(
        entries.map((e) => ({
          id: e.id,
          text: 'BTC_USDT',
          change: String(e.amount),
          time: String(Math.floor(e.timestamp / 1000)), // Gate.io uses seconds
        })),
      );
    },
    withEmpty: (ex) => { ex.privateFuturesGetSettleAccountBook!.mockResolvedValue([]); },
    withError: (ex, err) => { ex.privateFuturesGetSettleAccountBook!.mockRejectedValue(err); },
  },
);

// ─── BingX Contract ────────────────────────────────────────────────

import { BingxFundingFeeAdapter } from '@/services/trading/adapters/BingxFundingFeeAdapter';

describeFundingFeeAdapterContract(
  'BingxFundingFeeAdapter',
  (mock) => new BingxFundingFeeAdapter(mock as any),
  {
    createMockExchange: () => ({
      swapV2PrivateGetUserIncome: vi.fn(),
      privateGetSwapV2UserIncome: vi.fn(),
      fetchMyTrades: vi.fn(),
    }),
    withEntries: (ex, entries) => {
      ex.swapV2PrivateGetUserIncome!.mockResolvedValue({
        data: entries.map((e) => ({
          symbol: 'BTC-USDT',
          income: String(e.amount),
          time: String(e.timestamp),
          tranId: e.id,
        })),
      });
    },
    withEmpty: (ex) => { ex.swapV2PrivateGetUserIncome!.mockResolvedValue({ data: [] }); },
    withError: (ex, err) => {
      // BingX 有 3-method fallback，需要讓所有方法都失敗
      ex.swapV2PrivateGetUserIncome!.mockRejectedValue(err);
      ex.privateGetSwapV2UserIncome!.mockRejectedValue(err);
      ex.fetchMyTrades!.mockRejectedValue(err);
    },
  },
);
