/**
 * Test: SlackNotifier
 *
 * Slack Webhook 通知服務單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { SlackNotifier } from '@/services/notification/SlackNotifier';
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

describe('SlackNotifier', () => {
  let notifier: SlackNotifier;
  const mockWebhookUrl = 'https://hooks.slack.com/services/T00/B00/XXX';

  beforeEach(() => {
    vi.clearAllMocks();
    notifier = new SlackNotifier();
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
          blocks: expect.any(Array),
        }),
        expect.objectContaining({ timeout: 30000 })
      );
    });

    it('should include header block with symbol', async () => {
      vi.mocked(axios.post).mockResolvedValue({ status: 200 });

      await notifier.sendArbitrageNotification(mockWebhookUrl, createMessage({ symbol: 'ETHUSDT' }));

      const callArgs = vi.mocked(axios.post).mock.calls[0][1];
      const headerBlock = callArgs.blocks.find((b: any) => b.type === 'header');

      expect(headerBlock).toBeDefined();
      expect(headerBlock.text.text).toContain('ETHUSDT');
    });

    it('should include exchange fields in section blocks', async () => {
      vi.mocked(axios.post).mockResolvedValue({ status: 200 });

      await notifier.sendArbitrageNotification(mockWebhookUrl, createMessage());

      const callArgs = vi.mocked(axios.post).mock.calls[0][1];
      const sectionBlocks = callArgs.blocks.filter((b: any) => b.type === 'section');

      // Find section with exchange info
      const exchangeSection = sectionBlocks.find((s: any) =>
        s.fields && s.fields.some((f: any) => f.text.includes('做多'))
      );

      expect(exchangeSection).toBeDefined();
      expect(JSON.stringify(exchangeSection)).toContain('BINANCE');
      expect(JSON.stringify(exchangeSection)).toContain('OKX');
    });

    it('should return error on axios failure', async () => {
      vi.mocked(axios.post).mockRejectedValue(new Error('Slack API error'));

      const result = await notifier.sendArbitrageNotification(mockWebhookUrl, createMessage());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Slack API error');
    });

    it('should handle unknown error type', async () => {
      vi.mocked(axios.post).mockRejectedValue('Non-Error object');

      const result = await notifier.sendArbitrageNotification(mockWebhookUrl, createMessage());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });

    it('should log success message', async () => {
      const { logger } = await import('@/lib/logger');
      vi.mocked(axios.post).mockResolvedValue({ status: 200 });

      await notifier.sendArbitrageNotification(mockWebhookUrl, createMessage({
        symbol: 'SOLUSDT',
        annualizedReturn: 150,
      }));

      expect(logger.info).toHaveBeenCalledWith(
        { symbol: 'SOLUSDT', annualizedReturn: 150 },
        'Slack notification sent successfully'
      );
    });

    it('should log error message on failure', async () => {
      const { logger } = await import('@/lib/logger');
      vi.mocked(axios.post).mockRejectedValue(new Error('Rate limited'));

      await notifier.sendArbitrageNotification(mockWebhookUrl, createMessage());

      expect(logger.error).toHaveBeenCalledWith(
        { error: 'Rate limited' },
        'Failed to send Slack notification'
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
          blocks: expect.any(Array),
        }),
        expect.any(Object)
      );
    });

    it('should include test header', async () => {
      vi.mocked(axios.post).mockResolvedValue({ status: 200 });

      await notifier.sendTestNotification(mockWebhookUrl);

      const callArgs = vi.mocked(axios.post).mock.calls[0][1];
      const headerBlock = callArgs.blocks.find((b: any) => b.type === 'header');

      expect(headerBlock.text.text).toContain('測試');
    });

    it('should return error on failure', async () => {
      vi.mocked(axios.post).mockRejectedValue(new Error('Invalid webhook URL'));

      const result = await notifier.sendTestNotification(mockWebhookUrl);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid webhook URL');
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
          blocks: expect.any(Array),
        }),
        expect.any(Object)
      );
    });

    it('should include disappeared header', async () => {
      vi.mocked(axios.post).mockResolvedValue({ status: 200 });

      await notifier.sendDisappearedNotification(mockWebhookUrl, createDisappearedMessage());

      const callArgs = vi.mocked(axios.post).mock.calls[0][1];
      const headerBlock = callArgs.blocks.find((b: any) => b.type === 'header');

      expect(headerBlock.text.text).toContain('結束');
    });

    it('should return error on failure', async () => {
      vi.mocked(axios.post).mockRejectedValue(new Error('Disappeared webhook error'));

      const result = await notifier.sendDisappearedNotification(mockWebhookUrl, createDisappearedMessage());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Disappeared webhook error');
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

    it('should include trigger info in blocks', async () => {
      vi.mocked(axios.post).mockResolvedValue({ status: 200 });

      await notifier.sendTriggerNotification(mockWebhookUrl, createTriggerMessage());

      const callArgs = vi.mocked(axios.post).mock.calls[0][1];
      const blocksJson = JSON.stringify(callArgs.blocks);

      expect(blocksJson).toContain('停損');
      expect(blocksJson).toContain('BTCUSDT');
    });

    it('should return error on failure', async () => {
      vi.mocked(axios.post).mockRejectedValue(new Error('Trigger slack error'));

      const result = await notifier.sendTriggerNotification(mockWebhookUrl, createTriggerMessage());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Trigger slack error');
    });
  });

  describe('sendEmergencyNotification', () => {
    const createEmergencyMessage = (): EmergencyNotificationMessage => ({
      positionId: 'pos-789',
      symbol: 'SOLUSDT',
      triggerType: 'SHORT_TP',
      triggeredExchange: 'okx',
      error: 'Order rejected',
      requiresManualIntervention: true,
      timestamp: new Date('2024-01-15T10:00:00Z'),
    });

    it('should send emergency notification successfully', async () => {
      vi.mocked(axios.post).mockResolvedValue({ status: 200 });

      const result = await notifier.sendEmergencyNotification(mockWebhookUrl, createEmergencyMessage());

      expect(result.success).toBe(true);
    });

    it('should include emergency header', async () => {
      vi.mocked(axios.post).mockResolvedValue({ status: 200 });

      await notifier.sendEmergencyNotification(mockWebhookUrl, createEmergencyMessage());

      const callArgs = vi.mocked(axios.post).mock.calls[0][1];
      const headerBlock = callArgs.blocks.find((b: any) => b.type === 'header');

      expect(headerBlock.text.text).toContain('緊急');
    });

    it('should include manual intervention notice', async () => {
      vi.mocked(axios.post).mockResolvedValue({ status: 200 });

      await notifier.sendEmergencyNotification(mockWebhookUrl, createEmergencyMessage());

      const callArgs = vi.mocked(axios.post).mock.calls[0][1];
      const blocksJson = JSON.stringify(callArgs.blocks);

      expect(blocksJson).toContain('手動處理');
    });

    it('should return error on failure', async () => {
      vi.mocked(axios.post).mockRejectedValue(new Error('Emergency slack error'));

      const result = await notifier.sendEmergencyNotification(mockWebhookUrl, createEmergencyMessage());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Emergency slack error');
    });
  });

  describe('Timeout configuration', () => {
    it('should use 30 second timeout', async () => {
      vi.mocked(axios.post).mockResolvedValue({ status: 200 });

      await notifier.sendArbitrageNotification(mockWebhookUrl, {
        symbol: 'BTCUSDT',
        longExchange: 'binance',
        longOriginalRate: 0.0001,
        longTimeBasis: 8,
        longNormalizedRate: 0.0001,
        shortExchange: 'okx',
        shortOriginalRate: 0.0003,
        shortTimeBasis: 8,
        shortNormalizedRate: 0.0003,
        spreadPercent: 0.02,
        annualizedReturn: 73,
        isPriceDirectionCorrect: true,
        fundingPaybackPeriods: 5,
        timestamp: new Date(),
      });

      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({ timeout: 30000 })
      );
    });
  });
});
