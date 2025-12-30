-- Feature 035: Close Position - 新增 Trade 手續費欄位

-- 新增 longFee 欄位
ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "longFee" DECIMAL(18, 8) DEFAULT 0;

-- 新增 shortFee 欄位
ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "shortFee" DECIMAL(18, 8) DEFAULT 0;

-- 新增 totalFees 欄位
ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "totalFees" DECIMAL(18, 8) DEFAULT 0;
