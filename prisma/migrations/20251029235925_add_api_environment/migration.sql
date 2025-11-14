-- CreateEnum
CREATE TYPE "ApiEnvironment" AS ENUM ('MAINNET', 'TESTNET');

-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN "environment" "ApiEnvironment" NOT NULL DEFAULT 'MAINNET';
