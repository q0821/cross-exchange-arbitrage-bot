#!/usr/bin/env tsx
/**
 * OKX API 簡易測試腳本
 * 測試與 OKX 測試網的基本連接和資金費率查詢
 *
 * Date: 2025-10-22
 */

import { createCcxtExchange } from '../../src/lib/ccxt-factory'

async function testOKXConnection() {
  console.log('=== OKX 正式網 API 測試 ===\n')

  // 1. 測試 CCXT 連接
  console.log('📡 測試 1: CCXT 基本連接')
  console.log('─'.repeat(60))


  const okx = createCcxtExchange('okx', {
    apiKey: process.env.OKX_API_KEY || '',
    secret: process.env.OKX_API_SECRET || '',
    password: process.env.OKX_API_PASSWORD || '',
    enableRateLimit: true,
    options: {
      defaultType: 'swap',
      sandboxMode: false, // 使用正式網
    },
  })

  try {
    // 測試市場資料載入
    console.log('正在載入市場資料...')
    await okx.loadMarkets()
    console.log(`✅ 成功載入 ${Object.keys(okx.markets).length} 個市場\n`)

    // 2. 測試單一交易對的資金費率
    console.log('📊 測試 2: 查詢 BTCUSDT 永續合約資金費率')
    console.log('─'.repeat(60))

    const symbol = 'BTC/USDT:USDT'
    console.log(`交易對: ${symbol}`)

    // 2.1 使用 fetchFundingRate
    try {
      console.log('\n方法 1: fetchFundingRate()')
      const fundingRate = await okx.fetchFundingRate(symbol)

      console.log('回應資料:')
      console.log(JSON.stringify(fundingRate, null, 2))

      console.log('\n解析結果:')
      console.log(`  資金費率: ${fundingRate.fundingRate}`)
      console.log(`  下次收費時間: ${fundingRate.fundingTimestamp ? new Date(fundingRate.fundingTimestamp).toLocaleString('zh-TW') : 'N/A'}`)
      console.log(`  標記價格: ${fundingRate.markPrice || 'N/A'}`)
      console.log(`  指數價格: ${fundingRate.indexPrice || 'N/A'}`)
    } catch (error) {
      console.error('❌ fetchFundingRate 失敗:', error instanceof Error ? error.message : String(error))
    }

    // 2.2 使用 fetchFundingRates
    try {
      console.log('\n方法 2: fetchFundingRates()')
      const fundingRates = await okx.fetchFundingRates([symbol])

      console.log('回應資料:')
      console.log(JSON.stringify(fundingRates, null, 2))

      if (fundingRates[symbol]) {
        const rate = fundingRates[symbol]
        console.log('\n解析結果:')
        console.log(`  資金費率: ${rate.fundingRate}`)
        console.log(`  下次收費時間: ${rate.fundingTimestamp ? new Date(rate.fundingTimestamp).toLocaleString('zh-TW') : 'N/A'}`)
      }
    } catch (error) {
      console.error('❌ fetchFundingRates 失敗:', error instanceof Error ? error.message : String(error))
    }

    // 3. 測試多個交易對
    console.log('\n📈 測試 3: 查詢多個交易對')
    console.log('─'.repeat(60))

    const symbols = ['BTC/USDT:USDT', 'ETH/USDT:USDT', 'SOL/USDT:USDT']
    console.log(`交易對: ${symbols.join(', ')}\n`)

    for (const sym of symbols) {
      try {
        const rate = await okx.fetchFundingRate(sym)
        const fundingRate = rate.fundingRate || 0
        const percentage = (fundingRate * 100).toFixed(4)
        const nextTime = rate.fundingTimestamp
          ? new Date(rate.fundingTimestamp).toLocaleString('zh-TW', {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })
          : 'N/A'

        console.log(`${sym.padEnd(20)} | 費率: ${percentage.padStart(8)}% | 下次: ${nextTime}`)
      } catch (error) {
        console.log(`${sym.padEnd(20)} | ❌ 查詢失敗: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    // 4. 測試原始 API 呼叫
    console.log('\n🔧 測試 4: 直接呼叫 OKX REST API')
    console.log('─'.repeat(60))

    try {
      // OKX 原始 API: GET /api/v5/public/funding-rate
      const response = await fetch('https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()
      console.log('原始 API 回應:')
      console.log(JSON.stringify(data, null, 2))

      if (data.code === '0' && data.data && data.data.length > 0) {
        const fundingData = data.data[0]
        console.log('\n解析結果:')
        console.log(`  合約: ${fundingData.instId}`)
        console.log(`  資金費率: ${fundingData.fundingRate}`)
        console.log(`  下次費率: ${fundingData.nextFundingRate || 'N/A'}`)
        console.log(`  下次收費時間: ${fundingData.fundingTime ? new Date(parseInt(fundingData.fundingTime)).toLocaleString('zh-TW') : 'N/A'}`)
        console.log(`  下次收費時間: ${fundingData.nextFundingTime ? new Date(parseInt(fundingData.nextFundingTime)).toLocaleString('zh-TW') : 'N/A'}`)
      }
    } catch (error) {
      console.error('❌ 原始 API 呼叫失敗:', error instanceof Error ? error.message : String(error))
    }

    console.log('\n' + '='.repeat(60))
    console.log('✅ 測試完成')
    console.log('='.repeat(60))

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
testOKXConnection().catch((error) => {
  console.error('測試執行失敗:', error)
  process.exit(1)
})
