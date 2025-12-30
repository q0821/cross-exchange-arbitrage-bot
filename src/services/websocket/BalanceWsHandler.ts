/**
 * BalanceWsHandler
 * Feature: 052-specify-scripts-bash
 * Task: T068
 *
 * 處理餘額 WebSocket 事件，聚合和追蹤餘額變更
 */

import { EventEmitter } from 'events';
import Decimal from 'decimal.js';
import type { ExchangeName } from '@/connectors/types';
import type { BalanceChanged } from '@/types/internal-events';
import { logger } from '@/lib/logger';

/** 餘額更新事件 */
export interface BalanceUpdateEvent {
  exchange: ExchangeName;
  asset: string;
  balance: string;
  change: string;
  reason: string;
  timestamp: Date;
}

/** 餘額歷史記錄 */
interface BalanceHistoryEntry {
  balance: string;
  change: string;
  reason: string;
  timestamp: Date;
}

/**
 * BalanceWsHandler
 *
 * 處理來自各交易所的餘額變更事件
 */
export class BalanceWsHandler extends EventEmitter {
  // 當前餘額: exchange -> asset -> balance
  private balances: Map<ExchangeName, Map<string, Decimal>> = new Map();

  // 餘額歷史: exchange:asset -> history[]
  private history: Map<string, BalanceHistoryEntry[]> = new Map();

  // 歷史記錄最大長度
  private readonly maxHistoryLength = 100;

  constructor() {
    super();
  }

  /**
   * 處理餘額變更事件
   */
  handleBalanceChanged(event: BalanceChanged): void {
    const { exchange, asset, walletBalance, balanceChange, changeReason, receivedAt } = event;
    const reason = changeReason ?? 'UNKNOWN';
    const timestamp = receivedAt;

    // 更新餘額
    if (!this.balances.has(exchange)) {
      this.balances.set(exchange, new Map());
    }
    this.balances.get(exchange)!.set(asset, walletBalance);

    // 記錄歷史
    const historyKey = `${exchange}:${asset}`;
    if (!this.history.has(historyKey)) {
      this.history.set(historyKey, []);
    }
    const historyList = this.history.get(historyKey)!;
    historyList.push({
      balance: this.formatBalance(walletBalance),
      change: this.formatBalance(balanceChange),
      reason,
      timestamp,
    });

    // 限制歷史長度
    if (historyList.length > this.maxHistoryLength) {
      historyList.shift();
    }

    // 發射更新事件
    const updateEvent: BalanceUpdateEvent = {
      exchange,
      asset,
      balance: this.formatBalance(walletBalance),
      change: this.formatBalance(balanceChange),
      reason,
      timestamp,
    };
    this.emit('balanceUpdate', updateEvent);

    logger.debug(
      { exchange, asset, balance: updateEvent.balance, change: updateEvent.change },
      'Balance updated'
    );
  }

  /**
   * 取得所有餘額
   */
  getBalances(): Record<string, Record<string, string>> {
    const result: Record<string, Record<string, string>> = {};

    for (const [exchange, assets] of this.balances) {
      result[exchange] = {};
      for (const [asset, balance] of assets) {
        result[exchange][asset] = this.formatBalance(balance);
      }
    }

    return result;
  }

  /**
   * 取得特定交易所的餘額
   */
  getExchangeBalances(exchange: ExchangeName): Record<string, string> {
    const assets = this.balances.get(exchange);
    if (!assets) return {};

    const result: Record<string, string> = {};
    for (const [asset, balance] of assets) {
      result[asset] = this.formatBalance(balance);
    }
    return result;
  }

  /**
   * 取得特定資產的總餘額（跨交易所）
   */
  getTotalBalance(asset: string): string {
    let total = new Decimal(0);

    for (const assets of this.balances.values()) {
      const balance = assets.get(asset);
      if (balance) {
        total = total.plus(balance);
      }
    }

    return total.toFixed();
  }

  /**
   * 取得餘額歷史
   */
  getBalanceHistory(exchange: ExchangeName, asset: string): BalanceHistoryEntry[] {
    const historyKey = `${exchange}:${asset}`;
    return this.history.get(historyKey) ?? [];
  }

  /**
   * 清除所有資料
   */
  clear(): void {
    this.balances.clear();
    this.history.clear();
  }

  /**
   * 格式化餘額字串
   * 移除不必要的尾隨零，保留有效小數位
   */
  private formatBalance(value: Decimal): string {
    const str = value.toFixed(8);
    // 移除尾隨零和可能的小數點
    return str.replace(/\.?0+$/, '');
  }
}

export default BalanceWsHandler;
