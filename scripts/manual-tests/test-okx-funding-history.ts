#!/usr/bin/env tsx
/**
 * OKX 資金費率歷史查詢測試
 * 對比 API 回傳的即時費率 vs 歷史費率記錄
 *
 * Date: 2025-10-22
 */

import ccxt from 'ccxt'

async function testOKXFundingHistory() {
  console.log('=== OKX 資金費率對比測試 ===\n')

  const okx = new ccxt.okx({
    enableRateLimit: true,
    options: {
      defaultType: 'swap',
      sandboxMode: false, // 正式網
    },
  })

  try {
    await okx.loadMarkets()
    const symbol = 'BTC/USDT:USDT'

    // 1. 查詢當前資金費率（即將收取的費率）
    console.log('📊 測試 1: 當前資金費率')
    console.log('─'.repeat(80))

    const currentRate = await okx.fetchFundingRate(symbol)

    console.log('當前資金費率資訊:')
    console.log(`  交易對: ${currentRate.symbol}`)
    console.log(`  當前費率 (fundingRate): ${currentRate.fundingRate}`)
    console.log(`  當前費率 (百分比): ${currentRate.fundingRate ? (currentRate.fundingRate * 100).toFixed(6) : 'N/A'}%`)
    console.log(`  下次收費時間: ${currentRate.fundingTimestamp ? new Date(currentRate.fundingTimestamp).toLocaleString('zh-TW') : 'N/A'}`)
    console.log(`  下下次收費時間: ${(currentRate as any).nextFundingTimestamp ? new Date((currentRate as any).nextFundingTimestamp).toLocaleString('zh-TW') : 'N/A'}`)

    console.log('\n原始 info 物件:')
    console.log(JSON.stringify((currentRate as any).info, null, 2))

    // 2. 查詢歷史資金費率（已收取的費率）
    console.log('\n\n📈 測試 2: 歷史資金費率')
    console.log('─'.repeat(80))

    try {
      const history = await (okx as any).fetchFundingRateHistory(symbol, undefined, 20)

      console.log(`查詢到 ${history.length} 筆歷史記錄:\n`)

      console.log('日期時間'.padEnd(25) + '資金費率'.padStart(15) + '百分比'.padStart(12))
      console.log('─'.repeat(80))

      for (const record of history) {
        const date = new Date(record.timestamp).toLocaleString('zh-TW', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
        const rate = record.fundingRate
        const percentage = (rate * 100).toFixed(6) + '%'

        console.log(date.padEnd(25) + rate.toString().padStart(15) + percentage.padStart(12))
      }

      // 統計分析
      const rates = history.map(r => r.fundingRate)
      const avg = rates.reduce((a, b) => a + b, 0) / rates.length
      const max = Math.max(...rates)
      const min = Math.min(...rates)

      console.log('\n統計摘要:')
      console.log(`  平均費率: ${(avg * 100).toFixed(6)}%`)
      console.log(`  最高費率: ${(max * 100).toFixed(6)}%`)
      console.log(`  最低費率: ${(min * 100).toFixed(6)}%`)
      console.log(`  費率範圍: ${(min * 100).toFixed(6)}% ~ ${(max * 100).toFixed(6)}%`)

    } catch (error) {
      console.error('❌ fetchFundingRateHistory 失敗:', error instanceof Error ? error.message : String(error))
      console.log('\n嘗試使用原始 API 查詢歷史費率...')

      // 使用原始 API
      const response = await fetch('https://www.okx.com/api/v5/public/funding-rate-history?instId=BTC-USDT-SWAP&limit=20', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (data.code === '0' && data.data) {
        console.log(`\n✅ 原始 API 查詢到 ${data.data.length} 筆歷史記錄:\n`)

        console.log('日期時間'.padEnd(25) + '資金費率'.padStart(15) + '百分比'.padStart(12) + '已結算費率'.padStart(15))
        console.log('─'.repeat(80))

        for (const record of data.data) {
          const date = new Date(parseInt(record.fundingTime)).toLocaleString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
          const rate = parseFloat(record.fundingRate)
          const realizedRate = parseFloat(record.realizedRate || record.settFundingRate || '0')
          const percentage = (rate * 100).toFixed(6) + '%'
          const realizedPercentage = (realizedRate * 100).toFixed(6) + '%'

          console.log(date.padEnd(25) + rate.toFixed(16).padStart(15) + percentage.padStart(12) + realizedPercentage.padStart(15))
        }

        console.log('\n⚠️  注意: fundingRate 和 realizedRate (已結算費率) 可能不同')
        console.log('原始回應資料範例:')
        console.log(JSON.stringify(data.data[0], null, 2))
      }
    }

    // 3. 直接查詢當前費率的原始 API
    console.log('\n\n🔧 測試 3: 原始 API - 當前費率')
    console.log('─'.repeat(80))

    const currentResponse = await fetch('https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const currentData = await currentResponse.json()

    if (currentData.code === '0' && currentData.data && currentData.data.length > 0) {
      const fundingData = currentData.data[0]

      console.log('原始 API 回應:')
      console.log(JSON.stringify(fundingData, null, 2))

      console.log('\n解析結果:')
      console.log(`  fundingRate (當前預測費率): ${fundingData.fundingRate} = ${(parseFloat(fundingData.fundingRate) * 100).toFixed(6)}%`)
      console.log(`  nextFundingRate (下次預測費率): ${fundingData.nextFundingRate || 'N/A'}`)
      console.log(`  settFundingRate (上次已結算費率): ${fundingData.settFundingRate} = ${(parseFloat(fundingData.settFundingRate) * 100).toFixed(6)}%`)
      console.log(`  fundingTime (當前費率收費時間): ${new Date(parseInt(fundingData.fundingTime)).toLocaleString('zh-TW')}`)
      console.log(`  nextFundingTime (下次費率收費時間): ${new Date(parseInt(fundingData.nextFundingTime)).toLocaleString('zh-TW')}`)
    }

    console.log('\n' + '='.repeat(80))
    console.log('✅ 測試完成')
    console.log('='.repeat(80))

  } catch (error) {
    console.error('\n❌ 測試過程發生錯誤:')
    if (error instanceof Error) {
      console.error(`錯誤訊息: ${error.message}`)
      console.error(`錯誤堆疊:\n${error.stack}`)
    } else {
      console.error(error)
    }
    process.exit(1)
  }
}

// 執行測試
testOKXFundingHistory().catch((error) => {
  console.error('測試執行失敗:', error)
  process.exit(1)
})
