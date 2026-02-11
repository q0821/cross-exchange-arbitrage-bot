-- Fix: 修正 closeReason 欄位的 enum 類型不匹配
--
-- 背景：
-- Production 資料庫中 positions.closeReason 欄位的類型仍是 "CloseReason"（大寫）
-- 但 Prisma schema 的 @@map("close_reason") 讓 Prisma 產生使用 "close_reason"（小寫）的 SQL
-- 導致 PostgreSQL 報錯：column "closeReason" is of type "CloseReason" but expression is of type close_reason
--
-- 此 migration 會：
-- 1. 確保 "close_reason" enum type 存在（小寫，含所有值）
-- 2. 如果欄位使用舊的 "CloseReason" 類型，轉換為 "close_reason"
-- 3. 清理舊的 "CloseReason" type

-- Step 1: 確保 "close_reason" enum type 存在
DO $$ BEGIN
    CREATE TYPE "close_reason" AS ENUM (
        'MANUAL',
        'LONG_SL_TRIGGERED',
        'LONG_TP_TRIGGERED',
        'SHORT_SL_TRIGGERED',
        'SHORT_TP_TRIGGERED',
        'BOTH_TRIGGERED',
        'UNCONFIRMED_TRIGGER',
        'BATCH_CLOSE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 2: 如果欄位使用舊的 "CloseReason" 類型，轉換為 "close_reason"
DO $$ BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'positions'
          AND column_name = 'closeReason'
          AND udt_name = 'CloseReason'
    ) THEN
        ALTER TABLE "positions"
            ALTER COLUMN "closeReason" TYPE "close_reason"
            USING "closeReason"::text::"close_reason";
    END IF;
END $$;

-- Step 3: 如果欄位不存在（被 CASCADE 刪除），重新建立
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "closeReason" "close_reason";

-- Step 4: 清理舊的 "CloseReason" enum type（如果還存在）
DROP TYPE IF EXISTS "CloseReason";
