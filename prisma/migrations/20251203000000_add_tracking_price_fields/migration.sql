-- Feature 029: Add price tracking fields for fixed position quantity mode
-- AlterTable
ALTER TABLE "simulated_trackings" ADD COLUMN "initialLongPrice" DECIMAL(18,8);
ALTER TABLE "simulated_trackings" ADD COLUMN "initialShortPrice" DECIMAL(18,8);
ALTER TABLE "simulated_trackings" ADD COLUMN "positionQuantity" DECIMAL(18,8);
ALTER TABLE "simulated_trackings" ADD COLUMN "exitLongPrice" DECIMAL(18,8);
ALTER TABLE "simulated_trackings" ADD COLUMN "exitShortPrice" DECIMAL(18,8);
ALTER TABLE "simulated_trackings" ADD COLUMN "pricePnl" DECIMAL(18,8);
ALTER TABLE "simulated_trackings" ADD COLUMN "fundingPnl" DECIMAL(18,8);
ALTER TABLE "simulated_trackings" ADD COLUMN "totalPnl" DECIMAL(18,8);
