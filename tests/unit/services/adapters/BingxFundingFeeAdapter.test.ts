/**
 * BingX Funding Fee Adapter Unit Tests
 *
 * 使用 fixture 模擬 BingX swapV2PrivateGetUserIncome 的真實回應格式
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BingxFundingFeeAdapter } from '@/services/trading/adapters/BingxFundingFeeAdapter';
import bingxFixture from '../../../fixtures/funding-fees/bingx-income.json';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('BingxFundingFeeAdapter', () => {
  let adapter: BingxFundingFeeAdapter;
  let mockExchange: {
    swapV2PrivateGetUserIncome: ReturnType<typeof vi.fn>;
    privateGetSwapV2UserIncome: ReturnType<typeof vi.fn>;
    fetchMyTrades: ReturnType<typeof vi.fn>;
  };

  // fixture 中 BTC-USDT 在範圍內的 time: 1704070800000, 1704074400000
  // fixture 中 BTC-USDT 範圍外的 time: 1704000000000
  const startTime = new Date('2024-01-01T00:00:00Z'); // 1704067200000
  const endTime = new Date('2024-01-01T08:00:00Z');   // 1704096000000

  beforeEach(() => {
    mockExchange = {
      swapV2PrivateGetUserIncome: vi.fn(),
      privateGetSwapV2UserIncome: vi.fn(),
      fetchMyTrades: vi.fn(),
    };
    adapter = new BingxFundingFeeAdapter(mockExchange as any);
  });

  it('should have correct exchange name', () => {
    expect(adapter.exchangeName).toBe('bingx');
  });

  it('should parse BingX income response and filter by symbol', async () => {
    mockExchange.swapV2PrivateGetUserIncome.mockResolvedValue(bingxFixture);

    const entries = await adapter.fetchFundingFees({
      symbol: 'BTCUSDT',
      startTime,
      endTime,
    });

    // fixture 有 4 筆，BTC-USDT 有 3 筆，但 1 筆 time < startTime 不在 adapter 的過濾範圍
    // 注意：BingX adapter 不做時間過濾（靠 API 參數 startTime/endTime），但會過濾 symbol
    // fixture 全部 BTC-USDT 有 3 筆
    expect(entries).toHaveLength(3);
    expect(entries[0].amount.toFixed(8)).toBe('-0.04125000');
    expect(entries[1].amount.toFixed(8)).toBe('0.02300000');
  });

  it('should call BingX API with correct parameters', async () => {
    mockExchange.swapV2PrivateGetUserIncome.mockResolvedValue({ data: [] });

    await adapter.fetchFundingFees({ symbol: 'BTCUSDT', startTime, endTime });

    expect(mockExchange.swapV2PrivateGetUserIncome).toHaveBeenCalledWith({
      incomeType: 'FUNDING_FEE',
      startTime: startTime.getTime(),
      endTime: endTime.getTime(),
      limit: 1000,
    });
  });

  it('should fallback to method 2 when method 1 fails', async () => {
    mockExchange.swapV2PrivateGetUserIncome.mockRejectedValue(new Error('Method 1 failed'));
    mockExchange.privateGetSwapV2UserIncome.mockResolvedValue({ data: bingxFixture.data });

    const entries = await adapter.fetchFundingFees({ symbol: 'BTCUSDT', startTime, endTime });

    expect(mockExchange.privateGetSwapV2UserIncome).toHaveBeenCalled();
    expect(entries.length).toBeGreaterThan(0);
  });

  it('should fallback to method 3 when methods 1 and 2 fail', async () => {
    mockExchange.swapV2PrivateGetUserIncome.mockRejectedValue(new Error('Method 1 failed'));
    mockExchange.privateGetSwapV2UserIncome.mockRejectedValue(new Error('Method 2 failed'));
    mockExchange.fetchMyTrades.mockResolvedValue([
      { type: 'funding', timestamp: 1704070800000, amount: -0.05, id: 'trade-1' },
    ]);

    const entries = await adapter.fetchFundingFees({ symbol: 'BTCUSDT', startTime, endTime });

    expect(mockExchange.fetchMyTrades).toHaveBeenCalled();
    expect(entries).toHaveLength(1);
  });

  it('should throw when all methods fail', async () => {
    mockExchange.swapV2PrivateGetUserIncome.mockRejectedValue(new Error('Method 1 failed'));
    mockExchange.privateGetSwapV2UserIncome.mockRejectedValue(new Error('Method 2 failed'));
    mockExchange.fetchMyTrades.mockRejectedValue(new Error('Method 3 failed'));

    await expect(
      adapter.fetchFundingFees({ symbol: 'BTCUSDT', startTime, endTime }),
    ).rejects.toThrow(/All BingX funding fee API methods failed/);
  });

  it('should convert BTCUSDT to BTC-USDT for symbol filtering', async () => {
    mockExchange.swapV2PrivateGetUserIncome.mockResolvedValue({
      data: [
        { symbol: 'BTC-USDT', income: '-0.01', time: '1704070800000', tranId: '1' },
        { symbol: 'ETH-USDT', income: '-0.02', time: '1704070800000', tranId: '2' },
      ],
    });

    const entries = await adapter.fetchFundingFees({ symbol: 'BTCUSDT', startTime, endTime });
    expect(entries).toHaveLength(1);
    expect(entries[0].symbol).toBe('BTC-USDT');
  });

  it('should return empty array for empty API response', async () => {
    mockExchange.swapV2PrivateGetUserIncome.mockResolvedValue({ data: [] });

    const entries = await adapter.fetchFundingFees({ symbol: 'BTCUSDT', startTime, endTime });
    expect(entries).toHaveLength(0);
  });
});
