/**
 * CLI 指令: arb opportunities show <id>
 * 顯示特定套利機會的詳細資訊
 *
 * Feature: 006-opportunities-list-show
 * Date: 2025-10-22
 */

import { Command } from 'commander'
import { PrismaClient } from '@prisma/client'
import { logger } from '../../../lib/logger.js'

interface ShowOptions {
  format?: 'detail' | 'json'
}

/**
 * 建立 show 指令
 */
export function createShowCommand(): Command {
  const command = new Command('show')
    .description('顯示特定套利機會詳情')
    .argument('<id>', '機會 ID (可使用前 8 碼)')
    .option('--format <type>', '輸出格式: detail | json', 'detail')
    .action(async (id: string, options: ShowOptions) => {
      try {
        await handleShowCommand(id, options)
      } catch (error) {
        logger.error({ error, id }, 'Failed to handle show command')
        console.error('❌ 查詢失敗:', error instanceof Error ? error.message : String(error))
        process.exit(1)
      }
    })

  return command
}

/**
 * 處理 show 指令
 */
async function handleShowCommand(id: string, options: ShowOptions): Promise<void> {
  const prisma = new PrismaClient()

  try {
    const format = options.format || 'detail'

    // 查詢機會（支援短 ID - 使用 contains 過濾）
    const allOpportunities = await prisma.arbitrageOpportunity.findMany()
    const opportunities = allOpportunities.filter(opp => opp.id.startsWith(id))

    if (opportunities.length === 0) {
      console.log(`\n❌ 找不到 ID 為 ${id} 的套利機會\n`)
      return
    }

    if (opportunities.length > 1) {
      console.log(`\n⚠️  找到 ${opportunities.length} 個符合的機會，請使用更完整的 ID:\n`)
      for (const opp of opportunities) {
        console.log(`  ${opp.id} - ${opp.symbol} (${opp.status})`)
      }
      console.log()
      return
    }

    const opportunity = opportunities[0]
    if (!opportunity) {
      console.log(`\n❌ 找不到 ID 為 ${id} 的套利機會\n`)
      return
    }

    // 查詢相關的通知記錄
    const notifications = await prisma.notificationLog.findMany({
      where: {
        opportunity_id: opportunity.id,
      },
      orderBy: {
        sent_at: 'desc',
      },
      take: 10,
    })

    // 輸出結果
    if (format === 'json') {
      console.log(JSON.stringify({
        opportunity,
        notifications,
      }, null, 2))
      return
    }

    // Detail 格式輸出
    displayDetail(opportunity, notifications)
  } catch (error) {
    logger.error({ error, id }, '查詢套利機會詳情失敗')
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

/**
 * 顯示詳細資訊
 */
function displayDetail(opportunity: any, notifications: any[]): void {
  console.log('\n' + '='.repeat(80))
  console.log('📊 套利機會詳情')
  console.log('='.repeat(80))

  // 基本資訊
  console.log('\n【基本資訊】')
  console.log(`  機會 ID: ${opportunity.id}`)
  console.log(`  幣別: ${opportunity.symbol}`)
  console.log(`  狀態: ${opportunity.status}`)
  console.log(`  偵測時間: ${new Date(opportunity.detected_at).toLocaleString('zh-TW')}`)

  if (opportunity.expired_at) {
    console.log(`  過期時間: ${new Date(opportunity.expired_at).toLocaleString('zh-TW')}`)
  }

  if (opportunity.closed_at) {
    console.log(`  關閉時間: ${new Date(opportunity.closed_at).toLocaleString('zh-TW')}`)
  }

  // 交易所資訊
  console.log('\n【交易所】')
  console.log(`  做多交易所: ${opportunity.long_exchange}`)
  console.log(`  做空交易所: ${opportunity.short_exchange}`)
  console.log(`  做多費率: ${(parseFloat(opportunity.long_funding_rate.toString()) * 100).toFixed(4)}%`)
  console.log(`  做空費率: ${(parseFloat(opportunity.short_funding_rate.toString()) * 100).toFixed(4)}%`)

  // 收益資訊
  console.log('\n【收益分析】')
  console.log(`  費率差異: ${(parseFloat(opportunity.rate_difference.toString()) * 100).toFixed(4)}%`)
  console.log(`  預期年化收益: ${(parseFloat(opportunity.expected_return_rate.toString()) * 100).toFixed(2)}%`)

  if (opportunity.max_rate_difference) {
    console.log(`  最大費率差異: ${(parseFloat(opportunity.max_rate_difference.toString()) * 100).toFixed(4)}%`)
    if (opportunity.max_rate_difference_at) {
      console.log(`  最大差異時間: ${new Date(opportunity.max_rate_difference_at).toLocaleString('zh-TW')}`)
    }
  }

  // 生命週期
  const duration = calculateDuration(opportunity)
  if (duration) {
    console.log('\n【生命週期】')
    console.log(`  持續時間: ${duration}`)
  }

  if (opportunity.disappear_reason) {
    console.log(`  消失原因: ${opportunity.disappear_reason}`)
  }

  // 通知記錄
  if (notifications.length > 0) {
    console.log('\n【通知記錄】')
    console.log(`  總通知數: ${notifications.length}`)
    console.log('\n  最近通知:')
    for (const notif of notifications.slice(0, 5)) {
      const time = new Date(notif.sent_at).toLocaleString('zh-TW', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
      console.log(`    [${time}] ${notif.notification_type} via ${notif.channel} (${notif.severity})`)
    }
  }

  console.log('\n' + '='.repeat(80) + '\n')
}

/**
 * 計算持續時間
 */
function calculateDuration(opportunity: any): string | null {
  const startTime = new Date(opportunity.detected_at).getTime()
  let endTime: number

  if (opportunity.closed_at) {
    endTime = new Date(opportunity.closed_at).getTime()
  } else if (opportunity.expired_at) {
    endTime = new Date(opportunity.expired_at).getTime()
  } else {
    endTime = Date.now()
  }

  const durationMs = endTime - startTime
  const seconds = Math.floor(durationMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days} 天 ${hours % 24} 小時`
  } else if (hours > 0) {
    return `${hours} 小時 ${minutes % 60} 分鐘`
  } else if (minutes > 0) {
    return `${minutes} 分鐘 ${seconds % 60} 秒`
  } else {
    return `${seconds} 秒`
  }
}
