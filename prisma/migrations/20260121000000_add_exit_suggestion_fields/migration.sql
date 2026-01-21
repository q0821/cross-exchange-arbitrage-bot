-- Feature 067: 持倉平倉建議監控
-- Add exit suggestion fields to TradingSettings and Position tables

-- AlterTable: TradingSettings
ALTER TABLE "trading_settings" ADD COLUMN IF NOT EXISTS "exitSuggestionEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "trading_settings" ADD COLUMN IF NOT EXISTS "exitSuggestionThreshold" DECIMAL(10,2) NOT NULL DEFAULT 100;
ALTER TABLE "trading_settings" ADD COLUMN IF NOT EXISTS "exitNotificationEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: Position
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "cachedFundingPnL" DECIMAL(18,8);
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "cachedFundingPnLUpdatedAt" TIMESTAMPTZ;
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "exitSuggested" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "exitSuggestedAt" TIMESTAMPTZ;
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "exitSuggestedReason" VARCHAR(50);
