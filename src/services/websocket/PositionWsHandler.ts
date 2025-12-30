/**
 * PositionWsHandler
 * Feature: 052-specify-scripts-bash
 * Task: T044
 *
 * 處理 WebSocket 持倉變更事件
 * - 追蹤即時持倉狀態
 * - 偵測持倉開啟/關閉
 * - 節流資料庫更新
 */

import { EventEmitter } from 'events';
import Decimal from 'decimal.js';
import { logger } from '../../lib/logger';
import type { ExchangeName } from '../../connectors/types';
import type { PositionChanged, PositionClosed } from '../../types/internal-events';

// ==================== 類型定義 ====================

/**
 * 持倉狀態
 */
export interface PositionState {
  exchange: ExchangeName;
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: Decimal;
  entryPrice: Decimal;
  markPrice: Decimal;
  unrealizedPnl: Decimal;
  leverage?: number;
  liquidationPrice?: Decimal;
  margin?: Decimal;
  lastUpdate: Date;
}

/**
 * 資料庫更新快照
 */
export interface PositionSnapshot {
  exchange: ExchangeName;
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: string;
  entryPrice: string;
  markPrice: string;
  unrealizedPnl: string;
  updatedAt: Date;
}

/**
 * PositionWsHandler 選項
 */
export interface PositionWsHandlerOptions {
  /** 資料庫更新節流間隔 (毫秒) */
  updateThrottleMs?: number;
  /** 自動清理已關閉持倉 */
  autoCleanup?: boolean;
  /** 清理延遲 (毫秒) */
  cleanupDelayMs?: number;
}

// ==================== PositionWsHandler 類別 ====================

/**
 * PositionWsHandler
 *
 * 處理 WebSocket 持倉變更事件
 */
export class PositionWsHandler extends EventEmitter {
  private static instance: PositionWsHandler | null = null;
  private positions: Map<string, PositionState> = new Map();
  private lastUpdateTimes: Map<string, number> = new Map();
  private pendingUpdates: Map<string, PositionState> = new Map();
  private flushTimer: NodeJS.Timeout | null = null;
  private options: Required<PositionWsHandlerOptions>;

  private constructor(options?: PositionWsHandlerOptions) {
    super();
    this.options = {
      updateThrottleMs: options?.updateThrottleMs ?? 1000,
      autoCleanup: options?.autoCleanup ?? true,
      cleanupDelayMs: options?.cleanupDelayMs ?? 5000,
    };

    // 啟動定期刷新 pending updates
    this.startFlushTimer();
  }

  /**
   * 獲取單例實例
   */
  static getInstance(options?: PositionWsHandlerOptions): PositionWsHandler {
    if (!PositionWsHandler.instance) {
      PositionWsHandler.instance = new PositionWsHandler(options);
    }
    return PositionWsHandler.instance;
  }

  /**
   * 重置單例 (僅用於測試)
   */
  static resetInstance(): void {
    if (PositionWsHandler.instance) {
      PositionWsHandler.instance.destroy();
      PositionWsHandler.instance = null;
    }
  }

  /**
   * 處理持倉變更事件
   */
  handlePositionChanged(event: PositionChanged): void {
    const key = this.getPositionKey(event.exchange, event.symbol, event.side);
    const existing = this.positions.get(key);

    // 檢查是否為持倉關閉 (size = 0)
    if (event.size.isZero()) {
      if (existing && !existing.size.isZero()) {
        this.handlePositionClosed(existing, event);
      }
      return;
    }

    // 更新持倉狀態
    const newState: PositionState = {
      exchange: event.exchange,
      symbol: event.symbol,
      side: event.side,
      size: event.size,
      entryPrice: event.entryPrice,
      markPrice: event.markPrice,
      unrealizedPnl: event.unrealizedPnl,
      leverage: event.leverage,
      liquidationPrice: event.liquidationPrice,
      margin: event.margin,
      lastUpdate: event.receivedAt,
    };

    this.positions.set(key, newState);

    // 檢查是否為新持倉
    if (!existing || existing.size.isZero()) {
      logger.info(
        {
          exchange: event.exchange,
          symbol: event.symbol,
          side: event.side,
          size: event.size.toString(),
        },
        'Position opened via WebSocket'
      );
      this.emit('positionOpened', newState);
    }

    // 節流資料庫更新
    this.scheduleUpdate(key, newState);

    // 發出即時更新事件 (不節流)
    this.emit('positionUpdated', newState);
  }

