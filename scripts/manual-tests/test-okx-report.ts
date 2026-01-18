#!/usr/bin/env tsx
/**
 * OKX 資金費率詳細報告
 * 生成易於對比的資金費率報告
 *
 * Date: 2025-10-22
 */

import ccxt from 'ccxt'

async function generateFundingRateReport() {
  console.log('╔═══════════════════════════════════════════════════════════════════════════╗')
  console.log('║                    OKX 資金費率詳細報告 (正式網)                          ║')
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝')
  console.log()

  const okx = new ccxt.okx({
    enableRateLimit: true,
    options: {
      defaultType: 'swap',
      sandboxMode: false, // 正式網
    },
  })

  try {
    await okx.loadMarkets()

    // 查詢當前費率
    const currentRate = await okx.fetchFundingRate('BTC/USDT:USDT')

    console.log('┌─────────────────────────────────────────────────────────────────────────┐')
    console.log('│  當前費率資訊 (Current Funding Rate)                                     │')
    console.log('├─────────────────────────────────────────────────────────────────────────┤')
    console.log(`│  交易對: BTC/USDT 永續合約                                               │`)
    console.log(`│  預測費率 (fundingRate): ${(currentRate.fundingRate * 100).toFixed(6)}%`.padEnd(75) + '│')
    console.log(`│  年化收益率: ${(currentRate.fundingRate * 3 * 365 * 100).toFixed(2)}%`.padEnd(75) + '│')
    console.log(`│  下次收費時間: ${new Date(currentRate.fundingTimestamp).toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })}`.padEnd(75) + '│')

    if (currentRate.info && currentRate.info.settFundingRate) {
      const settRate = parseFloat(currentRate.info.settFundingRate)
      console.log(`│  上次已結算費率 (settFundingRate): ${(settRate * 100).toFixed(6)}%`.padEnd(75) + '│')
    }
    console.log('└─────────────────────────────────────────────────────────────────────────┘')
    console.log()

    // 查詢歷史費率
    console.log('┌─────────────────────────────────────────────────────────────────────────┐')
    console.log('│  歷史費率記錄 (最近 30 筆實際收費記錄)                                   │')
    console.log('├──────────────────────────┬──────────────────┬──────────────────┬────────┤')
    console.log('│  收費時間                │  資金費率        │  年化收益率      │  趨勢  │')
    console.log('├──────────────────────────┼──────────────────┼──────────────────┼────────┤')

    const history = await okx.fetchFundingRateHistory('BTC/USDT:USDT', undefined, 30)

    let previousRate = 0
    for (const record of history) {
      const date = new Date(record.timestamp).toLocaleString('zh-TW', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
      const rate = record.fundingRate
      const percentage = (rate * 100).toFixed(6)
      const annualized = (rate * 3 * 365 * 100).toFixed(2)

      // 趨勢符號
      let trend = '  -   '
      if (previousRate !== 0) {
        if (rate > previousRate) {
          trend = '  ↑   '
        } else if (rate < previousRate) {
          trend = '  ↓   '
        } else {
          trend = '  →   '
        }
      }
      previousRate = rate

      const rateStr = `${percentage}%`.padStart(16)
      const annStr = `${annualized}%`.padStart(16)

      console.log(`│  ${date.padEnd(22)}  │ ${rateStr} │ ${annStr} │ ${trend} │`)
    }

    console.log('└──────────────────────────┴──────────────────┴──────────────────┴────────┘')
    console.log()

    // 統計分析
    const rates = history.map(r => r.fundingRate)
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length
    const max = Math.max(...rates)
    const min = Math.min(...rates)
    const positiveCount = rates.filter(r => r > 0).length
    const negativeCount = rates.filter(r => r < 0).length

    console.log('┌─────────────────────────────────────────────────────────────────────────┐')
    console.log('│  統計分析 (Statistical Analysis)                                        │')
    console.log('├─────────────────────────────────────────────────────────────────────────┤')
    console.log(`│  平均費率: ${(avg * 100).toFixed(6)}%`.padEnd(75) + '│')
    console.log(`│  平均年化收益: ${(avg * 3 * 365 * 100).toFixed(2)}%`.padEnd(75) + '│')
    console.log(`│  最高費率: ${(max * 100).toFixed(6)}%`.padEnd(75) + '│')
    console.log(`│  最低費率: ${(min * 100).toFixed(6)}%`.padEnd(75) + '│')
    console.log(`│  費率範圍: ${(min * 100).toFixed(6)}% ~ ${(max * 100).toFixed(6)}%`.padEnd(75) + '│')
    console.log(`│  正費率次數: ${positiveCount} 次 (做空方付費給做多方)`.padEnd(75) + '│')
    console.log(`│  負費率次數: ${negativeCount} 次 (做多方付費給做空方)`.padEnd(75) + '│')
    console.log(`│  正費率佔比: ${((positiveCount / rates.length) * 100).toFixed(1)}%`.padEnd(75) + '│')
    console.log('└─────────────────────────────────────────────────────────────────────────┘')
    console.log()

    // 多個交易對對比
    console.log('┌─────────────────────────────────────────────────────────────────────────┐')
    console.log('│  多幣種對比 (Multi-Symbol Comparison)                                   │')
    console.log('├──────────────┬──────────────────┬──────────────────┬──────────────────┤')
    console.log('│  交易對      │  當前費率        │  年化收益率      │  下次收費時間    │')
    console.log('├──────────────┼──────────────────┼──────────────────┼──────────────────┤')

    const symbols = ['BTC/USDT:USDT', 'ETH/USDT:USDT', 'SOL/USDT:USDT', 'BNB/USDT:USDT', 'XRP/USDT:USDT']

    for (const symbol of symbols) {
      try {
        const rate = await okx.fetchFundingRate(symbol)
        const fundingRate = rate.fundingRate || 0
        const percentage = (fundingRate * 100).toFixed(4) + '%'
        const annualized = (fundingRate * 3 * 365 * 100).toFixed(2) + '%'
        const nextTime = rate.fundingTimestamp
          ? new Date(rate.fundingTimestamp).toLocaleString('zh-TW', {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })
          : 'N/A'

        const symbolStr = symbol.replace('/USDT:USDT', '').padEnd(12)
        const rateStr = percentage.padStart(16)
        const annStr = annualized.padStart(16)
        const timeStr = nextTime.padEnd(16)

        console.log(`│  ${symbolStr} │ ${rateStr} │ ${annStr} │ ${timeStr} │`)
      } catch (_error) {
        const symbolStr = symbol.replace('/USDT:USDT', '').padEnd(12)
        console.log(`│  ${symbolStr} │ ${'ERROR'.padStart(16)} │ ${'N/A'.padStart(16)} │ ${'N/A'.padEnd(16)} │`)
      }
    }

    console.log('└──────────────┴──────────────────┴──────────────────┴──────────────────┘')
    console.log()

    console.log('╔═══════════════════════════════════════════════════════════════════════════╗')
    console.log('║  報告生成完成！                                                            ║')
    console.log('║  您可以將此報告與 OKX 網頁上的資料進行對比                                 ║')
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝')

  } catch (error) {
    console.error('\n❌ 報告生成失敗:')
    if (error instanceof Error) {
      console.error(`錯誤訊息: ${error.message}`)
      console.error(`錯誤堆疊:\n${error.stack}`)
    } else {
      console.error(error)
    }
    process.exit(1)
  }
}

// 執行報告生成
generateFundingRateReport().catch((error) => {
  console.error('報告生成失敗:', error)
  process.exit(1)
})
