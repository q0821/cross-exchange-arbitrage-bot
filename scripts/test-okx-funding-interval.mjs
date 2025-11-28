#!/usr/bin/env node

/**
 * OKX Funding Interval Diagnostic Tool
 * Feature: 024-fix-okx-funding-normalization (User Story 5)
 *
 * Compares CCXT and Native API interval detection results
 * Usage: node scripts/test-okx-funding-interval.mjs
 */

import ccxt from 'ccxt';
import axios from 'axios';

// T080: Define TEST_SYMBOLS array
const TEST_SYMBOLS = [
  'BTC-USDT-SWAP',
  'ETH-USDT-SWAP',
  'SOL-USDT-SWAP',
  'BNB-USDT-SWAP',
  'XRP-USDT-SWAP',
  'ADA-USDT-SWAP',
  'DOGE-USDT-SWAP',
  'LTC-USDT-SWAP',
  'DOT-USDT-SWAP',
  'AVAX-USDT-SWAP',
];

// T086: Add batch delay to avoid rate limiting
const BATCH_DELAY_MS = 200;

/**
 * T081: Test interval detection via CCXT
 */
async function testCCXT(symbol) {
  try {
    const exchange = new ccxt.okx({
      enableRateLimit: true,
      options: { defaultType: 'swap' },
    });

    const ccxtSymbol = symbol.replace('-SWAP', '').replace('-', '/') + ':USDT';
    const fundingRate = await exchange.fetchFundingRate(ccxtSymbol);

    const info = fundingRate.info;
    const fundingTime = parseInt(info?.fundingTime, 10);
    const nextFundingTime = parseInt(info?.nextFundingTime, 10);

    if (!fundingTime || !nextFundingTime || isNaN(fundingTime) || isNaN(nextFundingTime)) {
      return { success: false, error: 'Missing or invalid timestamps', interval: null };
    }

    const intervalHours = Math.round((nextFundingTime - fundingTime) / (60 * 60 * 1000));

    return {
      success: true,
      interval: intervalHours,
      fundingTime: new Date(fundingTime).toISOString(),
      nextFundingTime: new Date(nextFundingTime).toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      interval: null,
    };
  }
}

/**
 * T082: Test interval detection via OKX Native API
 */
async function testNativeAPI(symbol) {
  try {
    const response = await axios.get('https://www.okx.com/api/v5/public/funding-rate', {
      params: { instId: symbol },
      timeout: 5000,
    });

    const data = response.data;

    if (data.code !== '0' || !Array.isArray(data.data) || data.data.length === 0) {
      return {
        success: false,
        error: `API Error: ${data.msg || 'Invalid response'}`,
        interval: null,
      };
    }

    const rateData = data.data[0];
    const fundingTime = parseInt(rateData.fundingTime, 10);
    const nextFundingTime = parseInt(rateData.nextFundingTime, 10);

    if (isNaN(fundingTime) || isNaN(nextFundingTime)) {
      return {
        success: false,
        error: 'Invalid timestamps in response',
        interval: null,
      };
    }

    const intervalHours = Math.round((nextFundingTime - fundingTime) / (60 * 60 * 1000));

    return {
      success: true,
      interval: intervalHours,
      fundingTime: new Date(fundingTime).toISOString(),
      nextFundingTime: new Date(nextFundingTime).toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      interval: null,
    };
  }
}

/**
 * T083: Main diagnostic function
 */
async function runDiagnostic() {
  console.log('\n=== OKX Funding Interval Diagnostic Tool ===\n');
  console.log(`Testing ${TEST_SYMBOLS.length} symbols...\n`);

  const results = [];
  const startTime = Date.now();

  for (const symbol of TEST_SYMBOLS) {
    console.log(`Testing ${symbol}...`);

    // Test both methods
    const ccxtResult = await testCCXT(symbol);
    await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));

    const nativeResult = await testNativeAPI(symbol);
    await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));

    // Calculate match and deviation
    const match = ccxtResult.success && nativeResult.success &&
                 ccxtResult.interval === nativeResult.interval;

    const deviation = ccxtResult.success && nativeResult.success
      ? Math.abs(ccxtResult.interval - nativeResult.interval)
      : null;

    results.push({
      symbol,
      ccxt: ccxtResult,
      native: nativeResult,
      match,
      deviation,
    });
  }

  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

  // T084: Format output as comparison table
  console.log('\n=== Results ===\n');
  console.log('Symbol'.padEnd(20) +
              'CCXT'.padEnd(10) +
              'Native'.padEnd(10) +
              'Match'.padEnd(10) +
              'Deviation');
  console.log('-'.repeat(60));

  for (const result of results) {
    const symbol = result.symbol.padEnd(20);
    const ccxt = result.ccxt.success ? `${result.ccxt.interval}h` : 'ERROR';
    const native = result.native.success ? `${result.native.interval}h` : 'ERROR';
    const match = result.match ? '✓' : '✗';
    const deviation = result.deviation !== null ? `${result.deviation}h` : 'N/A';

    console.log(`${symbol}${ccxt.padEnd(10)}${native.padEnd(10)}${match.padEnd(10)}${deviation}`);
  }

  // T085: Add summary statistics
  console.log('\n=== Summary ===\n');
  const total = results.length;
  const matched = results.filter(r => r.match).length;
  const mismatched = results.filter(r => !r.match && r.ccxt.success && r.native.success).length;
  const ccxtErrors = results.filter(r => !r.ccxt.success).length;
  const nativeErrors = results.filter(r => !r.native.success).length;

  console.log(`Total Symbols:        ${total}`);
  console.log(`Matched:              ${matched} (${((matched / total) * 100).toFixed(1)}%)`);
  console.log(`Mismatched:           ${mismatched}`);
  console.log(`CCXT Errors:          ${ccxtErrors}`);
  console.log(`Native API Errors:    ${nativeErrors}`);
  console.log(`Elapsed Time:         ${elapsedTime}s`);

  // T088: Verify diagnostic completes in < 30 seconds
  if (parseFloat(elapsedTime) > 30) {
    console.log('\n⚠️  Warning: Diagnostic took longer than expected (>30s)');
  }

  // Show errors if any
  if (ccxtErrors > 0 || nativeErrors > 0) {
    console.log('\n=== Errors ===\n');
    for (const result of results) {
      if (!result.ccxt.success) {
        console.log(`${result.symbol} (CCXT): ${result.ccxt.error}`);
      }
      if (!result.native.success) {
        console.log(`${result.symbol} (Native): ${result.native.error}`);
      }
    }
  }

  console.log('\n=== Diagnostic Complete ===\n');

  // Exit with error code if there are mismatches or errors
  if (mismatched > 0 || ccxtErrors > 0 || nativeErrors > 0) {
    process.exit(1);
  }
}

// Run diagnostic
runDiagnostic().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
