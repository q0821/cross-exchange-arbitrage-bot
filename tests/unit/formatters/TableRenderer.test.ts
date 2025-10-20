import { describe, it, expect, beforeEach } from 'vitest'
import { TableRenderer } from '../../../src/lib/formatters/TableRenderer.js'
import { ColorStyler } from '../../../src/lib/formatters/ColorStyler.js'
import { FundingRateRecord } from '../../../src/models/FundingRate.js'
import type { FundingRatePair } from '../../../src/models/FundingRate.js'

describe('TableRenderer', () => {
  let colorStyler: ColorStyler

  beforeEach(() => {
    colorStyler = new ColorStyler(false) // 使用無顏色模式便於測試
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

  describe('render with empty data', () => {
    it('should display "No data available" when pairs array is empty', () => {
      const renderer = new TableRenderer(100, colorStyler)
      const result = renderer.render([], 0.05)

      expect(result).toBe('No data available')
    })
  })

  describe('full mode (width >= 80)', () => {
    let renderer: TableRenderer

    beforeEach(() => {
      renderer = new TableRenderer(100, colorStyler)
    })

    it('should render table with all columns in full mode', () => {
      const pairs = [
        createTestPair('BTCUSDT', 0.0001, 0.0002),
        createTestPair('ETHUSDT', 0.0003, 0.0001)
      ]

      const result = renderer.render(pairs, 0.05)

      // 檢查表格包含關鍵元素
      expect(result).toContain('BTCUSDT')
      expect(result).toContain('ETHUSDT')
      expect(result).toContain('Binance')
      expect(result).toContain('OKX')
      expect(result).toContain('Spread')
      expect(result).toContain('Updated')
    })

    it('should format rates as percentages with 4 decimal places', () => {
      const pairs = [createTestPair('BTCUSDT', 0.0001, 0.0002)]
      const result = renderer.render(pairs, 0.05)

      // 檢查百分比格式
      expect(result).toContain('0.0100%') // Binance: 0.0001 * 100 = 0.01%
      expect(result).toContain('0.0200%') // OKX: 0.0002 * 100 = 0.02%
    })

    it('should calculate and display spread correctly', () => {
      const pairs = [createTestPair('BTCUSDT', 0.0010, 0.0005)]
      const result = renderer.render(pairs, 0.05)

      // Spread = 0.0010 - 0.0005 = 0.0005 = 0.0500%
      expect(result).toContain('0.0500%')
    })

    it('should display negative spread when OKX rate is higher', () => {
      const pairs = [createTestPair('BTCUSDT', 0.0005, 0.0010)]
      const result = renderer.render(pairs, 0.05)

      // Spread = 0.0005 - 0.0010 = -0.0005 = -0.0500%
      expect(result).toContain('-0.0500%')
    })

    it('should display timestamp in HH:MM:SS format', () => {
      const pairs = [createTestPair('BTCUSDT', 0.0001, 0.0002)]
      const result = renderer.render(pairs, 0.05)

      // 時間戳記應該是 HH:MM:SS 格式（例如 14:23:56）
      expect(result).toMatch(/\d{2}:\d{2}:\d{2}/)
    })

    it('should handle multiple pairs in horizontal layout', () => {
      const pairs = [
        createTestPair('BTCUSDT', 0.0001, 0.0002),
        createTestPair('ETHUSDT', 0.0003, 0.0001),
        createTestPair('SOLUSDT', 0.0002, 0.0002)
      ]

      const result = renderer.render(pairs, 0.05)

      // 所有交易對都應該出現
      expect(result).toContain('BTCUSDT')
      expect(result).toContain('ETHUSDT')
      expect(result).toContain('SOLUSDT')

      // 橫向佈局：交易對名稱在表頭
      const lines = result.split('\n')
      const headerLine = lines[1] // 第二行通常是表頭內容
      expect(headerLine).toContain('BTCUSDT')
      expect(headerLine).toContain('ETHUSDT')
      expect(headerLine).toContain('SOLUSDT')
    })
  })

  describe('simplified mode (width < 80)', () => {
    let renderer: TableRenderer

    beforeEach(() => {
      renderer = new TableRenderer(70, colorStyler)
    })

    it('should render simplified table with only spread column', () => {
      const pairs = [createTestPair('BTCUSDT', 0.0001, 0.0002)]
      const result = renderer.render(pairs, 0.05)

      // 簡化模式應該包含交易對和費率差異
      expect(result).toContain('BTCUSDT')
      expect(result).toContain('Spread')

      // 不應包含個別費率列
      expect(result).not.toContain('Binance')
      expect(result).not.toContain('OKX')
      expect(result).not.toContain('Updated')
    })

    it('should still display spread values correctly in simplified mode', () => {
      const pairs = [createTestPair('BTCUSDT', 0.0015, 0.0010)]
      const result = renderer.render(pairs, 0.05)

      // Spread = 0.0015 - 0.0010 = 0.0005 = 0.0500%
      expect(result).toContain('0.0500%')
    })
  })

  describe('opportunity highlighting', () => {
    let renderer: TableRenderer
    let colorStylerWithColor: ColorStyler

    beforeEach(() => {
      colorStylerWithColor = new ColorStyler(true)
      renderer = new TableRenderer(100, colorStylerWithColor)
    })

    it('should highlight symbol when spread exceeds threshold', () => {
      // 閾值 0.05%，費率差異 0.06% 應該被突顯
      const pairs = [createTestPair('BTCUSDT', 0.0010, 0.0004)]
      const result = renderer.render(pairs, 0.05)

      // 有顏色支援時應該包含 ANSI 控制碼
      expect(result).toMatch(/\x1b\[\d+m/)
    })

    it('should not highlight symbol when spread is below threshold', () => {
      const colorStylerNoColor = new ColorStyler(false)
      const rendererNoColor = new TableRenderer(100, colorStylerNoColor)

      // 閾值 0.05%，費率差異 0.01% 不應該被突顯
      const pairs = [createTestPair('BTCUSDT', 0.0002, 0.0001)]
      const result = rendererNoColor.render(pairs, 0.05)

      // 無顏色支援時，未達閾值不應有特殊標記
      expect(result).not.toContain('>>>')
      expect(result).not.toContain('*')
    })

    it('should use high intensity for spread > 0.1%', () => {
      const colorStylerNoColor = new ColorStyler(false)
      const rendererNoColor = new TableRenderer(100, colorStylerNoColor)

      // 費率差異 0.15% > 0.1%，應使用 high intensity (>>>)
      const pairs = [createTestPair('BTCUSDT', 0.0020, 0.0005)]
      const result = rendererNoColor.render(pairs, 0.05)

      // 無顏色模式下，high intensity 在交易對名稱前加上 ">>>"
      // 表格中會顯示為 ">>> BTCUSDT"（可能有額外空格）
      expect(result).toMatch(/>>>\s*BTCUSDT/)
    })

    it('should use low intensity for spread 0.05-0.1%', () => {
      const colorStylerNoColor = new ColorStyler(false)
      const rendererNoColor = new TableRenderer(100, colorStylerNoColor)

      // 費率差異 0.08% 在 0.05-0.1% 範圍，應使用 low intensity (*)
      const pairs = [createTestPair('ETHUSDT', 0.0010, 0.0002)]
      const result = rendererNoColor.render(pairs, 0.05)

      // 無顏色模式下，low intensity 在交易對名稱前加上 "*"
      expect(result).toMatch(/\*\s*ETHUSDT/)
    })
  })

  describe('data integrity with missing values', () => {
    let renderer: TableRenderer

    beforeEach(() => {
      renderer = new TableRenderer(100, colorStyler)
    })

    it('should display placeholder when binance rate is missing', () => {
      const pairs = [createTestPair('BTCUSDT', 0.0001, 0.0002)]
      // 手動設定為 undefined 模擬資料缺失
      pairs[0].binance = undefined as any

      const result = renderer.render(pairs, 0.05)

      // 應該顯示佔位符 "---"
      expect(result).toContain('---')
    })

    it('should display placeholder when okx rate is missing', () => {
      const pairs = [createTestPair('BTCUSDT', 0.0001, 0.0002)]
      pairs[0].okx = undefined as any

      const result = renderer.render(pairs, 0.05)

      expect(result).toContain('---')
    })

    it('should display placeholder for spread when either rate is missing', () => {
      const pairs = [createTestPair('BTCUSDT', 0.0001, 0.0002)]
      pairs[0].binance = undefined as any

      const result = renderer.render(pairs, 0.05)

      // Spread 也應該是 placeholder，因為無法計算
      const lines = result.split('\n')
      const spreadLine = lines.find(line => line.includes('Spread'))
      expect(spreadLine).toBeDefined()
      expect(spreadLine).toContain('---')
    })

    it('should display placeholder for timestamp when both timestamps are missing', () => {
      const pairs = [createTestPair('BTCUSDT', 0.0001, 0.0002)]
      pairs[0].binance = undefined as any
      pairs[0].okx = undefined as any

      const result = renderer.render(pairs, 0.05)

      const lines = result.split('\n')
      const updatedLine = lines.find(line => line.includes('Updated'))
      expect(updatedLine).toBeDefined()
      expect(updatedLine).toContain('---')
    })
  })

  describe('edge cases', () => {
    let renderer: TableRenderer

    beforeEach(() => {
      renderer = new TableRenderer(100, colorStyler)
    })

    it('should handle very small spread differences', () => {
      // 極小的費率差異 (0.0001%)
      const pairs = [createTestPair('BTCUSDT', 0.000001, 0.000002)]
      const result = renderer.render(pairs, 0.05)

      // 應該正確顯示 4 位小數
      expect(result).toContain('0.0001%')
      expect(result).toContain('0.0002%')
    })

    it('should handle exactly at threshold boundary', () => {
      const colorStylerNoColor = new ColorStyler(false)
      const rendererNoColor = new TableRenderer(100, colorStylerNoColor)

      // 費率差異正好等於閾值 0.05%
      const pairs = [createTestPair('BTCUSDT', 0.0010, 0.0005)]
      const result = rendererNoColor.render(pairs, 0.05)

      // 正好在閾值應該被突顯
      expect(result).toMatch(/\*\s*BTCUSDT/)
    })

    it('should handle zero spread', () => {
      const pairs = [createTestPair('BTCUSDT', 0.0005, 0.0005)]
      const result = renderer.render(pairs, 0.05)

      // 零差異應該顯示為 0.0000%
      expect(result).toContain('0.0000%')
    })

    it('should handle terminal width exactly at boundary (80)', () => {
      const rendererAtBoundary = new TableRenderer(80, colorStyler)
      const pairs = [createTestPair('BTCUSDT', 0.0001, 0.0002)]

      const result = rendererAtBoundary.render(pairs, 0.05)

      // 寬度正好 80 應該使用完整模式
      expect(result).toContain('Binance')
      expect(result).toContain('OKX')
      expect(result).toContain('Updated')
    })

    it('should handle terminal width just below boundary (79)', () => {
      const rendererBelowBoundary = new TableRenderer(79, colorStyler)
      const pairs = [createTestPair('BTCUSDT', 0.0001, 0.0002)]

      const result = rendererBelowBoundary.render(pairs, 0.05)

      // 寬度 79 應該使用簡化模式
      expect(result).not.toContain('Binance')
      expect(result).not.toContain('OKX')
      expect(result).not.toContain('Updated')
      expect(result).toContain('Spread')
    })
  })
})
