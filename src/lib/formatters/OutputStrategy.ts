import type { FundingRatePair } from '../../models/FundingRate.js'
import { TableRenderer } from './TableRenderer.js'
import { ColorStyler } from './ColorStyler.js'

/**
 * OutputStrategy - 輸出策略介面
 *
 * 定義不同輸出模式的統一介面，支援：
 * - Table: 使用 cli-table3 渲染表格
 * - PlainText: 換行分隔的純文字
 * - JSON: JSON 格式輸出
 */
export interface OutputStrategy {
  /**
   * 渲染資金費率資料
   * @param pairs 資金費率配對資料
   * @param threshold 套利閾值
   * @returns 格式化後的輸出字串
   */
  render(pairs: FundingRatePair[], threshold: number): string
}

/**
 * TableOutputStrategy - 表格輸出策略
 *
 * 使用 TableRenderer 渲染 ASCII 表格
 */
export class TableOutputStrategy implements OutputStrategy {
  private readonly tableRenderer: TableRenderer

  constructor(
    terminalWidth: number,
    supportsColor: boolean
  ) {
    const colorStyler = new ColorStyler(supportsColor)
    this.tableRenderer = new TableRenderer(terminalWidth, colorStyler)
  }

  render(pairs: FundingRatePair[], threshold: number): string {
    return this.tableRenderer.render(pairs, threshold)
  }
}

/**
 * PlainTextOutputStrategy - 純文字輸出策略
 *
 * 輸出換行分隔的純文字格式，適合非 TTY 環境
 */
export class PlainTextOutputStrategy implements OutputStrategy {
  render(pairs: FundingRatePair[], threshold: number): string {
    if (pairs.length === 0) {
      return 'No data available'
    }

    return pairs.map(pair => {
      const binanceRate = pair.binance?.fundingRate
      const okxRate = pair.okx?.fundingRate

      const binanceRateStr = binanceRate !== null && binanceRate !== undefined
        ? `${(binanceRate * 100).toFixed(4)}%`
        : '---'

      const okxRateStr = okxRate !== null && okxRate !== undefined
        ? `${(okxRate * 100).toFixed(4)}%`
        : '---'

      let spreadStr = '---'
      if (binanceRate !== null && binanceRate !== undefined &&
          okxRate !== null && okxRate !== undefined) {
        const spread = binanceRate - okxRate
        spreadStr = `${(spread * 100).toFixed(4)}%`
      }

      // 判斷是否為套利機會
      const isOpportunity = binanceRate !== null && binanceRate !== undefined &&
                            okxRate !== null && okxRate !== undefined &&
                            Math.abs(binanceRate - okxRate) * 100 >= threshold

      const opportunityMarker = isOpportunity ? ' [OPPORTUNITY]' : ''

      return `${pair.symbol}${opportunityMarker}: Binance ${binanceRateStr} | OKX ${okxRateStr} | Spread ${spreadStr}`
    }).join('\n')
  }
}

/**
 * JSONOutputStrategy - JSON 輸出策略
 *
 * 輸出 JSON 格式，適合程式化處理或 CI/CD 管道
 */
export class JSONOutputStrategy implements OutputStrategy {
  render(pairs: FundingRatePair[], threshold: number): string {
    const output = pairs.map(pair => {
      const binanceRate = pair.binance?.fundingRate
      const okxRate = pair.okx?.fundingRate

      let spread = null
      let isOpportunity = false

      if (binanceRate !== null && binanceRate !== undefined &&
          okxRate !== null && okxRate !== undefined) {
        spread = binanceRate - okxRate
        isOpportunity = Math.abs(spread) * 100 >= threshold
      }

      return {
        symbol: pair.symbol,
        binance: {
          fundingRate: binanceRate,
          fundingRatePercent: binanceRate !== null && binanceRate !== undefined
            ? `${(binanceRate * 100).toFixed(4)}%`
            : null
        },
        okx: {
          fundingRate: okxRate,
          fundingRatePercent: okxRate !== null && okxRate !== undefined
            ? `${(okxRate * 100).toFixed(4)}%`
            : null
        },
        spread: {
          value: spread,
          percent: spread !== null ? `${(spread * 100).toFixed(4)}%` : null
        },
        isOpportunity,
        threshold: `${threshold.toFixed(4)}%`,
        recordedAt: pair.recordedAt.toISOString()
      }
    })

    return JSON.stringify(output, null, 2)
  }
}
