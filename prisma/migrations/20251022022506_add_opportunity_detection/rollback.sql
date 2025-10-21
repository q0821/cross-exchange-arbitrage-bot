-- Rollback script to clean up partial migration

-- Drop foreign keys first
ALTER TABLE "notification_logs" DROP CONSTRAINT IF EXISTS "notification_logs_opportunity_id_fkey";
ALTER TABLE "opportunity_history" DROP CONSTRAINT IF EXISTS "opportunity_history_opportunity_id_fkey";

-- Drop tables
DROP TABLE IF EXISTS "notification_logs" CASCADE;
DROP TABLE IF EXISTS "opportunity_history" CASCADE;

-- Drop enums
DROP TYPE IF EXISTS "disappear_reason" CASCADE;
DROP TYPE IF EXISTS "notification_type" CASCADE;
DROP TYPE IF EXISTS "notification_channel" CASCADE;
DROP TYPE IF EXISTS "severity" CASCADE;

-- Restore ArbitrageOpportunity columns that were dropped
-- Note: This might fail if data was already modified, but we'll try
ALTER TABLE "arbitrage_opportunities"
  DROP COLUMN IF EXISTS "expired_at",
  DROP COLUMN IF EXISTS "closed_at",
  DROP COLUMN IF EXISTS "max_rate_difference",
  DROP COLUMN IF EXISTS "max_rate_difference_at",
  DROP COLUMN IF EXISTS "notification_count",
  DROP COLUMN IF EXISTS "last_notification_at";

-- Restore old enum if needed
-- Note: This will fail if old enum doesn't exist, which is fine
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opportunity_status_old') THEN
    -- Create old enum
    CREATE TYPE "opportunity_status_old" AS ENUM ('PENDING', 'EXECUTING', 'COMPLETED', 'FAILED', 'EXPIRED');

    -- Convert status column back
    ALTER TABLE "arbitrage_opportunities"
      ALTER COLUMN "status" DROP DEFAULT,
      ALTER COLUMN "status" TYPE "opportunity_status_old"
        USING CASE
          WHEN "status"::text = 'ACTIVE' THEN 'PENDING'::"opportunity_status_old"
          WHEN "status"::text = 'EXPIRED' THEN 'EXPIRED'::"opportunity_status_old"
          WHEN "status"::text = 'CLOSED' THEN 'COMPLETED'::"opportunity_status_old"
          ELSE 'PENDING'::"opportunity_status_old"
        END;

    -- Drop new enum
    DROP TYPE IF EXISTS "opportunity_status" CASCADE;

    -- Rename old enum back
    ALTER TYPE "opportunity_status_old" RENAME TO "opportunity_status";

    -- Restore default
    ALTER TABLE "arbitrage_opportunities" ALTER COLUMN "status" SET DEFAULT 'PENDING';
  END IF;
END$$;
