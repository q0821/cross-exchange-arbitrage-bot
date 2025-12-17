import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const user = await prisma.user.findFirst();
  console.log('User:', user?.email);
  console.log('User ID:', user?.id);

  const apiKeys = await prisma.apiKey.findMany({
    where: { userId: user?.id },
    select: { id: true, exchange: true, isActive: true, createdAt: true }
  });
  console.log('\nAPI Keys:', JSON.stringify(apiKeys, null, 2));
  await prisma.$disconnect();
}

check();
