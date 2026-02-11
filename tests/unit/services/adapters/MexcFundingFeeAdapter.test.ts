/**
 * MEXC Funding Fee Adapter Unit Tests
 *
 * 使用 fixture 模擬 CCXT fetchFundingHistory 的 unified response 格式
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MexcFundingFeeAdapter } from '@/services/trading/adapters/MexcFundingFeeAdapter';
import mexcFixture from '../../../fixtures/funding-fees/mexc-funding-history.json';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('MexcFundingFeeAdapter', () => {
  let adapter: MexcFundingFeeAdapter;
  let mockExchange: { fetchFundingHistory: ReturnType<typeof vi.fn> };

  const startTime = new Date('2024-01-01T00:00:00Z');
  const endTime = new Date('2024-01-01T08:00:00Z');

  beforeEach(() => {
    mockExchange = {
      fetchFundingHistory: vi.fn(),
    };
    adapter = new MexcFundingFeeAdapter(mockExchange as any);
  });

  it('should have correct exchange name', () => {
    expect(adapter.exchangeName).toBe('mexc');
  });

  it('should parse CCXT funding history from fixture', async () => {
    mockExchange.fetchFundingHistory.mockResolvedValue(mexcFixture);

    const entries = await adapter.fetchFundingFees({
      symbol: 'BTCUSDT',
      startTime,
      endTime,
    });

    expect(entries).toHaveLength(2);
    expect(entries[0].id).toBe('mexc-001');
    expect(entries[0].amount.toNumber()).toBe(-0.045);
    expect(entries[1].id).toBe('mexc-002');
    expect(entries[1].amount.toNumber()).toBe(0.021);
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

  it('should return empty array for empty response', async () => {
    mockExchange.fetchFundingHistory.mockResolvedValue([]);

    const entries = await adapter.fetchFundingFees({ symbol: 'BTCUSDT', startTime, endTime });
    expect(entries).toHaveLength(0);
  });

  it('should throw on API error', async () => {
    mockExchange.fetchFundingHistory.mockRejectedValue(new Error('MEXC API Error'));

    await expect(
      adapter.fetchFundingFees({ symbol: 'BTCUSDT', startTime, endTime }),
    ).rejects.toThrow('MEXC API Error');
  });

  it('should filter out entries outside time range', async () => {
    const beforeRange = startTime.getTime() - 3600000;
    const inRange = startTime.getTime() + 3600000;
    const afterRange = endTime.getTime() + 3600000;

    mockExchange.fetchFundingHistory.mockResolvedValue([
      { id: '1', timestamp: beforeRange, datetime: '', symbol: 'BTC/USDT:USDT', amount: 0.1 },
      { id: '2', timestamp: inRange, datetime: '', symbol: 'BTC/USDT:USDT', amount: 0.2 },
      { id: '3', timestamp: afterRange, datetime: '', symbol: 'BTC/USDT:USDT', amount: 0.3 },
    ]);

    const entries = await adapter.fetchFundingFees({ symbol: 'BTCUSDT', startTime, endTime });
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('2');
  });
});
