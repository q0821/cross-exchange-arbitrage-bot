/**
 * 套利機會偵測系統 MVP 整合測試
 * 驗證 Phase 1-3 的核心功能
 *
 * Feature: 005-arbitrage-opportunity-detection
 * Date: 2025-10-23
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { Decimal } from 'decimal.js'
import { ArbitrageOpportunityRepository } from '../../src/repositories/ArbitrageOpportunityRepository'
import { OpportunityHistoryRepository } from '../../src/repositories/OpportunityHistoryRepository'
import { NotificationLogRepository } from '../../src/repositories/NotificationLogRepository'
import { DebounceManager } from '../../src/lib/debounce'

const prisma = new PrismaClient()

describe('套利機會偵測系統 MVP 整合測試', () => {
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
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('Phase 1: 資料庫與 Schema', () => {
    it('應該能連接到資料庫', async () => {
      const result = await prisma.$queryRaw`SELECT 1 as test`
      expect(result).toBeDefined()
    })

    it('應該包含 arbitrage_opportunities 表', async () => {
      const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'arbitrage_opportunities'
      `
      expect(tables).toHaveLength(1)
      expect(tables[0].tablename).toBe('arbitrage_opportunities')
    })

    it('應該包含 opportunity_history 表', async () => {
      const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'opportunity_history'
      `
      expect(tables).toHaveLength(1)
      expect(tables[0].tablename).toBe('opportunity_history')
    })

    it('應該包含 notification_logs 表', async () => {
      const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notification_logs'
      `
      expect(tables).toHaveLength(1)
      expect(tables[0].tablename).toBe('notification_logs')
    })
  })

  describe('Phase 2: Repository 基礎操作', () => {
    let testOpportunityId: string

    it('應該能建立新的套利機會', async () => {
      const opportunity = await opportunityRepo.create({
        symbol: 'BTC',
        longExchange: 'binance',
        shortExchange: 'okx',
        longFundingRate: new Decimal(0.0001) as any,
        shortFundingRate: new Decimal(0.0008) as any,
        rateDifference: new Decimal(0.0007) as any,
        expectedReturnRate: new Decimal(0.7665) as any, // 0.0007 * 3 * 365 = 76.65%
      })

      expect(opportunity).toBeDefined()
      expect(opportunity.id).toBeDefined()
      expect(opportunity.symbol).toBe('BTC')
      expect(opportunity.status).toBe('ACTIVE')
      testOpportunityId = opportunity.id
    })

    it('應該能根據 ID 查詢機會', async () => {
      const opportunity = await opportunityRepo.findById(testOpportunityId)
      expect(opportunity).toBeDefined()
      expect(opportunity!.id).toBe(testOpportunityId)
      expect(opportunity!.symbol).toBe('BTC')
    })

    it('應該能根據幣別查詢活躍機會', async () => {
      const opportunities = await opportunityRepo.findActiveBySymbol('BTC')
      expect(opportunities.length).toBeGreaterThan(0)
      expect(opportunities[0].symbol).toBe('BTC')
      expect(opportunities[0].status).toBe('ACTIVE')
    })

    it('應該能更新機會狀態', async () => {
      const updated = await opportunityRepo.updateStatus(testOpportunityId, 'EXPIRED')
      expect(updated.status).toBe('EXPIRED')
      expect(updated.expired_at).toBeDefined()
    })

    it('應該能建立通知記錄', async () => {
      const log = await notificationRepo.create({
        opportunityId: testOpportunityId,
        symbol: 'BTC',
        notificationType: 'OPPORTUNITY_APPEARED',
        channel: 'TERMINAL',
        severity: 'INFO',
        message: 'Test notification',
        rateDifference: new Decimal(0.0007) as any,
        isDebounced: false,
        debounceSkippedCount: 0,
      })

      expect(log).toBeDefined()
      expect(log.opportunity_id).toBe(testOpportunityId)
      expect(log.notification_type).toBe('OPPORTUNITY_APPEARED')
    })

    it('應該能查詢機會的通知記錄', async () => {
      const logs = await notificationRepo.findByOpportunityId(testOpportunityId)
      expect(logs.length).toBeGreaterThan(0)
      expect(logs[0].opportunity_id).toBe(testOpportunityId)
    })

    it('應該能建立機會歷史記錄', async () => {
      const history = await historyRepo.create({
        opportunityId: testOpportunityId,
        symbol: 'BTC',
        longExchange: 'binance',
        shortExchange: 'okx',
        initialRateDifference: new Decimal(0.0007) as any,
        maxRateDifference: new Decimal(0.0009) as any,
        avgRateDifference: new Decimal(0.0008) as any,
        durationMs: BigInt(900000), // 15 分鐘
        durationMinutes: new Decimal(15) as any,
        totalNotifications: 3,
        detectedAt: new Date(Date.now() - 900000),
        expiredAt: new Date(),
        disappearReason: 'RATE_DROPPED',
      })

      expect(history).toBeDefined()
      expect(history.opportunity_id).toBe(testOpportunityId)
      expect(history.disappear_reason).toBe('RATE_DROPPED')
    })

    it('應該能查詢機會的歷史記錄', async () => {
      const history = await historyRepo.findByOpportunityId(testOpportunityId)
      expect(history).toBeDefined()
      expect(history!.opportunity_id).toBe(testOpportunityId)
      expect(Number(history!.duration_minutes)).toBe(15)
    })

    // 清理測試資料
    afterAll(async () => {
      await prisma.notificationLog.deleteMany({
        where: { opportunity_id: testOpportunityId },
      })
      await prisma.opportunityHistory.deleteMany({
        where: { opportunity_id: testOpportunityId },
      })
      await prisma.arbitrageOpportunity.deleteMany({
        where: { id: testOpportunityId },
      })
    })
  })

  describe('Phase 2: DebounceManager', () => {
    it('應該允許首次觸發', () => {
      const key = 'test-symbol-1'
      const shouldTrigger = debouncer.shouldTrigger(key)
      expect(shouldTrigger).toBe(true)
    })

    it('應該在防抖動窗口內阻止觸發', () => {
      const key = 'test-symbol-2'
      debouncer.shouldTrigger(key) // 首次觸發
      const shouldTrigger = debouncer.shouldTrigger(key) // 立即再次嘗試
      expect(shouldTrigger).toBe(false)
    })

    it('應該記錄跳過次數', () => {
      const key = 'test-symbol-3'
      debouncer.shouldTrigger(key) // 首次
      debouncer.shouldTrigger(key) // 跳過 1
      debouncer.shouldTrigger(key) // 跳過 2
      const skipCount = debouncer.getSkipCount(key)
      expect(skipCount).toBe(2)
    })

    it('應該能重置防抖動狀態', () => {
      const key = 'test-symbol-4'
      debouncer.shouldTrigger(key)
      debouncer.reset(key)
      const shouldTrigger = debouncer.shouldTrigger(key)
      expect(shouldTrigger).toBe(true)
    })

    it('應該能清理所有狀態', () => {
      debouncer.shouldTrigger('test-1')
      debouncer.shouldTrigger('test-2')
      debouncer.clear()
      expect(debouncer.getActiveCount()).toBe(0)
    })
  })

  describe('Phase 2: NotificationLogRepository 統計功能', () => {
    let testOpportunityId2: string

    beforeAll(async () => {
      // 建立測試機會
      const opportunity = await opportunityRepo.create({
        symbol: 'ETH',
        longExchange: 'binance',
        shortExchange: 'okx',
        longFundingRate: new Decimal(0.0002) as any,
        shortFundingRate: new Decimal(0.0009) as any,
        rateDifference: new Decimal(0.0007) as any,
        expectedReturnRate: new Decimal(0.7665) as any,
      })
      testOpportunityId2 = opportunity.id

      // 建立多個通知記錄
      await notificationRepo.create({
        opportunityId: testOpportunityId2,
        symbol: 'ETH',
        notificationType: 'OPPORTUNITY_APPEARED',
        channel: 'TERMINAL',
        severity: 'INFO',
        message: 'Test 1',
        rateDifference: new Decimal(0.0007) as any,
        isDebounced: false,
        debounceSkippedCount: 0,
      })

      await notificationRepo.create({
        opportunityId: testOpportunityId2,
        symbol: 'ETH',
        notificationType: 'OPPORTUNITY_UPDATED',
        channel: 'LOG',
        severity: 'INFO',
        message: 'Test 2',
        rateDifference: new Decimal(0.0008) as any,
        isDebounced: true,
        debounceSkippedCount: 2,
      })
    })

    it('應該能獲取防抖動統計', async () => {
      const stats = await notificationRepo.getDebounceStats('ETH', 1)
      expect(stats.totalNotifications).toBeGreaterThanOrEqual(2)
      expect(stats.debouncedCount).toBeGreaterThanOrEqual(1)
      expect(stats.totalSkipped).toBeGreaterThanOrEqual(2)
    })

    it('應該能獲取通知頻率統計', async () => {
      const frequency = await notificationRepo.getNotificationFrequency(1, 10)
      expect(frequency).toBeDefined()
      expect(Array.isArray(frequency)).toBe(true)
    })

    afterAll(async () => {
      await prisma.notificationLog.deleteMany({
        where: { opportunity_id: testOpportunityId2 },
      })
      await prisma.arbitrageOpportunity.deleteMany({
        where: { id: testOpportunityId2 },
      })
    })
  })
})
