/**
 * 套利機會格式化工具
 * 提供各種格式化輸出功能
 *
 * Feature: 005-arbitrage-opportunity-detection (Phase 4)
 * Date: 2025-10-23
 */

import type { Decimal } from '@prisma/client/runtime/library'
import { Decimal as DecimalJS } from 'decimal.js'

/**
 * 格式化年化收益率
 * @param expectedReturnRate 預期年化收益率（0.7665 = 76.65%）
 * @returns 格式化後的字串 "76.65%"
 */
export function formatAnnualizedReturn(expectedReturnRate: Decimal): string {
  const percent = new DecimalJS(expectedReturnRate.toString()).mul(100).toFixed(2)
  return `${percent}%`
}

/**
 * 格式化費率差異為百分比
 * @param rateDifference 費率差異（0.0007 = 0.07%）
 * @returns 格式化後的字串 "0.07%"
 */
export function formatSpread(rateDifference: Decimal): string {
  const percent = new DecimalJS(rateDifference.toString()).mul(100).toFixed(2)
  return `${percent}%`
}

/**
 * 格式化持續時間
 * @param detectedAt 偵測時間
 * @param expiredAt 過期時間（可選，未過期則使用當前時間）
 * @returns 格式化後的字串 "5m 23s" 或 "2h 15m" 或 "3d 2h"
 */
export function formatDuration(detectedAt: Date, expiredAt?: Date | null): string {
  const endTime = expiredAt || new Date()
  const durationMs = endTime.getTime() - detectedAt.getTime()

  if (durationMs < 0) {
    return '0s'
  }

  const seconds = Math.floor(durationMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    const remainingHours = hours % 24
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
  }

  if (hours > 0) {
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  }

  if (minutes > 0) {
    const remainingSeconds = seconds % 60
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  }

  return `${seconds}s`
}

/**
 * 格式化持續時間（毫秒版本）
 * @param durationMs 持續時間（毫秒）
 * @returns 格式化後的字串
 */
export function formatDurationMs(durationMs: number | bigint): string {
  const ms = typeof durationMs === 'bigint' ? Number(durationMs) : durationMs

  if (ms < 0) {
    return '0s'
  }

  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    const remainingHours = hours % 24
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
  }

  if (hours > 0) {
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  }

  if (minutes > 0) {
    const remainingSeconds = seconds % 60
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  }

  return `${seconds}s`
}

/**
 * 格式化日期時間
 * @param date 日期物件
 * @returns 格式化後的字串 "2025-10-23 14:30:25"
 */
export function formatDateTime(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

/**
 * 格式化短日期時間（不顯示秒）
 * @param date 日期物件
 * @returns 格式化後的字串 "2025-10-23 14:30"
 */
export function formatShortDateTime(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}`
}

/**
 * 截斷字串並加上省略號
 * @param str 原始字串
 * @param maxLength 最大長度
 * @returns 截斷後的字串
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str
  }
  return str.substring(0, maxLength - 3) + '...'
}

/**
 * 格式化通知計數
 * @param count 通知次數
 * @returns 格式化後的字串 "5" 或 "99+" (超過 99 次)
 */
export function formatNotificationCount(count: number): string {
  if (count > 99) {
    return '99+'
  }
  return count.toString()
}
