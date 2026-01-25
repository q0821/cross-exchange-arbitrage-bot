/**
 * Test OKX position opening and closing
 */

import { PrismaClient } from '@/generated/prisma/client';
import { decrypt } from '../src/lib/encryption';
import { createCcxtExchange } from '../src/lib/ccxt-factory';

const prisma = new PrismaClient();

async function main() {
  const testEmail = 'q0821yeh1@gmail.com';
  const testSymbol = 'DOGE/USDT:USDT'; // Use a liquid symbol
  const testQuantity = 10; // Small quantity for testing
  const testLeverage = 1;

  console.log(`Testing OKX position with user: ${testEmail}\n`);

  // Get user
  const user = await prisma.user.findFirst({
    where: { email: testEmail },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Get OKX API key
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      userId: user.id,
      exchange: 'okx',
      isActive: true,
    },
  });

  if (!apiKey) {
    throw new Error('OKX API key not found');
  }

  // Decrypt credentials
  const decryptedKey = decrypt(apiKey.encryptedKey);
  const decryptedSecret = decrypt(apiKey.encryptedSecret);
  const decryptedPassphrase = apiKey.encryptedPassphrase
    ? decrypt(apiKey.encryptedPassphrase)
    : undefined;

  console.log('API Key found, creating CCXT exchange instance...\n');


  const exchange = createCcxtExchange('okx', {
    apiKey: decryptedKey,
    secret: decryptedSecret,
    password: decryptedPassphrase,
    sandbox: false,
    enableRateLimit: true,
    timeout: 30000,
    options: {
      defaultType: 'swap',
    },
  });

  try {
    // Check account configuration
    console.log('=== Checking OKX Account Configuration ===\n');

    // Fetch account config
    const accountConfig = await exchange.privateGetAccountConfig();
    console.log('Account Config:', JSON.stringify(accountConfig, null, 2));

    // Check position mode
    console.log('\n=== Checking Position Mode ===\n');
    const positions = await exchange.fetchPositions([testSymbol.replace('/USDT:USDT', '-USDT-SWAP')]);
    console.log('Current positions:', positions.length > 0 ? positions : 'No positions');

    // Get current price
    const ticker = await exchange.fetchTicker(testSymbol);
    console.log(`\nCurrent ${testSymbol} price: ${ticker.last}`);

    // Try to set leverage
    console.log('\n=== Setting Leverage ===\n');
    try {
      await exchange.setLeverage(testLeverage, testSymbol);
      console.log(`Leverage set to ${testLeverage}x`);
    } catch (e: any) {
      console.log('Set leverage warning:', e.message);
    }

    // Test opening a LONG position (buy)
    console.log('\n=== Testing Open Long Position ===\n');
    console.log(`  Symbol: ${testSymbol}`);
    console.log(`  Side: buy (LONG)`);
    console.log(`  Quantity: ${testQuantity}`);
    console.log(`  Leverage: ${testLeverage}x`);

    // Try different parameter combinations
    const testParams = [
      { name: 'Default (no extra params)', params: {} },
      { name: 'With posSide long', params: { posSide: 'long' } },
      { name: 'With tdMode cross', params: { tdMode: 'cross' } },
      { name: 'With both', params: { posSide: 'long', tdMode: 'cross' } },
    ];

    for (const test of testParams) {
      console.log(`\nTrying: ${test.name}`);
      console.log(`Params: ${JSON.stringify(test.params)}`);

      try {
        const order = await exchange.createMarketOrder(
          testSymbol,
          'buy',
          testQuantity,
          undefined,
          test.params
        );

        console.log('✅ Order created successfully!');
        console.log('Order ID:', order.id);
        console.log('Price:', order.average || order.price);
        console.log('Filled:', order.filled);

        // If order succeeded, try to close it
        console.log('\n=== Closing the position ===\n');

        // For OKX, closing depends on position mode
        const closeParams = test.params.posSide
          ? { posSide: 'long', reduceOnly: true }
          : { reduceOnly: true };

        console.log(`Close params: ${JSON.stringify(closeParams)}`);

        const closeOrder = await exchange.createMarketOrder(
          testSymbol,
          'sell',
          testQuantity,
          undefined,
          closeParams
        );

        console.log('✅ Position closed successfully!');
        console.log('Close Order ID:', closeOrder.id);
        console.log('Close Price:', closeOrder.average || closeOrder.price);

        break; // Success, no need to try other params
      } catch (e: any) {
        console.log('❌ Error:', e.message);
      }
    }

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    if (error.message.includes('position')) {
      console.log('\nThis might be a position mode issue. Checking account mode...');
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
