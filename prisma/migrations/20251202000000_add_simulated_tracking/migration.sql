-- Feature 029: Simulated APY Tracking
-- CreateEnum
CREATE TYPE "TrackingStatus" AS ENUM ('ACTIVE', 'STOPPED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SnapshotType" AS ENUM ('SETTLEMENT', 'PERIODIC');

-- CreateEnum
CREATE TYPE "SettlementSide" AS ENUM ('LONG', 'SHORT', 'BOTH');

-- CreateTable
CREATE TABLE "simulated_trackings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "longExchange" VARCHAR(20) NOT NULL,
    "shortExchange" VARCHAR(20) NOT NULL,
    "simulatedCapital" DECIMAL(18,8) NOT NULL,
    "autoStopOnExpire" BOOLEAN NOT NULL DEFAULT true,
    "initialSpread" DECIMAL(10,6) NOT NULL,
    "initialAPY" DECIMAL(10,2) NOT NULL,
    "initialLongRate" DECIMAL(10,8) NOT NULL,
    "initialShortRate" DECIMAL(10,8) NOT NULL,
    "longIntervalHours" SMALLINT NOT NULL,
    "shortIntervalHours" SMALLINT NOT NULL,
    "status" "TrackingStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stoppedAt" TIMESTAMPTZ,
    "totalFundingProfit" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "totalSettlements" INTEGER NOT NULL DEFAULT 0,
    "maxSpread" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "minSpread" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "simulated_trackings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_snapshots" (
    "id" TEXT NOT NULL,
    "trackingId" TEXT NOT NULL,
    "snapshotType" "SnapshotType" NOT NULL,
    "longRate" DECIMAL(10,8) NOT NULL,
    "shortRate" DECIMAL(10,8) NOT NULL,
    "spread" DECIMAL(10,6) NOT NULL,
    "annualizedReturn" DECIMAL(10,2) NOT NULL,
    "longPrice" DECIMAL(18,8),
    "shortPrice" DECIMAL(18,8),
    "priceDiffPercent" DECIMAL(10,4),
    "settlementSide" "SettlementSide",
    "fundingProfit" DECIMAL(18,8),
    "cumulativeProfit" DECIMAL(18,8) NOT NULL,
    "recordedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "simulated_trackings_userId_symbol_longExchange_shortExchang_key" ON "simulated_trackings"("userId", "symbol", "longExchange", "shortExchange", "status");

-- CreateIndex
CREATE INDEX "simulated_trackings_userId_status_idx" ON "simulated_trackings"("userId", "status");

-- CreateIndex
CREATE INDEX "simulated_trackings_symbol_idx" ON "simulated_trackings"("symbol");

-- CreateIndex
CREATE INDEX "simulated_trackings_startedAt_idx" ON "simulated_trackings"("startedAt" DESC);

-- CreateIndex
CREATE INDEX "tracking_snapshots_trackingId_recordedAt_idx" ON "tracking_snapshots"("trackingId", "recordedAt" DESC);

-- CreateIndex
CREATE INDEX "tracking_snapshots_trackingId_snapshotType_idx" ON "tracking_snapshots"("trackingId", "snapshotType");

-- AddForeignKey
ALTER TABLE "simulated_trackings" ADD CONSTRAINT "simulated_trackings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_snapshots" ADD CONSTRAINT "tracking_snapshots_trackingId_fkey" FOREIGN KEY ("trackingId") REFERENCES "simulated_trackings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
