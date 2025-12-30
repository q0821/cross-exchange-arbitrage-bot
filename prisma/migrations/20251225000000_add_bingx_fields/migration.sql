-- Feature 043: BingX 整合 - 新增 AssetSnapshot BingX 欄位

-- 新增 bingxBalanceUSD 欄位
ALTER TABLE "asset_snapshots" ADD COLUMN IF NOT EXISTS "bingxBalanceUSD" DECIMAL(18, 8);

-- 新增 bingxStatus 欄位
ALTER TABLE "asset_snapshots" ADD COLUMN IF NOT EXISTS "bingxStatus" VARCHAR(50);
