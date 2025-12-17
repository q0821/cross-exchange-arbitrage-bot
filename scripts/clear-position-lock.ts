/**
 * 清除持倉鎖定
 */

import Redis from 'ioredis';

async function clearLock() {
  const userId = process.argv[2];
  const symbol = process.argv[3];

  if (!userId || !symbol) {
    console.log('Usage: pnpm tsx scripts/clear-position-lock.ts <userId> <symbol>');
    console.log('Example: pnpm tsx scripts/clear-position-lock.ts cmij3rmw10000ixyp487f2axg FOLKSUSDT');
    process.exit(1);
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const client = new Redis(redisUrl);

  console.log('Connected to Redis');

  const lockKey = `position:open:${userId}:${symbol}`;
  console.log(`Looking for lock: ${lockKey}`);

  const value = await client.get(lockKey);
  if (value) {
    console.log(`Found lock with value: ${value}`);
    await client.del(lockKey);
    console.log('✅ Lock cleared successfully');
  } else {
    console.log('No lock found');
  }

  // Also check for close lock
  const closeLockKey = `position:close:${userId}:${symbol}`;
  const closeValue = await client.get(closeLockKey);
  if (closeValue) {
    console.log(`Found close lock with value: ${closeValue}`);
    await client.del(closeLockKey);
    console.log('✅ Close lock cleared successfully');
  }

  await client.quit();
}

clearLock().catch(console.error);
