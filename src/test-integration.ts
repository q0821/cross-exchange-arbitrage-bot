#!/usr/bin/env tsx
/**
 * 整合測試腳本
 * 測試完整的套利機會偵測流程
 *
 * 流程：
 * 1. FundingRateMonitor 監控費率
 * 2. 發出 'opportunity-detected' 事件
 * 3. OpportunityDetector 建立資料庫記錄
 * 4. NotificationService 發送通知（Terminal + Log）
 * 5. 驗證資料庫記錄
 *
 * Feature: 005-arbitrage-opportunity-detection
 * Date: 2025-10-22
 */

import { PrismaClient } from '@prisma/client'
import { FundingRateMonitor } from './services/monitor/FundingRateMonitor.js'
import { OpportunityDetector } from './services/monitor/OpportunityDetector.js'
import { NotificationService } from './services/notification/NotificationService.js'
import { TerminalChannel } from './services/notification/channels/TerminalChannel.js'
import { LogChannel } from './services/notification/channels/LogChannel.js'
import { ArbitrageOpportunityRepository } from './repositories/ArbitrageOpportunityRepository.js'
// import { OpportunityHistoryRepository } from './repositories/OpportunityHistoryRepository.js' // 未使用
import { DebounceManager } from './lib/debounce.js'
import { logger } from './lib/logger.js'
// import { config } from './lib/config.js' // 未使用
import type { FundingRatePair } from './models/FundingRate.js'
import { Decimal } from 'decimal.js'

