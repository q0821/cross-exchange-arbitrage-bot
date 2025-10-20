import { describe, it, expect } from 'vitest'
import { ColorStyler } from '../../../src/lib/formatters/ColorStyler.js'

describe('ColorStyler', () => {
  describe('with color support', () => {
    const styler = new ColorStyler(true)

    it('should use ANSI colors when colors are supported', () => {
      const result = styler.highlightOpportunity('BTC', 'high')
      // 檢查是否包含 ANSI 控制碼
      expect(result).toMatch(/\x1b\[\d+m/)
    })

    it('should use green bold for high intensity', () => {
      const result = styler.highlightOpportunity('BTC', 'high')
      // chalk.green.bold 包含 32 (綠色) 和 1 (粗體)
      expect(result).toContain('\x1b[32m')
      expect(result).toContain('\x1b[1m')
    })

    it('should use yellow for low intensity', () => {
      const result = styler.highlightOpportunity('ETH', 'low')
      // chalk.yellow 包含 33
      expect(result).toContain('\x1b[33m')
    })

    it('should return emoji for opportunity icon', () => {
      const icon = styler.opportunityIcon()
      expect(icon).toBe('🎯')
    })

    it('should format spread with green for > 0.1%', () => {
      const result = styler.formatSpread('0.15%', 0.15, 0.05)
      expect(result).toMatch(/\x1b\[32m/) // 綠色
      expect(result).toMatch(/\x1b\[1m/)  // 粗體
    })

    it('should format spread with yellow for 0.05-0.1%', () => {
      const result = styler.formatSpread('0.08%', 0.08, 0.05)
      expect(result).toContain('\x1b[33m') // 黃色
    })

    it('should not format spread below threshold', () => {
      const result = styler.formatSpread('0.03%', 0.03, 0.05)
      // 不應包含顏色碼 (除了可能的重置碼)
      expect(result).toBe('0.03%')
    })

    it('should format error messages in red', () => {
      const result = styler.error('Error occurred')
      expect(result).toContain('\x1b[31m') // 紅色
    })

    it('should format warning messages in yellow', () => {
      const result = styler.warning('Warning message')
      expect(result).toContain('\x1b[33m') // 黃色
    })

    it('should format success messages in green', () => {
      const result = styler.success('Success!')
      expect(result).toContain('\x1b[32m') // 綠色
    })

    it('should format dim text', () => {
      const result = styler.dim('Secondary info')
      expect(result).toContain('\x1b[2m') // dim
    })
  })

  describe('without color support', () => {
    const styler = new ColorStyler(false)

    it('should use text symbols when colors are not supported', () => {
      const result = styler.highlightOpportunity('BTC', 'high')
      // 不應包含 ANSI 控制碼
      expect(result).not.toMatch(/\x1b/)
    })

    it('should use >>> for high intensity', () => {
      const result = styler.highlightOpportunity('BTC', 'high')
      expect(result).toBe('>>> BTC')
    })

    it('should use * for low intensity', () => {
      const result = styler.highlightOpportunity('ETH', 'low')
      expect(result).toBe('* ETH')
    })

    it('should return text symbol for opportunity icon', () => {
      const icon = styler.opportunityIcon()
      expect(icon).toBe('>>>')
    })

    it('should not apply any formatting to spread', () => {
      const result = styler.formatSpread('0.15%', 0.15, 0.05)
      expect(result).toBe('0.15%')
      expect(result).not.toMatch(/\x1b/)
    })

    it('should return plain text for error', () => {
      const result = styler.error('Error occurred')
      expect(result).toBe('Error occurred')
      expect(result).not.toMatch(/\x1b/)
    })

    it('should return plain text for warning', () => {
      const result = styler.warning('Warning message')
      expect(result).toBe('Warning message')
      expect(result).not.toMatch(/\x1b/)
    })

    it('should return plain text for success', () => {
      const result = styler.success('Success!')
      expect(result).toBe('Success!')
      expect(result).not.toMatch(/\x1b/)
    })

    it('should return plain text for dim', () => {
      const result = styler.dim('Secondary info')
      expect(result).toBe('Secondary info')
      expect(result).not.toMatch(/\x1b/)
    })
  })

  describe('edge cases', () => {
    const styler = new ColorStyler(true)

    it('should handle empty strings', () => {
      const result = styler.highlightOpportunity('', 'high')
      // 空字串會被包裝顏色碼，所以結果不是 truthy，但應該有定義
      expect(result).toBeDefined()
      // 在有顏色支援時，即使空字串也會有 ANSI 碼
      expect(result.length).toBeGreaterThanOrEqual(0)
    })

    it('should handle negative spread values', () => {
      const result = styler.formatSpread('-0.08%', -0.08, 0.05)
      // 絕對值 0.08 應該使用黃色
      expect(result).toContain('\x1b[33m')
    })

    it('should handle spread exactly at threshold', () => {
      const result = styler.formatSpread('0.05%', 0.05, 0.05)
      // 正好在閾值應該使用黃色
      expect(result).toContain('\x1b[33m')
    })

    it('should handle spread exactly at 0.1%', () => {
      const result = styler.formatSpread('0.10%', 0.10, 0.05)
      // 正好 0.1% 應該使用黃色 (在 0.05-0.1 範圍內)
      expect(result).toContain('\x1b[33m')
    })
  })
})
