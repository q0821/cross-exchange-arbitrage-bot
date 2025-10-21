/**
 * 測試資金費率驗證功能
 *
 * 手動測試腳本，驗證 FundingRateValidator 是否能正常工作
 * Feature: 004-fix-okx-add-price-display
 *
 * 使用方式:
 * npx tsx scripts/test-funding-rate-validation.ts
 */

import { PrismaClient } from '@prisma/client';
import { OKXConnector } from '../src/connectors/okx';
import { OkxConnectorAdapter } from '../src/adapters/OkxConnectorAdapter';
import { OkxCCXT } from '../src/lib/ccxt/OkxCCXT';
import { FundingRateValidationRepository } from '../src/repositories/FundingRateValidationRepository';
import { FundingRateValidator } from '../src/services/validation/FundingRateValidator';

async function main() {
  console.log('🚀 開始測試資金費率驗證功能...\n');

  // 1. 初始化 Prisma Client
  const prisma = new PrismaClient();
  console.log('✅ Prisma Client 已初始化');

  // 2. 初始化 OKX Connector
  const okxConnector = new OKXConnector(true); // 使用測試網
  await okxConnector.connect();
  console.log('✅ OKX Connector 已連接 (測試網)');

  // 3. 建立 Adapter
  const okxAdapter = new OkxConnectorAdapter(okxConnector);
  console.log('✅ OKX Connector Adapter 已建立');

  // 4. 初始化 CCXT
  const okxCCXT = new OkxCCXT(true); // 使用測試網
  console.log('✅ CCXT 已初始化');

  // 5. 建立 Repository
  const repository = new FundingRateValidationRepository(prisma);
  console.log('✅ Repository 已建立');

  // 6. 建立 Validator
  const validator = new FundingRateValidator(repository, okxAdapter, okxCCXT);
  console.log('✅ FundingRateValidator 已建立\n');

  // 7. 測試驗證功能
  const testSymbols = ['BTC-USDT-SWAP', 'ETH-USDT-SWAP'];

  for (const symbol of testSymbols) {
    console.log(`📊 正在驗證 ${symbol}...`);

    try {
      const result = await validator.validate(symbol);

      console.log('結果:');
      console.log(`  - 交易對: ${result.symbol}`);
      console.log(`  - OKX 費率: ${result.okxRate}`);
      console.log(`  - CCXT 費率: ${result.ccxtRate ?? 'N/A'}`);
      console.log(`  - 驗證狀態: ${result.validationStatus}`);
      console.log(`  - 差異: ${result.discrepancyPercent ? (result.discrepancyPercent * 100).toFixed(4) + '%' : 'N/A'}`);
      console.log(`  - 時間: ${result.timestamp.toISOString()}`);

      if (result.errorMessage) {
        console.log(`  - 錯誤: ${result.errorMessage}`);
      }

      console.log('');
    } catch (error) {
      console.error(`❌ 驗證失敗: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }

  // 8. 查詢最近的驗證記錄
  console.log('📋 查詢最近 5 筆驗證記錄...');
  const recentRecords = await prisma.fundingRateValidation.findMany({
    take: 5,
    orderBy: { timestamp: 'desc' },
  });

  console.log(`找到 ${recentRecords.length} 筆記錄:\n`);
  recentRecords.forEach((record, index) => {
    console.log(`${index + 1}. ${record.symbol} - ${record.validationStatus} (${record.timestamp.toISOString()})`);
  });

  // 9. 查詢驗證失敗記錄
  console.log('\n⚠️  查詢驗證失敗記錄...');
  const failures = await validator.getRecentFailures(5);
  console.log(`找到 ${failures.length} 筆失敗記錄\n`);

  // 10. 計算通過率
  for (const symbol of testSymbols) {
    const passRate = await validator.getPassRate(symbol, 1); // 最近 1 天
    console.log(`${symbol} 通過率 (最近 1 天): ${passRate.toFixed(2)}%`);
  }

  // 清理
  await okxConnector.disconnect();
  await prisma.$disconnect();

  console.log('\n✅ 測試完成！');
}

main()
  .catch((error) => {
    console.error('❌ 測試失敗:', error);
    process.exit(1);
  });
