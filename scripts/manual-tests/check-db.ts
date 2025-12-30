#!/usr/bin/env tsx
/**
 * 檢查資料庫記錄
 */

import { PrismaClient } from '@/generated/prisma/client'

async function main() {
  const prisma = new PrismaClient()

  try {
    const opportunities = await prisma.arbitrageOpportunity.findMany({
      orderBy: { detected_at: 'desc' },
      take: 10,
    })

    console.log(`\n📊 套利機會記錄: ${opportunities.length} 筆`)
    console.log('━'.repeat(80))

    for (const opp of opportunities) {
      console.log(`\n[${opp.id.substring(0, 8)}...] ${opp.symbol}`)
      console.log(`  狀態: ${opp.status}`)
      console.log(`  做多: ${opp.long_exchange} | 做空: ${opp.short_exchange}`)
      console.log(`  費率差異: ${opp.rate_difference.toString()}`)
      console.log(`  預期收益: ${opp.expected_return_rate ? (parseFloat(opp.expected_return_rate.toString()) * 100).toFixed(2) + '%' : 'N/A'}`)
      console.log(`  偵測時間: ${opp.detected_at.toISOString()}`)
    }

    const notificationLogs = await prisma.notificationLog.findMany({
      orderBy: { sent_at: 'desc' },
      take: 10,
    })

    console.log(`\n\n📬 通知記錄: ${notificationLogs.length} 筆`)
    console.log('━'.repeat(80))

    for (const log of notificationLogs) {
      console.log(`\n[${log.id.substring(0, 8)}...] ${log.symbol}`)
      console.log(`  類型: ${log.notification_type} | 渠道: ${log.channel} | 嚴重性: ${log.severity}`)
      console.log(`  訊息: ${log.message}`)
      console.log(`  防抖動: ${log.is_debounced ? '是' : '否'} | 跳過次數: ${log.debounce_skipped_count}`)
      console.log(`  發送時間: ${log.sent_at.toISOString()}`)
    }

    console.log('\n')
  } catch (error) {
    console.error('查詢失敗:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
