/**
 * CLI 指令: arb opportunities config
 * 查看和設定套利機會偵測配置
 *
 * Feature: 005-arbitrage-opportunity-detection
 * Date: 2025-10-22
 */

import { Command } from 'commander'
import { config } from '../../../lib/config.js'
import { logger } from '../../../lib/logger.js'

interface ConfigOptions {
  threshold?: string
  debounce?: string
  reset?: boolean
  format?: 'table' | 'json'
}

/**
 * 建立 config 指令
 */
export function createConfigCommand(): Command {
  const command = new Command('config')
    .description('查看或設定套利機會偵測配置')
    .option('--threshold <value>', '設定最小費率差異閾值 (例如: 0.0005 = 0.05%)')
    .option('--debounce <seconds>', '設定防抖動窗口時間（秒）')
    .option('--reset', '重置為預設值')
    .option('--format <type>', '輸出格式: table | json', 'table')
    .action(async (options: ConfigOptions) => {
      try {
        await handleConfigCommand(options)
      } catch (error) {
        logger.error({ error }, 'Failed to handle config command')
        console.error('❌ 設定失敗:', error instanceof Error ? error.message : String(error))
        process.exit(1)
      }
    })

  return command
}

/**
 * 處理 config 指令
 */
async function handleConfigCommand(options: ConfigOptions): Promise<void> {
  // 如果是重置操作
  if (options.reset) {
    console.log('⚠️  重置功能尚未實作')
    console.log('提示: 請手動編輯 .env 檔案來重置配置')
    return
  }

  // 如果有設定參數，更新配置（需要寫入檔案）
  if (options.threshold || options.debounce) {
    console.log('⚠️  動態更新配置功能尚未實作')
    console.log('提示: 請編輯 .env 檔案來更新配置，然後重新啟動服務')

    if (options.threshold) {
      console.log(`   MIN_RATE_DIFFERENCE=${options.threshold}`)
    }
    if (options.debounce) {
      console.log(`   NOTIFICATION_DEBOUNCE_WINDOW_MS=${Number(options.debounce) * 1000}`)
    }

    return
  }

  // 顯示當前配置
  displayConfig(options.format || 'table')
}

/**
 * 顯示當前配置
 */
function displayConfig(format: 'table' | 'json'): void {
  const currentConfig = {
    minRateDifference: config.trading.minSpreadThreshold,
    minRateDifferencePercent: (config.trading.minSpreadThreshold * 100).toFixed(4) + '%',
    debounceWindowMs: 30000, // 預設值，可以從配置中讀取
    debounceWindowSeconds: 30,
    fundingInterval: 8, // 8 小時
  }

  if (format === 'json') {
    console.log(JSON.stringify(currentConfig, null, 2))
    return
  }

  // Table 格式
  console.log('\n📊 套利機會偵測配置\n')
  console.log('┌─────────────────────────────────┬─────────────────┐')
  console.log('│ 配置項目                        │ 當前值          │')
  console.log('├─────────────────────────────────┼─────────────────┤')
  console.log(`│ 最小費率差異閾值                │ ${currentConfig.minRateDifferencePercent.padEnd(15)} │`)
  console.log(`│ 最小費率差異 (Decimal)          │ ${currentConfig.minRateDifference.toFixed(8).padEnd(15)} │`)
  console.log(`│ 防抖動窗口                      │ ${currentConfig.debounceWindowSeconds}秒            │`)
  console.log(`│ 資金費率結算間隔                │ ${currentConfig.fundingInterval}小時            │`)
  console.log('└─────────────────────────────────┴─────────────────┘')
  console.log('\n💡 提示:')
  console.log('  - 費率差異 >= 閾值時會偵測為套利機會')
  console.log('  - 年化收益率 = 費率差異 × (24/8) × 365 = 費率差異 × 1095')
  console.log('  - 防抖動窗口內同一幣別只通知一次')
  console.log('\n📝 修改配置:')
  console.log('  編輯 .env 檔案並重新啟動服務')
  console.log('  例如: MIN_RATE_DIFFERENCE=0.0008\n')
}
