/**
 * 日誌通知渠道
 * 將通知記錄到結構化日誌系統（Pino）
 *
 * Feature: 005-arbitrage-opportunity-detection
 * Date: 2025-10-22
 */

import type { Severity } from '@prisma/client'
import { logger } from '../../../lib/logger'

/**
 * 通知訊息介面
 */
export interface NotificationMessage {
  symbol: string
  severity: Severity
  message: string
  timestamp?: Date
  metadata?: Record<string, unknown>
}

/**
 * 日誌通知渠道
 */
export class LogChannel {
  private enabled: boolean = true

  constructor() {
    logger.info('初始化 LogChannel')
  }

  /**
   * 發送通知到日誌系統
   * @param notification 通知訊息
   */
  async send(notification: NotificationMessage): Promise<void> {
    if (!this.enabled) {
      logger.debug({ symbol: notification.symbol }, 'LogChannel 已停用，跳過發送')
      return
    }

    try {
      const logLevel = this.mapSeverityToLogLevel(notification.severity)
      const logContext = {
        symbol: notification.symbol,
        severity: notification.severity,
        timestamp: notification.timestamp || new Date(),
        ...notification.metadata,
      }

      // 根據嚴重性選擇日誌層級
      switch (logLevel) {
        case 'info':
          logger.info(logContext, notification.message)
          break
        case 'warn':
          logger.warn(logContext, notification.message)
          break
        case 'error':
          logger.error(logContext, notification.message)
          break
        default:
          logger.info(logContext, notification.message)
      }

      logger.debug({
        symbol: notification.symbol,
        severity: notification.severity,
        logLevel,
      }, 'LogChannel 發送通知成功')
    } catch (error) {
      logger.error({ error, notification }, 'LogChannel 發送通知失敗')
      throw error
    }
  }

  /**
   * 測試渠道連線
   * @returns 是否連線成功
   */
  async test(): Promise<boolean> {
    try {
      logger.info('LogChannel 連線測試成功')
      return true
    } catch (error) {
      logger.error({ error }, 'LogChannel 連線測試失敗')
      return false
    }
  }

  /**
   * 啟用渠道
   */
  enable(): void {
    this.enabled = true
    logger.info('LogChannel 已啟用')
  }

  /**
   * 停用渠道
   */
  disable(): void {
    this.enabled = false
    logger.info('LogChannel 已停用')
  }

  /**
   * 檢查渠道是否啟用
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * 批量發送通知
   * @param notifications 通知訊息陣列
   */
  async sendBatch(notifications: NotificationMessage[]): Promise<void> {
    if (!this.enabled) {
      logger.debug('LogChannel 已停用，跳過批量發送')
      return
    }

    for (const notification of notifications) {
      await this.send(notification)
    }
  }

  /**
   * 將 Severity 映射到 Pino 日誌層級
   */
  private mapSeverityToLogLevel(severity: Severity): 'info' | 'warn' | 'error' {
    switch (severity) {
      case 'INFO':
        return 'info'
      case 'WARNING':
        return 'warn'
      case 'CRITICAL':
        return 'error'
      default:
        return 'info'
    }
  }
}
