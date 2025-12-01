-- Feature 027: 套利機會結束監測和通知

-- 1. 為 notification_webhooks 添加 notify_on_disappear 欄位
ALTER TABLE "notification_webhooks" ADD COLUMN IF NOT EXISTS "notifyOnDisappear" BOOLEAN NOT NULL DEFAULT true;

-- 2. 建立 opportunity_end_histories 資料表
CREATE TABLE IF NOT EXISTS "opportunity_end_histories" (
    "id" TEXT NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "longExchange" VARCHAR(20) NOT NULL,
    "shortExchange" VARCHAR(20) NOT NULL,
    "detectedAt" TIMESTAMPTZ NOT NULL,
    "disappearedAt" TIMESTAMPTZ NOT NULL,
    "durationMs" BIGINT NOT NULL,
    "initialSpread" DECIMAL(10,6) NOT NULL,
    "maxSpread" DECIMAL(10,6) NOT NULL,
    "maxSpreadAt" TIMESTAMPTZ NOT NULL,
    "finalSpread" DECIMAL(10,6) NOT NULL,
    "longIntervalHours" SMALLINT NOT NULL,
    "shortIntervalHours" SMALLINT NOT NULL,
    "settlementRecords" JSONB NOT NULL DEFAULT '[]',
    "longSettlementCount" SMALLINT NOT NULL,
    "shortSettlementCount" SMALLINT NOT NULL,
    "totalFundingProfit" DECIMAL(10,6) NOT NULL,
    "totalCost" DECIMAL(10,6) NOT NULL,
    "netProfit" DECIMAL(10,6) NOT NULL,
    "realizedAPY" DECIMAL(10,2) NOT NULL,
    "notificationCount" INTEGER NOT NULL DEFAULT 1,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_end_histories_pkey" PRIMARY KEY ("id")
);

-- 3. 建立索引
CREATE INDEX IF NOT EXISTS "opportunity_end_histories_userId_idx" ON "opportunity_end_histories"("userId");
CREATE INDEX IF NOT EXISTS "opportunity_end_histories_symbol_idx" ON "opportunity_end_histories"("symbol");
CREATE INDEX IF NOT EXISTS "opportunity_end_histories_disappearedAt_idx" ON "opportunity_end_histories"("disappearedAt" DESC);

-- 4. 建立外鍵關聯
ALTER TABLE "opportunity_end_histories" ADD CONSTRAINT "opportunity_end_histories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
