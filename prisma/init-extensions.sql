-- Enable required PostgreSQL extensions for Cross-Exchange Arbitrage Platform
-- This script should be run BEFORE prisma db push or prisma migrate deploy

-- Enable UUID generation functions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Verify extensions are enabled
SELECT extname, extversion
FROM pg_extension
WHERE extname IN ('uuid-ossp');
