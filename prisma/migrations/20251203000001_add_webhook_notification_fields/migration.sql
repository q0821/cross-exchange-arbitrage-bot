-- Feature 027: Add notification fields for opportunity end notification
-- AlterTable
ALTER TABLE "notification_webhooks" ADD COLUMN "notifyOnDisappear" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "notification_webhooks" ADD COLUMN "notificationMinutes" INTEGER[] DEFAULT ARRAY[50]::INTEGER[];
