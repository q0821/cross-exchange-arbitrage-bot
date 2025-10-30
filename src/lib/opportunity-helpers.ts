/**
 * 套利機會輔助函式
 * 提供計算、格式化等共用功能
 *
 * Feature: 005-arbitrage-opportunity-detection
 * Date: 2025-10-22
 *
 * 更新：加入淨收益計算（Feature 006）
 * Date: 2025-10-30
 */

import type { Decimal } from '@prisma/client/runtime/library'
import { Decimal as DecimalJS } from 'decimal.js'
import { TOTAL_COST_RATE } from './cost-constants.js'

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

// ============================================
// 淨收益計算函式（Feature 006）
// ============================================

/**
 * 計算淨收益率
 * 扣除所有交易成本後的實際收益率
 *
 * @param rateDifference 費率差異（毛收益）
 * @returns 淨收益率（費率差異 - 總成本 0.37%）
 *
 * @example
 * ```typescript
 * const netProfit = calculateNetProfitRate(new Decimal(0.004)) // 0.4%
 * // 返回: 0.0003 (0.03%) = 0.4% - 0.37%
 * ```
 */
export function calculateNetProfitRate(rateDifference: Decimal): Decimal {
  const rate = new DecimalJS(rateDifference.toString())
  const cost = new DecimalJS(TOTAL_COST_RATE)
  return rate.minus(cost) as unknown as Decimal
}

/**
 * 計算淨年化收益率
 * 基於淨收益計算的年化報酬率
 *
 * @param rateDifference 費率差異（毛收益）
 * @param fundingInterval 資金費率結算間隔（小時），預設 8 小時
 * @returns 淨年化收益率
 *
 * @example
 * ```typescript
 * const netAnnualReturn = calculateNetAnnualizedReturn(new Decimal(0.004)) // 0.4%
 * // 淨收益: 0.03%
 * // 年化: 0.03% × 1095 = 32.85%
 * ```
 */
export function calculateNetAnnualizedReturn(
  rateDifference: Decimal,
  fundingInterval: number = 8
): Decimal {
  const netProfit = calculateNetProfitRate(rateDifference)
  const periodsPerDay = 24 / fundingInterval
  const periodsPerYear = periodsPerDay * 365

  const rate = new DecimalJS(netProfit.toString())
  return rate.times(periodsPerYear) as unknown as Decimal
}

/**
 * 檢查是否為有效套利機會
 * 只有淨收益 > 0 才算有效機會
 *
 * @param rateDifference 費率差異
 * @returns true 如果淨收益 > 0，false 否則
 *
 * @example
 * ```typescript
 * isValidNetOpportunity(new Decimal(0.004)) // true (0.4% > 0.37%)
 * isValidNetOpportunity(new Decimal(0.003)) // false (0.3% < 0.37%)
 * ```
 */
export function isValidNetOpportunity(rateDifference: Decimal): boolean {
  const rate = new DecimalJS(rateDifference.toString())
  const threshold = new DecimalJS(TOTAL_COST_RATE)
  return rate.greaterThan(threshold)
}

/**
 * 計算淨收益金額
 *
 * @param rateDifference 費率差異
 * @param positionSize 倉位大小（USDT），預設 100000
 * @returns 淨收益金額（USDT）
 *
 * @example
 * ```typescript
 * const profit = calculateNetProfitAmount(new Decimal(0.004), 100000)
 * // 返回: 30 USDT = (0.4% - 0.37%) × 100000
 * ```
 */
export function calculateNetProfitAmount(
  rateDifference: Decimal,
  positionSize: number = 100000
): Decimal {
  const netProfitRate = calculateNetProfitRate(rateDifference)
  const rate = new DecimalJS(netProfitRate.toString())
  return rate.times(positionSize) as unknown as Decimal
}

/**
 * 格式化淨收益率為百分比字串
 *
 * @param rateDifference 費率差異
 * @param decimals 小數位數，預設 4 位
 * @returns 格式化的百分比字串（例如：0.0300%）
 */
export function formatNetProfitPercent(
  rateDifference: Decimal,
  decimals: number = 4
): string {
  const netProfit = calculateNetProfitRate(rateDifference)
  return formatRateDifferencePercent(netProfit, decimals)
}

/**
 * 格式化淨年化收益率為百分比字串
 *
 * @param rateDifference 費率差異
 * @param decimals 小數位數，預設 2 位
 * @returns 格式化的百分比字串（例如：32.85%）
 */
export function formatNetAnnualizedPercent(
  rateDifference: Decimal,
  decimals: number = 2
): string {
  const netAnnual = calculateNetAnnualizedReturn(rateDifference)
  return formatRateDifferencePercent(netAnnual, decimals)
}

/**
 * 取得總成本率
 * @returns 總成本率 (0.37%)
 */
export function getTotalCostRate(): number {
  return TOTAL_COST_RATE
}

/**
 * 取得總成本率（Decimal 格式）
 * @returns 總成本率 Decimal (0.0037)
 */
export function getTotalCostRateDecimal(): Decimal {
  return new DecimalJS(TOTAL_COST_RATE) as unknown as Decimal
}
