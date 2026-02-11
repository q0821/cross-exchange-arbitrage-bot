/**
 * OKX Funding Fee Adapter Unit Tests
 *
 * 使用 fixture 模擬 OKX privateGetAccountBills 的真實回應格式
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OkxFundingFeeAdapter } from '@/services/trading/adapters/OkxFundingFeeAdapter';
import okxFixture from '../../../fixtures/funding-fees/okx-bills.json';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('OkxFundingFeeAdapter', () => {
  let adapter: OkxFundingFeeAdapter;
  let mockExchange: { privateGetAccountBills: ReturnType<typeof vi.fn> };

  // Fixture 的時間範圍：1704067200000 (2024-01-01T00:00:00Z) ~ 1704096000000 (2024-01-01T08:00:00Z)
  // fixture 中 BTC-USDT-SWAP 在範圍內的 ts: 1704070800000, 1704074400000
  // fixture 中 BTC-USDT-SWAP 在範圍外的 ts: 1704000000000 (before)
  const startTime = new Date('2024-01-01T00:00:00Z'); // 1704067200000
  const endTime = new Date('2024-01-01T08:00:00Z');   // 1704096000000

  beforeEach(() => {
    mockExchange = {
      privateGetAccountBills: vi.fn(),
    };
    adapter = new OkxFundingFeeAdapter(mockExchange as any);
  });

  it('should have correct exchange name', () => {
    expect(adapter.exchangeName).toBe('okx');
  });

  it('should parse OKX bills response and filter by time range', async () => {
    // OKX API 已通過 instId 參數過濾 symbol，adapter 只做時間過濾
    // 模擬 API 回傳只包含匹配 instId 的記錄
    const btcOnlyFixture = {
      data: okxFixture.data.filter((d) => d.instId === 'BTC-USDT-SWAP'),
    };
    mockExchange.privateGetAccountBills.mockResolvedValue(btcOnlyFixture);

    const entries = await adapter.fetchFundingFees({
      symbol: 'BTCUSDT',
      startTime,
      endTime,
    });

    // BTC-USDT-SWAP 有 3 筆，但 1 筆 ts=1704000000000 在範圍外
    expect(entries).toHaveLength(2);
    expect(entries[0].id).toBe('111001');
    expect(entries[0].amount.toFixed(8)).toBe('-0.02917500');
    expect(entries[1].id).toBe('111002');
    expect(entries[1].amount.toFixed(8)).toBe('0.01523400');
  });

  it('should call OKX API with correct parameters', async () => {
    mockExchange.privateGetAccountBills.mockResolvedValue({ data: [] });

    await adapter.fetchFundingFees({
      symbol: 'BTCUSDT',
      startTime,
      endTime,
    });

    expect(mockExchange.privateGetAccountBills).toHaveBeenCalledWith({
      instType: 'SWAP',
      type: '8',
      instId: 'BTC-USDT-SWAP',
      begin: String(startTime.getTime()),
      end: String(endTime.getTime()),
      limit: '100',
    });
  });

  it('should convert PIPPINUSDT to PIPPIN-USDT-SWAP', async () => {
    mockExchange.privateGetAccountBills.mockResolvedValue({ data: [] });

    await adapter.fetchFundingFees({
      symbol: 'PIPPINUSDT',
      startTime,
      endTime,
    });

    expect(mockExchange.privateGetAccountBills).toHaveBeenCalledWith(
      expect.objectContaining({ instId: 'PIPPIN-USDT-SWAP' }),
    );
  });

  it('should use balChg as amount (not pnl)', async () => {
    mockExchange.privateGetAccountBills.mockResolvedValue({
      data: [
        {
          billId: '999',
          instId: 'BTC-USDT-SWAP',
          balChg: '-0.05',
          pnl: '-0.10',
          ts: String(startTime.getTime() + 3600000),
        },
      ],
    });

    const entries = await adapter.fetchFundingFees({ symbol: 'BTCUSDT', startTime, endTime });
    expect(entries[0].amount.toNumber()).toBe(-0.05);
  });

  it('should return empty array for empty API response', async () => {
    mockExchange.privateGetAccountBills.mockResolvedValue({ data: [] });

    const entries = await adapter.fetchFundingFees({ symbol: 'BTCUSDT', startTime, endTime });
    expect(entries).toHaveLength(0);
  });

  it('should throw on API error', async () => {
    mockExchange.privateGetAccountBills.mockRejectedValue(new Error('OKX API Error'));

    await expect(
      adapter.fetchFundingFees({ symbol: 'BTCUSDT', startTime, endTime }),
    ).rejects.toThrow('OKX API Error');
  });

  it('should maintain Decimal precision', async () => {
    mockExchange.privateGetAccountBills.mockResolvedValue({
      data: [
        { billId: '1', instId: 'BTC-USDT-SWAP', balChg: '0.00000001', ts: String(startTime.getTime() + 1000) },
        { billId: '2', instId: 'BTC-USDT-SWAP', balChg: '0.00000002', ts: String(startTime.getTime() + 2000) },
      ],
    });

    const entries = await adapter.fetchFundingFees({ symbol: 'BTCUSDT', startTime, endTime });
    const total = entries.reduce((sum, e) => sum.plus(e.amount), entries[0].amount.minus(entries[0].amount));
    expect(total.toFixed(8)).toBe('0.00000003');
  });
});
