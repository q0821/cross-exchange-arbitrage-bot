/**
 * 診斷腳本：分析 Node.js Heap 記憶體使用
 *
 * 用法：
 * 1. 在生產環境運行（需要服務正在運行）
 * 2. 使用 node --inspect 啟動服務並連接 Chrome DevTools
 */

import v8 from 'v8';

console.log('=== Node.js 記憶體分析 ===\n');

// 1. 基礎記憶體資訊
const mem = process.memoryUsage();
console.log('1. process.memoryUsage():');
console.log(`   RSS: ${(mem.rss / 1024 / 1024).toFixed(2)} MB`);
console.log(`   Heap Total: ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`);
console.log(`   Heap Used: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
console.log(`   External: ${(mem.external / 1024 / 1024).toFixed(2)} MB`);
console.log(`   Array Buffers: ${(mem.arrayBuffers / 1024 / 1024).toFixed(2)} MB`);

// 2. V8 Heap 統計
console.log('\n2. v8.getHeapStatistics():');
const heapStats = v8.getHeapStatistics();
console.log(`   Total Heap Size: ${(heapStats.total_heap_size / 1024 / 1024).toFixed(2)} MB`);
console.log(`   Total Heap Size Executable: ${(heapStats.total_heap_size_executable / 1024 / 1024).toFixed(2)} MB`);
console.log(`   Total Physical Size: ${(heapStats.total_physical_size / 1024 / 1024).toFixed(2)} MB`);
console.log(`   Total Available Size: ${(heapStats.total_available_size / 1024 / 1024).toFixed(2)} MB`);
console.log(`   Used Heap Size: ${(heapStats.used_heap_size / 1024 / 1024).toFixed(2)} MB`);
console.log(`   Heap Size Limit: ${(heapStats.heap_size_limit / 1024 / 1024).toFixed(2)} MB`);
console.log(`   Malloced Memory: ${(heapStats.malloced_memory / 1024 / 1024).toFixed(2)} MB`);
console.log(`   Peak Malloced Memory: ${(heapStats.peak_malloced_memory / 1024 / 1024).toFixed(2)} MB`);
console.log(`   External Memory: ${(heapStats.external_memory / 1024 / 1024).toFixed(2)} MB`);

// 3. V8 Heap 空間統計
console.log('\n3. v8.getHeapSpaceStatistics():');
const spaceStats = v8.getHeapSpaceStatistics();
for (const space of spaceStats) {
  console.log(`   ${space.space_name}:`);
  console.log(`     Size: ${(space.space_size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`     Used: ${(space.space_used_size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`     Available: ${(space.space_available_size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`     Physical: ${(space.physical_space_size / 1024 / 1024).toFixed(2)} MB`);
}

// 4. 建議
console.log('\n=== 診斷建議 ===');
console.log('- 若要深入分析，請使用 Chrome DevTools Memory Profiler');
console.log('- 啟動服務時加上 --inspect 參數：');
console.log('  pnpm tsx --inspect server.ts');
console.log('- 然後在 Chrome 打開 chrome://inspect 連接');
