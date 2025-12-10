-- CreateTable
CREATE TABLE IF NOT EXISTS "asset_snapshots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "binanceBalanceUSD" DECIMAL(18,8),
    "okxBalanceUSD" DECIMAL(18,8),
    "mexcBalanceUSD" DECIMAL(18,8),
    "gateioBalanceUSD" DECIMAL(18,8),
    "totalBalanceUSD" DECIMAL(18,8) NOT NULL,
    "binanceStatus" VARCHAR(50),
    "okxStatus" VARCHAR(50),
    "mexcStatus" VARCHAR(50),
    "gateioStatus" VARCHAR(50),
    "recordedAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "asset_snapshots_userId_recordedAt_idx" ON "asset_snapshots"("userId", "recordedAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "asset_snapshots_recordedAt_idx" ON "asset_snapshots"("recordedAt" DESC);

-- AddForeignKey (only if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'asset_snapshots_userId_fkey'
    ) THEN
        ALTER TABLE "asset_snapshots" ADD CONSTRAINT "asset_snapshots_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
