import { PrismaClient } from '@/generated/prisma/client'
import { logger } from './src/lib/logger'

const prisma = new PrismaClient()

async function testConnection() {
  try {
    logger.info('測試資料庫連線...')

    // 測試連線
    await prisma.$connect()
    logger.info('✓ 成功連接到資料庫')

    // 測試查詢
    const result = await prisma.$queryRaw`SELECT NOW() as current_time, version() as postgres_version`
    logger.info('✓ 資料庫查詢成功', result)

    // 檢查 TimescaleDB 擴展
    const timescaleCheck = await prisma.$queryRaw`
      SELECT extname, extversion
      FROM pg_extension
      WHERE extname = 'timescaledb'
    `
    logger.info('✓ TimescaleDB 狀態', timescaleCheck)

    // 檢查所有表格
    const tables = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `
    logger.info('✓ 資料庫表格', tables)

    logger.info('✅ 資料庫連線測試全部通過！')
  } catch (error) {
    logger.error('❌ 資料庫連線測試失敗', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()
  .then(() => {
    logger.info('測試完成')
    process.exit(0)
  })
  .catch((error) => {
    logger.error('測試失敗', error)
    process.exit(1)
  })
