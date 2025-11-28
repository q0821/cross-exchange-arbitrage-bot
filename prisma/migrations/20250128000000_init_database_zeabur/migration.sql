
-- Migration: Initial Database Schema
-- This migration creates all tables, enums, and indexes for the arbitrage trading platform

-- CreateEnum
CREATE TYPE "opportunity_status" AS ENUM ('ACTIVE', 'EXPIRED', 'CLOSED');

-- CreateEnum
CREATE TYPE "disappear_reason" AS ENUM ('RATE_DROPPED', 'DATA_UNAVAILABLE', 'MANUAL_CLOSE', 'SYSTEM_ERROR');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('OPPORTUNITY_APPEARED', 'OPPORTUNITY_DISAPPEARED', 'OPPORTUNITY_UPDATED');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('TERMINAL', 'LOG', 'WEBHOOK', 'TELEGRAM');

-- CreateEnum
CREATE TYPE "severity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "position_status" AS ENUM ('OPENING', 'ACTIVE', 'CLOSING', 'CLOSED', 'FAILED');

-- CreateEnum
CREATE TYPE "trade_side" AS ENUM ('LONG', 'SHORT');

-- CreateEnum
CREATE TYPE "order_type" AS ENUM ('MARKET', 'LIMIT');

-- CreateEnum
CREATE TYPE "trade_action" AS ENUM ('OPEN', 'CLOSE');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('FILLED', 'PARTIAL', 'CANCELED', 'FAILED');

