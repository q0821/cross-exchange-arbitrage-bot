#!/usr/bin/env tsx
/**
 * 測試 ArbitrageOpportunityRepository.create()
 */

import { PrismaClient } from '@/generated/prisma/client'
import { ArbitrageOpportunityRepository } from './repositories/ArbitrageOpportunityRepository.js'
import { Decimal } from 'decimal.js'

async function main() {
  const prisma = new PrismaClient()

  try {
    const repo = new ArbitrageOpportunityRepository(prisma)

    console.log('測試 ArbitrageOpportunityRepository.create()...\n')

    const testData = {
      symbol: 'BTCUSDT',
      longExchange: 'binance',
      shortExchange: 'okx',
      longFundingRate: new Decimal('0.0001') as any,
      shortFundingRate: new Decimal('0.00005') as any,
      rateDifference: new Decimal('0.00005') as any,
      expectedReturnRate: new Decimal('0.054750') as any,
      detectedAt: new Date(),
    }

    console.log('測試資料:')
    console.log(JSON.stringify({
      ...testData,
      longFundingRate: testData.longFundingRate.toString(),
      shortFundingRate: testData.shortFundingRate.toString(),
      rateDifference: testData.rateDifference.toString(),
      expectedReturnRate: testData.expectedReturnRate.toString(),
    }, null, 2))

    console.log('\n開始建立記錄...')
    const opportunity = await repo.create(testData)

    console.log('\n✅ 成功建立記錄!')
    console.log('記錄 ID:', opportunity.id)
    console.log('幣別:', opportunity.symbol)
    console.log('狀態:', opportunity.status)
    console.log('費率差異:', opportunity.rate_difference.toString())
    console.log('預期收益:', opportunity.expected_return_rate.toString())

  } catch (error) {
    console.error('\n❌ 失敗!')
    if (error instanceof Error) {
      console.error('錯誤名稱:', error.name)
      console.error('錯誤訊息:', error.message)
      console.error('堆疊:', error.stack)
    } else {
      console.error(error)
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
