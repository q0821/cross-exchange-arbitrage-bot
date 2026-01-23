/**
 * 測試資產快照更新（透過 proxy）
 */
import { prisma } from '@/src/lib/db';
import { AssetSnapshotService } from '@/src/services/assets/AssetSnapshotService';
import { getProxyUrl } from '@lib/env';

async function testAssetSnapshot() {
  console.log('=== 測試資產快照更新 ===\n');

  // 檢查 proxy 設定
  const proxyUrl = getProxyUrl();
  console.log('Proxy 設定:', proxyUrl || '未設定', '\n');

  // 查詢第一個用戶
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log('❌ 沒有找到任何用戶');
    return;
  }
  console.log('測試用戶:', user.email, '(ID:', user.id, ')\n');

  // 初始化服務
  const service = new AssetSnapshotService(prisma);

  console.log('正在查詢即時餘額...\n');

  try {
    const result = await service.getRealtimeBalances(user.id);

    console.log('=== 結果 ===');
    console.log('總資產: $' + result.totalBalanceUSD.toFixed(2));
    console.log('更新時間:', result.lastUpdated.toISOString(), '\n');

    console.log('各交易所餘額:');
    for (const ex of result.exchanges) {
      const statusIcon = ex.status === 'success' ? '✅' :
                         ex.status === 'no_api_key' ? '⏭️' : '❌';
      console.log('  ' + statusIcon + ' ' + ex.exchange.toUpperCase());
      if (ex.status === 'success') {
        console.log('     總權益: $' + (ex.balanceUSD?.toFixed(2) || '0.00'));
        console.log('     可用餘額: $' + (ex.availableBalanceUSD?.toFixed(2) || '0.00'));
      } else if (ex.status === 'no_api_key') {
        console.log('     (未設定 API Key)');
      } else {
        console.log('     錯誤:', ex.errorMessage);
      }
    }

    console.log('\n✅ 測試完成');
  } catch (error) {
    console.error('❌ 測試失敗:', error);
  }

  await prisma.$disconnect();
}

testAssetSnapshot();
