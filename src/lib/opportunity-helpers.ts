/**
 * 套利機會輔助函式
 * 提供計算、格式化等共用功能
 *
 * Feature: 005-arbitrage-opportunity-detection
 * Date: 2025-10-22
 */

import type { Decimal } from '@prisma/client/runtime/library'
import { Decimal as DecimalJS } from 'decimal.js'

/**
 * 計算持續時間（毫秒）
 * @param startTime 開始時間
 * @param endTime 結束時間（預設為當前時間）
 * @returns 持續時間（毫秒）
 */
export function calculateDurationMs(startTime: Date, endTime: Date = new Date()): number {
  return endTime.getTime() - startTime.getTime()
}

/**
 * 計算持續時間（分鐘）
 * @param startTime 開始時間
 * @param endTime 結束時間（預設為當前時間）
 * @returns 持續時間（分鐘，保留 2 位小數）
 */
export function calculateDurationMinutes(startTime: Date, endTime: Date = new Date()): number {
  const ms = calculateDurationMs(startTime, endTime)
  return Math.round((ms / (1000 * 60)) * 100) / 100
}

/**
 * 計算平均費率差異
 * @param samples 費率差異樣本陣列
 * @returns 平均費率差異
 */
export function calculateAverageRateDifference(samples: Decimal[]): Decimal {
  if (samples.length === 0) {
    return new DecimalJS(0) as unknown as Decimal
  }

  const sum = samples.reduce(
    (acc, val) => acc.plus(new DecimalJS(val.toString())),
    new DecimalJS(0)
  )

  return sum.dividedBy(samples.length) as unknown as Decimal
}

/**
 * 計算年化收益率
 * @param rateDifference 費率差異
 * @param fundingInterval 資金費率結算間隔（小時），預設 8 小時
 * @returns 年化收益率
 */
export function calculateAnnualizedReturn(
  rateDifference: Decimal,
  fundingInterval: number = 8
): Decimal {
  // 年化收益率 = 費率差異 * (24 / 結算間隔) * 365
  const periodsPerDay = 24 / fundingInterval
  const periodsPerYear = periodsPerDay * 365

  const rate = new DecimalJS(rateDifference.toString())
  return rate.times(periodsPerYear) as unknown as Decimal
}

/**
 * 格式化費率差異為百分比字串
 * @param rateDifference 費率差異
 * @param decimals 小數位數，預設 4 位
 * @returns 格式化的百分比字串（例如：0.0523%）
 */
export function formatRateDifferencePercent(
  rateDifference: Decimal,
  decimals: number = 4
): string {
  const rate = new DecimalJS(rateDifference.toString())
  const percent = rate.times(100)
  return `${percent.toFixed(decimals)}%`
}

/**
 * 格式化持續時間為人類可讀字串
 * @param durationMs 持續時間（毫秒）
 * @returns 格式化字串（例如：2h 30m 15s）
 */
