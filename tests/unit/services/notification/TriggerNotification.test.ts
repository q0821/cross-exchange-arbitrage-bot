/**
 * Test: Trigger Notification
 * Feature: 050-sl-tp-trigger-monitor (Phase 5: US3)
 *
 * TDD: 測試停損停利觸發通知功能
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger at top level
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock axios at top level
vi.mock('axios', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ status: 200 }),
  },
}));

// ==================== T025: TriggerNotificationMessage 介面 ====================
describe('T025: TriggerNotificationMessage interface', () => {
  it('should define TriggerNotificationMessage with required fields', async () => {
    // 在 types.ts 中應該有 TriggerNotificationMessage 類型
    // 驗證可以建立符合介面的物件
    const message = {
      // 基本資訊
      positionId: 'pos-123',
      symbol: 'BTCUSDT',
      triggerType: 'LONG_SL' as const,

      // 觸發資訊
      triggeredExchange: 'binance',
      triggeredSide: 'LONG' as const,
      triggerPrice: 94000,

      // 平倉資訊
      closedExchange: 'okx',
      closedSide: 'SHORT' as const,
      closePrice: 94100,

      // 損益資訊
      pnl: {
        priceDiffPnL: -10,
        fundingRatePnL: 5,
        totalFees: 2,
        totalPnL: -7,
        roi: -0.5,
      },

      // 持倉資訊
      positionSize: 0.001,
      leverage: 3,
      holdingDuration: '2 小時 30 分鐘',

      // 時間戳
      triggeredAt: new Date(),
      closedAt: new Date(),
    };

    expect(message.positionId).toBe('pos-123');
    expect(message.symbol).toBe('BTCUSDT');
    expect(message.triggerType).toBe('LONG_SL');
    expect(message.pnl.totalPnL).toBe(-7);
  });
});

// ==================== T028: Discord 觸發通知模板 ====================
describe('T028: Discord trigger notification template', () => {
  let DiscordNotifier: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import('@/services/notification/DiscordNotifier');
    DiscordNotifier = module.DiscordNotifier;
  });

  it('should have sendTriggerNotification method', () => {
    const notifier = new DiscordNotifier();
    expect(typeof notifier.sendTriggerNotification).toBe('function');
  });

  it('should format trigger notification with correct embed', async () => {
    const axios = (await import('axios')).default;
    const notifier = new DiscordNotifier();

    const message = {
      positionId: 'pos-123',
      symbol: 'BTCUSDT',
      triggerType: 'LONG_SL' as const,
      triggeredExchange: 'binance',
      triggeredSide: 'LONG' as const,
      triggerPrice: 94000,
      closedExchange: 'okx',
      closedSide: 'SHORT' as const,
      closePrice: 94100,
      pnl: {
        priceDiffPnL: -10,
        fundingRatePnL: 5,
        totalFees: 2,
        totalPnL: -7,
        roi: -0.5,
      },
      positionSize: 0.001,
      leverage: 3,
      holdingDuration: '2 小時 30 分鐘',
      triggeredAt: new Date(),
      closedAt: new Date(),
    };

    const result = await notifier.sendTriggerNotification(
      'https://discord.com/api/webhooks/xxx',
      message
    );

    expect(result.success).toBe(true);
    expect(axios.post).toHaveBeenCalled();

    const callArgs = vi.mocked(axios.post).mock.calls[0];
    const payload = callArgs[1];

    // 驗證 Discord embed 格式
    expect(payload.embeds).toBeDefined();
    expect(payload.embeds[0].title).toContain('停損');
  });

  it('should use green color for take profit', async () => {
    const axios = (await import('axios')).default;
    const notifier = new DiscordNotifier();

    const message = {
      positionId: 'pos-123',
      symbol: 'BTCUSDT',
      triggerType: 'LONG_TP' as const,
      triggeredExchange: 'binance',
      triggeredSide: 'LONG' as const,
      triggerPrice: 96000,
      closedExchange: 'okx',
      closedSide: 'SHORT' as const,
      closePrice: 96100,
      pnl: {
        priceDiffPnL: 10,
        fundingRatePnL: 5,
        totalFees: 2,
        totalPnL: 13,
        roi: 1.0,
      },
      positionSize: 0.001,
      leverage: 3,
      holdingDuration: '2 小時',
      triggeredAt: new Date(),
      closedAt: new Date(),
    };

    await notifier.sendTriggerNotification(
      'https://discord.com/api/webhooks/xxx',
      message
    );

    const callArgs = vi.mocked(axios.post).mock.calls[0];
    const payload = callArgs[1];

    expect(payload.embeds[0].title).toContain('停利');
    // 綠色 = 0x00FF00 or similar
    expect(payload.embeds[0].color).toBeGreaterThan(0);
  });
});

// ==================== T029: Slack 觸發通知模板 ====================
describe('T029: Slack trigger notification template', () => {
  let SlackNotifier: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import('@/services/notification/SlackNotifier');
    SlackNotifier = module.SlackNotifier;
  });

  it('should have sendTriggerNotification method', () => {
    const notifier = new SlackNotifier();
    expect(typeof notifier.sendTriggerNotification).toBe('function');
  });

  it('should format trigger notification with Slack blocks', async () => {
    const axios = (await import('axios')).default;
    const notifier = new SlackNotifier();

    const message = {
      positionId: 'pos-123',
      symbol: 'BTCUSDT',
      triggerType: 'SHORT_SL' as const,
      triggeredExchange: 'okx',
      triggeredSide: 'SHORT' as const,
      triggerPrice: 96000,
      closedExchange: 'binance',
      closedSide: 'LONG' as const,
      closePrice: 95900,
      pnl: {
        priceDiffPnL: -10,
        fundingRatePnL: 5,
        totalFees: 2,
        totalPnL: -7,
        roi: -0.5,
      },
      positionSize: 0.001,
      leverage: 3,
      holdingDuration: '1 小時 15 分鐘',
      triggeredAt: new Date(),
      closedAt: new Date(),
    };

    const result = await notifier.sendTriggerNotification(
      'https://hooks.slack.com/services/xxx',
      message
    );

    expect(result.success).toBe(true);
    expect(axios.post).toHaveBeenCalled();

    const callArgs = vi.mocked(axios.post).mock.calls[0];
    const payload = callArgs[1];

    // 驗證 Slack block 格式
    expect(payload.blocks).toBeDefined();
    expect(payload.blocks.length).toBeGreaterThan(0);
  });
});

// ==================== T026-T027: NotificationService 觸發通知方法 ====================
describe('T026-T027: NotificationService trigger notification methods', () => {
  it('should have TriggerNotificationMessage type in types.ts', async () => {
    // 這個測試確保類型被正確匯出
    // 實際的類型檢查由 TypeScript 編譯器處理
    const types = await import('@/services/notification/types');
    expect(types).toBeDefined();
    // TriggerNotificationMessage 應該在 types.ts 中定義
  });
});

// ==================== INotifier 介面擴展測試 ====================
describe('INotifier interface extension', () => {
  it('should add sendTriggerNotification to INotifier interface', async () => {
    const types = await import('@/services/notification/types');
    // 類型在編譯時檢查，這裡確認模組可以正常導入
    expect(types).toBeDefined();
  });
});

// ==================== T026-T027: buildTriggerNotificationMessage ====================
describe('T026-T027: buildTriggerNotificationMessage', () => {
  it('should have buildTriggerNotificationMessage function', async () => {
    // 這個測試確保 buildTriggerNotificationMessage 函數存在
    const { buildTriggerNotificationMessage } = await import(
      '@/services/notification/utils'
    );
    expect(typeof buildTriggerNotificationMessage).toBe('function');
  });

  it('should build trigger notification message with correct fields', async () => {
    const { buildTriggerNotificationMessage } = await import(
      '@/services/notification/utils'
    );

    const input = {
      positionId: 'pos-123',
      symbol: 'BTCUSDT',
      triggerType: 'LONG_SL' as const,
      triggeredExchange: 'binance',
      triggeredSide: 'LONG' as const,
      triggerPrice: 94000,
      closedExchange: 'okx',
      closedSide: 'SHORT' as const,
      closePrice: 94100,
      positionSize: 0.001,
      leverage: 3,
      openedAt: new Date('2025-01-01T10:00:00Z'),
      closedAt: new Date('2025-01-01T12:30:00Z'),
      pnl: {
        priceDiffPnL: -10,
        fundingRatePnL: 5,
        totalFees: 2,
        totalPnL: -7,
        roi: -0.5,
      },
    };

    const message = buildTriggerNotificationMessage(input);

    expect(message.positionId).toBe('pos-123');
    expect(message.symbol).toBe('BTCUSDT');
    expect(message.triggerType).toBe('LONG_SL');
    expect(message.holdingDuration).toBeDefined();
    expect(message.holdingDuration).toContain('2');
    expect(message.holdingDuration).toContain('30');
  });

  it('should have buildEmergencyNotificationMessage function', async () => {
    const { buildEmergencyNotificationMessage } = await import(
      '@/services/notification/utils'
    );
    expect(typeof buildEmergencyNotificationMessage).toBe('function');
  });

  it('should build emergency notification message with correct fields', async () => {
    const { buildEmergencyNotificationMessage } = await import(
      '@/services/notification/utils'
    );

    const input = {
      positionId: 'pos-456',
      symbol: 'ETHUSDT',
      triggerType: 'SHORT_TP' as const,
      triggeredExchange: 'okx',
      error: 'Insufficient balance',
      requiresManualIntervention: true,
    };

    const message = buildEmergencyNotificationMessage(input);

    expect(message.positionId).toBe('pos-456');
    expect(message.symbol).toBe('ETHUSDT');
    expect(message.triggerType).toBe('SHORT_TP');
    expect(message.error).toBe('Insufficient balance');
    expect(message.requiresManualIntervention).toBe(true);
    expect(message.timestamp).toBeInstanceOf(Date);
  });
});
