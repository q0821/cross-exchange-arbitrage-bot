-- Feature 027: Add notification fields for opportunity end notification
-- AlterTable (skip if column already exists)
ALTER TABLE "notification_webhooks" ADD COLUMN IF NOT EXISTS "notifyOnDisappear" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "notification_webhooks" ADD COLUMN IF NOT EXISTS "notificationMinutes" INTEGER[] DEFAULT ARRAY[50]::INTEGER[];
