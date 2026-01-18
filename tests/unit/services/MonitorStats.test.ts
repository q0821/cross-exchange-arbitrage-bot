import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { MonitorStatsTracker } from '../../../src/services/monitor/MonitorStats.js'
import type { MonitorStats as _MonitorStats } from '../../../src/services/monitor/MonitorStats.js'

describe('MonitorStatsTracker', () => {
  let tracker: MonitorStatsTracker

  beforeEach(() => {
    // 使用固定時間進行測試
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-15T10:00:00.000Z'))
    tracker = new MonitorStatsTracker()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const stats = tracker.getStats()

      expect(stats.startTime).toEqual(new Date('2025-01-15T10:00:00.000Z'))
      expect(stats.totalUpdates).toBe(0)
      expect(stats.errorCount).toBe(0)
      expect(stats.activeOpportunities).toBe(0)
      expect(stats.lastUpdateTime).toBeNull()
    })

    it('should return immutable stats object', () => {
      const stats = tracker.getStats()

      // 嘗試修改返回的物件不應影響內部狀態
      ;(stats as any).totalUpdates = 999

      const stats2 = tracker.getStats()
      expect(stats2.totalUpdates).toBe(0)
    })
  })

  describe('increment()', () => {
    it('should increment totalUpdates by 1', () => {
      tracker.increment('totalUpdates')

      const stats = tracker.getStats()
      expect(stats.totalUpdates).toBe(1)
    })

    it('should increment totalUpdates by custom amount', () => {
      tracker.increment('totalUpdates', 5)

      const stats = tracker.getStats()
      expect(stats.totalUpdates).toBe(5)
    })

    it('should increment errorCount', () => {
      tracker.increment('errorCount')
      tracker.increment('errorCount')

      const stats = tracker.getStats()
      expect(stats.errorCount).toBe(2)
    })

    it('should increment activeOpportunities', () => {
      tracker.increment('activeOpportunities', 3)

      const stats = tracker.getStats()
      expect(stats.activeOpportunities).toBe(3)
    })

    it('should update lastUpdateTime when incrementing totalUpdates', () => {
      // 前進時間
      vi.advanceTimersByTime(5000) // 5 秒後
      tracker.increment('totalUpdates')

      const stats = tracker.getStats()
      expect(stats.lastUpdateTime).toEqual(new Date('2025-01-15T10:00:05.000Z'))
    })

    it('should not update lastUpdateTime when incrementing errorCount', () => {
      tracker.increment('errorCount')

      const stats = tracker.getStats()
      expect(stats.lastUpdateTime).toBeNull()
    })

    it('should update lastUpdateTime to latest increment time', () => {
      vi.advanceTimersByTime(1000)
      tracker.increment('totalUpdates')

      vi.advanceTimersByTime(2000)
      tracker.increment('totalUpdates')

      const stats = tracker.getStats()
      expect(stats.lastUpdateTime).toEqual(new Date('2025-01-15T10:00:03.000Z'))
    })
  })

  describe('setActiveOpportunities()', () => {
    it('should set activeOpportunities to specific value', () => {
      tracker.setActiveOpportunities(5)

      const stats = tracker.getStats()
      expect(stats.activeOpportunities).toBe(5)
    })

    it('should overwrite previous activeOpportunities value', () => {
      tracker.setActiveOpportunities(5)
      tracker.setActiveOpportunities(2)

      const stats = tracker.getStats()
      expect(stats.activeOpportunities).toBe(2)
    })

    it('should allow setting to 0', () => {
      tracker.setActiveOpportunities(10)
      tracker.setActiveOpportunities(0)

      const stats = tracker.getStats()
      expect(stats.activeOpportunities).toBe(0)
    })
  })

  describe('getUptime()', () => {
    it('should return 0 seconds immediately after creation', () => {
      expect(tracker.getUptime()).toBe(0)
    })

    it('should return correct uptime in seconds', () => {
      vi.advanceTimersByTime(5000) // 5 秒
      expect(tracker.getUptime()).toBe(5)
    })

    it('should return correct uptime after 1 minute', () => {
      vi.advanceTimersByTime(60000) // 60 秒
      expect(tracker.getUptime()).toBe(60)
    })

    it('should return correct uptime after 1 hour', () => {
      vi.advanceTimersByTime(3600000) // 3600 秒
      expect(tracker.getUptime()).toBe(3600)
    })

    it('should floor fractional seconds', () => {
      vi.advanceTimersByTime(1500) // 1.5 秒
      expect(tracker.getUptime()).toBe(1)
    })
  })

  describe('getFormattedUptime()', () => {
    it('should format 0 seconds', () => {
      expect(tracker.getFormattedUptime()).toBe('0s')
    })

    it('should format seconds only', () => {
      vi.advanceTimersByTime(45000) // 45 秒
      expect(tracker.getFormattedUptime()).toBe('45s')
    })

    it('should format minutes and seconds', () => {
      vi.advanceTimersByTime(125000) // 2 分 5 秒
      expect(tracker.getFormattedUptime()).toBe('2m 5s')
    })

    it('should format hours, minutes and seconds', () => {
      vi.advanceTimersByTime(3665000) // 1 小時 1 分 5 秒
      expect(tracker.getFormattedUptime()).toBe('1h 1m 5s')
    })

    it('should format hours and minutes without seconds', () => {
      vi.advanceTimersByTime(3660000) // 1 小時 1 分 0 秒
      expect(tracker.getFormattedUptime()).toBe('1h 1m')
    })

    it('should format hours and seconds without minutes', () => {
      vi.advanceTimersByTime(3605000) // 1 小時 0 分 5 秒
      expect(tracker.getFormattedUptime()).toBe('1h 5s')
    })

    it('should format multiple hours', () => {
      vi.advanceTimersByTime(7385000) // 2 小時 3 分 5 秒
      expect(tracker.getFormattedUptime()).toBe('2h 3m 5s')
    })

    it('should format exactly 1 hour', () => {
      vi.advanceTimersByTime(3600000) // 1 小時
      expect(tracker.getFormattedUptime()).toBe('1h')
    })
  })

  describe('reset()', () => {
    it('should reset all stats to initial values', () => {
      // 修改所有統計值
      tracker.increment('totalUpdates', 10)
      tracker.increment('errorCount', 5)
      tracker.setActiveOpportunities(3)
      vi.advanceTimersByTime(5000)

      // 重置
      vi.advanceTimersByTime(1000) // 前進到 6 秒
      tracker.reset()

      const stats = tracker.getStats()
      expect(stats.startTime).toEqual(new Date('2025-01-15T10:00:06.000Z'))
      expect(stats.totalUpdates).toBe(0)
      expect(stats.errorCount).toBe(0)
      expect(stats.activeOpportunities).toBe(0)
      expect(stats.lastUpdateTime).toBeNull()
    })

    it('should reset uptime calculation', () => {
      vi.advanceTimersByTime(5000) // 5 秒
      tracker.reset()
      vi.advanceTimersByTime(2000) // 再 2 秒

      // 重置後的 uptime 應該從重置時間開始計算
      expect(tracker.getUptime()).toBe(2)
    })
  })

  describe('integration scenarios', () => {
    it('should track typical monitoring session', () => {
      // 模擬監控會話
      vi.advanceTimersByTime(1000)
      tracker.increment('totalUpdates')

      vi.advanceTimersByTime(1000)
      tracker.increment('totalUpdates')

      vi.advanceTimersByTime(500)
      tracker.setActiveOpportunities(1)

      vi.advanceTimersByTime(1500)
      tracker.increment('totalUpdates')
      tracker.increment('errorCount')

      const stats = tracker.getStats()
      expect(stats.totalUpdates).toBe(3)
      expect(stats.errorCount).toBe(1)
      expect(stats.activeOpportunities).toBe(1)
      expect(tracker.getUptime()).toBe(4) // 總共 4 秒
      expect(stats.lastUpdateTime).toEqual(new Date('2025-01-15T10:00:04.000Z'))
    })

    it('should handle multiple opportunities lifecycle', () => {
      tracker.setActiveOpportunities(3)
      expect(tracker.getStats().activeOpportunities).toBe(3)

      tracker.setActiveOpportunities(5)
      expect(tracker.getStats().activeOpportunities).toBe(5)

      tracker.setActiveOpportunities(0)
      expect(tracker.getStats().activeOpportunities).toBe(0)
    })

    it('should maintain accurate counts across long sessions', () => {
      // 模擬長時間運行
      for (let i = 0; i < 1000; i++) {
        tracker.increment('totalUpdates')
      }

      for (let i = 0; i < 50; i++) {
        tracker.increment('errorCount')
      }

      const stats = tracker.getStats()
      expect(stats.totalUpdates).toBe(1000)
      expect(stats.errorCount).toBe(50)
    })
  })

  describe('edge cases', () => {
    it('should handle negative increment amounts', () => {
      tracker.increment('totalUpdates', 10)
      tracker.increment('totalUpdates', -3)

      const stats = tracker.getStats()
      expect(stats.totalUpdates).toBe(7)
    })

    it('should handle large uptime values', () => {
      // 模擬運行 24 小時
      vi.advanceTimersByTime(24 * 60 * 60 * 1000)

      expect(tracker.getUptime()).toBe(86400)
      expect(tracker.getFormattedUptime()).toContain('24h')
    })

    it('should handle very large increment amounts', () => {
      tracker.increment('totalUpdates', 999999)

      const stats = tracker.getStats()
      expect(stats.totalUpdates).toBe(999999)
    })

    it('should handle negative activeOpportunities values', () => {
      tracker.setActiveOpportunities(-5)

      const stats = tracker.getStats()
      expect(stats.activeOpportunities).toBe(-5)
    })
  })
})
