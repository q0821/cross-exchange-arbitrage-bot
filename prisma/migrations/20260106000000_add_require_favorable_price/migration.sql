-- Feature 057: Add requireFavorablePrice field to notification_webhooks
-- This enables price filter functionality for webhook notifications

ALTER TABLE "notification_webhooks" ADD COLUMN "requireFavorablePrice" BOOLEAN NOT NULL DEFAULT false;
