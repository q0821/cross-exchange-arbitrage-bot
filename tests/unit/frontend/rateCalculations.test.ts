/**
 * Unit tests for frontend rate calculations
 * Feature 019: 修復費率差異根據時間基準動態計算
 * Feature 022: 年化收益門檻套利機會偵測
 */

import { describe, it, expect } from 'vitest';
import {
  recalculateBestPair,
  DEFAULT_OPPORTUNITY_THRESHOLD_ANNUALIZED,
  DEFAULT_APPROACHING_THRESHOLD_ANNUALIZED,
} from '../../../app/(dashboard)/market-monitor/utils/rateCalculations';
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

  it('should calculate normalized rate on-the-fly when no normalized rate exists', () => {
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

    // Assert: 應該即時計算標準化費率
    // 8h -> 1h: rate × (1/8)
    // binance: 0.0002 × (1/8) = 0.000025
    // okx: 0.0006 × (1/8) = 0.000075
    // 利差 = 0.000075 - 0.000025 = 0.00005
    expect(result.bestPair).not.toBeNull();
    if (result.bestPair) {
      expect(result.bestPair.spread).toBeCloseTo(0.00005, 7);
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

  it('should set status to opportunity when annualized return >= 800%', () => {
    // Arrange: 高年化收益情況
    // 8h 基準，年化收益 800% 需要利差 = 800 / (365 × 3 × 100) ≈ 0.73%
    // 使用利差 1% 確保超過門檻
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
          rate: 0.011,
          price: 91100,
          normalized: { '8h': 0.011 },
          originalInterval: 8,
        } as ExchangeRateData,
      },
      bestPair: null,
      status: 'normal',
      timestamp: new Date().toISOString(),
    };

    // Act
    const result = recalculateBestPair(mockRate, 8);

    // Assert: 利差 1% (0.01)，年化 = 0.01 × 365 × 3 × 100 = 1095%
    expect(result.status).toBe('opportunity');
    if (result.bestPair) {
      expect(result.bestPair.spreadPercent).toBeCloseTo(1, 2);
      expect(result.bestPair.annualizedReturn).toBeGreaterThanOrEqual(
        DEFAULT_OPPORTUNITY_THRESHOLD_ANNUALIZED
      );
    }
  });

  it('should set status to approaching when 600% <= annualized < 800%', () => {
    // Arrange: 接近閾值的情況
    // 8h 基準，年化收益 700% 需要利差 = 700 / (365 × 3 × 100) ≈ 0.64%
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
          rate: 0.0074,
          price: 91100,
          normalized: { '8h': 0.0074 },
          originalInterval: 8,
        } as ExchangeRateData,
      },
      bestPair: null,
      status: 'normal',
      timestamp: new Date().toISOString(),
    };

    // Act
    const result = recalculateBestPair(mockRate, 8);

    // Assert: 利差 0.64%，年化約 700%，應該是 approaching
    expect(result.status).toBe('approaching');
    if (result.bestPair) {
      expect(result.bestPair.annualizedReturn).toBeGreaterThanOrEqual(
        DEFAULT_APPROACHING_THRESHOLD_ANNUALIZED
      );
      expect(result.bestPair.annualizedReturn).toBeLessThan(
        DEFAULT_OPPORTUNITY_THRESHOLD_ANNUALIZED
      );
    }
  });

  it('should set status to normal when annualized < 600%', () => {
    // Arrange: 低年化收益
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
          rate: 0.004,
          price: 91100,
          normalized: { '8h': 0.004 },
          originalInterval: 8,
        } as ExchangeRateData,
      },
      bestPair: null,
      status: 'normal',
      timestamp: new Date().toISOString(),
    };

    // Act
    const result = recalculateBestPair(mockRate, 8);

    // Assert: 利差 0.3%，年化 = 0.003 × 365 × 3 × 100 ≈ 328.5%
    expect(result.status).toBe('normal');
    if (result.bestPair) {
      expect(result.bestPair.annualizedReturn).toBeLessThan(
        DEFAULT_APPROACHING_THRESHOLD_ANNUALIZED
      );
    }
  });
});

