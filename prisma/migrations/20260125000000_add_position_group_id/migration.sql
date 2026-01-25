-- Migration: add_position_group_id
-- Description: 新增分單開倉組別 ID 欄位 (Feature 069)
-- Created: 2026-01-25

-- AlterTable: Add groupId column (冪等)
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "groupId" UUID;

-- CreateIndex (冪等)
CREATE INDEX IF NOT EXISTS "positions_groupId_idx" ON "positions"("groupId");
