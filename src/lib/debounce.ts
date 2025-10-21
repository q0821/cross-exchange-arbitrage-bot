/**
 * 防抖動管理器實作
 * 用於防止通知轟炸，採用 per-symbol 策略
 *
 * Feature: 005-arbitrage-opportunity-detection
 * Date: 2025-10-22
 */

import type { IDebounceManager } from '../types/opportunity-detection'
import { logger } from './logger'

/**
 * 防抖動狀態記錄
 */
interface DebounceState {
  /** 上次觸發時間 */
  lastTriggerTime: number
  /** 跳過次數 */
  skipCount: number
}

/**
 * 防抖動管理器實作
 *
 * 採用 per-symbol 策略，每個幣別獨立計算防抖動窗口
 * 預設窗口為 30 秒，同一幣別在窗口內只觸發一次
 */
export class DebounceManager implements IDebounceManager {
  private readonly states = new Map<string, DebounceState>()

  constructor(
    /** 防抖動窗口（毫秒），預設 30 秒 */
    private readonly windowMs: number = 30_000
  ) {
    logger.debug({ windowMs }, '初始化防抖動管理器')
  }

  /**
   * 檢查是否應該觸發
   * @param key 防抖動鍵值（通常為 symbol 或 symbol:type 組合）
   * @returns 是否應該觸發
   */
  shouldTrigger(key: string): boolean {
    const now = Date.now()
    const state = this.states.get(key)

    // 第一次觸發
    if (!state) {
      this.states.set(key, {
        lastTriggerTime: now,
        skipCount: 0,
      })
      logger.debug({ key }, '防抖動：首次觸發')
      return true
    }

    const timeSinceLastTrigger = now - state.lastTriggerTime

    // 在防抖動窗口內，跳過觸發
    if (timeSinceLastTrigger < this.windowMs) {
      state.skipCount++
      logger.debug({
        key,
        timeSinceLastTrigger,
        skipCount: state.skipCount,
        windowMs: this.windowMs,
      }, '防抖動：窗口內跳過')
      return false
    }

    // 超過窗口，允許觸發
    const previousSkipCount = state.skipCount
    state.lastTriggerTime = now
    state.skipCount = 0

    logger.debug({
      key,
      timeSinceLastTrigger,
      previousSkipCount,
    }, '防抖動：窗口外觸發')

    return true
  }

  /**
   * 重置防抖動狀態
   * @param key 防抖動鍵值
   */
  reset(key: string): void {
    const hadState = this.states.has(key)
    this.states.delete(key)

    if (hadState) {
      logger.debug({ key }, '重置防抖動狀態')
    }
  }

  /**
   * 清除所有防抖動狀態
   */
  clear(): void {
    const count = this.states.size
    this.states.clear()
    logger.debug({ clearedCount: count }, '清除所有防抖動狀態')
  }

  /**
   * 獲取跳過次數
   * @param key 防抖動鍵值
   * @returns 跳過次數
   */
  getSkipCount(key: string): number {
    const state = this.states.get(key)
    return state?.skipCount || 0
  }

  /**
   * 獲取當前狀態快照（用於除錯）
   */
  getSnapshot(): Record<string, { lastTriggerTime: Date; skipCount: number; remainingMs: number }> {
    const now = Date.now()
    const snapshot: Record<string, any> = {}

    for (const [key, state] of this.states.entries()) {
      const elapsed = now - state.lastTriggerTime
      const remainingMs = Math.max(0, this.windowMs - elapsed)

      snapshot[key] = {
        lastTriggerTime: new Date(state.lastTriggerTime),
        skipCount: state.skipCount,
        remainingMs,
      }
    }

    return snapshot
  }

  /**
   * 獲取活躍鍵值數量
   */
  getActiveCount(): number {
    return this.states.size
  }

  /**
   * 清理過期狀態（超過 2 倍窗口時間未使用）
   * 建議定期呼叫以避免記憶體洩漏
   */
  cleanup(): void {
    const now = Date.now()
    const expirationThreshold = this.windowMs * 2
    let cleanedCount = 0

    for (const [key, state] of this.states.entries()) {
      const elapsed = now - state.lastTriggerTime
      if (elapsed > expirationThreshold) {
        this.states.delete(key)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      logger.debug({
        cleanedCount,
        remainingCount: this.states.size,
        expirationThreshold,
      }, '清理過期防抖動狀態')
    }
  }
}

/**
 * 建立標準防抖動管理器（30 秒窗口）
 */
export function createStandardDebouncer(): DebounceManager {
  return new DebounceManager(30_000)
}

/**
 * 建立快速防抖動管理器（5 秒窗口，用於測試）
 */
export function createFastDebouncer(): DebounceManager {
  return new DebounceManager(5_000)
}

/**
 * 建立防抖動鍵值
 * @param symbol 幣別符號
 * @param type 通知類型（可選）
 * @returns 防抖動鍵值
 */
export function createDebounceKey(symbol: string, type?: string): string {
  return type ? `${symbol}:${type}` : symbol
}