async function main() {
  logger.info('=== 開始整合測試 ===')

  // 初始化資料庫連線
  const prisma = new PrismaClient()

  try {
    // 測試配置
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']
    const updateInterval = 10000 // 10 秒更新一次
    const threshold = 0.0001 // 降低閾值到 0.01% 以增加偵測機會
    const isTestnet = true // 使用測試網

    logger.info({
      symbols,
      updateInterval,
      threshold: threshold.toString(),
      isTestnet,
    }, '測試配置')

    // 1. 初始化各服務
    logger.info('初始化服務...')

    // 初始化 Repository
    const opportunityRepo = new ArbitrageOpportunityRepository(prisma)
    // const historyRepo = new OpportunityHistoryRepository(prisma) // 未使用

    // 初始化 OpportunityDetector
    const detector = new OpportunityDetector(opportunityRepo, {
      minRateDifference: new Decimal(threshold) as any,
      fundingInterval: 8,
    })

    // 初始化 DebounceManager
    const debounceManager = new DebounceManager(30000) // 30 秒防抖動窗口

    // 初始化 NotificationService
    const notificationService = new NotificationService(prisma, debounceManager)

    // 初始化通知渠道
    const terminalChannel = new TerminalChannel()
    const logChannel = new LogChannel()

    logger.info('所有服務已初始化')

    // 2. 建立 FundingRateMonitor
    const monitor = new FundingRateMonitor(symbols, updateInterval, threshold, isTestnet)

    // 3. 監聽 opportunity-detected 事件
    let opportunityCount = 0

    monitor.on('opportunity-detected', async (pair: FundingRatePair) => {
      try {
        opportunityCount++
        logger.info({
          count: opportunityCount,
          symbol: pair.symbol,
          spread: pair.spreadPercent,
        }, '收到套利機會事件')

        // 轉換為 FundingRateData 格式
        const fundingRates = new Map([
          ['binance', {
            exchange: 'binance' as const,
            symbol: pair.symbol,
            fundingRate: new Decimal(pair.binance.fundingRate) as any,
            nextFundingTime: pair.binance.nextFundingTime,
            markPrice: pair.binance.markPrice ? new Decimal(pair.binance.markPrice) as any : undefined,
            indexPrice: pair.binance.indexPrice ? new Decimal(pair.binance.indexPrice) as any : undefined,
            recordedAt: new Date(),
          }],
          ['okx', {
            exchange: 'okx' as const,
            symbol: pair.symbol,
            fundingRate: new Decimal(pair.okx.fundingRate) as any,
            nextFundingTime: pair.okx.nextFundingTime,
            markPrice: pair.okx.markPrice ? new Decimal(pair.okx.markPrice) as any : undefined,
            indexPrice: pair.okx.indexPrice ? new Decimal(pair.okx.indexPrice) as any : undefined,
            recordedAt: new Date(),
          }],
        ])

        // 使用 OpportunityDetector 偵測機會
        const opportunities = await detector.detectOpportunities(pair.symbol, fundingRates)

        logger.info({
          symbol: pair.symbol,
          detectedCount: opportunities.length,
        }, 'OpportunityDetector 偵測結果')

        // 處理每個偵測到的機會
        for (const opp of opportunities) {
          try {
            // 建立資料庫記錄
            const dbOpportunity = await opportunityRepo.create({
              symbol: opp.symbol,
              longExchange: opp.longExchange,
              shortExchange: opp.shortExchange,
              longFundingRate: opp.longFundingRate,
              shortFundingRate: opp.shortFundingRate,
              rateDifference: opp.rateDifference,
              expectedReturnRate: opp.expectedReturnRate,
              detectedAt: new Date(),
            })

            logger.info({
              opportunityId: dbOpportunity.id,
              symbol: dbOpportunity.symbol,
            }, '機會記錄已建立')

            // 發送通知到 Terminal 和 Log 渠道
            await terminalChannel.send({
              symbol: dbOpportunity.symbol,
              message: `發現套利機會: ${dbOpportunity.symbol}`,
              severity: 'INFO',
            })

            await logChannel.send({
              symbol: dbOpportunity.symbol,
              message: `發現套利機會: ${dbOpportunity.symbol}`,
              severity: 'INFO',
            })

            // 使用 NotificationService 記錄通知日誌
            await notificationService.notifyOpportunityAppeared(
              dbOpportunity as any,
              ['TERMINAL', 'LOG']
            )
          } catch (error) {
            // 詳細輸出錯誤資訊
            if (error instanceof Error) {
              logger.error({
                error: error.message,
                stack: error.stack,
                name: error.name,
                opportunity: {
                  symbol: opp.symbol,
                  longExchange: opp.longExchange,
                  shortExchange: opp.shortExchange,
                  longFundingRate: opp.longFundingRate.toString(),
                  shortFundingRate: opp.shortFundingRate.toString(),
                  rateDifference: opp.rateDifference.toString(),
                  expectedReturnRate: opp.expectedReturnRate.toString(),
                },
              }, '建立機會記錄時發生錯誤 - 詳細資訊')
            }
            throw error
          }
        }
      } catch (error) {
        logger.error({ error }, '處理套利機會事件時發生錯誤')
      }
    })

    // 監聽其他事件
    monitor.on('rate-updated', (pair: FundingRatePair) => {
      logger.debug({
        symbol: pair.symbol,
        spread: pair.spreadPercent,
      }, '費率已更新')
    })

    monitor.on('error', (error: Error) => {
      logger.error({ error: error.message }, '監控服務錯誤')
    })

    // 4. 啟動監控
    logger.info('啟動監控服務...')
    await monitor.start()

    // 5. 運行 30 秒後停止（降低閾值後應該能偵測到機會）
    const testDuration = 30000 // 30 秒
    logger.info({ durationMs: testDuration }, '測試將運行')

    await new Promise((resolve) => setTimeout(resolve, testDuration))

    // 6. 停止監控
    logger.info('停止監控服務...')
    await monitor.stop()

    // 7. 查詢資料庫驗證結果
    logger.info('查詢資料庫記錄...')

    const allOpportunities = await prisma.arbitrageOpportunity.findMany({
      orderBy: { detected_at: 'desc' },
      take: 10,
    })

    logger.info({
      totalRecords: allOpportunities.length,
    }, '資料庫記錄')

    for (const opp of allOpportunities) {
      logger.info({
        id: opp.id,
        symbol: opp.symbol,
        status: opp.status,
        rateDifference: opp.rate_difference.toString(),
        expectedReturnRate: opp.expected_return_rate.toString(),
        detectedAt: opp.detected_at,
      }, '機會記錄')
    }

    const notificationLogs = await prisma.notificationLog.findMany({
      orderBy: { sent_at: 'desc' },
      take: 10,
    })

    logger.info({
      totalLogs: notificationLogs.length,
    }, '通知記錄')

    for (const log of notificationLogs) {
      logger.info({
        id: log.id,
        symbol: log.symbol,
        type: log.notification_type,
        channel: log.channel,
        severity: log.severity,
        sentAt: log.sent_at,
      }, '通知日誌')
    }

    // 8. 測試摘要
    logger.info({
      opportunityCount,
      dbRecords: allOpportunities.length,
      notificationLogs: notificationLogs.length,
    }, '=== 測試完成 ===')

  } catch (error) {
    logger.error({ error }, '測試失敗')
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// 執行測試
main().catch((error) => {
  logger.error({ error }, '測試執行失敗')
  process.exit(1)
})