-- CreateEnum
CREATE TYPE "cycle_status" AS ENUM ('ACTIVE', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "event_severity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ApiEnvironment" AS ENUM ('MAINNET', 'TESTNET');

-- CreateEnum
CREATE TYPE "position_web_status" AS ENUM ('PENDING', 'OPENING', 'OPEN', 'CLOSING', 'CLOSED', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "trade_web_status" AS ENUM ('SUCCESS', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "funding_rates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "exchange" VARCHAR(50) NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "funding_rate" DECIMAL(10,8) NOT NULL,
    "next_funding_time" TIMESTAMPTZ NOT NULL,
    "mark_price" DECIMAL(20,8),
    "index_price" DECIMAL(20,8),
    "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funding_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arbitrage_opportunities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "symbol" VARCHAR(20) NOT NULL,
    "long_exchange" VARCHAR(50) NOT NULL,
    "short_exchange" VARCHAR(50) NOT NULL,
    "long_funding_rate" DECIMAL(10,8) NOT NULL,
    "short_funding_rate" DECIMAL(10,8) NOT NULL,
    "rate_difference" DECIMAL(10,8) NOT NULL,
    "expected_return_rate" DECIMAL(10,8) NOT NULL,
    "status" "opportunity_status" NOT NULL DEFAULT 'ACTIVE',
    "detected_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expired_at" TIMESTAMPTZ,
    "closed_at" TIMESTAMPTZ,
    "max_rate_difference" DECIMAL(10,8),
    "max_rate_difference_at" TIMESTAMPTZ,
    "notification_count" INTEGER NOT NULL DEFAULT 0,
    "last_notification_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "arbitrage_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "opportunity_id" UUID NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "long_exchange" VARCHAR(50) NOT NULL,
    "short_exchange" VARCHAR(50) NOT NULL,
    "initial_rate_difference" DECIMAL(10,8) NOT NULL,
    "max_rate_difference" DECIMAL(10,8) NOT NULL,
    "avg_rate_difference" DECIMAL(10,8) NOT NULL,
    "duration_ms" BIGINT NOT NULL,
    "duration_minutes" DECIMAL(10,2) NOT NULL,
    "total_notifications" INTEGER NOT NULL,
    "detected_at" TIMESTAMPTZ NOT NULL,
    "expired_at" TIMESTAMPTZ NOT NULL,
    "disappear_reason" "disappear_reason" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "opportunity_id" UUID NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "notification_type" "notification_type" NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "severity" "severity" NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "rate_difference" DECIMAL(10,8) NOT NULL,
    "sent_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_debounced" BOOLEAN NOT NULL DEFAULT false,
    "debounce_skipped_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id","sent_at")
);

-- CreateTable
CREATE TABLE "hedge_positions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "arbitrage_cycle_id" UUID NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "long_exchange" VARCHAR(50) NOT NULL,
    "short_exchange" VARCHAR(50) NOT NULL,
    "position_size" DECIMAL(20,8) NOT NULL,
    "position_value_usdt" DECIMAL(20,8) NOT NULL,
    "leverage" INTEGER NOT NULL DEFAULT 1,
    "long_entry_price" DECIMAL(20,8) NOT NULL,
    "short_entry_price" DECIMAL(20,8) NOT NULL,
    "long_exit_price" DECIMAL(20,8),
    "short_exit_price" DECIMAL(20,8),
    "margin_used_usdt" DECIMAL(20,8) NOT NULL,
    "margin_ratio" DECIMAL(10,8),
    "unrealized_pnl_usdt" DECIMAL(20,8) DEFAULT 0,
    "realized_pnl_usdt" DECIMAL(20,8),
    "total_funding_received" DECIMAL(20,8) DEFAULT 0,
    "total_funding_paid" DECIMAL(20,8) DEFAULT 0,
    "status" "position_status" NOT NULL DEFAULT 'OPENING',
    "opened_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ,
    "failure_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "hedge_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hedge_position_id" UUID NOT NULL,
    "exchange" VARCHAR(50) NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "order_id" VARCHAR(100) NOT NULL,
    "client_order_id" VARCHAR(100),
    "side" "trade_side" NOT NULL,
    "type" "order_type" NOT NULL,
    "action" "trade_action" NOT NULL,
    "quantity" DECIMAL(20,8) NOT NULL,
    "filled_quantity" DECIMAL(20,8) NOT NULL,
    "price" DECIMAL(20,8),
    "average_price" DECIMAL(20,8) NOT NULL,
    "fee" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "fee_currency" VARCHAR(10) NOT NULL DEFAULT 'USDT',
    "commission_rate" DECIMAL(10,8),
    "order_status" "order_status" NOT NULL,
    "slippage" DECIMAL(10,8),
    "executed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trade_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arbitrage_cycles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "opportunity_id" UUID NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "initial_capital_usdt" DECIMAL(20,8) NOT NULL,
    "total_fees_usdt" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "total_funding_income" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "price_pnl_usdt" DECIMAL(20,8) DEFAULT 0,
    "net_profit_usdt" DECIMAL(20,8),
    "net_profit_rate" DECIMAL(10,8),
    "roi" DECIMAL(10,8),
    "funding_periods" INTEGER NOT NULL DEFAULT 0,
    "duration_hours" DECIMAL(10,2),
    "status" "cycle_status" NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "arbitrage_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_parameters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "min_rate_difference" DECIMAL(10,8) NOT NULL DEFAULT 0.0005,
    "max_position_size_usdt" DECIMAL(20,8) NOT NULL DEFAULT 10000,
    "max_total_exposure_usdt" DECIMAL(20,8) NOT NULL DEFAULT 50000,
    "max_leverage" INTEGER NOT NULL DEFAULT 5,
    "stop_loss_rate" DECIMAL(10,8) NOT NULL DEFAULT 0.001,
    "max_holding_hours" INTEGER NOT NULL DEFAULT 24,
    "position_size_percentage" DECIMAL(10,8) NOT NULL DEFAULT 0.03,
    "enable_auto_trading" BOOLEAN NOT NULL DEFAULT false,
    "enable_auto_close" BOOLEAN NOT NULL DEFAULT true,
    "max_slippage_rate" DECIMAL(10,8) NOT NULL DEFAULT 0.001,
    "min_liquidity_usdt" DECIMAL(20,8) NOT NULL DEFAULT 50000,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "risk_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funding_rate_validations" (
    "id" SERIAL NOT NULL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "symbol" VARCHAR(20) NOT NULL,
    "exchange" VARCHAR(50) NOT NULL DEFAULT 'okx',
    "okxRate" DECIMAL(18,8) NOT NULL,
    "okxNextRate" DECIMAL(18,8),
    "okxFundingTime" TIMESTAMPTZ(6),
    "ccxtRate" DECIMAL(18,8),
    "ccxtFundingTime" TIMESTAMPTZ(6),
    "discrepancyPercent" DECIMAL(10,6),
    "validationStatus" VARCHAR(10) NOT NULL,
    "errorMessage" TEXT,

    CONSTRAINT "funding_rate_validations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_type" VARCHAR(50) NOT NULL,
    "severity" "event_severity" NOT NULL,
    "exchange" VARCHAR(50),
    "symbol" VARCHAR(20),
    "message" TEXT NOT NULL,
    "details" JSONB,
    "related_id" UUID,
    "is_notified" BOOLEAN NOT NULL DEFAULT false,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exchange" VARCHAR(50) NOT NULL,
    "environment" "ApiEnvironment" NOT NULL DEFAULT 'MAINNET',
    "label" VARCHAR(100) NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "encryptedSecret" TEXT NOT NULL,
    "encryptedPassphrase" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastValidatedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "longExchange" VARCHAR(50) NOT NULL,
    "longOrderId" VARCHAR(100),
    "longEntryPrice" DECIMAL(18,8) NOT NULL,
    "longPositionSize" DECIMAL(18,8) NOT NULL,
    "longLeverage" INTEGER NOT NULL DEFAULT 3,
    "shortExchange" VARCHAR(50) NOT NULL,
    "shortOrderId" VARCHAR(100),
    "shortEntryPrice" DECIMAL(18,8) NOT NULL,
    "shortPositionSize" DECIMAL(18,8) NOT NULL,
    "shortLeverage" INTEGER NOT NULL DEFAULT 3,
    "status" "position_web_status" NOT NULL DEFAULT 'PENDING',
    "openFundingRateLong" DECIMAL(10,8) NOT NULL,
    "openFundingRateShort" DECIMAL(10,8) NOT NULL,
    "unrealizedPnL" DECIMAL(18,8),
    "openedAt" TIMESTAMPTZ,
    "closedAt" TIMESTAMPTZ,
    "failureReason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "longExchange" VARCHAR(50) NOT NULL,
    "longEntryPrice" DECIMAL(18,8) NOT NULL,
    "longExitPrice" DECIMAL(18,8) NOT NULL,
    "longPositionSize" DECIMAL(18,8) NOT NULL,
    "shortExchange" VARCHAR(50) NOT NULL,
    "shortEntryPrice" DECIMAL(18,8) NOT NULL,
    "shortExitPrice" DECIMAL(18,8) NOT NULL,
    "shortPositionSize" DECIMAL(18,8) NOT NULL,
    "openedAt" TIMESTAMPTZ NOT NULL,
    "closedAt" TIMESTAMPTZ NOT NULL,
    "holdingDuration" INTEGER NOT NULL,
    "priceDiffPnL" DECIMAL(18,8) NOT NULL,
    "fundingRatePnL" DECIMAL(18,8) NOT NULL,
    "totalPnL" DECIMAL(18,8) NOT NULL,
    "roi" DECIMAL(10,4) NOT NULL,
    "status" "trade_web_status" NOT NULL DEFAULT 'SUCCESS',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" VARCHAR(50) NOT NULL,
    "resource" VARCHAR(100),
    "details" JSONB,
    "ipAddress" VARCHAR(45),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "funding_rates_recorded_at_idx" ON "funding_rates"("recorded_at" DESC);

-- CreateIndex
CREATE INDEX "funding_rates_exchange_symbol_recorded_at_idx" ON "funding_rates"("exchange", "symbol", "recorded_at" DESC);

-- CreateIndex
CREATE INDEX "funding_rates_symbol_recorded_at_idx" ON "funding_rates"("symbol", "recorded_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "funding_rates_exchange_symbol_recorded_at_key" ON "funding_rates"("exchange", "symbol", "recorded_at");

-- CreateIndex
CREATE INDEX "idx_opportunity_status" ON "arbitrage_opportunities"("status");

-- CreateIndex
CREATE INDEX "idx_opportunity_detected" ON "arbitrage_opportunities"("detected_at" DESC);

-- CreateIndex
CREATE INDEX "idx_opportunity_symbol_detected" ON "arbitrage_opportunities"("symbol", "detected_at" DESC);

-- CreateIndex
CREATE INDEX "idx_opportunity_expired" ON "arbitrage_opportunities"("expired_at");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_history_opportunity_id_key" ON "opportunity_history"("opportunity_id");

-- CreateIndex
CREATE INDEX "idx_history_symbol" ON "opportunity_history"("symbol");

-- CreateIndex
CREATE INDEX "idx_history_detected" ON "opportunity_history"("detected_at" DESC);

-- CreateIndex
CREATE INDEX "idx_history_duration" ON "opportunity_history"("duration_ms" DESC);

-- CreateIndex
CREATE INDEX "idx_history_max_diff" ON "opportunity_history"("max_rate_difference" DESC);

-- CreateIndex
CREATE INDEX "idx_notification_opportunity" ON "notification_logs"("opportunity_id", "sent_at" DESC);

-- CreateIndex
CREATE INDEX "idx_notification_symbol" ON "notification_logs"("symbol", "sent_at" DESC);

-- CreateIndex
CREATE INDEX "idx_notification_sent" ON "notification_logs"("sent_at" DESC);

-- CreateIndex
CREATE INDEX "idx_notification_type" ON "notification_logs"("notification_type", "sent_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "hedge_positions_arbitrage_cycle_id_key" ON "hedge_positions"("arbitrage_cycle_id");

-- CreateIndex
CREATE INDEX "idx_position_status" ON "hedge_positions"("status");

-- CreateIndex
CREATE INDEX "idx_position_cycle" ON "hedge_positions"("arbitrage_cycle_id");

-- CreateIndex
CREATE INDEX "idx_position_opened" ON "hedge_positions"("opened_at" DESC);

-- CreateIndex
CREATE INDEX "idx_position_symbol" ON "hedge_positions"("symbol", "status");

-- CreateIndex
CREATE INDEX "idx_trade_position" ON "trade_records"("hedge_position_id");

-- CreateIndex
CREATE INDEX "idx_trade_executed" ON "trade_records"("executed_at" DESC);

-- CreateIndex
CREATE INDEX "idx_trade_exchange_symbol" ON "trade_records"("exchange", "symbol", "executed_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "trade_records_exchange_order_id_key" ON "trade_records"("exchange", "order_id");

-- CreateIndex
CREATE UNIQUE INDEX "arbitrage_cycles_opportunity_id_key" ON "arbitrage_cycles"("opportunity_id");

-- CreateIndex
CREATE INDEX "idx_cycle_opportunity" ON "arbitrage_cycles"("opportunity_id");

-- CreateIndex
CREATE INDEX "idx_cycle_status" ON "arbitrage_cycles"("status");

-- CreateIndex
CREATE INDEX "idx_cycle_started" ON "arbitrage_cycles"("started_at" DESC);

-- CreateIndex
CREATE INDEX "idx_cycle_symbol_status" ON "arbitrage_cycles"("symbol", "status");

-- CreateIndex
CREATE UNIQUE INDEX "risk_parameters_name_key" ON "risk_parameters"("name");

-- CreateIndex
CREATE INDEX "idx_risk_params_active" ON "risk_parameters"("is_active");

-- CreateIndex
CREATE INDEX "funding_rate_validations_symbol_timestamp_idx" ON "funding_rate_validations"("symbol", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "funding_rate_validations_validationStatus_timestamp_idx" ON "funding_rate_validations"("validationStatus", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "funding_rate_validations_timestamp_idx" ON "funding_rate_validations"("timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "funding_rate_validations_timestamp_symbol_key" ON "funding_rate_validations"("timestamp", "symbol");

-- CreateIndex
CREATE INDEX "idx_event_type_occurred" ON "system_events"("event_type", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "idx_event_severity" ON "system_events"("severity", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "idx_event_notified" ON "system_events"("is_notified");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "api_keys_userId_isActive_idx" ON "api_keys"("userId", "isActive");

-- CreateIndex
CREATE INDEX "api_keys_exchange_idx" ON "api_keys"("exchange");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_userId_exchange_label_key" ON "api_keys"("userId", "exchange", "label");

-- CreateIndex
CREATE INDEX "positions_userId_status_idx" ON "positions"("userId", "status");

-- CreateIndex
CREATE INDEX "positions_symbol_status_idx" ON "positions"("symbol", "status");

-- CreateIndex
CREATE INDEX "positions_createdAt_idx" ON "positions"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "trades_positionId_key" ON "trades"("positionId");

-- CreateIndex
CREATE INDEX "trades_userId_createdAt_idx" ON "trades"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "trades_symbol_createdAt_idx" ON "trades"("symbol", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "trades_createdAt_idx" ON "trades"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "opportunity_history" ADD CONSTRAINT "opportunity_history_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "arbitrage_opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "arbitrage_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hedge_positions" ADD CONSTRAINT "hedge_positions_arbitrage_cycle_id_fkey" FOREIGN KEY ("arbitrage_cycle_id") REFERENCES "arbitrage_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_records" ADD CONSTRAINT "trade_records_hedge_position_id_fkey" FOREIGN KEY ("hedge_position_id") REFERENCES "hedge_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arbitrage_cycles" ADD CONSTRAINT "arbitrage_cycles_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "arbitrage_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

