-- Feature 069: 分單持倉合併顯示與批量平倉
-- 新增 Position.groupId 欄位用於關聯分單開倉的持倉

-- AlterTable: 新增 groupId 欄位 (冪等)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'positions' AND column_name = 'groupId'
    ) THEN
        ALTER TABLE "positions" ADD COLUMN "groupId" UUID;
    END IF;
END $$;

-- CreateIndex: 加速組別查詢 (冪等)
CREATE INDEX IF NOT EXISTS "positions_groupId_idx" ON "positions"("groupId");
