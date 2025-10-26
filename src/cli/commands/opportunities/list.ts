/**
 * CLI 指令: arb opportunities list
 * 列出當前活躍的套利機會
 *
 * Feature: 005-arbitrage-opportunity-detection (Phase 4)
 * Updated: 2025-10-23
 */

import { Command } from 'commander'
import { PrismaClient } from '@prisma/client'
import { logger } from '../../../lib/logger.js'
import {
  formatAnnualizedReturn,
  formatSpread,
  formatDuration,
  formatNotificationCount,
} from '../../../lib/formatters/OpportunityFormatter.js'

interface ListOptions {
  status?: 'ACTIVE' | 'EXPIRED' | 'CLOSED'
  symbol?: string
  minReturn?: string
  limit?: string
  format?: 'table' | 'json'
  sortBy?: 'return' | 'time' | 'spread'
}

/**
 * 建立 list 指令
 */
export function createListCommand(): Command {
  const command = new Command('list')
    .description('列出套利機會')
    .option('-s, --status <status>', '篩選狀態: ACTIVE | EXPIRED | CLOSED', 'ACTIVE')
    .option('--symbol <symbol>', '篩選特定幣別 (例如: BTCUSDT)')
    .option('--min-return <percent>', '最小年化收益率 (例如: 10 = 10%)')
    .option('-l, --limit <number>', '限制顯示數量', '20')
    .option('--format <type>', '輸出格式: table | json', 'table')
    .option('--sort-by <field>', '排序方式: return | time | spread', 'return')
    .action(async (options: ListOptions) => {
      try {
        await handleListCommand(options)
      } catch (error) {
        logger.error({ error }, 'Failed to handle list command')
        console.error('❌ 查詢失敗:', error instanceof Error ? error.message : String(error))
        process.exit(1)
      }
    })

  return command
}

/**
 * 處理 list 指令
 */
async function handleListCommand(options: ListOptions): Promise<void> {
  const prisma = new PrismaClient()

  try {
    // 解析參數
    const status = options.status || 'ACTIVE'
    const symbol = options.symbol
    const minReturn = options.minReturn ? parseFloat(options.minReturn) / 100 : undefined
    const limit = parseInt(options.limit || '20', 10)
    const format = options.format || 'table'
    const sortBy = options.sortBy || 'return'

    // 建立查詢條件
    const where: any = {
      status,
    }

    if (symbol) {
      where.symbol = symbol
    }

    if (minReturn !== undefined) {
      where.expected_return_rate = {
        gte: minReturn,
      }
    }

    // 建立排序條件
    let orderBy: any
    switch (sortBy) {
      case 'return':
        orderBy = { expected_return_rate: 'desc' }
        break
      case 'spread':
        orderBy = { rate_difference: 'desc' }
        break
      case 'time':
        orderBy = { detected_at: 'desc' }
        break
      default:
        orderBy = { expected_return_rate: 'desc' }
    }

    // 查詢資料庫
    const opportunities = await prisma.arbitrageOpportunity.findMany({
      where,
      orderBy,
      take: limit,
    })

    // 輸出結果
    if (format === 'json') {
      console.log(JSON.stringify(opportunities, null, 2))
      return
    }

    // Table 格式輸出
    displayTable(opportunities, status)
  } catch (error) {
    logger.error({ error }, '查詢套利機會失敗')
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

/**
 * 顯示表格
 */
function displayTable(opportunities: any[], status: string): void {
  if (opportunities.length === 0) {
    console.log(`\n📊 沒有找到 ${status} 狀態的套利機會\n`)
    return
  }

  console.log(`\n📊 套利機會列表 (${status})\n`)
  console.log('┌────────┬──────────┬───────────┬─────────┬──────────┬───────────┬────────┐')
  console.log('│ Symbol │ Long     │ Short     │ Spread  │ Annual % │ Duration  │ Notif. │')
  console.log('├────────┼──────────┼───────────┼─────────┼──────────┼───────────┼────────┤')

  for (const opp of opportunities) {
    const symbol = opp.symbol.padEnd(6)
    const longEx = opp.long_exchange.substring(0, 8).padEnd(8)
    const shortEx = opp.short_exchange.substring(0, 9).padEnd(9)
    const spread = formatSpread(opp.rate_difference).padEnd(7)
    const returnRate = formatAnnualizedReturn(opp.expected_return_rate).padEnd(8)
    const duration = formatDuration(new Date(opp.detected_at), opp.expired_at || opp.closed_at).padEnd(9)
    const notifCount = formatNotificationCount(opp.notification_count).padStart(6)

    console.log(`│ ${symbol} │ ${longEx} │ ${shortEx} │ ${spread} │ ${returnRate} │ ${duration} │ ${notifCount} │`)
  }

  console.log('└────────┴──────────┴───────────┴─────────┴──────────┴───────────┴────────┘')
  console.log(`\n總計: ${opportunities.length} 個機會\n`)

  // 統計摘要
  if (opportunities.length > 0) {
    const avgReturn = opportunities.reduce((sum, opp) =>
      sum + parseFloat(opp.expected_return_rate.toString()), 0) / opportunities.length
    const maxReturn = Math.max(...opportunities.map(opp =>
      parseFloat(opp.expected_return_rate.toString())))
    const minReturnVal = Math.min(...opportunities.map(opp =>
      parseFloat(opp.expected_return_rate.toString())))

    console.log('📈 統計摘要:')
    console.log(`  - 平均年化收益: ${(avgReturn * 100).toFixed(2)}%`)
    console.log(`  - 最高年化收益: ${(maxReturn * 100).toFixed(2)}%`)
    console.log(`  - 最低年化收益: ${(minReturnVal * 100).toFixed(2)}%\n`)
  }
}
