/**
 * ExitSuggestionNotification Unit Tests
 *
 * Feature: 067-position-exit-monitor
 * Phase: 2 - User Story 1
 *
 * 測試通知服務擴展：
 * - formatExitSuggestionMessage() 格式化正確
 * - DiscordNotifier.sendExitSuggestionNotification()
 * - SlackNotifier.sendExitSuggestionNotification()
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to define mock functions before vi.mock is hoisted
const { mockAxiosPost } = vi.hoisted(() => ({
  mockAxiosPost: vi.fn(),
}));

// Mock axios
vi.mock('axios', () => ({
  default: {
    post: mockAxiosPost,
  },
}));

// Import after mocks
import { formatExitSuggestionMessage } from '@/services/notification/utils';
import { DiscordNotifier } from '@/services/notification/DiscordNotifier';
import { SlackNotifier } from '@/services/notification/SlackNotifier';
import { ExitSuggestionReason } from '@/services/monitor/types';
import type { ExitSuggestionMessage } from '@/services/monitor/types';

describe('ExitSuggestionNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAxiosPost.mockResolvedValue({
      status: 200,
      data: {},
    });
  });

  // 建立測試用的 ExitSuggestionMessage
  const createMessage = (overrides = {}): ExitSuggestionMessage => ({
    symbol: 'BTCUSDT',
    positionId: 'position-test-001',
    reason: ExitSuggestionReason.APY_NEGATIVE,
    reasonDescription: 'APY 已轉負，繼續持有會虧損',
    currentAPY: -50.2,
    fundingPnL: 12.35,
    priceDiffLoss: 8.2,
    netProfit: 4.15,
    longExchange: 'binance',
    shortExchange: 'okx',
    timestamp: new Date('2026-01-21T10:00:00Z'),
    ...overrides,
  });

  describe('formatExitSuggestionMessage()', () => {
    it('應該正確格式化 APY_NEGATIVE 建議訊息', () => {
      const message = createMessage({
        reason: ExitSuggestionReason.APY_NEGATIVE,
        reasonDescription: 'APY 已轉負，繼續持有會虧損',
        currentAPY: -50.2,
      });

      const formatted = formatExitSuggestionMessage(message);

      // 驗證包含必要資訊（使用不區分大小寫的檢查）
      expect(formatted).toContain('平倉建議');
      expect(formatted).toContain('BTCUSDT');
      expect(formatted).toContain('APY 已轉負');
      expect(formatted).toContain('-50.2');
      expect(formatted).toContain('12.35');
      expect(formatted).toContain('8.2');
      expect(formatted).toContain('4.15');
      expect(formatted.toLowerCase()).toContain('binance');
      expect(formatted.toLowerCase()).toContain('okx');
    });

    it('應該正確格式化 PROFIT_LOCKABLE 建議訊息', () => {
      const message = createMessage({
        reason: ExitSuggestionReason.PROFIT_LOCKABLE,
        reasonDescription: 'APY 低於閾值但整體有獲利可鎖定',
        currentAPY: 50.0,
        fundingPnL: 25.0,
        priceDiffLoss: 10.0,
        netProfit: 15.0,
      });

      const formatted = formatExitSuggestionMessage(message);

      expect(formatted).toContain('平倉建議');
      expect(formatted).toContain('獲利可鎖定');
      expect(formatted).toContain('50');
      expect(formatted).toContain('15'); // 淨收益
    });

    it('應該包含交易所資訊', () => {
      const message = createMessage({
        longExchange: 'okx',
        shortExchange: 'gateio',
      });

      const formatted = formatExitSuggestionMessage(message);

      // 使用不區分大小寫的檢查（formatter 可能會轉大寫）
      expect(formatted.toLowerCase()).toContain('okx');
      expect(formatted.toLowerCase()).toContain('gateio');
    });

    it('應該包含 emoji 標識', () => {
      const message = createMessage();
      const formatted = formatExitSuggestionMessage(message);

      // 應該包含警告或通知相關的 emoji（使用 includes 而非正則表達式避免 combined character 問題）
      const hasEmoji = ['🔔', '⚠️', '📊', '💰', '📉', '✅'].some((emoji) =>
        formatted.includes(emoji)
      );
      expect(hasEmoji).toBe(true);
    });
  });

  describe('DiscordNotifier.sendExitSuggestionNotification()', () => {
    let notifier: DiscordNotifier;
    const webhookUrl = 'https://discord.com/api/webhooks/test-webhook';

    beforeEach(() => {
      notifier = new DiscordNotifier();
    });

    it('應該成功發送平倉建議通知', async () => {
      const message = createMessage();

      const result = await notifier.sendExitSuggestionNotification(webhookUrl, message);

      expect(result.success).toBe(true);
      // axios.post 呼叫格式：(url, data, config)
      expect(mockAxiosPost).toHaveBeenCalledWith(
        webhookUrl,
        expect.objectContaining({
          content: expect.any(String),
        }),
        expect.any(Object)
      );
    });

    it('應該發送正確格式的 Discord 訊息', async () => {
      const message = createMessage();

      await notifier.sendExitSuggestionNotification(webhookUrl, message);

      // axios.post 的第二個參數就是 body
      const callArgs = mockAxiosPost.mock.calls[0];
      const body = callArgs[1];

      // Discord 訊息應該包含 content 或 embeds
      expect(body.content || body.embeds).toBeDefined();

      // 訊息內容應該包含關鍵資訊
      const content = body.content || JSON.stringify(body.embeds);
      expect(content).toContain('BTCUSDT');
    });

    it('Webhook 失敗時應該返回錯誤', async () => {
      // axios 會 reject 當狀態碼不是 2xx
      const axiosError = new Error('Request failed with status code 429');
      mockAxiosPost.mockRejectedValue(axiosError);

      const message = createMessage();
      const result = await notifier.sendExitSuggestionNotification(webhookUrl, message);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('網路錯誤時應該返回錯誤', async () => {
      mockAxiosPost.mockRejectedValue(new Error('Network error'));

      const message = createMessage();
      const result = await notifier.sendExitSuggestionNotification(webhookUrl, message);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('SlackNotifier.sendExitSuggestionNotification()', () => {
    let notifier: SlackNotifier;
    const webhookUrl = 'https://hooks.slack.com/services/test-webhook';

    beforeEach(() => {
      notifier = new SlackNotifier();
    });

    it('應該成功發送平倉建議通知', async () => {
      const message = createMessage();

      const result = await notifier.sendExitSuggestionNotification(webhookUrl, message);

      expect(result.success).toBe(true);
      // axios.post 呼叫格式：(url, data, config)
      expect(mockAxiosPost).toHaveBeenCalledWith(
        webhookUrl,
        expect.objectContaining({
          text: expect.any(String),
        }),
        expect.any(Object)
      );
    });

    it('應該發送正確格式的 Slack 訊息', async () => {
      const message = createMessage();

      await notifier.sendExitSuggestionNotification(webhookUrl, message);

      // axios.post 的第二個參數就是 body
      const callArgs = mockAxiosPost.mock.calls[0];
      const body = callArgs[1];

      // Slack 訊息應該包含 text 或 blocks
      expect(body.text || body.blocks).toBeDefined();

      // 訊息內容應該包含關鍵資訊
      const content = body.text || JSON.stringify(body.blocks);
      expect(content).toContain('BTCUSDT');
    });

    it('Webhook 失敗時應該返回錯誤', async () => {
      // axios 會 reject 當狀態碼不是 2xx
      const axiosError = new Error('Request failed with status code 500');
      mockAxiosPost.mockRejectedValue(axiosError);

      const message = createMessage();
      const result = await notifier.sendExitSuggestionNotification(webhookUrl, message);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('網路錯誤時應該返回錯誤', async () => {
      mockAxiosPost.mockRejectedValue(new Error('Connection refused'));

      const message = createMessage();
      const result = await notifier.sendExitSuggestionNotification(webhookUrl, message);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection refused');
    });
  });

  describe('訊息格式一致性', () => {
    it('Discord 和 Slack 訊息應該包含相同的關鍵資訊', async () => {
      const message = createMessage();

      const discordNotifier = new DiscordNotifier();
      const slackNotifier = new SlackNotifier();

      await discordNotifier.sendExitSuggestionNotification(
        'https://discord.com/webhook',
        message
      );
      await slackNotifier.sendExitSuggestionNotification(
        'https://hooks.slack.com/webhook',
        message
      );

      // 兩個 webhook 都應該被呼叫
      expect(mockAxiosPost).toHaveBeenCalledTimes(2);

      // 驗證兩個訊息都包含相同的關鍵資訊
      // axios.post 的第二個參數是 body（不需要 JSON.parse）
      const discordBody = mockAxiosPost.mock.calls[0][1];
      const slackBody = mockAxiosPost.mock.calls[1][1];

      const discordContent = discordBody.content || JSON.stringify(discordBody.embeds);
      const slackContent = slackBody.text || JSON.stringify(slackBody.blocks);

      // 兩者都應該包含交易對符號
      expect(discordContent).toContain('BTCUSDT');
      expect(slackContent).toContain('BTCUSDT');
    });
  });
});
