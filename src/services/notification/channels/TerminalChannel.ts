/**
 * 終端機通知渠道
 * 將通知輸出到終端機，使用顏色標示不同嚴重性
 *
 * Feature: 005-arbitrage-opportunity-detection
 * Date: 2025-10-22
 */

import chalk from 'chalk'
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
}

/**
 * 終端機通知渠道
 */
export class TerminalChannel {
  private enabled: boolean = true

  constructor() {
    logger.info('初始化 TerminalChannel')
  }

  /**
   * 發送通知到終端機
   * @param notification 通知訊息
   */
  async send(notification: NotificationMessage): Promise<void> {
    if (!this.enabled) {
      logger.debug({ symbol: notification.symbol }, 'TerminalChannel 已停用，跳過發送')
      return
    }

    try {
      const coloredMessage = this.formatMessage(notification)
      console.log(coloredMessage)

      logger.debug({
        symbol: notification.symbol,
        severity: notification.severity,
      }, 'TerminalChannel 發送通知成功')
    } catch (error) {
      logger.error({ error, notification }, 'TerminalChannel 發送通知失敗')
      throw error
    }
  }

  /**
   * 測試渠道連線
   * @returns 是否連線成功
   */
  async test(): Promise<boolean> {
    try {
      const testMessage = chalk.cyan('✓ TerminalChannel 連線測試成功')
      console.log(testMessage)
      return true
    } catch (error) {
      logger.error({ error }, 'TerminalChannel 連線測試失敗')
      return false
    }
  }

  /**
   * 啟用渠道
   */
  enable(): void {
    this.enabled = true
    logger.info('TerminalChannel 已啟用')
  }

  /**
   * 停用渠道
   */
  disable(): void {
    this.enabled = false
    logger.info('TerminalChannel 已停用')
  }

  /**
   * 檢查渠道是否啟用
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * 格式化訊息並根據嚴重性著色
   */
  private formatMessage(notification: NotificationMessage): string {
    const timestamp = notification.timestamp || new Date()
    const timeStr = timestamp.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })

    // 根據嚴重性選擇顏色
    let colorFn: typeof chalk.cyan
    let icon: string

    switch (notification.severity) {
      case 'INFO':
        colorFn = chalk.cyan
        icon = 'ℹ'
        break
      case 'WARNING':
        colorFn = chalk.yellow
        icon = '⚠'
        break
      case 'CRITICAL':
        colorFn = chalk.red
        icon = '❌'
        break
      default:
        colorFn = chalk.white
        icon = '•'
    }

    // 構建格式化訊息
    const header = colorFn.bold(`${icon} [${notification.severity}] ${notification.symbol}`)
    const time = chalk.gray(`[${timeStr}]`)
    const message = colorFn(notification.message)

    return `\n${time} ${header}\n${message}\n`
  }

  /**
   * 批量發送通知
   * @param notifications 通知訊息陣列
   */
  async sendBatch(notifications: NotificationMessage[]): Promise<void> {
    if (!this.enabled) {
      logger.debug('TerminalChannel 已停用，跳過批量發送')
      return
    }

    for (const notification of notifications) {
      await this.send(notification)
    }
  }
}
