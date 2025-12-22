-- CreateEnum (if not exists)
DO $$ BEGIN
    CREATE TYPE "conditional_order_status" AS ENUM ('PENDING', 'SETTING', 'SET', 'PARTIAL', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable: Add conditional order fields to positions
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "stopLossEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "stopLossPercent" DECIMAL(5,2);
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "longStopLossPrice" DECIMAL(20,8);
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "longStopLossOrderId" VARCHAR(100);
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "shortStopLossPrice" DECIMAL(20,8);
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "shortStopLossOrderId" VARCHAR(100);
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "takeProfitEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "takeProfitPercent" DECIMAL(5,2);
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "longTakeProfitPrice" DECIMAL(20,8);
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "longTakeProfitOrderId" VARCHAR(100);
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "shortTakeProfitPrice" DECIMAL(20,8);
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "shortTakeProfitOrderId" VARCHAR(100);
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "conditionalOrderStatus" "conditional_order_status" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "conditionalOrderError" TEXT;

-- CreateTable: TradingSettings (if not exists)
CREATE TABLE IF NOT EXISTS "trading_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "defaultStopLossEnabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultStopLossPercent" DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    "defaultTakeProfitEnabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultTakeProfitPercent" DECIMAL(5,2) NOT NULL DEFAULT 3.00,
    "defaultLeverage" INTEGER NOT NULL DEFAULT 1,
    "maxPositionSizeUSD" DECIMAL(20,2) NOT NULL DEFAULT 10000,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "trading_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS "trading_settings_userId_key" ON "trading_settings"("userId");

-- AddForeignKey (if not exists)
DO $$ BEGIN
    ALTER TABLE "trading_settings" ADD CONSTRAINT "trading_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
