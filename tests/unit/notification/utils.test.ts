/**
 * Test: Notification Utils
 *
 * 通知服務工具函式單元測試
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateOpenPositionUrl,
  generateExchangeUrl,
  formatPercent,
  formatPrice,
  formatPriceSmart,
  formatDuration,
  formatSpreadStats,
  formatTime,
  formatProfitInfo,
  formatProfitInfoDiscord,
  buildTriggerNotificationMessage,
  buildEmergencyNotificationMessage,
} from '@/services/notification/utils';

describe('Notification Utils', () => {
  describe('generateOpenPositionUrl', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      vi.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should use NEXT_PUBLIC_BASE_URL when available', () => {
      process.env.NEXT_PUBLIC_BASE_URL = 'https://my-app.com';
      process.env.NEXT_PUBLIC_WS_URL = 'https://ws.example.com';

      const url = generateOpenPositionUrl('BTCUSDT', 'binance', 'okx');

      expect(url).toBe('https://my-app.com/market-monitor?symbol=BTCUSDT&long=binance&short=okx');
    });

    it('should fallback to NEXT_PUBLIC_WS_URL', () => {
      delete process.env.NEXT_PUBLIC_BASE_URL;
      process.env.NEXT_PUBLIC_WS_URL = 'https://ws.example.com';

      const url = generateOpenPositionUrl('ETHUSDT', 'okx', 'gateio');

      expect(url).toBe('https://ws.example.com/market-monitor?symbol=ETHUSDT&long=okx&short=gateio');
    });

    it('should fallback to localhost when no env vars', () => {
      delete process.env.NEXT_PUBLIC_BASE_URL;
      delete process.env.NEXT_PUBLIC_WS_URL;

      const url = generateOpenPositionUrl('SOLUSDT', 'mexc', 'binance');

      expect(url).toBe('http://localhost:3000/market-monitor?symbol=SOLUSDT&long=mexc&short=binance');
    });

    it('should lowercase exchange names', () => {
      delete process.env.NEXT_PUBLIC_BASE_URL;
      delete process.env.NEXT_PUBLIC_WS_URL;

      const url = generateOpenPositionUrl('BTCUSDT', 'BINANCE', 'OKX');

      expect(url).toContain('long=binance&short=okx');
    });
  });

  describe('generateExchangeUrl', () => {
    it('should generate Binance URL', () => {
      const url = generateExchangeUrl('binance', 'BTCUSDT');
      expect(url).toBe('https://www.binance.com/zh-TC/futures/BTCUSDT');
    });

    it('should generate OKX URL with SWAP format', () => {
      const url = generateExchangeUrl('okx', 'BTCUSDT');
      expect(url).toBe('https://www.okx.com/zh-hant/trade-swap/BTC-USDT-SWAP');
    });

    it('should generate MEXC URL', () => {
      const url = generateExchangeUrl('mexc', 'ETHUSDT');
      expect(url).toBe('https://futures.mexc.com/zh-TW/exchange/ETH_USDT');
    });

    it('should generate Gate.io URL (gate)', () => {
      const url = generateExchangeUrl('gate', 'SOLUSDT');
      expect(url).toBe('https://www.gate.io/zh-tw/futures_trade/USDT/SOL_USDT');
    });

    it('should generate Gate.io URL (gateio)', () => {
      const url = generateExchangeUrl('gateio', 'BTCUSDT');
      expect(url).toBe('https://www.gate.io/zh-tw/futures_trade/USDT/BTC_USDT');
    });

    it('should generate Bybit URL', () => {
      const url = generateExchangeUrl('bybit', 'BTCUSDT');
      expect(url).toBe('https://www.bybit.com/trade/usdt/BTCUSDT');
    });

    it('should generate Bitget URL', () => {
      const url = generateExchangeUrl('bitget', 'ETHUSDT');
      expect(url).toBe('https://www.bitget.com/futures/usdt/ETHUSDT');
    });

    it('should generate HTX URL', () => {
      const url = generateExchangeUrl('htx', 'BTCUSDT');
      expect(url).toBe('https://www.htx.com/futures/linear_swap/exchange#contract_code=BTC-USDT&type=cross');
    });

    it('should return generic URL for unknown exchange', () => {
      const url = generateExchangeUrl('unknown', 'BTCUSDT');
      expect(url).toBe('https://www.unknown.com');
    });

    it('should handle uppercase exchange names', () => {
      const url = generateExchangeUrl('BINANCE', 'BTCUSDT');
      expect(url).toBe('https://www.binance.com/zh-TC/futures/BTCUSDT');
    });
  });

  describe('formatPercent', () => {
    it('should format positive value', () => {
      expect(formatPercent(0.01)).toBe('1.0000%');
    });

    it('should format negative value', () => {
      expect(formatPercent(-0.0025)).toBe('-0.2500%');
    });

    it('should respect custom decimals', () => {
      expect(formatPercent(0.0123, 2)).toBe('1.23%');
    });

    it('should handle zero', () => {
      expect(formatPercent(0)).toBe('0.0000%');
    });
  });

  describe('formatPrice', () => {
    it('should format with dollar sign', () => {
      expect(formatPrice(100)).toBe('$100.00');
    });

    it('should format with custom decimals', () => {
      expect(formatPrice(95123.456, 4)).toBe('$95123.4560');
    });

    it('should handle zero', () => {
      expect(formatPrice(0)).toBe('$0.00');
    });
  });

  describe('formatPriceSmart', () => {
    it('should use 2 decimals for price >= 1', () => {
      expect(formatPriceSmart(100)).toBe('$100.00');
      expect(formatPriceSmart(1)).toBe('$1.00');
    });

    it('should use 4 decimals for price >= 0.01', () => {
      expect(formatPriceSmart(0.09)).toBe('$0.0900');
      expect(formatPriceSmart(0.01)).toBe('$0.0100');
    });

    it('should use 6 decimals for price < 0.01', () => {
      expect(formatPriceSmart(0.00999)).toBe('$0.009990');
      expect(formatPriceSmart(0.000123)).toBe('$0.000123');
    });
  });

  describe('formatDuration', () => {
    it('should format minutes only', () => {
      expect(formatDuration(30 * 60 * 1000)).toBe('30 分鐘');
    });

    it('should format hours only', () => {
      expect(formatDuration(2 * 60 * 60 * 1000)).toBe('2 小時');
    });

    it('should format hours and minutes', () => {
      expect(formatDuration(2.5 * 60 * 60 * 1000)).toBe('2 小時 30 分鐘');
    });

    it('should handle zero', () => {
      expect(formatDuration(0)).toBe('0 分鐘');
    });
  });

  describe('formatSpreadStats', () => {
    it('should format spread statistics', () => {
      const maxSpreadAt = new Date('2024-01-15T10:30:00');
      const result = formatSpreadStats(0.0005, 0.001, maxSpreadAt, 0.0002);

      expect(result).toContain('初始：0.05%');
      expect(result).toContain('最高：0.10%');
      expect(result).toContain('10:30');
      expect(result).toContain('結束：0.02%');
    });
  });

  describe('formatTime', () => {
    it('should format time as HH:MM', () => {
      const date = new Date('2024-01-15T08:30:00');
      const result = formatTime(date);

      expect(result).toMatch(/08:30/);
    });
  });

  describe('formatProfitInfo', () => {
    it('should format profit info with positive values', () => {
      const result = formatProfitInfo({
        longSettlementCount: 10,
        shortSettlementCount: 5,
        longExchange: 'binance',
        shortExchange: 'okx',
        longIntervalHours: 8,
        shortIntervalHours: 4,
        totalFundingProfit: 0.015,
        totalCost: 0.003,
        netProfit: 0.012,
        realizedAPY: 150,
      });

      expect(result).toContain('結算次數：15 次');
      expect(result).toContain('做多 BINANCE (8h)：10 次');
      expect(result).toContain('做空 OKX (4h)：5 次');
      expect(result).toContain('總費率收益：+1.50%');
      expect(result).toContain('開平倉成本：-0.30%');
      expect(result).toContain('淨收益：+1.20%');
      expect(result).toContain('實際 APY：150%');
    });

    it('should format profit info with negative values', () => {
      const result = formatProfitInfo({
        longSettlementCount: 2,
        shortSettlementCount: 2,
        longExchange: 'mexc',
        shortExchange: 'gateio',
        longIntervalHours: 8,
        shortIntervalHours: 8,
        totalFundingProfit: -0.005,
        totalCost: 0.003,
        netProfit: -0.008,
        realizedAPY: -50,
      });

      expect(result).toContain('總費率收益：-0.50%');
      expect(result).toContain('淨收益：-0.80%');
      expect(result).toContain('實際 APY：-50%');
    });
  });

  describe('formatProfitInfoDiscord', () => {
    it('should format with Discord bold markdown', () => {
      const result = formatProfitInfoDiscord({
        longSettlementCount: 10,
        shortSettlementCount: 5,
        longExchange: 'binance',
        shortExchange: 'okx',
        longIntervalHours: 8,
        shortIntervalHours: 4,
        totalFundingProfit: 0.015,
        totalCost: 0.003,
        netProfit: 0.012,
        realizedAPY: 150,
      });

      expect(result).toContain('淨收益：**+1.20%**');
      expect(result).toContain('實際 APY：**150%**');
    });
  });

  describe('buildTriggerNotificationMessage', () => {
    it('should build complete trigger notification message', () => {
      const openedAt = new Date('2024-01-15T08:00:00Z');
      const closedAt = new Date('2024-01-15T10:30:00Z');

      const result = buildTriggerNotificationMessage({
        positionId: 'pos-123',
        symbol: 'BTCUSDT',
        triggerType: 'LONG_SL',
        triggeredExchange: 'binance',
        triggeredSide: 'LONG',
        triggerPrice: 94000,
        closedExchange: 'okx',
        closedSide: 'SHORT',
        closePrice: 94050,
        positionSize: 1000,
        leverage: 5,
        openedAt,
        closedAt,
        pnl: {
          priceDiffPnL: 50,
          fundingRatePnL: 10,
          totalFees: 5,
          totalPnL: 55,
          roi: 2.75,
        },
      });

      expect(result.positionId).toBe('pos-123');
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.triggerType).toBe('LONG_SL');
      expect(result.triggeredExchange).toBe('binance');
      expect(result.triggeredSide).toBe('LONG');
      expect(result.triggerPrice).toBe(94000);
      expect(result.closedExchange).toBe('okx');
      expect(result.closedSide).toBe('SHORT');
      expect(result.closePrice).toBe(94050);
      expect(result.positionSize).toBe(1000);
      expect(result.leverage).toBe(5);
      expect(result.pnl.totalPnL).toBe(55);
      expect(result.holdingDuration).toBe('2 小時 30 分鐘');
      expect(result.triggeredAt).toEqual(closedAt);
      expect(result.closedAt).toEqual(closedAt);
    });

    it('should handle optional trigger price', () => {
      const result = buildTriggerNotificationMessage({
        positionId: 'pos-456',
        symbol: 'ETHUSDT',
        triggerType: 'SHORT_TP',
        triggeredExchange: 'okx',
        triggeredSide: 'SHORT',
        closedExchange: 'binance',
        closedSide: 'LONG',
        positionSize: 500,
        leverage: 3,
        openedAt: new Date('2024-01-15T00:00:00Z'),
        closedAt: new Date('2024-01-15T01:00:00Z'),
        pnl: {
          priceDiffPnL: 20,
          fundingRatePnL: 5,
          totalFees: 3,
          totalPnL: 22,
          roi: 1.5,
        },
      });

      expect(result.triggerPrice).toBeUndefined();
      expect(result.closePrice).toBeUndefined();
      expect(result.holdingDuration).toBe('1 小時');
    });
  });

  describe('buildEmergencyNotificationMessage', () => {
    it('should build emergency notification message', () => {
      const result = buildEmergencyNotificationMessage({
        positionId: 'pos-789',
        symbol: 'SOLUSDT',
        triggerType: 'LONG_SL',
        triggeredExchange: 'binance',
        error: 'Insufficient balance for closing',
        requiresManualIntervention: true,
      });

      expect(result.positionId).toBe('pos-789');
      expect(result.symbol).toBe('SOLUSDT');
      expect(result.triggerType).toBe('LONG_SL');
      expect(result.triggeredExchange).toBe('binance');
      expect(result.error).toBe('Insufficient balance for closing');
      expect(result.requiresManualIntervention).toBe(true);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should handle various trigger types', () => {
      const triggerTypes = ['LONG_SL', 'LONG_TP', 'SHORT_SL', 'SHORT_TP', 'BOTH'] as const;

      triggerTypes.forEach((triggerType) => {
        const result = buildEmergencyNotificationMessage({
          positionId: 'pos-test',
          symbol: 'BTCUSDT',
          triggerType,
          triggeredExchange: 'okx',
          error: 'Test error',
          requiresManualIntervention: false,
        });

        expect(result.triggerType).toBe(triggerType);
      });
    });
  });
});
