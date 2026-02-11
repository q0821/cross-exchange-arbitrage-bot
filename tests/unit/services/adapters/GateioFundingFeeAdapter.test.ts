/**
 * Gate.io Funding Fee Adapter Unit Tests
 *
 * 使用 fixture 模擬 Gate.io privateFuturesGetSettleAccountBook 的真實回應格式
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GateioFundingFeeAdapter } from '@/services/trading/adapters/GateioFundingFeeAdapter';
import gateioFixture from '../../../fixtures/funding-fees/gateio-account-book.json';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('GateioFundingFeeAdapter', () => {
  let adapter: GateioFundingFeeAdapter;
  let mockExchange: { privateFuturesGetSettleAccountBook: ReturnType<typeof vi.fn> };

  // fixture 中 BTC_USDT time(sec): 1704070800, 1704074400 (in range), 1704000000 (out)
  const startTime = new Date('2024-01-01T00:00:00Z'); // 1704067200
  const endTime = new Date('2024-01-01T08:00:00Z');   // 1704096000

  beforeEach(() => {
    mockExchange = {
      privateFuturesGetSettleAccountBook: vi.fn(),
    };
    adapter = new GateioFundingFeeAdapter(mockExchange as any);
  });

  it('should have correct exchange name', () => {
    expect(adapter.exchangeName).toBe('gateio');
  });

  it('should parse Gate.io account book and filter by symbol and time range', async () => {
    mockExchange.privateFuturesGetSettleAccountBook.mockResolvedValue(gateioFixture);

    const entries = await adapter.fetchFundingFees({
      symbol: 'BTCUSDT',
      startTime,
      endTime,
    });

    // fixture 有 4 筆，BTC_USDT 在範圍內只有 2 筆
    expect(entries).toHaveLength(2);
    expect(entries[0].id).toBe('gateio-001');
    expect(entries[0].amount.toFixed(8)).toBe('-0.03250000');
    expect(entries[1].id).toBe('gateio-002');
    expect(entries[1].amount.toFixed(8)).toBe('0.01800000');
  });

  it('should call Gate.io API with correct parameters', async () => {
    mockExchange.privateFuturesGetSettleAccountBook.mockResolvedValue([]);

    await adapter.fetchFundingFees({
      symbol: 'BTCUSDT',
      startTime,
      endTime,
    });

    expect(mockExchange.privateFuturesGetSettleAccountBook).toHaveBeenCalledWith({
      settle: 'usdt',
      type: 'fund',
      from: Math.floor(startTime.getTime() / 1000),
      to: Math.floor(endTime.getTime() / 1000),
      limit: 1000,
    });
  });

  it('should convert BTCUSDT to BTC_USDT', async () => {
    mockExchange.privateFuturesGetSettleAccountBook.mockResolvedValue([]);

    await adapter.fetchFundingFees({ symbol: 'BTCUSDT', startTime, endTime });

    // Gate.io API 不帶 symbol 參數，但 adapter 做 post-filter
    // 確認有正確呼叫 API
    expect(mockExchange.privateFuturesGetSettleAccountBook).toHaveBeenCalledTimes(1);
  });

  it('should filter out entries with non-matching symbol', async () => {
    mockExchange.privateFuturesGetSettleAccountBook.mockResolvedValue(gateioFixture);

    const entries = await adapter.fetchFundingFees({
      symbol: 'ETHUSDT',
      startTime,
      endTime,
    });

    // 只有 1 筆 ETH_USDT 在範圍內
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('gateio-003');
  });

  it('should return empty array for empty API response', async () => {
    mockExchange.privateFuturesGetSettleAccountBook.mockResolvedValue([]);

    const entries = await adapter.fetchFundingFees({ symbol: 'BTCUSDT', startTime, endTime });
    expect(entries).toHaveLength(0);
  });

  it('should throw on API error', async () => {
    mockExchange.privateFuturesGetSettleAccountBook.mockRejectedValue(new Error('Gate.io API Error'));

    await expect(
      adapter.fetchFundingFees({ symbol: 'BTCUSDT', startTime, endTime }),
    ).rejects.toThrow('Gate.io API Error');
  });

  it('should convert timestamp from seconds to milliseconds', async () => {
    mockExchange.privateFuturesGetSettleAccountBook.mockResolvedValue([
      { time: '1704070800', change: '-0.01', text: 'BTC_USDT', id: 'test-1' },
    ]);

    const entries = await adapter.fetchFundingFees({ symbol: 'BTCUSDT', startTime, endTime });
    expect(entries[0].timestamp).toBe(1704070800000); // seconds * 1000
  });
});
