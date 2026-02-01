/**
 * 診斷腳本：檢查 DataStructureRegistry 中的服務註冊狀態
 */

import { DataStructureRegistry, initializeSingletonGetters } from '@/lib/data-structure-registry';
import { isMonitorable } from '@/types/memory-stats';
import { ConnectionPoolManager } from '@/services/websocket/ConnectionPoolManager';

console.log('=== DataStructureRegistry 診斷 ===\n');

// 1. 檢查 ConnectionPoolManager 是否實作 Monitorable
console.log('1. ConnectionPoolManager 檢查:');
console.log('   - isMonitorable:', isMonitorable(ConnectionPoolManager));
console.log('   - getPoolCount:', ConnectionPoolManager.getPoolCount());

try {
  const stats = ConnectionPoolManager.getDataStructureStats();
  console.log('   - getDataStructureStats:', JSON.stringify(stats, null, 2));
} catch (error) {
  console.log('   - getDataStructureStats ERROR:', error);
}

// 2. 初始化 singleton getters
console.log('\n2. 初始化 singleton getters...');
initializeSingletonGetters();

// 3. 檢查所有已註冊的服務統計
console.log('\n3. getAllStats():');
const allStats = DataStructureRegistry.getAllStats();
console.log('   - 服務數量:', allStats.length);
allStats.forEach((stat, index) => {
  console.log(`   [${index}] ${stat.name}: totalItems=${stat.totalItems}, eventListenerCount=${stat.eventListenerCount ?? 'N/A'}`);
});

// 4. 檢查 registry 內部狀態
console.log('\n4. Registry 狀態:');
console.log('   - 已註冊服務總數:', DataStructureRegistry.getRegisteredCount());

console.log('\n=== 診斷完成 ===');
