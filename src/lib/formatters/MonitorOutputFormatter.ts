import logUpdate from 'log-update'
import chalk from 'chalk'
import type { FundingRatePair } from '../../models/FundingRate.js'
import type { MonitorStats } from '../../services/monitor/MonitorStats.js'
import {
  type OutputStrategy,
  TableOutputStrategy,
  PlainTextOutputStrategy,
  JSONOutputStrategy
} from './OutputStrategy.js'

/**
 * OutputMode - 輸出模式類型
 */
export type OutputMode = 'table' | 'simplified' | 'plain' | 'json'

/**
 * MonitorOutputFormatter - 監控輸出格式化主類別
 *
 * 負責：
 * - 檢測終端環境（TTY、寬度、顏色支援）
 * - 根據環境選擇適當的輸出策略
 * - 提供統一的渲染介面
 * - 使用 log-update 實現固定位置刷新（TTY 環境）
 */
export class MonitorOutputFormatter {
  private readonly isTTY: boolean
  private readonly terminalWidth: number
  private readonly supportsColor: boolean
  private readonly strategy: OutputStrategy
  private readonly outputMode: OutputMode

  /**
   * 建構子 - 自動檢測終端環境
   * @param manualFormat 手動指定輸出格式（覆寫自動檢測）
   */
  constructor(manualFormat?: OutputMode) {
    // 檢測終端環境
    this.isTTY = process.stdout.isTTY ?? false
    this.terminalWidth = process.stdout.columns ?? 80
    this.supportsColor = chalk.level > 0

    // 決定輸出模式
    this.outputMode = manualFormat ?? this.detectOutputMode()

    // 根據輸出模式選擇策略
    this.strategy = this.createStrategy(this.outputMode)
  }

  /**
   * 自動檢測輸出模式
   * @returns 適合當前環境的輸出模式
   */
  private detectOutputMode(): OutputMode {
    // 檢查環境變數 OUTPUT_FORMAT（允許手動覆寫）
    const envFormat = process.env.OUTPUT_FORMAT?.toLowerCase()
    if (envFormat === 'table' || envFormat === 'plain' || envFormat === 'json') {
      return envFormat as OutputMode
    }

    // 非 TTY 環境預設使用 plain-text
    if (!this.isTTY) {
      return 'plain'
    }

    // TTY 環境根據終端寬度決定
    if (this.terminalWidth >= 80) {
      return 'table'
    } else {
      return 'simplified'
    }
  }

  /**
   * 根據輸出模式建立對應的策略
   */
  private createStrategy(mode: OutputMode): OutputStrategy {
    switch (mode) {
      case 'table':
        return new TableOutputStrategy(this.terminalWidth, this.supportsColor)
      case 'simplified':
        return new TableOutputStrategy(this.terminalWidth, this.supportsColor)
      case 'plain':
        return new PlainTextOutputStrategy()
      case 'json':
        return new JSONOutputStrategy()
    }
  }

  /**
   * 取得當前輸出模式
   */
  getOutputMode(): OutputMode {
    return this.outputMode
  }

  /**
   * 渲染狀態摘要標題
   * @param stats 監控統計資訊
   * @returns 格式化後的狀態摘要字串
   */
  renderStatusHeader(stats: MonitorStats): string {
    // JSON 模式直接返回空字串（不需要狀態標題）
    if (this.outputMode === 'json') {
      return ''
    }

    const currentTime = new Date().toLocaleTimeString('en-US', { hour12: false })
    const uptime = this.formatUptime(stats.startTime)

    // Plain text 模式不使用顏色
    const isPlain = this.outputMode === 'plain'
    const useColor = !isPlain && this.supportsColor

    const errorDisplay = stats.errorCount > 0
      ? (useColor ? chalk.yellow(`⚠️  ${stats.errorCount}`) : `WARNING: ${stats.errorCount}`)
      : (useColor ? chalk.green('0') : '0')

    const opportunitiesDisplay = stats.activeOpportunities > 0
      ? (useColor ? chalk.bold.green(`🎯 ${stats.activeOpportunities}`) : `>>> ${stats.activeOpportunities}`)
      : (useColor ? chalk.dim('0') : '0')

    // Plain text 模式使用簡單格式（無顏色）
    if (isPlain) {
      return [
        `[${currentTime}] Uptime: ${uptime} | Updates: ${stats.totalUpdates} | Errors: ${errorDisplay} | Opportunities: ${opportunitiesDisplay}`,
        '─'.repeat(Math.min(this.terminalWidth, 80))
      ].join('\n')
    }

    // Table/Simplified 模式使用更豐富的格式
    const separator = '─'.repeat(Math.min(this.terminalWidth, 100))

    const statusLine = this.supportsColor
      ? [
          chalk.dim('['),
          chalk.cyan(currentTime),
          chalk.dim(']'),
          ' ',
          chalk.dim('Uptime:'),
          ' ',
          chalk.white(uptime),
          chalk.dim(' | '),
          chalk.dim('Updates:'),
          ' ',
          chalk.white(stats.totalUpdates),
          chalk.dim(' | '),
          chalk.dim('Errors:'),
          ' ',
          errorDisplay,
          chalk.dim(' | '),
          chalk.dim('Opportunities:'),
          ' ',
          opportunitiesDisplay
        ].join('')
      : `[${currentTime}] Uptime: ${uptime} | Updates: ${stats.totalUpdates} | Errors: ${errorDisplay} | Opportunities: ${opportunitiesDisplay}`

    return [statusLine, separator, ''].join('\n')
  }

