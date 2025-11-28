/**
 * Unit tests for formatArbitrageMessage function
 *
 * Feature 025: 價差回本週期指標 (User Story 4)
 *
 * 測試複製訊息中包含回本資訊
 */

import { describe, it, expect } from 'vitest';
import { formatArbitrageMessage } from '../../../app/(dashboard)/market-monitor/utils/formatArbitrageMessage';
import type { MarketRate } from '../../../app/(dashboard)/market-monitor/types';

describe('formatArbitrageMessage - Feature 025 (US4)', () => {
  // 基礎測試資料
  const createMockRate = (
    priceDiffPercent: number | null,
    spreadPercent: number
  ): MarketRate => ({
    symbol: 'BTCUSDT',
    exchanges: {
      binance: {
        rate: 0.01,
        nextFundingTime: new Date(),
        price: 50000,
        originalInterval: 8,
      },
      okx: {
        rate: -0.04,
        nextFundingTime: new Date(),
        price: 49925,
        originalInterval: 8,
      },
    },
    bestPair: {
      longExchange: 'binance',
      shortExchange: 'okx',
      spread: spreadPercent / 100,
      spreadPercent,
      annualizedReturn: 800,
      priceDiffPercent,
    },
    status: 'opportunity',
    lastUpdate: new Date(),
  });

  describe('US4: payback_needed status', () => {
    it('should include payback info in message when price diff is negative', () => {
      const rate = createMockRate(-0.15, 0.05);
      const message = formatArbitrageMessage(rate, 8);

      // 驗證訊息包含回本資訊
      expect(message).toContain('價差回本');
      expect(message).toContain('3.0 次資費');
      // 24 小時 = 1 天
      expect(message).toContain('1.0 天');
    });

    it('should format payback message correctly for different values', () => {
      const rate = createMockRate(-0.30, 0.10);
      const message = formatArbitrageMessage(rate, 8);

      // 0.30 / 0.10 = 3.0 次，3.0 * 8 = 24 小時
      expect(message).toContain('3.0 次資費');
    });

    it('should show estimated time based on time basis', () => {
      const rate = createMockRate(-0.15, 0.05);

      // 8h 基準：3.0 * 8 = 24 小時 = 1 天
      const message8h = formatArbitrageMessage(rate, 8);
      expect(message8h).toContain('1.0 天');

      // 1h 基準：3.0 * 1 = 3 小時
      const message1h = formatArbitrageMessage(rate, 1);
      expect(message1h).toContain('3.0 小時');
    });
  });

  describe('US4: favorable status', () => {
    it('should include favorable message when price diff is positive', () => {
      const rate = createMockRate(0.15, 0.03);
      const message = formatArbitrageMessage(rate, 8);

      // 驗證訊息包含「價差有利」資訊
      expect(message).toContain('價差回本');
      expect(message).toContain('價差有利');
      expect(message).toContain('建倉即有正報酬');
    });

    it('should include favorable message when price diff is zero', () => {
      const rate = createMockRate(0, 0.05);
      const message = formatArbitrageMessage(rate, 8);

      expect(message).toContain('價差有利');
    });
  });

  describe('US4: too_many status', () => {
    it('should include warning message when payback periods exceed 100', () => {
      const rate = createMockRate(-1.5, 0.01);
      const message = formatArbitrageMessage(rate, 8);

      // 1.5 / 0.01 = 150 次（超過 100）
      expect(message).toContain('價差回本');
      expect(message).toContain('回本次數過多');
      expect(message).toContain('不建議建倉');
    });

    it('should show warning for impossible payback when spread is zero', () => {
      const rate = createMockRate(-0.15, 0);
      const message = formatArbitrageMessage(rate, 8);

      expect(message).toContain('回本次數過多');
      expect(message).toContain('不建議建倉');
    });
  });

  describe('US4: message format validation', () => {
    it('should maintain existing message structure', () => {
      const rate = createMockRate(-0.15, 0.05);
      const message = formatArbitrageMessage(rate, 8);

      // 驗證現有欄位仍然存在
      expect(message).toContain('【套套摳訊】');
      expect(message).toContain('BTC/USDT');
      expect(message).toContain('預估年化收益');
      expect(message).toContain('單次費率收益');
      expect(message).toContain('價格偏差');
      expect(message).toContain('下單小提醒');
      expect(message).toContain('風險提示');

      // 驗證新增的回本資訊欄位
      expect(message).toContain('⏱️ 價差回本');
    });

    it('should use correct emoji for payback_needed', () => {
      const rate = createMockRate(-0.15, 0.05);
      const message = formatArbitrageMessage(rate, 8);

      expect(message).toContain('⏱️ 價差回本');
    });

    it('should use correct emoji for favorable', () => {
      const rate = createMockRate(0.15, 0.03);
      const message = formatArbitrageMessage(rate, 8);

      expect(message).toContain('✓ 價差回本');
    });

    it('should use correct emoji for too_many', () => {
      const rate = createMockRate(-1.5, 0.01);
      const message = formatArbitrageMessage(rate, 8);

      expect(message).toContain('❌ 價差回本');
    });
  });

  describe('Edge cases', () => {
    it('should handle null priceDiffPercent gracefully', () => {
      const rate = createMockRate(null, 0.05);
      const message = formatArbitrageMessage(rate, 8);

      // 不應拋出錯誤，應該有合理的輸出
      expect(message).toBeDefined();
      expect(message).toContain('【套套摳訊】');
    });

    it('should handle very small payback periods', () => {
      const rate = createMockRate(-0.001, 0.05);
      const message = formatArbitrageMessage(rate, 8);

      // 0.001 / 0.05 = 0.02 => rounds to 0.0
      expect(message).toContain('0.0 次資費');
    });
  });
});
