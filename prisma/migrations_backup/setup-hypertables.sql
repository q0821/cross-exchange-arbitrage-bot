-- TimescaleDB Hypertable 設置
-- 將時序資料表轉換為 Hypertable 以優化時間序列查詢效能

-- 1. funding_rates 轉換為 Hypertable
SELECT create_hypertable(
  'funding_rates',
  'recorded_at',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- 2. system_events 轉換為 Hypertable
SELECT create_hypertable(
  'system_events',
  'occurred_at',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- 3. 設置 funding_rates 資料保留策略 (保留 30 天)
SELECT add_retention_policy(
  'funding_rates',
  INTERVAL '30 days',
  if_not_exists => TRUE
);

-- 4. 設置 system_events 資料保留策略 (保留 7 天)
SELECT add_retention_policy(
  'system_events',
  INTERVAL '7 days',
  if_not_exists => TRUE
);

-- 5. 建立連續聚合 (Continuous Aggregates) - 每小時平均資金費率
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

-- 6. 設置連續聚合自動刷新策略
SELECT add_continuous_aggregate_policy(
  'funding_rates_hourly',
  start_offset => INTERVAL '3 hours',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

-- 7. 建立索引優化
CREATE INDEX IF NOT EXISTS idx_funding_rates_hypertable
  ON funding_rates (exchange, symbol, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_events_hypertable
  ON system_events (event_type, severity, occurred_at DESC);

-- 完成訊息
SELECT format('TimescaleDB Hypertables configured successfully at %s', NOW());
