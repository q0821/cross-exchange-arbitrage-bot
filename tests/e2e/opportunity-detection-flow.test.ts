/**
 * 套利機會偵測系統端到端測試
 * 測試完整的偵測與通知流程
 *
 * Feature: 005-arbitrage-opportunity-detection
 * Date: 2025-10-23
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { Decimal } from 'decimal.js'
import { OpportunityDetector, OpportunityDetectorConfig } from '../../src/services/monitor/OpportunityDetector'
import { NotificationService } from '../../src/services/notification/NotificationService'
import { ArbitrageOpportunityRepository } from '../../src/repositories/ArbitrageOpportunityRepository'
import { OpportunityHistoryRepository } from '../../src/repositories/OpportunityHistoryRepository'
import { NotificationLogRepository } from '../../src/repositories/NotificationLogRepository'
import { DebounceManager } from '../../src/lib/debounce'
import type { FundingRateData } from '../../src/types/opportunity-detection'

const prisma = new PrismaClient()

describe('套利機會偵測系統 E2E 測試', () => {
  let detector: OpportunityDetector
  let notificationService: NotificationService
  let opportunityRepo: ArbitrageOpportunityRepository
  let historyRepo: OpportunityHistoryRepository
  let notificationRepo: NotificationLogRepository
  let debouncer: DebounceManager

  beforeAll(async () => {
    // 初始化 repositories
    opportunityRepo = new ArbitrageOpportunityRepository(prisma)
    historyRepo = new OpportunityHistoryRepository(prisma)
    notificationRepo = new NotificationLogRepository(prisma)
    debouncer = new DebounceManager(1000) // 1 秒防抖動（測試用）

    // 初始化服務
    const config: OpportunityDetectorConfig = {
      minRateDifference: new Decimal(0.0005) as any, // 0.05%
      fundingInterval: 8, // 8 小時
    }
    detector = new OpportunityDetector(opportunityRepo, config)
    notificationService = new NotificationService(prisma, debouncer)
  })

  afterAll(async () => {
    // 清理測試資料
    await prisma.notificationLog.deleteMany({
      where: { symbol: 'BTC-E2E' },
    })
    await prisma.opportunityHistory.deleteMany({
      where: { symbol: 'BTC-E2E' },
    })
    await prisma.arbitrageOpportunity.deleteMany({
      where: { symbol: 'BTC-E2E' },
    })
    await prisma.$disconnect()
  })

  describe('完整的機會偵測流程', () => {
    it('應該能偵測到達到閾值的套利機會', async () => {
      // 模擬資金費率資料
      const fundingRates = new Map<string, FundingRateData>([
        [
          'binance',
          {
            exchange: 'binance',
            symbol: 'BTC-E2E',
            fundingRate: new Decimal(0.0001) as any,
            nextFundingTime: new Date(Date.now() + 3600000),
            recordedAt: new Date(),
          },
        ],
        [
          'okx',
          {
            exchange: 'okx',
            symbol: 'BTC-E2E',
            fundingRate: new Decimal(0.0008) as any,
            nextFundingTime: new Date(Date.now() + 3600000),
            recordedAt: new Date(),
          },
        ],
      ])

      // 偵測機會
      const opportunities = await detector.detectOpportunities('BTC-E2E', fundingRates)

      expect(opportunities).toHaveLength(1)
      expect(opportunities[0].symbol).toBe('BTC-E2E')
      expect(opportunities[0].longExchange).toBe('binance')
      expect(opportunities[0].shortExchange).toBe('okx')
      expect(Number(opportunities[0].rateDifference)).toBeCloseTo(0.0007, 4)
    })

    it('應該不偵測低於閾值的機會', async () => {
      const fundingRates = new Map<string, FundingRateData>([
        [
          'binance',
          {
            exchange: 'binance',
            symbol: 'BTC-E2E',
            fundingRate: new Decimal(0.0001) as any,
            nextFundingTime: new Date(Date.now() + 3600000),
            recordedAt: new Date(),
          },
        ],
        [
          'okx',
          {
            exchange: 'okx',
            symbol: 'BTC-E2E',
            fundingRate: new Decimal(0.0003) as any, // 差異只有 0.02%，低於閾值
            nextFundingTime: new Date(Date.now() + 3600000),
            recordedAt: new Date(),
          },
        ],
      ])

      const opportunities = await detector.detectOpportunities('BTC-E2E', fundingRates)
      expect(opportunities).toHaveLength(0)
    })
  })

  describe('通知服務流程', () => {
    let testOpportunity: any

    beforeAll(async () => {
      // 建立測試機會
      testOpportunity = await opportunityRepo.create({
        symbol: 'BTC-E2E',
        longExchange: 'binance',
        shortExchange: 'okx',
        longFundingRate: new Decimal(0.0001) as any,
        shortFundingRate: new Decimal(0.0008) as any,
        rateDifference: new Decimal(0.0007) as any,
        expectedReturnRate: new Decimal(0.7665) as any,
      })
    })

    it('應該能發送機會出現通知', async () => {
      await notificationService.notifyOpportunityAppeared(
        testOpportunity,
        ['TERMINAL', 'LOG']
      )

      // 檢查通知記錄
      const logs = await notificationRepo.findByOpportunityId(testOpportunity.id)
      expect(logs.length).toBeGreaterThan(0)
      expect(logs.some(log => log.notification_type === 'OPPORTUNITY_APPEARED')).toBe(true)
    })

    it('應該能發送機會消失通知', async () => {
      await notificationService.notifyOpportunityDisappeared(
        testOpportunity,
        'RATE_DROPPED',
        ['TERMINAL']
      )

      const logs = await notificationRepo.findByOpportunityId(testOpportunity.id)
      expect(logs.some(log => log.notification_type === 'OPPORTUNITY_DISAPPEARED')).toBe(true)
    })
  })

  describe('防抖動機制', () => {
    it('應該在防抖動窗口內跳過重複通知', async () => {
      const testOpportunity = await opportunityRepo.create({
        symbol: 'ETH-E2E',
        longExchange: 'binance',
        shortExchange: 'okx',
        longFundingRate: new Decimal(0.0002) as any,
        shortFundingRate: new Decimal(0.0009) as any,
        rateDifference: new Decimal(0.0007) as any,
        expectedReturnRate: new Decimal(0.7665) as any,
      })

      // 第一次通知
      await notificationService.notifyOpportunityAppeared(
        testOpportunity,
        ['TERMINAL']
      )

      // 立即再次通知（應該被防抖動跳過）
      await notificationService.notifyOpportunityAppeared(
        testOpportunity,
        ['TERMINAL']
      )

      const logs = await notificationRepo.findByOpportunityId(testOpportunity.id)

      // 檢查是否有記錄被防抖動跳過
      const debouncedLogs = logs.filter(log => log.is_debounced)
      expect(debouncedLogs.length).toBeGreaterThan(0)

      // 清理
      await prisma.notificationLog.deleteMany({
        where: { opportunity_id: testOpportunity.id },
      })
      await prisma.arbitrageOpportunity.deleteMany({
        where: { id: testOpportunity.id },
      })
    })
  })

  describe('機會生命週期', () => {
    it('應該能追蹤機會從出現到消失的完整生命週期', async () => {
      // 1. 建立機會（模擬偵測到機會）
      const opportunity = await opportunityRepo.create({
        symbol: 'SOL-E2E',
        longExchange: 'binance',
        shortExchange: 'okx',
        longFundingRate: new Decimal(0.0003) as any,
        shortFundingRate: new Decimal(0.0010) as any,
        rateDifference: new Decimal(0.0007) as any,
        expectedReturnRate: new Decimal(0.7665) as any,
      })
      expect(opportunity.status).toBe('ACTIVE')

      // 2. 發送出現通知
      await notificationService.notifyOpportunityAppeared(
        opportunity,
        ['TERMINAL', 'LOG']
      )

      // 3. 模擬費率變化，更新機會
      const updated = await opportunityRepo.update(opportunity.id, {
        rateDifference: new Decimal(0.0009) as any,
        maxRateDifference: new Decimal(0.0009) as any,
        maxRateDifferenceAt: new Date(),
      })

      // 4. 標記機會過期
      const expired = await opportunityRepo.updateStatus(opportunity.id, 'EXPIRED')
      expect(expired.status).toBe('EXPIRED')
      expect(expired.expired_at).toBeDefined()

      // 5. 發送消失通知
      await notificationService.notifyOpportunityDisappeared(
        expired,
        'RATE_DROPPED',
        ['TERMINAL']
      )

      // 6. 建立歷史記錄
      const history = await historyRepo.create({
        opportunityId: opportunity.id,
        symbol: 'SOL-E2E',
        longExchange: 'binance',
        shortExchange: 'okx',
        initialRateDifference: new Decimal(0.0007) as any,
        maxRateDifference: new Decimal(0.0009) as any,
        avgRateDifference: new Decimal(0.0008) as any,
        durationMs: BigInt(600000), // 10 分鐘
        durationMinutes: new Decimal(10) as any,
        totalNotifications: 3,
        detectedAt: new Date(Date.now() - 600000),
        expiredAt: new Date(),
        disappearReason: 'RATE_DROPPED',
      })

      // 驗證完整流程
      expect(history.opportunity_id).toBe(opportunity.id)
      expect(history.disappear_reason).toBe('RATE_DROPPED')

      const logs = await notificationRepo.findByOpportunityId(opportunity.id)
      expect(logs.length).toBeGreaterThan(0)

      // 清理
      await prisma.notificationLog.deleteMany({
        where: { opportunity_id: opportunity.id },
      })
      await prisma.opportunityHistory.deleteMany({
        where: { opportunity_id: opportunity.id },
      })
      await prisma.arbitrageOpportunity.deleteMany({
        where: { id: opportunity.id },
      })
    })
  })
})
