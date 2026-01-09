/**
 * 清理 Redis 中殘留的開倉鎖
 * 使用方式: pnpm tsx scripts/clear-position-locks.ts
 */

import { createClient } from 'redis';

async function main() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  console.log(`🔌 連接到 Redis: ${redisUrl}`);

  const client = createClient({ url: redisUrl });

  client.on('error', (err) => {
    console.error('❌ Redis 連線錯誤:', err.message);
  });

  try {
    await client.connect();
    console.log('✅ Redis 連線成功');

    // 查找所有開倉鎖
    const keys = await client.keys('position:open:*');

    if (keys.length === 0) {
      console.log('✅ 沒有找到任何開倉鎖');
    } else {
      console.log(`🔍 找到 ${keys.length} 個開倉鎖:`);

      for (const key of keys) {
        const ttl = await client.ttl(key);
        const value = await client.get(key);
        console.log(`  - ${key} (TTL: ${ttl}s, value: ${value})`);
      }

      // 刪除所有鎖
      console.log('\n🗑️  正在刪除所有開倉鎖...');
      const deleted = await client.del(keys);
      console.log(`✅ 已刪除 ${deleted} 個鎖`);
    }

  } catch (error) {
    console.error('❌ 錯誤:', error);
  } finally {
    await client.disconnect();
    console.log('👋 Redis 連線已關閉');
  }
}

main();
