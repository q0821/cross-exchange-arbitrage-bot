/**
 * Binance Funding Fee Adapter Unit Tests
 *
 * 使用 fixture 模擬 CCXT fetchFundingHistory 的 unified response 格式
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BinanceFundingFeeAdapter } from '@/services/trading/adapters/BinanceFundingFeeAdapter';
import binanceFixture from '../../../fixtures/funding-fees/binance-funding-history.json';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('BinanceFundingFeeAdapter', () => {
  let adapter: BinanceFundingFeeAdapter;
  let mockExchange: { fetchFundingHistory: ReturnType<typeof vi.fn> };

  // fixture 中在範圍內的 timestamp: 1704070800000, 1704074400000
  // fixture 中範圍外的 timestamp: 1704000000000 (before startTime)
  const startTime = new Date('2024-01-01T00:00:00Z'); // 1704067200000
  const endTime = new Date('2024-01-01T08:00:00Z');   // 1704096000000

  beforeEach(() => {
    mockExchange = {
      fetchFundingHistory: vi.fn(),
    };
    adapter = new BinanceFundingFeeAdapter(mockExchange as any);
  });

  it('should have correct exchange name', () => {
    expect(adapter.exchangeName).toBe('binance');
  });

  it('should parse CCXT funding history and filter by time range', async () => {
    mockExchange.fetchFundingHistory.mockResolvedValue(binanceFixture);

    const entries = await adapter.fetchFundingFees({
      symbol: 'BTCUSDT',
      startTime,
      endTime,
    });

    // fixture 有 3 筆，但 1 筆 timestamp < startTime
    expect(entries).toHaveLength(2);
    expect(entries[0].id).toBe('bin-001');
    expect(entries[0].amount.toNumber()).toBe(-0.05125);
    expect(entries[1].id).toBe('bin-002');
    expect(entries[1].amount.toNumber()).toBe(0.0325);
  });

  it('should call CCXT with correct symbol format', async () => {
    mockExchange.fetchFundingHistory.mockResolvedValue([]);

    await adapter.fetchFundingFees({ symbol: 'BTCUSDT', startTime, endTime });

    expect(mockExchange.fetchFundingHistory).toHaveBeenCalledWith(
      'BTC/USDT:USDT',
      startTime.getTime(),
      undefined,
      { until: endTime.getTime() },
    );
  });

  it('should convert ETHUSDT to ETH/USDT:USDT', async () => {
    mockExchange.fetchFundingHistory.mockResolvedValue([]);

    await adapter.fetchFundingFees({ symbol: 'ETHUSDT', startTime, endTime });

    expect(mockExchange.fetchFundingHistory).toHaveBeenCalledWith(
      'ETH/USDT:USDT',
      expect.any(Number),
      undefined,
      expect.any(Object),
    );
  });

  it('should return empty array for empty response', async () => {
    mockExchange.fetchFundingHistory.mockResolvedValue([]);

    const entries = await adapter.fetchFundingFees({ symbol: 'BTCUSDT', startTime, endTime });
    expect(entries).toHaveLength(0);
  });

  it('should throw on API error', async () => {
    mockExchange.fetchFundingHistory.mockRejectedValue(new Error('Binance API Error'));

    await expect(
      adapter.fetchFundingFees({ symbol: 'BTCUSDT', startTime, endTime }),
    ).rejects.toThrow('Binance API Error');
  });

  it('should handle missing amount field gracefully', async () => {
    mockExchange.fetchFundingHistory.mockResolvedValue([
      { id: '1', timestamp: startTime.getTime() + 1000, datetime: '2024-01-01T00:00:01Z', symbol: 'BTC/USDT:USDT' },
    ]);

    const entries = await adapter.fetchFundingFees({ symbol: 'BTCUSDT', startTime, endTime });
    expect(entries[0].amount.toNumber()).toBe(0);
  });

  it('should handle missing id field gracefully', async () => {
    const ts = startTime.getTime() + 1000;
    mockExchange.fetchFundingHistory.mockResolvedValue([
      { timestamp: ts, datetime: '2024-01-01T00:00:01Z', symbol: 'BTC/USDT:USDT', amount: 0.5 },
    ]);

    const entries = await adapter.fetchFundingFees({ symbol: 'BTCUSDT', startTime, endTime });
    expect(entries[0].id).toBe(String(ts));
  });

  it('should maintain Decimal precision for small amounts', async () => {
    const ts = startTime.getTime() + 1000;
    mockExchange.fetchFundingHistory.mockResolvedValue([
      { id: '1', timestamp: ts, datetime: '2024-01-01T00:00:01Z', symbol: 'BTC/USDT:USDT', amount: 0.00000001 },
      { id: '2', timestamp: ts + 1000, datetime: '2024-01-01T00:00:02Z', symbol: 'BTC/USDT:USDT', amount: 0.00000002 },
    ]);

    const entries = await adapter.fetchFundingFees({ symbol: 'BTCUSDT', startTime, endTime });
    const total = entries.reduce((sum, e) => sum.plus(e.amount), entries[0].amount.minus(entries[0].amount));
    expect(total.toFixed(8)).toBe('0.00000003');
  });

  it('should include entries exactly at boundary timestamps', async () => {
    mockExchange.fetchFundingHistory.mockResolvedValue([
      { id: '1', timestamp: startTime.getTime(), datetime: startTime.toISOString(), symbol: 'BTC/USDT:USDT', amount: 0.1 },
      { id: '2', timestamp: endTime.getTime(), datetime: endTime.toISOString(), symbol: 'BTC/USDT:USDT', amount: 0.2 },
    ]);

    const entries = await adapter.fetchFundingFees({ symbol: 'BTCUSDT', startTime, endTime });
    expect(entries).toHaveLength(2);
  });
});
