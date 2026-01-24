-- Migration: add_admin_fields
-- Description: 新增用戶角色和啟用狀態欄位 (Feature 068)
-- Created: 2026-01-23

-- CreateEnum (冪等)
DO $$ BEGIN
    CREATE TYPE "user_role" AS ENUM ('USER', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable: Add role and isActive columns
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "user_role" NOT NULL DEFAULT 'USER';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex (冪等)
CREATE INDEX IF NOT EXISTS "users_isActive_idx" ON "users"("isActive");
