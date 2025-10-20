import { describe, it, expect, beforeEach } from 'vitest'
import {
  TableOutputStrategy,
  PlainTextOutputStrategy,
  JSONOutputStrategy
} from '../../../src/lib/formatters/OutputStrategy.js'
import { FundingRateRecord } from '../../../src/models/FundingRate.js'
import type { FundingRatePair } from '../../../src/models/FundingRate.js'

describe('OutputStrategy', () => {
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

  describe('TableOutputStrategy', () => {
    it('should render table using TableRenderer', () => {
      const strategy = new TableOutputStrategy(100, false)
      const pairs = [createTestPair('BTCUSDT', 0.0001, 0.0002)]

      const result = strategy.render(pairs, 0.05)

      // 應該包含表格元素
      expect(result).toContain('BTCUSDT')
      expect(result).toContain('Binance')
      expect(result).toContain('OKX')
      expect(result).toContain('Spread')
    })

    it('should pass terminal width to TableRenderer', () => {
      const narrowStrategy = new TableOutputStrategy(70, false)
      const wideStrategy = new TableOutputStrategy(100, false)
      const pairs = [createTestPair('BTCUSDT', 0.0001, 0.0002)]

      const narrowResult = narrowStrategy.render(pairs, 0.05)
      const wideResult = wideStrategy.render(pairs, 0.05)

      // 寬終端應該顯示更多欄位
      expect(narrowResult).not.toContain('Binance')
      expect(narrowResult).not.toContain('OKX')
      expect(wideResult).toContain('Binance')
      expect(wideResult).toContain('OKX')
    })

    it('should support color styling', () => {
      const colorStrategy = new TableOutputStrategy(100, true)
      const pairs = [createTestPair('BTCUSDT', 0.0020, 0.0005)]

      const result = colorStrategy.render(pairs, 0.05)

      // 應該包含 ANSI 控制碼（顏色支援）
      expect(result).toMatch(/\x1b\[\d+m/)
    })
  })

  describe('PlainTextOutputStrategy', () => {
    let strategy: PlainTextOutputStrategy

    beforeEach(() => {
      strategy = new PlainTextOutputStrategy()
    })

    it('should render plain text format with all fields', () => {
      const pairs = [createTestPair('BTCUSDT', 0.0001, 0.0002)]
      const result = strategy.render(pairs, 0.05)

      expect(result).toContain('BTCUSDT')
      expect(result).toContain('Binance 0.0100%')
      expect(result).toContain('OKX 0.0200%')
      expect(result).toContain('Spread -0.0100%')
    })

    it('should render multiple pairs separated by newlines', () => {
      const pairs = [
        createTestPair('BTCUSDT', 0.0001, 0.0002),
        createTestPair('ETHUSDT', 0.0003, 0.0001)
      ]

      const result = strategy.render(pairs, 0.05)

      const lines = result.split('\n')
      expect(lines.length).toBe(2)
      expect(lines[0]).toContain('BTCUSDT')
      expect(lines[1]).toContain('ETHUSDT')
    })

    it('should mark opportunities with [OPPORTUNITY] tag', () => {
      // Spread = 0.0015 = 0.15%, threshold = 0.05%
      const pairs = [createTestPair('BTCUSDT', 0.0020, 0.0005)]
      const result = strategy.render(pairs, 0.05)

      expect(result).toContain('[OPPORTUNITY]')
    })

    it('should not mark non-opportunities', () => {
      // Spread = 0.0001 = 0.01%, threshold = 0.05%
      const pairs = [createTestPair('BTCUSDT', 0.0002, 0.0001)]
      const result = strategy.render(pairs, 0.05)

      expect(result).not.toContain('[OPPORTUNITY]')
    })

    it('should display --- for missing data', () => {
      const pairs = [createTestPair('BTCUSDT', 0.0001, 0.0002)]
      pairs[0].binance = undefined as any

      const result = strategy.render(pairs, 0.05)

      expect(result).toContain('Binance ---')
      expect(result).toContain('Spread ---')
    })

    it('should return "No data available" for empty pairs', () => {
      const result = strategy.render([], 0.05)
      expect(result).toBe('No data available')
    })

    it('should not contain ANSI control codes', () => {
      const pairs = [createTestPair('BTCUSDT', 0.0020, 0.0005)]
      const result = strategy.render(pairs, 0.05)

      // 不應包含任何 ANSI 碼
      expect(result).not.toMatch(/\x1b/)
    })
  })

  describe('JSONOutputStrategy', () => {
    let strategy: JSONOutputStrategy

    beforeEach(() => {
      strategy = new JSONOutputStrategy()
    })

    it('should render valid JSON', () => {
      const pairs = [createTestPair('BTCUSDT', 0.0001, 0.0002)]
      const result = strategy.render(pairs, 0.05)

      // 應該能被 JSON.parse 解析
      expect(() => JSON.parse(result)).not.toThrow()
    })

    it('should include all required fields', () => {
      const pairs = [createTestPair('BTCUSDT', 0.0001, 0.0002)]
      const result = strategy.render(pairs, 0.05)
      const parsed = JSON.parse(result)

      expect(parsed).toBeInstanceOf(Array)
      expect(parsed.length).toBe(1)

      const item = parsed[0]
      expect(item).toHaveProperty('symbol', 'BTCUSDT')
      expect(item).toHaveProperty('binance')
      expect(item.binance).toHaveProperty('fundingRate', 0.0001)
      expect(item.binance).toHaveProperty('fundingRatePercent', '0.0100%')
      expect(item).toHaveProperty('okx')
      expect(item.okx).toHaveProperty('fundingRate', 0.0002)
      expect(item.okx).toHaveProperty('fundingRatePercent', '0.0200%')
      expect(item).toHaveProperty('spread')
      expect(item.spread).toHaveProperty('value', -0.0001)
      expect(item.spread).toHaveProperty('percent', '-0.0100%')
      expect(item).toHaveProperty('isOpportunity')
      expect(item).toHaveProperty('threshold', '0.0500%')
      expect(item).toHaveProperty('recordedAt')
    })

    it('should mark opportunities correctly', () => {
      // Spread = 0.15%, threshold = 0.05%
      const pairs = [createTestPair('BTCUSDT', 0.0020, 0.0005)]
      const result = strategy.render(pairs, 0.05)
      const parsed = JSON.parse(result)

      expect(parsed[0].isOpportunity).toBe(true)
    })

    it('should not mark non-opportunities', () => {
      // Spread = 0.01%, threshold = 0.05%
      const pairs = [createTestPair('BTCUSDT', 0.0002, 0.0001)]
      const result = strategy.render(pairs, 0.05)
      const parsed = JSON.parse(result)

      expect(parsed[0].isOpportunity).toBe(false)
    })

    it('should handle missing data with null values', () => {
      const pairs = [createTestPair('BTCUSDT', 0.0001, 0.0002)]
      pairs[0].binance = undefined as any

      const result = strategy.render(pairs, 0.05)
      const parsed = JSON.parse(result)

      expect(parsed[0].binance.fundingRate).toBeUndefined()
      expect(parsed[0].binance.fundingRatePercent).toBeNull()
      expect(parsed[0].spread.value).toBeNull()
      expect(parsed[0].spread.percent).toBeNull()
      expect(parsed[0].isOpportunity).toBe(false)
    })

    it('should format JSON with 2-space indentation', () => {
      const pairs = [createTestPair('BTCUSDT', 0.0001, 0.0002)]
      const result = strategy.render(pairs, 0.05)

      // 檢查是否有適當的縮排（pretty-printed）
      expect(result).toContain('\n')
      expect(result).toContain('  ') // 2 空格縮排
    })

    it('should handle multiple pairs', () => {
      const pairs = [
        createTestPair('BTCUSDT', 0.0001, 0.0002),
        createTestPair('ETHUSDT', 0.0003, 0.0001)
      ]

      const result = strategy.render(pairs, 0.05)
      const parsed = JSON.parse(result)

      expect(parsed).toBeInstanceOf(Array)
      expect(parsed.length).toBe(2)
      expect(parsed[0].symbol).toBe('BTCUSDT')
      expect(parsed[1].symbol).toBe('ETHUSDT')
    })

    it('should include ISO timestamp in recordedAt', () => {
      const pairs = [createTestPair('BTCUSDT', 0.0001, 0.0002)]
      const result = strategy.render(pairs, 0.05)
      const parsed = JSON.parse(result)

      // ISO 8601 格式檢查
      expect(parsed[0].recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)
    })
  })

  describe('Strategy interface compliance', () => {
    it('all strategies should implement render method', () => {
      const tableStrategy = new TableOutputStrategy(100, false)
      const plainStrategy = new PlainTextOutputStrategy()
      const jsonStrategy = new JSONOutputStrategy()

      expect(typeof tableStrategy.render).toBe('function')
      expect(typeof plainStrategy.render).toBe('function')
      expect(typeof jsonStrategy.render).toBe('function')
    })

    it('all strategies should accept same parameters', () => {
      const pairs = [createTestPair('BTCUSDT', 0.0001, 0.0002)]
      const threshold = 0.05

      const tableStrategy = new TableOutputStrategy(100, false)
      const plainStrategy = new PlainTextOutputStrategy()
      const jsonStrategy = new JSONOutputStrategy()

      // 所有策略都應該能正常調用
      expect(() => tableStrategy.render(pairs, threshold)).not.toThrow()
      expect(() => plainStrategy.render(pairs, threshold)).not.toThrow()
      expect(() => jsonStrategy.render(pairs, threshold)).not.toThrow()
    })
  })
})
