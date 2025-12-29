/**
 * Test: ConditionalOrderMonitor Types
 * Feature: 050-sl-tp-trigger-monitor
 *
 * TDD: 先寫測試，確認類型定義符合規格
 */
import { describe, it, expect } from 'vitest';

describe('ConditionalOrderMonitor Types', () => {
  describe('TriggerType enum', () => {
    it('should have all required trigger types', async () => {
      const { TriggerType } = await import(
        '@/services/monitor/types'
      );

      // 驗證所有觸發類型都存在
      expect(TriggerType.LONG_SL).toBe('LONG_SL');
      expect(TriggerType.LONG_TP).toBe('LONG_TP');
      expect(TriggerType.SHORT_SL).toBe('SHORT_SL');
      expect(TriggerType.SHORT_TP).toBe('SHORT_TP');
      expect(TriggerType.BOTH).toBe('BOTH');
    });
  });

  describe('TriggerResult interface', () => {
    it('should accept valid trigger result', async () => {
      const { TriggerType } = await import(
        '@/services/monitor/types'
      );
      type TriggerResult = import('@/services/monitor/types').TriggerResult;

      const result: TriggerResult = {
        positionId: 'cm123abc',
        triggerType: TriggerType.LONG_SL,
        triggeredExchange: 'binance',
        triggeredOrderId: 'order123',
        triggeredAt: new Date(),
        confirmedByHistory: true,
      };

      expect(result.positionId).toBe('cm123abc');
      expect(result.triggerType).toBe(TriggerType.LONG_SL);
      expect(result.triggeredExchange).toBe('binance');
      expect(result.confirmedByHistory).toBe(true);
    });

    it('should accept both triggered result', async () => {
      const { TriggerType } = await import(
        '@/services/monitor/types'
      );
      type TriggerResult = import('@/services/monitor/types').TriggerResult;

      const result: TriggerResult = {
        positionId: 'cm456def',
        triggerType: TriggerType.BOTH,
        triggeredExchange: 'binance',
        triggeredOrderId: 'order456',
        triggeredAt: new Date(),
        confirmedByHistory: true,
        // 雙邊觸發時的額外資訊
        otherSideTriggeredExchange: 'okx',
        otherSideTriggeredOrderId: 'order789',
      };

      expect(result.triggerType).toBe(TriggerType.BOTH);
      expect(result.otherSideTriggeredExchange).toBe('okx');
    });
  });

  describe('OrderHistoryStatus enum', () => {
    it('should have all required order history statuses', async () => {
      const { OrderHistoryStatus } = await import(
        '@/services/monitor/types'
      );

      expect(OrderHistoryStatus.TRIGGERED).toBe('TRIGGERED');
      expect(OrderHistoryStatus.CANCELED).toBe('CANCELED');
      expect(OrderHistoryStatus.EXPIRED).toBe('EXPIRED');
      expect(OrderHistoryStatus.UNKNOWN).toBe('UNKNOWN');
    });
  });

  describe('ConditionalOrderInfo interface', () => {
    it('should accept valid conditional order info', async () => {
      const { OrderHistoryStatus } = await import(
        '@/services/monitor/types'
      );
      type ConditionalOrderInfo = import('@/services/monitor/types').ConditionalOrderInfo;

      const orderInfo: ConditionalOrderInfo = {
        orderId: 'order123',
        exchange: 'binance',
        symbol: 'BTCUSDT',
        side: 'LONG',
        orderType: 'STOP_LOSS',
        triggerPrice: 94000,
        status: OrderHistoryStatus.TRIGGERED,
        existsInPending: false,
      };

      expect(orderInfo.orderId).toBe('order123');
      expect(orderInfo.side).toBe('LONG');
      expect(orderInfo.orderType).toBe('STOP_LOSS');
      expect(orderInfo.status).toBe(OrderHistoryStatus.TRIGGERED);
    });
  });

  describe('MonitorConfig interface', () => {
    it('should accept valid monitor config', async () => {
      type MonitorConfig = import('@/services/monitor/types').MonitorConfig;

      const config: MonitorConfig = {
        intervalMs: 30000,
        maxRetries: 3,
        retryDelayMs: 1000,
      };

      expect(config.intervalMs).toBe(30000);
      expect(config.maxRetries).toBe(3);
    });

    it('should use default values from DEFAULT_MONITOR_CONFIG', async () => {
      const { DEFAULT_MONITOR_CONFIG } = await import(
        '@/services/monitor/types'
      );

      expect(DEFAULT_MONITOR_CONFIG.intervalMs).toBe(30000);
      expect(DEFAULT_MONITOR_CONFIG.maxRetries).toBe(3);
      expect(DEFAULT_MONITOR_CONFIG.retryDelayMs).toBe(1000);
    });
  });

  describe('TriggerDetectedEvent interface (WebSocket)', () => {
    it('should match WebSocket contract definition', async () => {
      const { TriggerType } = await import(
        '@/services/monitor/types'
      );
      type TriggerDetectedEvent = import('@/services/monitor/types').TriggerDetectedEvent;

      const event: TriggerDetectedEvent = {
        positionId: 'cm123abc',
        symbol: 'BTCUSDT',
        triggerType: TriggerType.LONG_SL,
        triggeredExchange: 'binance',
        triggeredAt: '2025-12-29T10:30:00.000Z',
      };

      expect(event.positionId).toBe('cm123abc');
      expect(event.symbol).toBe('BTCUSDT');
      expect(event.triggerType).toBe(TriggerType.LONG_SL);
    });
  });
});