  /**
   * 格式化運行時長
   * @param startTime 開始時間
   * @returns 格式化後的時長字串（例如: "1h 23m 45s"）
   */
  private formatUptime(startTime: Date): string {
    const now = new Date()
    const uptimeSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000)

    const hours = Math.floor(uptimeSeconds / 3600)
    const minutes = Math.floor((uptimeSeconds % 3600) / 60)
    const seconds = uptimeSeconds % 60

    const parts: string[] = []
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0) parts.push(`${minutes}m`)
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`)

    return parts.join(' ')
  }

  /**
   * 渲染套利機會報告
   * @param pair 資金費率配對資料
   * @param threshold 套利閾值（百分比形式，例如 0.05 = 0.05%）
   * @returns 格式化後的機會報告字串
   */
  renderOpportunityReport(pair: FundingRatePair, threshold: number): string {
    const binanceRate = pair.binance?.fundingRate ?? 0
    const okxRate = pair.okx?.fundingRate ?? 0
    const spread = binanceRate - okxRate
    const spreadPercent = Math.abs(spread) * 100
    const spreadAnnualized = Math.abs(spread) * 365 * 3 * 100 // 假設 8 小時結算 (365 * 3)

    // 判斷操作方向
    const action = spread > 0
      ? '在 Binance 做空 + 在 OKX 做多'
      : '在 Binance 做多 + 在 OKX 做空'

    // 風險提示（當費率差異超過閾值 3 倍時）
    const isHighRisk = spreadPercent > threshold * 3
    const riskWarning = isHighRisk
      ? '\n⚠️  警告: 費率差異異常大，請謹慎評估風險！'
      : ''

    const useColor = this.supportsColor

    // 使用分隔線
    const separator = '='.repeat(60)

    // 構建報告
    const lines = [
      '',
      separator,
      useColor ? chalk.bold.green('🎯 發現套利機會！') : '>>> 發現套利機會！',
      separator,
      '',
      `交易對: ${useColor ? chalk.cyan(pair.symbol) : pair.symbol}`,
      '',
      `Binance 費率: ${useColor ? chalk.yellow(this.formatPercent(binanceRate)) : this.formatPercent(binanceRate)}`,
      `OKX 費率:     ${useColor ? chalk.yellow(this.formatPercent(okxRate)) : this.formatPercent(okxRate)}`,
      `費率差異:     ${useColor ? chalk.bold.green(spreadPercent.toFixed(4) + '%') : spreadPercent.toFixed(4) + '%'}`,
      '',
      `建議操作: ${useColor ? chalk.white(action) : action}`,
      `預估年化收益: ${useColor ? chalk.bold.cyan(spreadAnnualized.toFixed(2) + '%') : spreadAnnualized.toFixed(2) + '%'}`,
      ''
    ]

    if (riskWarning) {
      lines.push(useColor ? chalk.bold.yellow(riskWarning) : riskWarning)
      lines.push('')
    }

    lines.push(separator)
    lines.push('')

    return lines.join('\n')
  }

  /**
   * 格式化百分比顯示
   */
  private formatPercent(value: number): string {
    return (value * 100).toFixed(4) + '%'
  }

  /**
   * 渲染表格
   * @param pairs 資金費率配對資料
   * @param threshold 套利閾值（百分比形式，例如 0.05 = 0.05%）
   * @returns 格式化後的字串
   */
  renderTable(pairs: FundingRatePair[], threshold: number): string {
    return this.strategy.render(pairs, threshold)
  }

  /**
   * 刷新終端輸出
   * @param content 要顯示的內容
   *
   * 在 TTY 環境使用 log-update 實現原地刷新
   * 在非 TTY 環境使用 stdout.write 輸出
   */
  refresh(content: string): void {
    if (this.isTTY) {
      // TTY 環境：使用 log-update 原地刷新
      logUpdate(content)
    } else {
      // 非 TTY 環境：直接輸出並換行
      process.stdout.write(content + '\n')
    }
  }

  /**
   * 清除 log-update 的內容（用於程式結束時）
   */
  done(): void {
    if (this.isTTY) {
      logUpdate.done()
    }
  }

  /**
   * 取得終端資訊（用於除錯）
   */
  getTerminalInfo(): {
    isTTY: boolean
    width: number
    supportsColor: boolean
    outputMode: OutputMode
  } {
    return {
      isTTY: this.isTTY,
      width: this.terminalWidth,
      supportsColor: this.supportsColor,
      outputMode: this.outputMode
    }
  }
}
