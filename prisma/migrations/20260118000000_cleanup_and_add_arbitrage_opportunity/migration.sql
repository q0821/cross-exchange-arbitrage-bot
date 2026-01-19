-- ============================================
-- Migration: 清理廢棄模型 + 新增 ArbitrageOpportunity
-- 
-- 背景：
-- 1. v0.3.0 (2025-10-22) 新增了套利偵測系統的多個模型
-- 2. 2025-12-30 這些模型在 schema 中被移除，但沒有產生 DROP migration
-- 3. Feature 065 需要全新設計的 ArbitrageOpportunity 模型
--
-- 此 migration 會：
-- 1. 清理可能存在的廢棄表和枚舉
-- 2. 建立新的 ArbitrageOpportunity 表
-- ============================================

-- =====================
-- Part 1: 清理廢棄物件
-- =====================

-- 移除廢棄的表（如果存在）
-- 注意順序：先移除有外鍵依賴的表
DROP TABLE IF EXISTS "notification_logs" CASCADE;
DROP TABLE IF EXISTS "opportunity_history" CASCADE;
DROP TABLE IF EXISTS "trade_records" CASCADE;
DROP TABLE IF EXISTS "hedge_positions" CASCADE;
DROP TABLE IF EXISTS "arbitrage_cycles" CASCADE;

-- 移除舊版 arbitrage_opportunities（如果存在且是舊版結構）
-- 舊版有 rate_difference, long_funding_rate 等欄位
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'arbitrage_opportunities' 
        AND column_name = 'rate_difference'
    ) THEN
        DROP TABLE "arbitrage_opportunities" CASCADE;
    END IF;
END $$;

-- 移除廢棄的枚舉（如果存在）
DROP TYPE IF EXISTS "disappear_reason" CASCADE;
DROP TYPE IF EXISTS "notification_type" CASCADE;
DROP TYPE IF EXISTS "notification_channel" CASCADE;
DROP TYPE IF EXISTS "severity" CASCADE;
DROP TYPE IF EXISTS "cycle_status" CASCADE;
DROP TYPE IF EXISTS "order_status" CASCADE;
DROP TYPE IF EXISTS "order_type" CASCADE;
DROP TYPE IF EXISTS "trade_action" CASCADE;
DROP TYPE IF EXISTS "trade_side" CASCADE;
DROP TYPE IF EXISTS "position_status" CASCADE;
DROP TYPE IF EXISTS "CloseReason" CASCADE;

-- 移除舊版 opportunity_status（如果有 EXPIRED, CLOSED 變體）
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'EXPIRED' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'opportunity_status')
    ) THEN
        DROP TYPE "opportunity_status" CASCADE;
    END IF;
END $$;

-- =====================
-- Part 2: 建立新模型
-- =====================

-- 建立新的 opportunity_status 枚舉（如果不存在）
DO $$ BEGIN
    CREATE TYPE "opportunity_status" AS ENUM ('ACTIVE', 'ENDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 建立新的 arbitrage_opportunities 表（如果不存在）
CREATE TABLE IF NOT EXISTS "arbitrage_opportunities" (
    "id" TEXT NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "longExchange" VARCHAR(20) NOT NULL,
    "shortExchange" VARCHAR(20) NOT NULL,
    "status" "opportunity_status" NOT NULL DEFAULT 'ACTIVE',
    "detectedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMPTZ,
    "durationMs" BIGINT,
    "initialSpread" DECIMAL(10,6) NOT NULL,
    "maxSpread" DECIMAL(10,6) NOT NULL,
    "maxSpreadAt" TIMESTAMPTZ NOT NULL,
    "currentSpread" DECIMAL(10,6) NOT NULL,
    "initialAPY" DECIMAL(10,2) NOT NULL,
    "maxAPY" DECIMAL(10,2) NOT NULL,
    "currentAPY" DECIMAL(10,2) NOT NULL,
    "longIntervalHours" SMALLINT NOT NULL,
    "shortIntervalHours" SMALLINT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "arbitrage_opportunities_pkey" PRIMARY KEY ("id")
);

-- 建立索引（如果不存在）
CREATE INDEX IF NOT EXISTS "arbitrage_opportunities_status_idx" 
    ON "arbitrage_opportunities"("status");

CREATE INDEX IF NOT EXISTS "arbitrage_opportunities_detectedAt_idx" 
    ON "arbitrage_opportunities"("detectedAt" DESC);

CREATE INDEX IF NOT EXISTS "arbitrage_opportunities_endedAt_idx" 
    ON "arbitrage_opportunities"("endedAt" DESC);

-- 建立唯一約束（如果不存在）
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'arbitrage_opportunities_symbol_longExchange_shortExchange_s_key'
    ) THEN
        CREATE UNIQUE INDEX "arbitrage_opportunities_symbol_longExchange_shortExchange_s_key" 
        ON "arbitrage_opportunities"("symbol", "longExchange", "shortExchange", "status");
    END IF;
END $$;
