import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MonitorOutputFormatter } from '../../../src/lib/formatters/MonitorOutputFormatter.js'
import { FundingRateRecord } from '../../../src/models/FundingRate.js'
import type { FundingRatePair } from '../../../src/models/FundingRate.js'
import type { MonitorStats } from '../../../src/services/monitor/MonitorStats.js'

describe('MonitorOutputFormatter', () => {
  // 儲存原始的 process.stdout 屬性
  const originalIsTTY = process.stdout.isTTY
  const originalColumns = process.stdout.columns

  afterEach(() => {
    // 恢復原始屬性
    process.stdout.isTTY = originalIsTTY
    process.stdout.columns = originalColumns
    // 清除環境變數
    delete process.env.OUTPUT_FORMAT
  })

  // 輔助函數：建立測試用的 FundingRatePair
  function createTestPair(
    symbol: string,
    binanceRate: number,
    okxRate: number
  ): FundingRatePair {
    const now = new Date()

    const binance = new FundingRateRecord({
      exchange: 'binance',
      symbol,
      fundingRate: binanceRate,
      nextFundingTime: new Date(Date.now() + 3600000),
      recordedAt: now
    })

    const okx = new FundingRateRecord({
      exchange: 'okx',
      symbol,
      fundingRate: okxRate,
      nextFundingTime: new Date(Date.now() + 3600000),
      recordedAt: now
    })

    const spread = Math.abs(binanceRate - okxRate)
    const spreadAnnualized = spread * 365 * 3

    return {
      symbol,
      binance,
      okx,
      spreadPercent: spread * 100,
      spreadAnnualized: spreadAnnualized * 100,
      recordedAt: now
    }
  }

  describe('environment detection', () => {
    it('should detect TTY environment correctly', () => {
      process.stdout.isTTY = true
      process.stdout.columns = 100

      const formatter = new MonitorOutputFormatter()
      const info = formatter.getTerminalInfo()

      expect(info.isTTY).toBe(true)
      expect(info.width).toBe(100)
    })

    it('should detect non-TTY environment correctly', () => {
      process.stdout.isTTY = false

      const formatter = new MonitorOutputFormatter()
      const info = formatter.getTerminalInfo()

      expect(info.isTTY).toBe(false)
    })

    it('should use default width 80 when columns is undefined', () => {
      process.stdout.isTTY = true
      process.stdout.columns = undefined

      const formatter = new MonitorOutputFormatter()
      const info = formatter.getTerminalInfo()

      expect(info.width).toBe(80)
    })

    it('should detect color support', () => {
      const formatter = new MonitorOutputFormatter()
      const info = formatter.getTerminalInfo()

      // chalk.level > 0 表示支援顏色
      expect(typeof info.supportsColor).toBe('boolean')
    })
  })

  describe('output mode detection', () => {
    it('should use table mode for TTY with width >= 80', () => {
      process.stdout.isTTY = true
      process.stdout.columns = 100

      const formatter = new MonitorOutputFormatter()

      expect(formatter.getOutputMode()).toBe('table')
    })

    it('should use simplified mode for TTY with width < 80', () => {
      process.stdout.isTTY = true
      process.stdout.columns = 70

      const formatter = new MonitorOutputFormatter()

      expect(formatter.getOutputMode()).toBe('simplified')
    })

    it('should use plain mode for non-TTY environment', () => {
      process.stdout.isTTY = false

      const formatter = new MonitorOutputFormatter()

      expect(formatter.getOutputMode()).toBe('plain')
    })

    it('should respect OUTPUT_FORMAT environment variable', () => {
      process.stdout.isTTY = true
      process.stdout.columns = 100
      process.env.OUTPUT_FORMAT = 'json'

      const formatter = new MonitorOutputFormatter()

      expect(formatter.getOutputMode()).toBe('json')
    })

    it('should respect manual format parameter over auto-detection', () => {
      process.stdout.isTTY = true
      process.stdout.columns = 100

      const formatter = new MonitorOutputFormatter('plain')

      expect(formatter.getOutputMode()).toBe('plain')
    })

    it('should handle case-insensitive OUTPUT_FORMAT', () => {
      process.env.OUTPUT_FORMAT = 'TABLE'

      const formatter = new MonitorOutputFormatter()

      expect(formatter.getOutputMode()).toBe('table')
    })

    it('should ignore invalid OUTPUT_FORMAT values', () => {
      process.stdout.isTTY = true
      process.stdout.columns = 100
      process.env.OUTPUT_FORMAT = 'invalid'

      const formatter = new MonitorOutputFormatter()

      // 應該回退到自動檢測（table mode）
      expect(formatter.getOutputMode()).toBe('table')
    })
  })

  describe('renderTable', () => {
    it('should render table in table mode', () => {
      process.stdout.isTTY = true
      process.stdout.columns = 100

      const formatter = new MonitorOutputFormatter()
      const pairs = [createTestPair('BTCUSDT', 0.0001, 0.0002)]

      const result = formatter.renderTable(pairs, 0.05)

      // Table mode 應該包含表格元素
      expect(result).toContain('BTCUSDT')
      expect(result).toContain('Binance')
      expect(result).toContain('OKX')
    })

    it('should render simplified table in simplified mode', () => {
      process.stdout.isTTY = true
      process.stdout.columns = 70

      const formatter = new MonitorOutputFormatter()
      const pairs = [createTestPair('BTCUSDT', 0.0001, 0.0002)]

      const result = formatter.renderTable(pairs, 0.05)

      // Simplified mode 不應包含個別交易所欄位
      expect(result).toContain('BTCUSDT')
      expect(result).not.toContain('Binance')
      expect(result).not.toContain('OKX')
    })

    it('should render plain text in plain mode', () => {
      const formatter = new MonitorOutputFormatter('plain')
      const pairs = [createTestPair('BTCUSDT', 0.0001, 0.0002)]

      const result = formatter.renderTable(pairs, 0.05)

      // Plain mode 應該是純文字格式
      expect(result).toContain('BTCUSDT')
      expect(result).toContain('Binance 0.0100%')
      expect(result).toContain('OKX 0.0200%')
      expect(result).not.toMatch(/[┌┐└┘├┤│─]/) // 不應包含表格邊框字元
    })

    it('should render JSON in json mode', () => {
      const formatter = new MonitorOutputFormatter('json')
      const pairs = [createTestPair('BTCUSDT', 0.0001, 0.0002)]

      const result = formatter.renderTable(pairs, 0.05)

      // JSON mode 應該能被解析
      expect(() => JSON.parse(result)).not.toThrow()

      const parsed = JSON.parse(result)
      expect(parsed).toBeInstanceOf(Array)
      expect(parsed[0].symbol).toBe('BTCUSDT')
    })

    it('should pass threshold to strategy', () => {
      const formatter = new MonitorOutputFormatter('plain')
      const pairs = [createTestPair('BTCUSDT', 0.0020, 0.0005)]

      // Spread = 0.15%, threshold = 0.05%
      const result = formatter.renderTable(pairs, 0.05)

      // 應該標記為機會
      expect(result).toContain('[OPPORTUNITY]')
    })

    it('should handle empty pairs array', () => {
      const formatter = new MonitorOutputFormatter('plain')

      const result = formatter.renderTable([], 0.05)

      expect(result).toContain('No data available')
    })
  })

  describe('refresh', () => {
    it('should use log-update in TTY environment', () => {
      process.stdout.isTTY = true
      process.stdout.columns = 100

      const formatter = new MonitorOutputFormatter()

      // 在 TTY 環境應該使用 log-update
      // 我們只驗證方法能正常執行而不拋出錯誤
      expect(() => formatter.refresh('test content')).not.toThrow()
    })

    it('should use stdout.write in non-TTY environment', () => {
      process.stdout.isTTY = false

      const formatter = new MonitorOutputFormatter()

      // Mock stdout.write
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

      formatter.refresh('test content')

      // 應該調用 stdout.write 並加上換行
      expect(writeSpy).toHaveBeenCalledWith('test content\n')

      writeSpy.mockRestore()
    })
  })

  describe('done', () => {
    it('should clear log-update in TTY environment', () => {
      process.stdout.isTTY = true
      process.stdout.columns = 100

      const formatter = new MonitorOutputFormatter()

      // 驗證 done 方法能正常執行
      expect(() => formatter.done()).not.toThrow()
    })

    it('should do nothing in non-TTY environment', () => {
      process.stdout.isTTY = false

      const formatter = new MonitorOutputFormatter()

      // 驗證 done 方法能正常執行
      expect(() => formatter.done()).not.toThrow()
    })
  })

  describe('getTerminalInfo', () => {
    it('should return complete terminal information', () => {
      process.stdout.isTTY = true
      process.stdout.columns = 100

      const formatter = new MonitorOutputFormatter()
      const info = formatter.getTerminalInfo()

      expect(info).toHaveProperty('isTTY')
      expect(info).toHaveProperty('width')
      expect(info).toHaveProperty('supportsColor')
      expect(info).toHaveProperty('outputMode')

      expect(typeof info.isTTY).toBe('boolean')
      expect(typeof info.width).toBe('number')
      expect(typeof info.supportsColor).toBe('boolean')
      expect(['table', 'simplified', 'plain', 'json']).toContain(info.outputMode)
    })
  })

  describe('edge cases', () => {
    it('should handle boundary width value (80)', () => {
      process.stdout.isTTY = true
      process.stdout.columns = 80

      const formatter = new MonitorOutputFormatter()

      // 正好 80 應該使用 table mode
      expect(formatter.getOutputMode()).toBe('table')
    })

    it('should handle boundary width value (79)', () => {
      process.stdout.isTTY = true
      process.stdout.columns = 79

      const formatter = new MonitorOutputFormatter()

      // 79 應該使用 simplified mode
      expect(formatter.getOutputMode()).toBe('simplified')
    })

    it('should handle very narrow terminal (< 40)', () => {
      process.stdout.isTTY = true
      process.stdout.columns = 30

      const formatter = new MonitorOutputFormatter()
      const pairs = [createTestPair('BTC', 0.0001, 0.0002)]

      // 應該仍能正常渲染（簡化模式）
      expect(() => formatter.renderTable(pairs, 0.05)).not.toThrow()
    })

    it('should handle very wide terminal (> 200)', () => {
      process.stdout.isTTY = true
      process.stdout.columns = 250

      const formatter = new MonitorOutputFormatter()
      const pairs = [createTestPair('BTCUSDT', 0.0001, 0.0002)]

      // 應該仍能正常渲染（完整模式）
      const result = formatter.renderTable(pairs, 0.05)
      expect(result).toContain('BTCUSDT')
    })
  })

  describe('renderStatusHeader', () => {
    // 輔助函數：建立測試用的 MonitorStats
    function createTestStats(
      uptimeSeconds: number = 0,
      totalUpdates: number = 0,
      errorCount: number = 0,
      activeOpportunities: number = 0
    ): MonitorStats {
      const startTime = new Date(Date.now() - uptimeSeconds * 1000)
      return {
        startTime,
        totalUpdates,
        errorCount,
        activeOpportunities,
        lastUpdateTime: new Date()
      }
    }

    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-01-15T10:30:45.000Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should render status header in table mode', () => {
      process.stdout.isTTY = true
      process.stdout.columns = 100

      const formatter = new MonitorOutputFormatter()
      const stats = createTestStats(125, 10, 0, 0) // 2m 5s uptime

      const result = formatter.renderStatusHeader(stats)

      // 檢查時間格式（HH:MM:SS）而不是具體時間值（因為時區問題）
      expect(result).toMatch(/\d{1,2}:\d{2}:\d{2}/) // 時間格式
      expect(result).toContain('2m 5s') // 運行時長
      expect(result).toContain('10') // 總更新次數
      expect(result).toContain('0') // 錯誤計數
      expect(result).toContain('─') // 分隔線
    })

    it('should render status header in plain mode', () => {
      const formatter = new MonitorOutputFormatter('plain')
      const stats = createTestStats(65, 5, 1, 2) // 1m 5s uptime, 1 error, 2 opportunities

      const result = formatter.renderStatusHeader(stats)

      // 檢查時間格式而不是具體值
      expect(result).toMatch(/\d{1,2}:\d{2}:\d{2}/)
      expect(result).toContain('1m 5s')
      expect(result).toContain('5') // totalUpdates
      expect(result).toContain('WARNING: 1') // 錯誤計數
      expect(result).toContain('>>> 2') // 機會數量
      expect(result).toContain('─') // 分隔線
    })

    it('should return empty string in json mode', () => {
      const formatter = new MonitorOutputFormatter('json')
      const stats = createTestStats(100, 20, 3, 1)

      const result = formatter.renderStatusHeader(stats)

      expect(result).toBe('')
    })

    it('should format uptime with hours', () => {
      process.stdout.isTTY = true
      process.stdout.columns = 100

      const formatter = new MonitorOutputFormatter()
      const stats = createTestStats(3665, 50, 0, 0) // 1h 1m 5s

      const result = formatter.renderStatusHeader(stats)

      expect(result).toContain('1h 1m 5s')
    })

    it('should format uptime with only seconds', () => {
      process.stdout.isTTY = true
      process.stdout.columns = 100

      const formatter = new MonitorOutputFormatter()
      const stats = createTestStats(45, 2, 0, 0) // 45s

      const result = formatter.renderStatusHeader(stats)

      expect(result).toContain('45s')
    })

    it('should format uptime as 0s for just started monitor', () => {
      process.stdout.isTTY = true
      process.stdout.columns = 100

      const formatter = new MonitorOutputFormatter()
      const stats = createTestStats(0, 0, 0, 0) // 0s

      const result = formatter.renderStatusHeader(stats)

      expect(result).toContain('0s')
    })

    it('should highlight errors with warning symbol', () => {
      process.stdout.isTTY = true
      process.stdout.columns = 100

      const formatter = new MonitorOutputFormatter()
      const stats = createTestStats(100, 20, 5, 0) // 5 errors

      const result = formatter.renderStatusHeader(stats)

      // 應該包含錯誤標示（⚠️ 或 WARNING）
      expect(result).toMatch(/⚠️|WARNING/)
      expect(result).toContain('5')
    })

    it('should highlight active opportunities', () => {
      process.stdout.isTTY = true
      process.stdout.columns = 100

      const formatter = new MonitorOutputFormatter()
      const stats = createTestStats(100, 20, 0, 3) // 3 opportunities

      const result = formatter.renderStatusHeader(stats)

      // 應該包含機會標示（🎯 或 >>>）
      expect(result).toMatch(/🎯|>>>/)
      expect(result).toContain('3')
    })

    it('should show 0 opportunities when none exist', () => {
      process.stdout.isTTY = true
      process.stdout.columns = 100

      const formatter = new MonitorOutputFormatter()
      const stats = createTestStats(100, 20, 0, 0)

      const result = formatter.renderStatusHeader(stats)

      // 應該只包含普通的 0
      expect(result).toContain('0')
    })

    it('should format long running uptime', () => {
      process.stdout.isTTY = true
      process.stdout.columns = 100

      const formatter = new MonitorOutputFormatter()
      const stats = createTestStats(7385, 1000, 10, 5) // 2h 3m 5s

      const result = formatter.renderStatusHeader(stats)

      expect(result).toContain('2h 3m 5s')
      expect(result).toContain('1000')
      expect(result).toContain('10')
      expect(result).toContain('5')
    })

    it('should handle exactly 1 hour uptime', () => {
      process.stdout.isTTY = true
      process.stdout.columns = 100

      const formatter = new MonitorOutputFormatter()
      const stats = createTestStats(3600, 100, 0, 0) // 1h

      const result = formatter.renderStatusHeader(stats)

      expect(result).toContain('1h')
      expect(result).not.toContain('0m')
      expect(result).not.toContain('0s')
    })

    it('should handle simplified mode with narrow terminal', () => {
      process.stdout.isTTY = true
      process.stdout.columns = 70

      const formatter = new MonitorOutputFormatter()
      const stats = createTestStats(100, 20, 0, 1)

      const result = formatter.renderStatusHeader(stats)

      // 簡化模式也應該顯示狀態標題
      expect(result).toContain('1m 40s')
      expect(result).toContain('20')
    })

    it('should not contain ANSI codes in plain mode', () => {
      const formatter = new MonitorOutputFormatter('plain')
      const stats = createTestStats(100, 20, 3, 2)

      const result = formatter.renderStatusHeader(stats)

      // 不應包含 ANSI 控制碼
      expect(result).not.toMatch(/\x1b\[/)
    })
  })
})
