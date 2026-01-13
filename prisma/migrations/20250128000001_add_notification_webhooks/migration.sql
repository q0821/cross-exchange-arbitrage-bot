-- CreateTable
CREATE TABLE IF NOT EXISTS "notification_webhooks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" VARCHAR(20) NOT NULL,
    "webhookUrl" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "threshold" DECIMAL(10,4) NOT NULL DEFAULT 800,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notification_webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (if not exists)
CREATE INDEX IF NOT EXISTS "notification_webhooks_userId_isEnabled_idx" ON "notification_webhooks"("userId", "isEnabled");

-- CreateIndex (if not exists)
CREATE INDEX IF NOT EXISTS "notification_webhooks_platform_idx" ON "notification_webhooks"("platform");

-- AddForeignKey (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'notification_webhooks_userId_fkey'
    ) THEN
        ALTER TABLE "notification_webhooks" ADD CONSTRAINT "notification_webhooks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
