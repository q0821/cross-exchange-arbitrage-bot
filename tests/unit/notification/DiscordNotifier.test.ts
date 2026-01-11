/**
 * Test: DiscordNotifier
 *
 * Discord Webhook 通知服務單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { DiscordNotifier } from '@/services/notification/DiscordNotifier';
import type { ArbitrageNotificationMessage, TriggerNotificationMessage, EmergencyNotificationMessage, OpportunityDisappearedMessage } from '@/services/notification/types';

// Mock axios
vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock priceRisk
vi.mock('@/lib/priceRisk', () => ({
  getPriceRiskLevel: vi.fn(() => 'low'),
  PRICE_DIFF_WARNING_THRESHOLD: 0.5,
}));

describe('DiscordNotifier', () => {
  let notifier: DiscordNotifier;
  const mockWebhookUrl = 'https://discord.com/api/webhooks/123/abc';

  beforeEach(() => {
    vi.clearAllMocks();
    notifier = new DiscordNotifier();
  });

  describe('sendArbitrageNotification', () => {
    const createMessage = (overrides: Partial<ArbitrageNotificationMessage> = {}): ArbitrageNotificationMessage => ({
      symbol: 'BTCUSDT',
      longExchange: 'binance',
      longOriginalRate: 0.0001,
      longTimeBasis: 8,
      longNormalizedRate: 0.0001,
      longPrice: 95000,
      shortExchange: 'okx',
      shortOriginalRate: 0.0003,
      shortTimeBasis: 8,
      shortNormalizedRate: 0.0003,
      shortPrice: 95050,
      spreadPercent: 0.02,
      annualizedReturn: 73,
      priceDiffPercent: 0.05,
      isPriceDirectionCorrect: true,
      paybackPeriods: 3,
      fundingPaybackPeriods: 5,
      timestamp: new Date('2024-01-15T10:00:00Z'),
      ...overrides,
    });

    it('should send notification successfully', async () => {
      vi.mocked(axios.post).mockResolvedValue({ status: 200 });

      const result = await notifier.sendArbitrageNotification(mockWebhookUrl, createMessage());

      expect(result.success).toBe(true);
      expect(axios.post).toHaveBeenCalledWith(
        mockWebhookUrl,
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              title: '套利機會：BTCUSDT',
            }),
          ]),
        }),
        expect.objectContaining({ timeout: 30000 })
      );
    });

    it('should include exchange fields in embed', async () => {
      vi.mocked(axios.post).mockResolvedValue({ status: 200 });

      await notifier.sendArbitrageNotification(mockWebhookUrl, createMessage());

      const callArgs = vi.mocked(axios.post).mock.calls[0][1];
      const embed = callArgs.embeds[0];

      // Check for long and short exchange fields
      const longField = embed.fields.find((f: any) => f.name === '📈 做多');
      const shortField = embed.fields.find((f: any) => f.name === '📉 做空');

      expect(longField).toBeDefined();
      expect(longField.value).toContain('BINANCE');
      expect(shortField).toBeDefined();
      expect(shortField.value).toContain('OKX');
    });

    it('should include profit analysis field', async () => {
      vi.mocked(axios.post).mockResolvedValue({ status: 200 });

      await notifier.sendArbitrageNotification(mockWebhookUrl, createMessage({
        spreadPercent: 0.05,
        annualizedReturn: 182.5,
        fundingPaybackPeriods: 3,
      }));

      const callArgs = vi.mocked(axios.post).mock.calls[0][1];
      const embed = callArgs.embeds[0];

      const profitField = embed.fields.find((f: any) => f.name === '💰 收益分析');
      expect(profitField).toBeDefined();
      expect(profitField.value).toContain('費率差');
      expect(profitField.value).toContain('年化收益');
      expect(profitField.value).toContain('回本');
    });

    it('should return error on axios failure', async () => {
      vi.mocked(axios.post).mockRejectedValue(new Error('Network error'));

      const result = await notifier.sendArbitrageNotification(mockWebhookUrl, createMessage());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle unknown error type', async () => {
      vi.mocked(axios.post).mockRejectedValue('String error');

      const result = await notifier.sendArbitrageNotification(mockWebhookUrl, createMessage());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });

    it('should log success message', async () => {
      const { logger } = await import('@/lib/logger');
      vi.mocked(axios.post).mockResolvedValue({ status: 200 });

      await notifier.sendArbitrageNotification(mockWebhookUrl, createMessage({
        symbol: 'ETHUSDT',
        annualizedReturn: 100,
      }));

      expect(logger.info).toHaveBeenCalledWith(
        { symbol: 'ETHUSDT', annualizedReturn: 100 },
        'Discord notification sent successfully'
      );
    });

    it('should log error message on failure', async () => {
      const { logger } = await import('@/lib/logger');
      vi.mocked(axios.post).mockRejectedValue(new Error('API rate limit'));

      await notifier.sendArbitrageNotification(mockWebhookUrl, createMessage());

      expect(logger.error).toHaveBeenCalledWith(
        { error: 'API rate limit' },
        'Failed to send Discord notification'
      );
    });
  });

  describe('sendTestNotification', () => {
    it('should send test notification successfully', async () => {
      vi.mocked(axios.post).mockResolvedValue({ status: 200 });

      const result = await notifier.sendTestNotification(mockWebhookUrl);

      expect(result.success).toBe(true);
      expect(axios.post).toHaveBeenCalledWith(
        mockWebhookUrl,
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              title: '測試通知',
              color: 0x00ff00, // Green
            }),
          ]),
        }),
        expect.any(Object)
      );
    });

    it('should return error on failure', async () => {
      vi.mocked(axios.post).mockRejectedValue(new Error('Invalid webhook'));

      const result = await notifier.sendTestNotification(mockWebhookUrl);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid webhook');
    });
  });

  describe('sendDisappearedNotification', () => {
    const createDisappearedMessage = (): OpportunityDisappearedMessage => ({
      symbol: 'BTCUSDT',
      longExchange: 'binance',
      shortExchange: 'okx',
      detectedAt: new Date('2024-01-15T08:00:00Z'),
      disappearedAt: new Date('2024-01-15T10:30:00Z'),
      durationFormatted: '2 小時 30 分鐘',
      initialSpread: 0.0005,
      maxSpread: 0.001,
      maxSpreadAt: new Date('2024-01-15T09:00:00Z'),
      finalSpread: 0.0002,
      longIntervalHours: 8,
      shortIntervalHours: 4,
      settlementRecords: [
        { side: 'long', timestamp: new Date(), rate: 0.0001 },
        { side: 'short', timestamp: new Date(), rate: -0.0002 },
      ],
      longSettlementCount: 5,
      shortSettlementCount: 10,
      totalFundingProfit: 0.01,
      totalCost: 0.003,
      netProfit: 0.007,
      realizedAPY: 80,
      notificationCount: 3,
      timestamp: new Date('2024-01-15T10:30:00Z'),
    });

    it('should send disappeared notification successfully', async () => {
      vi.mocked(axios.post).mockResolvedValue({ status: 200 });

      const result = await notifier.sendDisappearedNotification(mockWebhookUrl, createDisappearedMessage());

      expect(result.success).toBe(true);
      expect(axios.post).toHaveBeenCalledWith(
        mockWebhookUrl,
        expect.objectContaining({
          embeds: expect.any(Array),
        }),
        expect.any(Object)
      );
    });

    it('should return error on failure', async () => {
      vi.mocked(axios.post).mockRejectedValue(new Error('Webhook error'));

      const result = await notifier.sendDisappearedNotification(mockWebhookUrl, createDisappearedMessage());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Webhook error');
    });
  });

  describe('sendTriggerNotification', () => {
    const createTriggerMessage = (): TriggerNotificationMessage => ({
      positionId: 'pos-123',
      symbol: 'BTCUSDT',
      triggerType: 'LONG_SL',
      triggeredExchange: 'binance',
      triggeredSide: 'LONG',
      triggerPrice: 94000,
      closedExchange: 'okx',
      closedSide: 'SHORT',
      closePrice: 94050,
      pnl: {
        priceDiffPnL: 50,
        fundingRatePnL: 10,
        totalFees: 5,
        totalPnL: 55,
        roi: 2.75,
      },
      positionSize: 1000,
      leverage: 5,
      holdingDuration: '2 小時 30 分鐘',
      triggeredAt: new Date('2024-01-15T10:00:00Z'),
      closedAt: new Date('2024-01-15T10:00:00Z'),
    });

    it('should send trigger notification successfully', async () => {
      vi.mocked(axios.post).mockResolvedValue({ status: 200 });

      const result = await notifier.sendTriggerNotification(mockWebhookUrl, createTriggerMessage());

      expect(result.success).toBe(true);
      expect(axios.post).toHaveBeenCalled();
    });

    it('should include trigger type in embed', async () => {
      vi.mocked(axios.post).mockResolvedValue({ status: 200 });

      await notifier.sendTriggerNotification(mockWebhookUrl, createTriggerMessage());

      const callArgs = vi.mocked(axios.post).mock.calls[0][1];
      const embed = callArgs.embeds[0];

      expect(embed.title).toContain('停損');
    });

    it('should return error on failure', async () => {
      vi.mocked(axios.post).mockRejectedValue(new Error('Trigger webhook error'));

      const result = await notifier.sendTriggerNotification(mockWebhookUrl, createTriggerMessage());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Trigger webhook error');
    });
  });

  describe('sendEmergencyNotification', () => {
    const createEmergencyMessage = (): EmergencyNotificationMessage => ({
      positionId: 'pos-789',
      symbol: 'SOLUSDT',
      triggerType: 'LONG_SL',
      triggeredExchange: 'binance',
      error: 'Insufficient balance',
      requiresManualIntervention: true,
      timestamp: new Date('2024-01-15T10:00:00Z'),
    });

    it('should send emergency notification successfully', async () => {
      vi.mocked(axios.post).mockResolvedValue({ status: 200 });

      const result = await notifier.sendEmergencyNotification(mockWebhookUrl, createEmergencyMessage());

      expect(result.success).toBe(true);
    });

    it('should use red color for emergency', async () => {
      vi.mocked(axios.post).mockResolvedValue({ status: 200 });

      await notifier.sendEmergencyNotification(mockWebhookUrl, createEmergencyMessage());

      const callArgs = vi.mocked(axios.post).mock.calls[0][1];
      const embed = callArgs.embeds[0];

      expect(embed.color).toBe(0xff0000); // Red
    });

    it('should include manual intervention notice', async () => {
      vi.mocked(axios.post).mockResolvedValue({ status: 200 });

      await notifier.sendEmergencyNotification(mockWebhookUrl, createEmergencyMessage());

      const callArgs = vi.mocked(axios.post).mock.calls[0][1];
      const embed = callArgs.embeds[0];

      expect(JSON.stringify(embed)).toContain('需要手動處理');
    });

    it('should return error on failure', async () => {
      vi.mocked(axios.post).mockRejectedValue(new Error('Emergency webhook error'));

      const result = await notifier.sendEmergencyNotification(mockWebhookUrl, createEmergencyMessage());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Emergency webhook error');
    });
  });
});
