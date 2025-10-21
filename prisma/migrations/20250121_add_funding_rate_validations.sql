-- Add funding_rate_validations table and configure as TimescaleDB Hypertable
-- Feature: 004-fix-okx-add-price-display
-- Date: 2025-01-21

-- 1. Drop table if exists (for clean re-run)
DROP TABLE IF EXISTS funding_rate_validations CASCADE;

-- 2. Create funding_rate_validations table (without unique constraint first)
CREATE TABLE funding_rate_validations (
  id SERIAL,
  timestamp TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  symbol VARCHAR(20) NOT NULL,
  exchange VARCHAR(50) NOT NULL DEFAULT 'okx',
  "okxRate" DECIMAL(18, 8) NOT NULL,
  "okxNextRate" DECIMAL(18, 8),
  "okxFundingTime" TIMESTAMPTZ(6),
  "ccxtRate" DECIMAL(18, 8),
  "ccxtFundingTime" TIMESTAMPTZ(6),
  "discrepancyPercent" DECIMAL(10, 6),
  "validationStatus" VARCHAR(10) NOT NULL,
  "errorMessage" TEXT
);

-- 3. Convert to TimescaleDB Hypertable BEFORE adding constraints
-- Partition by timestamp with 1-day chunks
SELECT create_hypertable(
  'funding_rate_validations',
  'timestamp',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE,
  migrate_data => TRUE
);

-- 4. Add constraints AFTER hypertable creation
-- Primary key must include partitioning column for hypertables
ALTER TABLE funding_rate_validations
  ADD CONSTRAINT funding_rate_validations_pkey PRIMARY KEY (timestamp, id);

-- Add unique constraint (must include partitioning column)
ALTER TABLE funding_rate_validations
  ADD CONSTRAINT funding_rate_validations_timestamp_symbol_key UNIQUE (timestamp, symbol);

-- 3. Create indexes for query optimization
CREATE INDEX IF NOT EXISTS idx_funding_rate_validations_symbol_timestamp
  ON funding_rate_validations (symbol, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_funding_rate_validations_status_timestamp
  ON funding_rate_validations ("validationStatus", timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_funding_rate_validations_timestamp
  ON funding_rate_validations (timestamp DESC);

-- 4. Add data retention policy (90 days as per plan.md)
SELECT add_retention_policy(
  'funding_rate_validations',
  INTERVAL '90 days',
  if_not_exists => TRUE
);

-- 5. Add compression policy (compress data older than 7 days)
ALTER TABLE funding_rate_validations SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'symbol',
  timescaledb.compress_orderby = 'timestamp DESC'
);

SELECT add_compression_policy(
  'funding_rate_validations',
  INTERVAL '7 days',
  if_not_exists => TRUE
);

-- 6. Create continuous aggregate for validation pass rate (hourly)
CREATE MATERIALIZED VIEW IF NOT EXISTS funding_rate_validations_hourly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', timestamp) AS bucket,
  symbol,
  exchange,
  COUNT(*) AS total_validations,
  COUNT(*) FILTER (WHERE "validationStatus" = 'PASS') AS passed_validations,
  COUNT(*) FILTER (WHERE "validationStatus" = 'FAIL') AS failed_validations,
  COUNT(*) FILTER (WHERE "validationStatus" = 'ERROR') AS error_validations,
  AVG("discrepancyPercent") AS avg_discrepancy_percent,
  MAX("discrepancyPercent") AS max_discrepancy_percent
FROM funding_rate_validations
WHERE "validationStatus" IN ('PASS', 'FAIL')
GROUP BY bucket, symbol, exchange
WITH NO DATA;

-- 7. Add continuous aggregate refresh policy
SELECT add_continuous_aggregate_policy(
  'funding_rate_validations_hourly',
  start_offset => INTERVAL '3 hours',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

-- Completion message
SELECT format('funding_rate_validations hypertable configured successfully at %s', NOW());
