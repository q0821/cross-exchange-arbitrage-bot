-- TimescaleDB Hypertable 設置 v2
-- 注意：需要在表格建立後立即執行，在插入資料之前

-- 1. 檢查表格是否為空
DO $$
DECLARE
  funding_rates_count INTEGER;
  system_events_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO funding_rates_count FROM funding_rates;
  SELECT COUNT(*) INTO system_events_count FROM system_events;

  IF funding_rates_count > 0 THEN
    RAISE NOTICE 'funding_rates has % rows, Hypertable conversion may require data migration', funding_rates_count;
  END IF;

  IF system_events_count > 0 THEN
    RAISE NOTICE 'system_events has % rows, Hypertable conversion may require data migration', system_events_count;
  END IF;
END $$;

-- 2. funding_rates 轉換為 Hypertable
-- TimescaleDB 要求：分區鍵 (recorded_at) 必須包含在所有 unique 約束中
-- Prisma schema 已經定義: @@unique([exchange, symbol, recorded_at])
SELECT create_hypertable(
  'funding_rates',
  'recorded_at',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE,
  migrate_data => TRUE
);

-- 3. system_events 轉換為 Hypertable
SELECT create_hypertable(
  'system_events',
  'occurred_at',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE,
  migrate_data => TRUE
);

-- 4. 設置 funding_rates 資料保留策略 (保留 30 天)
SELECT add_retention_policy(
  'funding_rates',
  INTERVAL '30 days',
  if_not_exists => TRUE
);

-- 5. 設置 system_events 資料保留策略 (保留 7 天)
SELECT add_retention_policy(
  'system_events',
  INTERVAL '7 days',
  if_not_exists => TRUE
);

-- 6. 建立連續聚合 (Continuous Aggregates) - 每小時平均資金費率
CREATE MATERIALIZED VIEW IF NOT EXISTS funding_rates_hourly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', recorded_at) AS bucket,
  exchange,
  symbol,
  AVG(funding_rate) AS avg_funding_rate,
  MAX(funding_rate) AS max_funding_rate,
  MIN(funding_rate) AS min_funding_rate,
  COUNT(*) AS sample_count
FROM funding_rates
GROUP BY bucket, exchange, symbol
WITH NO DATA;

-- 7. 設置連續聚合自動刷新策略
SELECT add_continuous_aggregate_policy(
  'funding_rates_hourly',
  start_offset => INTERVAL '3 hours',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

-- 8. 建立額外索引優化
CREATE INDEX IF NOT EXISTS idx_funding_rates_hypertable_opt
  ON funding_rates (exchange, symbol, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_events_hypertable_opt
  ON system_events (event_type, severity, occurred_at DESC);

-- 完成訊息
SELECT format('TimescaleDB Hypertables configured successfully at %s', NOW());
