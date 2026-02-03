-- Feature 070: 統一持倉 groupId 架構
-- 此 migration 將 groupId 從可選改為必填，並為現有 null 資料補上 UUID

-- Step 1: 為現有 null groupId 的持倉生成獨立 UUID
-- 每個 null groupId 持倉都會獲得自己的 UUID（作為獨立的 group）
UPDATE positions
SET "groupId" = gen_random_uuid()
WHERE "groupId" IS NULL;

-- Step 2: 加上 NOT NULL 約束
ALTER TABLE positions ALTER COLUMN "groupId" SET NOT NULL;

-- Step 3: 設定預設值（新建持倉自動生成 UUID）
ALTER TABLE positions ALTER COLUMN "groupId" SET DEFAULT gen_random_uuid();
