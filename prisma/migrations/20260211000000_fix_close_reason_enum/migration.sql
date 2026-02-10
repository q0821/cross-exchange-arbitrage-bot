-- Fix: 重建 close_reason enum type 和 closeReason column
--
-- 背景：
-- 1. Migration 20251226000001 建立了 "CloseReason" enum type
-- 2. Migration 20260118000000 的清理腳本誤刪了 "CloseReason" (DROP TYPE CASCADE)
-- 3. CASCADE 同時移除了 positions.closeReason column
-- 4. Prisma schema 使用 @@map("close_reason") 映射，期望 DB 中存在 "close_reason" type
--
-- 此 migration 會：
-- 1. 建立 close_reason enum type（使用 @@map 名稱，包含所有當前值）
-- 2. 重新新增 positions.closeReason column

-- Step 1: 建立 close_reason enum type（如果不存在）
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

-- Step 2: 新增 closeReason column（如果不存在）
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "closeReason" "close_reason";
