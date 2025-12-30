-- Feature 050: 停損停利觸發偵測 - 新增 CloseReason enum 和 Position.closeReason 欄位

-- 建立 CloseReason enum（如果不存在）
DO $$ BEGIN
    CREATE TYPE "CloseReason" AS ENUM ('MANUAL', 'LONG_SL_TRIGGERED', 'LONG_TP_TRIGGERED', 'SHORT_SL_TRIGGERED', 'SHORT_TP_TRIGGERED', 'BOTH_TRIGGERED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 新增 closeReason 欄位到 positions 表
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "closeReason" "CloseReason";
