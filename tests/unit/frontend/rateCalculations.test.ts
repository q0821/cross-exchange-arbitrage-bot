/**
 * Unit tests for frontend rate calculations
 * Feature 019: 修復費率差異根據時間基準動態計算
 */

import { describe, it, expect } from 'vitest';
import { recalculateBestPair } from '../../../app/(dashboard)/market-monitor/utils/rateCalculations';
import type { MarketRate, ExchangeRateData } from '../../../app/(dashboard)/market-monitor/types';

describe('rateCalculations - recalculateBestPair', () => {
  it('should calculate correct spread for 8h basis', () => {
    // Arrange: 模擬 BTC/USDT 的費率數據
    const mockRate: MarketRate = {
      symbol: 'BTCUSDT',
      exchanges: {
        binance: {
          rate: 0.0001,
          price: 91000,
          normalized: {
            '1h': 0.0000125,
            '4h': 0.00005,
            '8h': 0.0001,
            '24h': 0.0003,
          },
          originalInterval: 8,
        } as ExchangeRateData,
        okx: {
          rate: 0.0005,
          price: 91100,
          normalized: {
            '1h': 0.0000625,
            '4h': 0.00025,
            '8h': 0.0005,
            '24h': 0.0015,
          },
          originalInterval: 8,
        } as ExchangeRateData,
      },
      bestPair: null,
      status: 'normal',
      timestamp: new Date().toISOString(),
    };

    // Act: 使用 8 小時基準計算
    const result = recalculateBestPair(mockRate, 8);

    // Assert
    expect(result.bestPair).not.toBeNull();
    if (result.bestPair) {
      // 利差應該是 |0.0005 - 0.0001| = 0.0004
      expect(result.bestPair.spread).toBeCloseTo(0.0004, 6);

      // 利差百分比 = 0.0004 * 100 = 0.04%
      expect(result.bestPair.spreadPercent).toBeCloseTo(0.04, 4);

      // 年化收益 = 0.0004 × 365 × (24 / 8) × 100 = 43.8%
      const expectedAnnualized = 0.0004 * 365 * (24 / 8) * 100;
      expect(result.bestPair.annualizedReturn).toBeCloseTo(expectedAnnualized, 2);

      // Binance 費率低,應該做多
      expect(result.bestPair.longExchange).toBe('binance');

      // OKX 費率高,應該做空
      expect(result.bestPair.shortExchange).toBe('okx');
    }
  });

  it('should calculate correct spread for 1h basis', () => {
    // Arrange: 同樣的數據
    const mockRate: MarketRate = {
      symbol: 'BTCUSDT',
      exchanges: {
        binance: {
          rate: 0.0001,
          price: 91000,
          normalized: {
            '1h': 0.0000125,
            '4h': 0.00005,
            '8h': 0.0001,
            '24h': 0.0003,
          },
          originalInterval: 8,
        } as ExchangeRateData,
        okx: {
          rate: 0.0005,
          price: 91100,
          normalized: {
            '1h': 0.0000625,
            '4h': 0.00025,
            '8h': 0.0005,
            '24h': 0.0015,
          },
          originalInterval: 8,
        } as ExchangeRateData,
      },
      bestPair: null,
      status: 'normal',
      timestamp: new Date().toISOString(),
    };

    // Act: 使用 1 小時基準計算
    const result = recalculateBestPair(mockRate, 1);

    // Assert
    expect(result.bestPair).not.toBeNull();
    if (result.bestPair) {
      // 1h 基準: 利差 = |0.0000625 - 0.0000125| = 0.00005
      expect(result.bestPair.spread).toBeCloseTo(0.00005, 7);

      // 年化收益 = 0.00005 × 365 × (24 / 1) × 100 = 43.8%
      const expectedAnnualized = 0.00005 * 365 * (24 / 1) * 100;
      expect(result.bestPair.annualizedReturn).toBeCloseTo(expectedAnnualized, 2);
    }
  });

  it('should calculate correct spread for 24h basis', () => {
    // Arrange
    const mockRate: MarketRate = {
      symbol: 'BTCUSDT',
      exchanges: {
        binance: {
          rate: 0.0001,
          price: 91000,
          normalized: {
            '1h': 0.0000125,
            '4h': 0.00005,
            '8h': 0.0001,
            '24h': 0.0003,
          },
          originalInterval: 8,
        } as ExchangeRateData,
        okx: {
          rate: 0.0005,
          price: 91100,
          normalized: {
            '1h': 0.0000625,
            '4h': 0.00025,
            '8h': 0.0005,
            '24h': 0.0015,
          },
          originalInterval: 8,
        } as ExchangeRateData,
      },
      bestPair: null,
      status: 'normal',
      timestamp: new Date().toISOString(),
    };

    // Act: 使用 24 小時基準計算
    const result = recalculateBestPair(mockRate, 24);

    // Assert
    expect(result.bestPair).not.toBeNull();
    if (result.bestPair) {
      // 24h 基準: 利差 = |0.0015 - 0.0003| = 0.0012
      expect(result.bestPair.spread).toBeCloseTo(0.0012, 6);

      // 年化收益 = 0.0012 × 365 × (24 / 24) × 100 = 43.8%
      const expectedAnnualized = 0.0012 * 365 * (24 / 24) * 100;
      expect(result.bestPair.annualizedReturn).toBeCloseTo(expectedAnnualized, 2);
    }
  });

  it('should use original rate when no normalized rate exists', () => {
    // Arrange: 沒有標準化費率的情況
    const mockRate: MarketRate = {
      symbol: 'ETHUSDT',
      exchanges: {
        binance: {
          rate: 0.0002,
          price: 3000,
          // 沒有 normalized 欄位
          originalInterval: 8,
        } as ExchangeRateData,
        okx: {
          rate: 0.0006,
          price: 3010,
          // 沒有 normalized 欄位
          originalInterval: 8,
        } as ExchangeRateData,
      },
      bestPair: null,
      status: 'normal',
      timestamp: new Date().toISOString(),
    };

    // Act: 使用 1 小時基準計算
    const result = recalculateBestPair(mockRate, 1);

    // Assert: 應該使用原始費率
    expect(result.bestPair).not.toBeNull();
    if (result.bestPair) {
      // 利差 = |0.0006 - 0.0002| = 0.0004
      expect(result.bestPair.spread).toBeCloseTo(0.0004, 6);
    }
  });

  it('should return null bestPair when only one exchange', () => {
    // Arrange: 只有一個交易所
    const mockRate: MarketRate = {
      symbol: 'SOLUSDT',
      exchanges: {
        binance: {
          rate: 0.0001,
          price: 100,
          originalInterval: 8,
        } as ExchangeRateData,
      },
      bestPair: null,
      status: 'normal',
      timestamp: new Date().toISOString(),
    };

    // Act
    const result = recalculateBestPair(mockRate, 8);

    // Assert: 無法計算套利對
    expect(result.bestPair).toBeNull();
    expect(result.status).toBe('normal');
  });

  it('should find best pair among 4 exchanges', () => {
    // Arrange: 4 個交易所
    const mockRate: MarketRate = {
      symbol: 'BTCUSDT',
      exchanges: {
        binance: {
          rate: 0.0001,
          price: 91000,
          normalized: { '8h': 0.0001 },
          originalInterval: 8,
        } as ExchangeRateData,
        okx: {
          rate: 0.0005,
          price: 91100,
          normalized: { '8h': 0.0005 },
          originalInterval: 8,
        } as ExchangeRateData,
        mexc: {
          rate: 0.0003,
          price: 91050,
          normalized: { '8h': 0.0003 },
          originalInterval: 8,
        } as ExchangeRateData,
        gateio: {
          rate: 0.0002,
          price: 91020,
          normalized: { '8h': 0.0002 },
          originalInterval: 8,
        } as ExchangeRateData,
      },
      bestPair: null,
      status: 'normal',
      timestamp: new Date().toISOString(),
    };

    // Act
    const result = recalculateBestPair(mockRate, 8);

    // Assert: 應該找到 Binance(0.0001) 和 OKX(0.0005) 的組合
    expect(result.bestPair).not.toBeNull();
    if (result.bestPair) {
      expect(result.bestPair.longExchange).toBe('binance');
      expect(result.bestPair.shortExchange).toBe('okx');
      expect(result.bestPair.spread).toBeCloseTo(0.0004, 6);
    }
  });

  it('should set status to opportunity when spread >= 0.5%', () => {
    // Arrange: 高利差情況
    const mockRate: MarketRate = {
      symbol: 'BTCUSDT',
      exchanges: {
        binance: {
          rate: 0.001,
          price: 91000,
          normalized: { '8h': 0.001 },
          originalInterval: 8,
        } as ExchangeRateData,
        okx: {
          rate: 0.006,
          price: 91100,
          normalized: { '8h': 0.006 },
          originalInterval: 8,
        } as ExchangeRateData,
      },
      bestPair: null,
      status: 'normal',
      timestamp: new Date().toISOString(),
    };

    // Act
    const result = recalculateBestPair(mockRate, 8);

    // Assert: 利差 0.5% (0.005),狀態應該是 opportunity
    expect(result.status).toBe('opportunity');
    if (result.bestPair) {
      expect(result.bestPair.spreadPercent).toBeCloseTo(0.5, 2);
    }
  });

  it('should set status to approaching when spread >= 0.4% and < 0.5%', () => {
    // Arrange: 接近閾值的情況
    const mockRate: MarketRate = {
      symbol: 'BTCUSDT',
      exchanges: {
        binance: {
          rate: 0.001,
          price: 91000,
          normalized: { '8h': 0.001 },
          originalInterval: 8,
        } as ExchangeRateData,
        okx: {
          rate: 0.0055,
          price: 91100,
          normalized: { '8h': 0.0055 },
          originalInterval: 8,
        } as ExchangeRateData,
      },
      bestPair: null,
      status: 'normal',
      timestamp: new Date().toISOString(),
    };

    // Act
    const result = recalculateBestPair(mockRate, 8);

    // Assert: 利差 0.45% (0.0045),狀態應該是 approaching
    expect(result.status).toBe('approaching');
    if (result.bestPair) {
      expect(result.bestPair.spreadPercent).toBeCloseTo(0.45, 2);
    }
  });
});
