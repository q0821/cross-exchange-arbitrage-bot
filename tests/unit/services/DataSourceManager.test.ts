/**
 * DataSourceManager Unit Tests
 * Feature: 052-specify-scripts-bash
 * Tasks: T049, T050
 *
 * 測試 DataSourceManager 的 fallback 和恢復邏輯
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DataSourceManager } from '../../../src/services/monitor/DataSourceManager';
import type { DataSourceSwitchEvent } from '../../../src/types/data-source';

describe('DataSourceManager', () => {
  let manager: DataSourceManager;

  beforeEach(() => {
    // 重置單例
    DataSourceManager.resetInstance();
    manager = DataSourceManager.getInstance({
      config: {
        fallbackDelay: 100,   // 加速測試
        recoveryDelay: 100,   // 加速測試
        dataStaleThreshold: 1000,
      },
    });
  });

  afterEach(() => {
    DataSourceManager.resetInstance();
  });

  describe('T049: Fallback Logic', () => {
    it('should initialize with preferred mode (websocket)', () => {
      const mode = manager.getCurrentMode('binance', 'fundingRate');
      expect(mode).toBe('websocket');
    });

    it('should initialize with REST for unsupported combinations', () => {
      // MEXC 不支援 position WebSocket (Feature 054: BingX fundingRate 現在支援)
      const mode = manager.getCurrentMode('mexc', 'position');
      expect(mode).toBe('rest');
    });

    it('should switch to REST when WebSocket is disabled', () => {
      const switchHandler = vi.fn();
      manager.onSwitch(switchHandler);

      // 確保初始狀態是 websocket
      expect(manager.getCurrentMode('binance', 'fundingRate')).toBe('websocket');

      // 模擬 WebSocket 斷線
      manager.disableWebSocket('binance', 'fundingRate', 'connection lost');

      // 驗證切換到 REST
      expect(manager.getCurrentMode('binance', 'fundingRate')).toBe('rest');

      // 驗證事件被觸發
      expect(switchHandler).toHaveBeenCalled();
      const event: DataSourceSwitchEvent = switchHandler.mock.calls[0][0];
      expect(event.fromMode).toBe('websocket');
      expect(event.toMode).toBe('rest');
    });

    it('should emit switch event with correct reason', () => {
      const switchHandler = vi.fn();
      manager.onSwitch(switchHandler);

      // 先切換到 REST，再切回 WebSocket，再斷線
      manager.disableWebSocket('okx', 'fundingRate', 'initial rest');
      manager.enableWebSocket('okx', 'fundingRate');
      manager.disableWebSocket('okx', 'fundingRate', 'timeout occurred');

      // 找到最後一個切換事件
      const lastCallIndex = switchHandler.mock.calls.length - 1;
      const event: DataSourceSwitchEvent = switchHandler.mock.calls[lastCallIndex][0];
      expect(event.reason).toBe('websocket_timeout');
    });

    it('should detect stale data correctly', () => {
      // 初始狀態應該是過期的（沒有數據接收時間）
      expect(manager.isDataStale('binance', 'fundingRate')).toBe(true);

      // 更新數據接收時間
      manager.updateLastDataReceived('binance', 'fundingRate');
      expect(manager.isDataStale('binance', 'fundingRate')).toBe(false);
    });

    it('should not switch if already in target mode', () => {
      const switchHandler = vi.fn();
      manager.onSwitch(switchHandler);

      // 切換到 REST
      manager.disableWebSocket('binance', 'fundingRate', 'error');

      // 再次嘗試切換到 REST
      manager.disableWebSocket('binance', 'fundingRate', 'another error');

      // 應該只有一次切換
      expect(switchHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('T050: WebSocket Recovery', () => {
    it('should schedule recovery after fallback', async () => {
      // 啟用 WebSocket
      await manager.enableWebSocket('binance', 'fundingRate');

      // 模擬斷線
      manager.disableWebSocket('binance', 'fundingRate', 'disconnect');

      // 驗證當前是 REST 模式
      expect(manager.getCurrentMode('binance', 'fundingRate')).toBe('rest');

      // 等待恢復嘗試事件
      const recoveryPromise = new Promise<void>((resolve) => {
        manager.on('recoveryAttempt', (event) => {
          expect(event.exchange).toBe('binance');
          expect(event.dataType).toBe('fundingRate');
          resolve();
        });
      });

      await recoveryPromise;
    });

    it('should recover to WebSocket when enableWebSocket is called', async () => {
      const switchHandler = vi.fn();
      manager.onSwitch(switchHandler);

      // 先斷線切換到 REST（需要先有 websocket 狀態）
      manager.disableWebSocket('okx', 'fundingRate', 'disconnect');
      expect(manager.getCurrentMode('okx', 'fundingRate')).toBe('rest');

      // 恢復 WebSocket
      await manager.enableWebSocket('okx', 'fundingRate');
      expect(manager.getCurrentMode('okx', 'fundingRate')).toBe('websocket');

      // 驗證最後一個切換事件
      const lastCallIndex = switchHandler.mock.calls.length - 1;
      const lastEvent: DataSourceSwitchEvent = switchHandler.mock.calls[lastCallIndex][0];
      expect(lastEvent.reason).toBe('websocket_connected');
    });

    it('should not recover if WebSocket is not supported', async () => {
      // MEXC position 不支援 WebSocket (Feature 054: BingX fundingRate 現在支援)
      const result = await manager.tryRecoverWebSocket('mexc', 'position');
      expect(result).toBe(false);
      expect(manager.getCurrentMode('mexc', 'position')).toBe('rest');
    });

    it('should emit recoveryAttempt event when in REST mode', async () => {
      const recoveryHandler = vi.fn();
      manager.on('recoveryAttempt', recoveryHandler);

      // 先切換到 REST 模式
      manager.disableWebSocket('binance', 'fundingRate', 'disconnect');
      expect(manager.getCurrentMode('binance', 'fundingRate')).toBe('rest');

      // 觸發恢復嘗試
      await manager.tryRecoverWebSocket('binance', 'fundingRate');

      expect(recoveryHandler).toHaveBeenCalledWith({
        exchange: 'binance',
        dataType: 'fundingRate',
      });
    });
  });

  describe('State Management', () => {
    it('should return undefined for non-existent state', () => {
      // 不先呼叫 getOrCreateState
      const state = manager.getState('binance', 'ticker');
      expect(state).toBeUndefined();
    });

    it('should track last data received time', () => {
      manager.updateLastDataReceived('binance', 'fundingRate', 50);

      const state = manager.getState('binance', 'fundingRate');
      expect(state?.lastDataReceivedAt).toBeInstanceOf(Date);
      expect(state?.latency).toBe(50);
    });

    it('should get all states', () => {
      manager.getCurrentMode('binance', 'fundingRate');
      manager.getCurrentMode('okx', 'fundingRate');
      manager.getCurrentMode('gateio', 'fundingRate');

      const states = manager.getAllStates();
      expect(states.length).toBe(3);
    });

    it('should generate summary correctly', () => {
      manager.enableWebSocket('binance', 'fundingRate');
      manager.disableWebSocket('okx', 'fundingRate', 'error');
      manager.getCurrentMode('gateio', 'fundingRate');

      const summary = manager.getSummary();
      expect(summary.total).toBe(3);
      expect(summary.websocketCount).toBe(2); // binance and gateio default to websocket
      expect(summary.restCount).toBe(1); // okx disabled
    });

    it('should perform health check', () => {
      manager.updateLastDataReceived('binance', 'fundingRate');
      const health = manager.getHealthCheck('binance', 'fundingRate');

      expect(health.exchange).toBe('binance');
      expect(health.dataType).toBe('fundingRate');
      expect(health.mode).toBe('websocket');
      expect(health.isStale).toBe(false);
      expect(health.health).toBe('optimal');
    });
  });

  describe('Configuration', () => {
    it('should use default config', () => {
      const config = manager.getConfig();
      expect(config.autoSwitch).toBe(true);
    });

    it('should update config', () => {
      manager.updateConfig({ autoSwitch: false });

      const config = manager.getConfig();
      expect(config.autoSwitch).toBe(false);
    });
  });

  describe('Cleanup', () => {
    it('should clear all states', () => {
      manager.getCurrentMode('binance', 'fundingRate');
      manager.getCurrentMode('okx', 'fundingRate');

      expect(manager.getAllStates().length).toBe(2);

      manager.clear();

      expect(manager.getAllStates().length).toBe(0);
    });

    it('should remove switch listeners', () => {
      const handler = vi.fn();
      manager.onSwitch(handler);
      manager.offSwitch(handler);

      manager.enableWebSocket('binance', 'fundingRate');

      // Handler should not be called after removal
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
