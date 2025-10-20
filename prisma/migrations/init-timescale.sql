-- TimescaleDB 初始化腳本
-- 此腳本會在 PostgreSQL 容器啟動時自動執行

-- 啟用必要的擴展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- 設置 TimescaleDB 配置
ALTER DATABASE arbitrage_db SET timescaledb.telemetry_level = off;

-- 授予權限
GRANT ALL PRIVILEGES ON DATABASE arbitrage_db TO arbitrage_user;

-- 日誌
SELECT format('TimescaleDB version: %s', extversion) FROM pg_extension WHERE extname = 'timescaledb';
