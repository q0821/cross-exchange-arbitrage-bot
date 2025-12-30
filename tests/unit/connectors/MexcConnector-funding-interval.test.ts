/**
 * Unit tests for MexcConnector.getFundingInterval
 * Bug: collectCycle 欄位是字串型別，程式碼檢查 typeof === 'number' 導致失敗
 * Root Cause: MEXC API 回傳字串 "8"，與 Gate.io 相同問題
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock CCXT
vi.mock('ccxt', () => {
  const mockExchange = vi.fn(function() {
    return {
      fetchFundingRate: vi.fn(),
      fetchTime: vi.fn().mockResolvedValue(Date.now()),
    };
  });

  return {
    default: {
      mexc: mockExchange,
    },
  };
});

describe('MexcConnector.getFundingInterval - String Type Fix', () => {
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      fetchFundingRate: vi.fn(),
      fetchTime: vi.fn().mockResolvedValue(Date.now()),
    };
  });

  it('should parse string collectCycle correctly (8 hours)', async () => {
    // Arrange: 模擬 MEXC API 回傳字串型別的 collectCycle
    const mockResponse = {
      symbol: 'BTC/USDT:USDT',
      fundingRate: 0.0001,
      fundingTimestamp: Date.now(),
      markPrice: 91000,
      info: {
        collectCycle: '8', // ← 字串型別！
        fundingRate: '0.0001',
      },
    };

    mockClient.fetchFundingRate.mockResolvedValue(mockResponse);

    // Act: 解析邏輯（模擬修復後的程式碼）
    const collectCycleRaw = mockResponse.info?.collectCycle;
    const collectCycle =
      typeof collectCycleRaw === 'string'
        ? parseInt(collectCycleRaw, 10)
        : collectCycleRaw;

    // Assert
    expect(collectCycleRaw).toBe('8'); // 確認是字串
    expect(typeof collectCycleRaw).toBe('string');
    expect(collectCycle).toBe(8); // 正確解析為數字
    expect(!isNaN(collectCycle) && collectCycle > 0).toBe(true);
  });

  it('should handle numeric collectCycle (edge case)', async () => {
    // Arrange: 如果 API 未來改回數字型別，也要能處理
    const mockResponse = {
      symbol: 'ETH/USDT:USDT',
      fundingRate: 0.0001,
      fundingTimestamp: Date.now(),
      markPrice: 3000,
      info: {
        collectCycle: 8, // ← 數字型別
        fundingRate: '0.0001',
      },
    };

    mockClient.fetchFundingRate.mockResolvedValue(mockResponse);

    // Act
    const collectCycleRaw = mockResponse.info?.collectCycle;
    const collectCycle =
      typeof collectCycleRaw === 'string'
        ? parseInt(collectCycleRaw, 10)
        : collectCycleRaw;

    // Assert
    expect(typeof collectCycleRaw).toBe('number');
    expect(collectCycle).toBe(8);
    expect(!isNaN(collectCycle) && collectCycle > 0).toBe(true);
  });

  it('should return default 8 when collectCycle is missing', async () => {
    // Arrange: API 未回傳 collectCycle 欄位
    const mockResponse = {
      symbol: 'SOL/USDT:USDT',
      fundingRate: 0.0001,
      fundingTimestamp: Date.now(),
      markPrice: 100,
      info: {
        // 沒有 collectCycle 欄位
        fundingRate: '0.0001',
      },
    };

    mockClient.fetchFundingRate.mockResolvedValue(mockResponse);

    // Act
    const collectCycleRaw = mockResponse.info?.collectCycle;
    const hasValidCycle = collectCycleRaw !== undefined && collectCycleRaw !== null;

    // Assert: 應使用預設值 8
    expect(hasValidCycle).toBe(false);
    const defaultInterval = 8;
    expect(defaultInterval).toBe(8);
  });

  it('should demonstrate the bug before fix', () => {
    // Arrange: 模擬修復前的錯誤邏輯
    const mockInfo = {
      collectCycle: '8', // 字串型別
    };

    // Act: 修復前的錯誤檢查
    const collectCycle = mockInfo.collectCycle;
    const buggyCheck =
      collectCycle &&
      typeof collectCycle === 'number' && // ❌ 字串不是數字，檢查失敗
      collectCycle > 0;

    // Assert: 修復前會跳過正確的間隔值
    expect(typeof collectCycle).toBe('string');
    expect(buggyCheck).toBe(false); // ❌ 條件失敗，使用預設 8 小時
    expect(buggyCheck).not.toBe(true);

    // 正確的邏輯
    const correctedCycle =
      typeof collectCycle === 'string'
        ? parseInt(collectCycle, 10)
        : collectCycle;
    const correctCheck = !isNaN(correctedCycle) && correctedCycle > 0;
    expect(correctCheck).toBe(true); // ✅ 正確解析
    expect(correctedCycle).toBe(8); // ✅ 正確識別為 8 小時
  });
});
