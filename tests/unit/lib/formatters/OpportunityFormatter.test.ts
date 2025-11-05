/**
 * OpportunityFormatter 單元測試
 *
 * Feature: 005-arbitrage-opportunity-detection (Phase 4)
 * Date: 2025-10-23
 */

import { describe, it, expect } from 'vitest'
import { Decimal } from 'decimal.js'
import {
  formatAnnualizedReturn,
  formatSpread,
  formatDuration,
  formatDurationMs,
  formatDateTime,
  formatShortDateTime,
  truncate,
  formatNotificationCount,
} from '../../../../src/lib/formatters/OpportunityFormatter'

describe('OpportunityFormatter', () => {
  describe('formatAnnualizedReturn', () => {
    it('應該格式化年化收益率為百分比', () => {
      const rate = new Decimal(0.7665) as any
      expect(formatAnnualizedReturn(rate)).toBe('76.65%')
    })

    it('應該處理小數點後兩位', () => {
      const rate = new Decimal(0.1234567) as any
      expect(formatAnnualizedReturn(rate)).toBe('12.35%')
    })

    it('應該處理 0 值', () => {
      const rate = new Decimal(0) as any
      expect(formatAnnualizedReturn(rate)).toBe('0.00%')
    })

    it('應該處理大於 1 的值', () => {
      const rate = new Decimal(1.5) as any
      expect(formatAnnualizedReturn(rate)).toBe('150.00%')
    })
  })

  describe('formatSpread', () => {
    it('應該格式化費率差異為百分比', () => {
      const spread = new Decimal(0.0007) as any
      expect(formatSpread(spread)).toBe('0.07%')
    })

    it('應該處理小數點後兩位', () => {
      const spread = new Decimal(0.000567) as any
      expect(formatSpread(spread)).toBe('0.06%')
    })

    it('應該處理 0 值', () => {
      const spread = new Decimal(0) as any
      expect(formatSpread(spread)).toBe('0.00%')
    })
  })

  describe('formatDuration', () => {
    it('應該格式化秒數', () => {
      const detectedAt = new Date('2025-10-23T10:00:00Z')
      const expiredAt = new Date('2025-10-23T10:00:35Z')
      expect(formatDuration(detectedAt, expiredAt)).toBe('35s')
    })

    it('應該格式化分鐘和秒', () => {
      const detectedAt = new Date('2025-10-23T10:00:00Z')
      const expiredAt = new Date('2025-10-23T10:05:23Z')
      expect(formatDuration(detectedAt, expiredAt)).toBe('5m 23s')
    })

    it('應該格式化小時和分鐘', () => {
      const detectedAt = new Date('2025-10-23T10:00:00Z')
      const expiredAt = new Date('2025-10-23T12:15:00Z')
      expect(formatDuration(detectedAt, expiredAt)).toBe('2h 15m')
    })

    it('應該格式化天數和小時', () => {
      const detectedAt = new Date('2025-10-23T10:00:00Z')
      const expiredAt = new Date('2025-10-26T12:00:00Z')
      expect(formatDuration(detectedAt, expiredAt)).toBe('3d 2h')
    })

    it('應該格式化只有天數', () => {
      const detectedAt = new Date('2025-10-23T10:00:00Z')
      const expiredAt = new Date('2025-10-28T10:00:00Z')
      expect(formatDuration(detectedAt, expiredAt)).toBe('5d')
    })

    it('應該處理 null expiredAt（使用當前時間）', () => {
      const detectedAt = new Date(Date.now() - 10000) // 10 秒前
      const result = formatDuration(detectedAt, null)
      expect(result).toMatch(/^\d+s$/) // 應該是秒數格式
    })

    it('應該處理負值', () => {
      const detectedAt = new Date('2025-10-23T12:00:00Z')
      const expiredAt = new Date('2025-10-23T10:00:00Z')
      expect(formatDuration(detectedAt, expiredAt)).toBe('0s')
    })
  })

  describe('formatDurationMs', () => {
    it('應該格式化毫秒為秒', () => {
      expect(formatDurationMs(35000)).toBe('35s')
    })

    it('應該格式化毫秒為分鐘', () => {
      expect(formatDurationMs(323000)).toBe('5m 23s') // 5分23秒
    })

    it('應該格式化毫秒為小時', () => {
      expect(formatDurationMs(8100000)).toBe('2h 15m') // 2小時15分
    })

    it('應該處理 bigint 類型', () => {
      expect(formatDurationMs(BigInt(35000))).toBe('35s')
    })

    it('應該處理 0 值', () => {
      expect(formatDurationMs(0)).toBe('0s')
    })

    it('應該處理負值', () => {
      expect(formatDurationMs(-1000)).toBe('0s')
    })
  })

  describe('formatDateTime', () => {
    it('應該格式化日期時間', () => {
      const date = new Date('2025-10-23T14:30:25Z')
      const result = formatDateTime(date)
      expect(result).toMatch(/2025-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)
    })

    it('應該補齊個位數字', () => {
      const date = new Date('2025-01-05T09:05:05Z')
      const result = formatDateTime(date)
      expect(result).toMatch(/2025-01-05 \d{2}:05:05/)
    })
  })

  describe('formatShortDateTime', () => {
    it('應該格式化短日期時間（不含秒）', () => {
      const date = new Date('2025-10-23T14:30:25Z')
      const result = formatShortDateTime(date)
      expect(result).toMatch(/2025-\d{2}-\d{2} \d{2}:\d{2}/)
      expect(result).not.toContain(':25')
    })
  })

  describe('truncate', () => {
    it('應該截斷長字串', () => {
      const str = 'This is a very long string that needs truncation'
      expect(truncate(str, 20)).toBe('This is a very lo...')
    })

    it('應該保持短字串不變', () => {
      const str = 'Short'
      expect(truncate(str, 20)).toBe('Short')
    })

    it('應該處理剛好等於限制的字串', () => {
      const str = '12345678901234567890'
      expect(truncate(str, 20)).toBe(str)
    })
  })

  describe('formatNotificationCount', () => {
    it('應該格式化小於 99 的數字', () => {
      expect(formatNotificationCount(5)).toBe('5')
      expect(formatNotificationCount(42)).toBe('42')
      expect(formatNotificationCount(99)).toBe('99')
    })

    it('應該顯示 99+ 當數字大於 99', () => {
      expect(formatNotificationCount(100)).toBe('99+')
      expect(formatNotificationCount(500)).toBe('99+')
    })

    it('應該處理 0 值', () => {
      expect(formatNotificationCount(0)).toBe('0')
    })
  })
})
