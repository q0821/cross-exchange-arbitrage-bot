-- AddColumn: portfolioMargin to api_keys
-- This column was missing from the initial migration but exists in schema.prisma
-- Using IF NOT EXISTS to make this migration idempotent

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'api_keys' AND column_name = 'portfolioMargin'
    ) THEN
        ALTER TABLE "api_keys" ADD COLUMN "portfolioMargin" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;
