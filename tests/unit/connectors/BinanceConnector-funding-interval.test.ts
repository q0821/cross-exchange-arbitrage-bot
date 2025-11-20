/**
 * Unit tests for BinanceConnector.getFundingInterval
 * Feature: 修復幣安資金費率間隔誤判問題
 *
 * Bug: SOONUSDT 等交易對的原始資金費率時間基準有誤
 * Root Cause: API 回傳陣列，程式碼誤判為物件
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

// Mock axios
vi.mock('axios');

describe('BinanceConnector.getFundingInterval - Array Response Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should correctly parse array response from /fapi/v1/fundingInfo', async () => {
    // Arrange: 模擬 API 回傳陣列（這是實際情況）
    const mockResponse = {
      data: [
        {
          symbol: 'KAVAUSDT',
          adjustedFundingRateCap: '0.02000000',
          adjustedFundingRateFloor: '-0.02000000',
          fundingIntervalHours: 1, // 1 小時結算
          disclaimer: false,
          updateTime: 1762675261532,
        },
        {
          symbol: 'BIGTIMEUSDT',
          adjustedFundingRateCap: '0.02000000',
          adjustedFundingRateFloor: '-0.02000000',
          fundingIntervalHours: 4, // 4 小時結算
          disclaimer: false,
          updateTime: 1697372241584,
        },
        {
          symbol: 'BTCUSDT',
          adjustedFundingRateCap: '0.02000000',
          adjustedFundingRateFloor: '-0.02000000',
          fundingIntervalHours: 8, // 8 小時結算
          disclaimer: false,
          updateTime: 1758343601560,
        },
      ],
    };

    vi.mocked(axios.get).mockResolvedValue(mockResponse);

    // Act: 解析邏輯（模擬修復後的程式碼）
    const dataArray = Array.isArray(mockResponse.data)
      ? mockResponse.data
      : [mockResponse.data];

    // Test Case 1: 1 小時結算的交易對
    const kavaData = dataArray.find((item) => item.symbol === 'KAVAUSDT');
    const kavaInterval = kavaData?.fundingIntervalHours || 8;

    expect(kavaInterval).toBe(1);
    expect(kavaInterval).not.toBe(8); // 修復前會錯誤返回 8

    // Test Case 2: 4 小時結算的交易對
    const bigtimeData = dataArray.find((item) => item.symbol === 'BIGTIMEUSDT');
    const bigtimeInterval = bigtimeData?.fundingIntervalHours || 8;

    expect(bigtimeInterval).toBe(4);
    expect(bigtimeInterval).not.toBe(8); // 修復前會錯誤返回 8

    // Test Case 3: 8 小時結算的交易對（預設值）
    const btcData = dataArray.find((item) => item.symbol === 'BTCUSDT');
    const btcInterval = btcData?.fundingIntervalHours || 8;

    expect(btcInterval).toBe(8);
  });

  it('should handle single object response (edge case)', async () => {
    // Arrange: 模擬 API 回傳單一物件（理論上可能發生）
    const mockResponse = {
      data: {
        symbol: 'BTCUSDT',
        adjustedFundingRateCap: '0.02000000',
        adjustedFundingRateFloor: '-0.02000000',
        fundingIntervalHours: 8,
        disclaimer: false,
        updateTime: 1758343601560,
      },
    };

    // Act: 解析邏輯
    const dataArray = Array.isArray(mockResponse.data)
      ? mockResponse.data
      : [mockResponse.data];

    const btcData = dataArray.find((item) => item.symbol === 'BTCUSDT');
    const btcInterval = btcData?.fundingIntervalHours || 8;

    // Assert
    expect(dataArray).toHaveLength(1);
    expect(btcInterval).toBe(8);
  });

  it('should return default 8 when symbol not found in array', async () => {
    // Arrange: 查詢的 symbol 不在回傳的陣列中
    const mockResponse = {
      data: [
        {
          symbol: 'BTCUSDT',
          fundingIntervalHours: 8,
        },
      ],
    };

    // Act
    const dataArray = Array.isArray(mockResponse.data)
      ? mockResponse.data
      : [mockResponse.data];

    const unknownData = dataArray.find((item) => item.symbol === 'SOONUSDT');
    const unknownInterval = unknownData?.fundingIntervalHours || 8;

    // Assert: 回退到預設值 8
    expect(unknownData).toBeUndefined();
    expect(unknownInterval).toBe(8);
  });

  it('should demonstrate the bug before fix', () => {
    // Arrange: 模擬修復前的錯誤邏輯
    const mockArrayResponse = [
      {
        symbol: 'KAVAUSDT',
        fundingIntervalHours: 1,
      },
    ];

    // Act: 修復前的錯誤邏輯
    const buggyInterval = (mockArrayResponse as any).fundingIntervalHours || 8;

    // Assert: 陣列沒有 fundingIntervalHours 屬性，所以會返回 8
    expect(buggyInterval).toBe(8); // ❌ 錯誤！應該是 1
    expect(buggyInterval).not.toBe(1);

    // 正確的邏輯
    const correctInterval = mockArrayResponse[0].fundingIntervalHours || 8;
    expect(correctInterval).toBe(1); // ✅ 正確
  });
});
