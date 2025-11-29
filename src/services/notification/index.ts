/**
 * Notification Service Exports
 * Feature 026: Discord/Slack 套利機會即時推送通知
 */

export { NotificationService } from './NotificationService';
export { DiscordNotifier } from './DiscordNotifier';
export { SlackNotifier } from './SlackNotifier';
export { generateExchangeUrl, formatPercent, formatPrice } from './utils';
export type {
  NotificationPlatform,
  WebhookConfig,
  ArbitrageNotificationMessage,
  NotificationResult,
  INotifier,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  WebhookResponse,
} from './types';
