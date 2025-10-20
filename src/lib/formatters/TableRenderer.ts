import Table from 'cli-table3'
import { ColorStyler } from './ColorStyler.js'
import type { FundingRatePair } from '../../models/FundingRate.js'

/**
 * TableRenderer - 處理 ASCII 表格的渲染邏輯
 *
 * 根據終端寬度自動選擇顯示模式：
 * - 完整模式 (寬度 >= 80): 顯示交易對、幣安費率、OKX 費率、差異、時間
 * - 簡化模式 (寬度 < 80): 僅顯示交易對和費率差異
 *
 * 採用橫向佈局節省垂直空間：
 * - 上方行：交易對名稱
 * - 下方行：對應的數值資料
 */
export class TableRenderer {
  private readonly FULL_MODE_MIN_WIDTH = 80
  private readonly PLACEHOLDER = '---'

  constructor(
    private readonly terminalWidth: number,
    private readonly colorStyler: ColorStyler
  ) {}

  /**
   * 渲染資金費率表格
   * @param pairs 資金費率配對資料
   * @param threshold 套利閾值（百分比）
   * @returns 格式化的表格字串
   */
  render(pairs: FundingRatePair[], threshold: number): string {
    if (pairs.length === 0) {
      return this.colorStyler.dim('No data available')
    }

    // 根據終端寬度選擇顯示模式
    return this.terminalWidth >= this.FULL_MODE_MIN_WIDTH
      ? this.renderFullMode(pairs, threshold)
      : this.renderSimplifiedMode(pairs, threshold)
  }

  /**
   * 完整模式：顯示所有欄位
   * 橫向佈局範例：
   * ┌──────────┬──────────┬──────────┐
   * │ Symbol   │ BTC      │ ETH      │
   * ├──────────┼──────────┼──────────┤
   * │ Binance  │ 0.0100%  │ 0.0050%  │
   * │ OKX      │ 0.0120%  │ 0.0045%  │
   * │ Spread   │ 0.0020%  │ -0.0005% │
   * │ Updated  │ 12:34:56 │ 12:34:56 │
   * └──────────┴──────────┴──────────┘
   */
  private renderFullMode(pairs: FundingRatePair[], threshold: number): string {
    const table = new Table({
      head: ['', ...pairs.map(p => this.formatSymbol(p, threshold))],
      style: {
        head: ['cyan'],
        border: ['gray']
      }
    })

    // Row 1: Binance 費率
    table.push({
      'Binance': pairs.map(p => this.formatRate(p.binance?.fundingRate))
    })

    // Row 2: OKX 費率
    table.push({
      'OKX': pairs.map(p => this.formatRate(p.okx?.fundingRate))
    })

    // Row 3: 費率差異（套利機會突顯）
    table.push({
      'Spread': pairs.map(p => this.formatSpreadValue(p, threshold))
    })

    // Row 4: 更新時間
    table.push({
      'Updated': pairs.map(p => this.formatTimestamp(p))
    })

    return table.toString()
  }

  /**
   * 簡化模式：僅顯示交易對和費率差異
   * 橫向佈局範例：
   * ┌──────────┬──────────┬──────────┐
   * │ Symbol   │ BTC      │ ETH      │
   * ├──────────┼──────────┼──────────┤
   * │ Spread   │ 0.0020%  │ -0.0005% │
   * └──────────┴──────────┴──────────┘
   */
  private renderSimplifiedMode(pairs: FundingRatePair[], threshold: number): string {
    const table = new Table({
      head: ['', ...pairs.map(p => this.formatSymbol(p, threshold))],
      style: {
        head: ['cyan'],
        border: ['gray']
      }
    })

    // 僅顯示費率差異
    table.push({
      'Spread': pairs.map(p => this.formatSpreadValue(p, threshold))
    })

    return table.toString()
  }

  /**
   * 格式化交易對名稱
   * 如果有套利機會，使用 ColorStyler 突顯
   */
  private formatSymbol(pair: FundingRatePair, threshold: number): string {
    const symbol = pair.symbol

    // 檢查是否為套利機會
    if (this.isOpportunity(pair, threshold)) {
      const intensity = this.getOpportunityIntensity(pair)
      return this.colorStyler.highlightOpportunity(symbol, intensity)
    }

    return symbol
  }

  /**
   * 格式化費率數值
   * 資料缺失時顯示佔位符
   */
  private formatRate(rate: number | null | undefined): string {
    if (rate === null || rate === undefined) {
      return this.colorStyler.dim(this.PLACEHOLDER)
    }

    // 轉換為百分比格式 (0.01 => 0.0100%)
    return `${(rate * 100).toFixed(4)}%`
  }

  /**
   * 格式化費率差異
   * 根據差異大小和閾值選擇顏色
   */
  private formatSpreadValue(pair: FundingRatePair, threshold: number): string {
    const binanceRate = pair.binance?.fundingRate
    const okxRate = pair.okx?.fundingRate

    // 資料不完整時顯示佔位符
    if (binanceRate === null || binanceRate === undefined ||
        okxRate === null || okxRate === undefined) {
      return this.colorStyler.dim(this.PLACEHOLDER)
    }

    const spread = binanceRate - okxRate
    const spreadPercent = Math.abs(spread) * 100
    const spreadText = `${(spread * 100).toFixed(4)}%`

    // 使用 ColorStyler 根據差異大小選擇顏色
    return this.colorStyler.formatSpread(spreadText, spreadPercent, threshold)
  }

  /**
   * 格式化時間戳記
   * 顯示 HH:MM:SS 格式
   */
  private formatTimestamp(pair: FundingRatePair): string {
    const timestamp = pair.binance?.recordedAt || pair.okx?.recordedAt

    if (!timestamp) {
      return this.colorStyler.dim(this.PLACEHOLDER)
    }

    const date = new Date(timestamp)
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const seconds = date.getSeconds().toString().padStart(2, '0')

    return this.colorStyler.dim(`${hours}:${minutes}:${seconds}`)
  }

  /**
   * 判斷是否為套利機會
   * @param threshold 閾值（百分比形式，例如 0.05 代表 0.05%）
   */
  private isOpportunity(pair: FundingRatePair, threshold: number): boolean {
    const binanceRate = pair.binance?.fundingRate
    const okxRate = pair.okx?.fundingRate

    if (binanceRate === null || binanceRate === undefined ||
        okxRate === null || okxRate === undefined) {
      return false
    }

    const spreadPercent = Math.abs(binanceRate - okxRate) * 100
    return spreadPercent >= threshold
  }

  /**
   * 取得套利機會的突顯強度
   * - high: 差異 > 0.1%
   * - low: 差異 0.05-0.1%
   */
  private getOpportunityIntensity(pair: FundingRatePair): 'low' | 'high' {
    const binanceRate = pair.binance?.fundingRate
    const okxRate = pair.okx?.fundingRate

    if (binanceRate === null || binanceRate === undefined ||
        okxRate === null || okxRate === undefined) {
      return 'low'
    }

    const spreadPercent = Math.abs(binanceRate - okxRate) * 100
    return spreadPercent > 0.1 ? 'high' : 'low'
  }
}