export function formatDuration(durationMs: number): string {
  const seconds = Math.floor(durationMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    const remainingHours = hours % 24
    return `${days}d ${remainingHours}h`
  }

  if (hours > 0) {
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }

  if (minutes > 0) {
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  return `${seconds}s`
}

/**
 * 檢查費率差異是否達到閾值
 * @param rateDifference 費率差異
 * @param threshold 閾值
 * @returns 是否達到閾值
 */
export function meetsThreshold(rateDifference: Decimal, threshold: Decimal): boolean {
  const rate = new DecimalJS(rateDifference.toString())
  const thresholdValue = new DecimalJS(threshold.toString())
  return rate.greaterThanOrEqualTo(thresholdValue)
}

/**
 * 計算兩個費率差異的變化百分比
 * @param oldValue 舊值
 * @param newValue 新值
 * @returns 變化百分比（例如：10.5 表示增加 10.5%）
 */
export function calculateChangePercent(oldValue: Decimal, newValue: Decimal): number {
  const oldVal = new DecimalJS(oldValue.toString())
  const newVal = new DecimalJS(newValue.toString())

  if (oldVal.isZero()) {
    return newVal.isZero() ? 0 : 100
  }

  const change = newVal.minus(oldVal)
  const percent = change.dividedBy(oldVal).times(100)
  return percent.toNumber()
}

/**
 * 判斷變化是否顯著（超過指定百分比）
 * @param oldValue 舊值
 * @param newValue 新值
 * @param significanceThreshold 顯著性閾值（百分比），預設 10%
 * @returns 是否顯著變化
 */
export function isSignificantChange(
  oldValue: Decimal,
  newValue: Decimal,
  significanceThreshold: number = 10
): boolean {
  const changePercent = Math.abs(calculateChangePercent(oldValue, newValue))
  return changePercent >= significanceThreshold
}

/**
 * 建立機會唯一識別字串
 * @param symbol 幣別符號
 * @param longExchange 做多交易所
 * @param shortExchange 做空交易所
 * @returns 唯一識別字串（例如：BTCUSDT:binance-okx）
 */
export function createOpportunityKey(
  symbol: string,
  longExchange: string,
  shortExchange: string
): string {
  return `${symbol}:${longExchange}-${shortExchange}`
}

/**
 * 解析機會唯一識別字串
 * @param key 唯一識別字串
 * @returns 解析結果，若格式不正確則返回 null
 */
export function parseOpportunityKey(key: string): {
  symbol: string
  longExchange: string
  shortExchange: string
} | null {
  const parts = key.split(':')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null

  const [symbol, exchanges] = parts
  const exchangeParts = exchanges?.split('-')
  if (!exchangeParts || exchangeParts.length !== 2 || !exchangeParts[0] || !exchangeParts[1]) return null

  const [longExchange, shortExchange] = exchangeParts

  return { symbol, longExchange, shortExchange }
}

/**
 * 排序機會列表（按費率差異降序）
 * @param opportunities 機會列表
 * @returns 排序後的機會列表
 */
export function sortByRateDifference<T extends { rateDifference: Decimal }>(
  opportunities: T[]
): T[] {
  return [...opportunities].sort((a, b) => {
    const aRate = new DecimalJS(a.rateDifference.toString())
    const bRate = new DecimalJS(b.rateDifference.toString())
    return bRate.minus(aRate).toNumber()
  })
}

/**
 * 過濾達到閾值的機會
 * @param opportunities 機會列表
 * @param threshold 費率差異閾值
 * @returns 過濾後的機會列表
 */
export function filterByThreshold<T extends { rateDifference: Decimal }>(
  opportunities: T[],
  threshold: Decimal
): T[] {
  return opportunities.filter((opp) => meetsThreshold(opp.rateDifference, threshold))
}

/**
 * 將 Decimal 轉換為數字（用於計算）
 * @param value Decimal 值
 * @returns 數字
 */
export function toNumber(value: Decimal): number {
  return new DecimalJS(value.toString()).toNumber()
}

/**
 * 將數字轉換為 Decimal
 * @param value 數字
 * @returns Decimal
 */
export function toDecimal(value: number): Decimal {
  return new DecimalJS(value) as unknown as Decimal
}

/**
 * 安全的 Decimal 加法
 * @param a 第一個值
 * @param b 第二個值
 * @returns 相加結果
 */
export function addDecimal(a: Decimal, b: Decimal): Decimal {
  const aVal = new DecimalJS(a.toString())
  const bVal = new DecimalJS(b.toString())
  return aVal.plus(bVal) as unknown as Decimal
}

/**
 * 安全的 Decimal 減法
 * @param a 被減數
 * @param b 減數
 * @returns 相減結果
 */
export function subtractDecimal(a: Decimal, b: Decimal): Decimal {
  const aVal = new DecimalJS(a.toString())
  const bVal = new DecimalJS(b.toString())
  return aVal.minus(bVal) as unknown as Decimal
}

/**
 * 安全的 Decimal 比較
 * @param a 第一個值
 * @param b 第二個值
 * @returns -1 (a < b), 0 (a = b), 1 (a > b)
 */
export function compareDecimal(a: Decimal, b: Decimal): number {
  const aVal = new DecimalJS(a.toString())
  const bVal = new DecimalJS(b.toString())
  return aVal.comparedTo(bVal)
}
