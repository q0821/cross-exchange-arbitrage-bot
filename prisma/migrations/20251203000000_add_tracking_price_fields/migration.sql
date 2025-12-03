-- Feature 029: Add price tracking fields for fixed position quantity mode
-- AlterTable (skip if column already exists)
ALTER TABLE "simulated_trackings" ADD COLUMN IF NOT EXISTS "initialLongPrice" DECIMAL(18,8);
ALTER TABLE "simulated_trackings" ADD COLUMN IF NOT EXISTS "initialShortPrice" DECIMAL(18,8);
ALTER TABLE "simulated_trackings" ADD COLUMN IF NOT EXISTS "positionQuantity" DECIMAL(18,8);
ALTER TABLE "simulated_trackings" ADD COLUMN IF NOT EXISTS "exitLongPrice" DECIMAL(18,8);
ALTER TABLE "simulated_trackings" ADD COLUMN IF NOT EXISTS "exitShortPrice" DECIMAL(18,8);
ALTER TABLE "simulated_trackings" ADD COLUMN IF NOT EXISTS "pricePnl" DECIMAL(18,8);
ALTER TABLE "simulated_trackings" ADD COLUMN IF NOT EXISTS "fundingPnl" DECIMAL(18,8);
ALTER TABLE "simulated_trackings" ADD COLUMN IF NOT EXISTS "totalPnl" DECIMAL(18,8);
