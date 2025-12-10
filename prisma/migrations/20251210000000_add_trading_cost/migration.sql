-- AlterTable
ALTER TABLE "simulated_trackings" ADD COLUMN IF NOT EXISTS "tradingCost" DECIMAL(18,8);

-- Update comment for totalPnl to clarify it now includes trading cost deduction
COMMENT ON COLUMN "simulated_trackings"."tradingCost" IS '交易成本（開平倉手續費）';