describe('rateCalculations - Cross Time Basis Consistency (Feature 022)', () => {
  /**
   * 關鍵測試：同一交易對在切換時間基準時，套利狀態應保持一致
   * 因為年化收益在任何時間基準下計算結果相同
   */
  it('should maintain consistent opportunity status across all time bases', () => {
    // Arrange: 設定一個高年化收益的交易對（約 900%）
    // 8h 基準下利差約 0.82% 對應 900% 年化
    const mockRate: MarketRate = {
      symbol: 'BTCUSDT',
      exchanges: {
        binance: {
          rate: 0.0001,
          price: 91000,
          normalized: {
            '1h': 0.0000125, // 0.0001 × (1/8)
            '4h': 0.00005, // 0.0001 × (4/8)
            '8h': 0.0001, // 原始
            '24h': 0.0003, // 0.0001 × (24/8)
          },
          originalInterval: 8,
        } as ExchangeRateData,
        okx: {
          rate: 0.0083,
          price: 91100,
          normalized: {
            '1h': 0.00103750, // 0.0083 × (1/8)
            '4h': 0.004150, // 0.0083 × (4/8)
            '8h': 0.0083, // 原始
            '24h': 0.0249, // 0.0083 × (24/8)
          },
          originalInterval: 8,
        } as ExchangeRateData,
      },
      bestPair: null,
      status: 'normal',
      timestamp: new Date().toISOString(),
    };

    // Act: 在所有時間基準下計算
    const result1h = recalculateBestPair(mockRate, 1);
    const result4h = recalculateBestPair(mockRate, 4);
    const result8h = recalculateBestPair(mockRate, 8);
    const result24h = recalculateBestPair(mockRate, 24);

    // Assert: 所有時間基準下狀態應一致
    expect(result1h.status).toBe('opportunity');
    expect(result4h.status).toBe('opportunity');
    expect(result8h.status).toBe('opportunity');
    expect(result24h.status).toBe('opportunity');

    // 驗證年化收益在所有時間基準下接近相同
    if (
      result1h.bestPair &&
      result4h.bestPair &&
      result8h.bestPair &&
      result24h.bestPair
    ) {
      const annualized1h = result1h.bestPair.annualizedReturn;
      const annualized4h = result4h.bestPair.annualizedReturn;
      const annualized8h = result8h.bestPair.annualizedReturn;
      const annualized24h = result24h.bestPair.annualizedReturn;

      // 允許小誤差（由於浮點數計算）
      expect(annualized1h).toBeCloseTo(annualized8h, 0);
      expect(annualized4h).toBeCloseTo(annualized8h, 0);
      expect(annualized24h).toBeCloseTo(annualized8h, 0);
    }
  });

  it('should maintain consistent approaching status across all time bases', () => {
    // Arrange: 設定一個接近門檻的交易對（約 700%）
    // 8h 基準下利差約 0.64% 對應 700% 年化
    const mockRate: MarketRate = {
      symbol: 'ETHUSDT',
      exchanges: {
        binance: {
          rate: 0.0001,
          price: 3000,
          normalized: {
            '1h': 0.0000125,
            '4h': 0.00005,
            '8h': 0.0001,
            '24h': 0.0003,
          },
          originalInterval: 8,
        } as ExchangeRateData,
        okx: {
          rate: 0.0065,
          price: 3010,
          normalized: {
            '1h': 0.0008125,
            '4h': 0.00325,
            '8h': 0.0065,
            '24h': 0.0195,
          },
          originalInterval: 8,
        } as ExchangeRateData,
      },
      bestPair: null,
      status: 'normal',
      timestamp: new Date().toISOString(),
    };

    // Act
    const result1h = recalculateBestPair(mockRate, 1);
    const result4h = recalculateBestPair(mockRate, 4);
    const result8h = recalculateBestPair(mockRate, 8);
    const result24h = recalculateBestPair(mockRate, 24);

    // Assert: 所有時間基準下狀態應一致為 approaching
    expect(result1h.status).toBe('approaching');
    expect(result4h.status).toBe('approaching');
    expect(result8h.status).toBe('approaching');
    expect(result24h.status).toBe('approaching');
  });

  it('should maintain consistent normal status across all time bases', () => {
    // Arrange: 設定一個低年化收益的交易對（約 400%）
    const mockRate: MarketRate = {
      symbol: 'SOLUSDT',
      exchanges: {
        binance: {
          rate: 0.0001,
          price: 100,
          normalized: {
            '1h': 0.0000125,
            '4h': 0.00005,
            '8h': 0.0001,
            '24h': 0.0003,
          },
          originalInterval: 8,
        } as ExchangeRateData,
        okx: {
          rate: 0.0038,
          price: 100.5,
          normalized: {
            '1h': 0.000475,
            '4h': 0.0019,
            '8h': 0.0038,
            '24h': 0.0114,
          },
          originalInterval: 8,
        } as ExchangeRateData,
      },
      bestPair: null,
      status: 'normal',
      timestamp: new Date().toISOString(),
    };

    // Act
    const result1h = recalculateBestPair(mockRate, 1);
    const result4h = recalculateBestPair(mockRate, 4);
    const result8h = recalculateBestPair(mockRate, 8);
    const result24h = recalculateBestPair(mockRate, 24);

    // Assert: 所有時間基準下狀態應一致為 normal
    expect(result1h.status).toBe('normal');
    expect(result4h.status).toBe('normal');
    expect(result8h.status).toBe('normal');
    expect(result24h.status).toBe('normal');
  });
});