  /**
   * 處理持倉關閉
   */
  private handlePositionClosed(existing: PositionState, event: PositionChanged): void {
    const key = this.getPositionKey(event.exchange, event.symbol, event.side);

    // 移除追蹤
    this.positions.delete(key);
    this.lastUpdateTimes.delete(key);
    this.pendingUpdates.delete(key);

    // 建立關閉事件
    const closedEvent: PositionClosed = {
      exchange: event.exchange,
      symbol: event.symbol,
      side: event.side,
      closedSize: existing.size,
      entryPrice: existing.entryPrice,
      exitPrice: event.markPrice,
      realizedPnl: existing.unrealizedPnl, // 近似值
      reason: 'MANUAL', // 預設為手動，由 TriggerDetector 覆蓋
      source: event.source,
      receivedAt: event.receivedAt,
    };

    logger.info(
      {
        exchange: event.exchange,
        symbol: event.symbol,
        side: event.side,
        closedSize: existing.size.toString(),
      },
      'Position closed via WebSocket'
    );

    this.emit('positionClosed', closedEvent);
  }

  /**
   * 排程節流更新
   */
  private scheduleUpdate(key: string, state: PositionState): void {
    const now = Date.now();
    const lastUpdate = this.lastUpdateTimes.get(key) || 0;

    if (now - lastUpdate >= this.options.updateThrottleMs) {
      // 立即更新
      this.lastUpdateTimes.set(key, now);
      this.emitDatabaseUpdate(state);
    } else {
      // 排入待更新
      this.pendingUpdates.set(key, state);
    }
  }

  /**
   * 刷新待更新
   */
  flushPendingUpdates(): void {
    const now = Date.now();

    for (const [key, state] of this.pendingUpdates) {
      this.lastUpdateTimes.set(key, now);
      this.emitDatabaseUpdate(state);
    }

    this.pendingUpdates.clear();
  }

  /**
   * 發出資料庫更新事件
   */
  private emitDatabaseUpdate(state: PositionState): void {
    const snapshot: PositionSnapshot = {
      exchange: state.exchange,
      symbol: state.symbol,
      side: state.side,
      size: state.size.toString(),
      entryPrice: state.entryPrice.toString(),
      markPrice: state.markPrice.toString(),
      unrealizedPnl: state.unrealizedPnl.toString(),
      updatedAt: state.lastUpdate,
    };

    this.emit('databaseUpdate', snapshot);
  }

  /**
   * 取得持倉
   */
  getPosition(exchange: ExchangeName, symbol: string, side: 'LONG' | 'SHORT'): PositionState | undefined {
    const key = this.getPositionKey(exchange, symbol, side);
    return this.positions.get(key);
  }

  /**
   * 取得所有持倉
   */
  getPositions(): Map<string, PositionState> {
    return new Map(this.positions);
  }

  /**
   * 取得指定交易所的持倉
   */
  getPositionsByExchange(exchange: ExchangeName): PositionState[] {
    return Array.from(this.positions.values()).filter((p) => p.exchange === exchange);
  }

  /**
   * 取得指定交易對的持倉
   */
  getPositionsBySymbol(symbol: string): PositionState[] {
    return Array.from(this.positions.values()).filter((p) => p.symbol === symbol);
  }

  /**
   * 檢查是否有持倉
   */
  hasPosition(exchange: ExchangeName, symbol: string, side: 'LONG' | 'SHORT'): boolean {
    const position = this.getPosition(exchange, symbol, side);
    return position !== undefined && !position.size.isZero();
  }

  /**
   * 取得待更新數量
   */
  getPendingUpdateCount(): number {
    return this.pendingUpdates.size;
  }

  /**
   * 取得持倉鍵值
   */
  private getPositionKey(exchange: ExchangeName, symbol: string, side: string): string {
    return `${exchange}:${symbol}:${side}`;
  }

  /**
   * 啟動定期刷新計時器
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      if (this.pendingUpdates.size > 0) {
        this.flushPendingUpdates();
      }
    }, this.options.updateThrottleMs);
  }

  /**
   * 停止刷新計時器
   */
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * 清除所有狀態
   */
  clear(): void {
    this.positions.clear();
    this.lastUpdateTimes.clear();
    this.pendingUpdates.clear();
  }

  /**
   * 銷毀處理器
   */
  destroy(): void {
    this.stopFlushTimer();
    this.clear();
    this.removeAllListeners();
    logger.debug('PositionWsHandler destroyed');
  }
}

/**
 * 導出單例訪問方法
 */
export const positionWsHandler = PositionWsHandler.getInstance();

export default PositionWsHandler;
