#!/usr/bin/env tsx
/**
 * 清理測試資料
 */

import { PrismaClient } from '@/generated/prisma/client'

async function main() {
  const prisma = new PrismaClient()

  try {
    console.log('清理測試資料...\n')

    // 刪除通知記錄
    const deletedNotifications = await prisma.notificationLog.deleteMany({})
    console.log(`✅ 刪除通知記錄: ${deletedNotifications.count} 筆`)

    // 刪除套利機會記錄
    const deletedOpportunities = await prisma.arbitrageOpportunity.deleteMany({})
    console.log(`✅ 刪除套利機會記錄: ${deletedOpportunities.count} 筆`)

    console.log('\n清理完成!')
  } catch (error) {
    console.error('清理失敗:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
