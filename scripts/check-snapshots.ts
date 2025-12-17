import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const user = await prisma.user.findFirst();
  console.log('User:', user?.email);
  console.log('User ID:', user?.id);

  const latestSnapshot = await prisma.assetSnapshot.findFirst({
    where: { userId: user?.id },
    orderBy: { recordedAt: 'desc' },
  });

  if (latestSnapshot) {
    console.log('\nLatest Snapshot:');
    console.log('  Recorded At:', latestSnapshot.recordedAt);
    console.log('  Total Balance USD:', latestSnapshot.totalBalanceUSD);
    console.log('  Binance:', latestSnapshot.binanceBalanceUSD, `(${latestSnapshot.binanceStatus})`);
    console.log('  OKX:', latestSnapshot.okxBalanceUSD, `(${latestSnapshot.okxStatus})`);
    console.log('  MEXC:', latestSnapshot.mexcBalanceUSD, `(${latestSnapshot.mexcStatus})`);
    console.log('  Gate.io:', latestSnapshot.gateioBalanceUSD, `(${latestSnapshot.gateioStatus})`);
  } else {
    console.log('\nNo snapshots found for this user');
  }

  await prisma.$disconnect();
}

check();
