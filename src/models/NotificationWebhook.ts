import { z } from 'zod';
import type { NotificationPlatform } from '../services/notification/types';

/**
 * NotificationWebhook Domain Model
 * Feature 026: Discord/Slack 套利機會即時推送通知
 * Feature 027: 套利機會結束監測和通知
 */

/**
 * Webhook URL 驗證模式
 */
const DISCORD_WEBHOOK_PATTERN = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/;
const SLACK_WEBHOOK_PATTERN = /^https:\/\/hooks\.slack\.com\/services\/[\w-]+\/[\w-]+\/[\w-]+$/;

/**
 * Webhook 驗證 Schema
 */
export const CreateWebhookSchema = z.object({
  platform: z.enum(['discord', 'slack']),
  webhookUrl: z.string().url(),
  name: z.string().min(1).max(100),
  threshold: z.number().min(0).max(10000).default(800),
  notifyOnDisappear: z.boolean().default(true), // Feature 027
  notificationMinutes: z
    .array(z.number().int().min(0).max(59))
    .min(1)
    .max(2)
    .default([50]), // 通知時間（每小時的第幾分鐘），最多 2 個
  requireFavorablePrice: z.boolean().default(false), // Feature 057: 價差過濾開關
});

export const UpdateWebhookSchema = z.object({
  webhookUrl: z.string().url().optional(),
  name: z.string().min(1).max(100).optional(),
  isEnabled: z.boolean().optional(),
  threshold: z.number().min(0).max(10000).optional(),
  notifyOnDisappear: z.boolean().optional(), // Feature 027
  notificationMinutes: z
    .array(z.number().int().min(0).max(59))
    .min(1)
    .max(2)
    .optional(), // 通知時間（每小時的第幾分鐘）
  requireFavorablePrice: z.boolean().optional(), // Feature 057: 價差過濾開關
});

/**
 * 驗證 Webhook URL 格式
 */
export function validateWebhookUrl(platform: NotificationPlatform, url: string): {
  valid: boolean;
  error?: string;
} {
  if (!url) {
    return { valid: false, error: 'Webhook URL is required' };
  }

  try {
    new URL(url);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  if (platform === 'discord') {
    if (!DISCORD_WEBHOOK_PATTERN.test(url)) {
      return {
        valid: false,
        error: 'Invalid Discord webhook URL. Expected format: https://discord.com/api/webhooks/{id}/{token}',
      };
    }
  } else if (platform === 'slack') {
    if (!SLACK_WEBHOOK_PATTERN.test(url)) {
      return {
        valid: false,
        error: 'Invalid Slack webhook URL. Expected format: https://hooks.slack.com/services/{id}/{id}/{token}',
      };
    }
  }

  return { valid: true };
}

/**
 * NotificationWebhook 類別
 */
export class NotificationWebhook {
  readonly id: string;
  readonly userId: string;
  readonly platform: NotificationPlatform;
  readonly name: string;
  readonly isEnabled: boolean;
  readonly threshold: number;
  readonly notifyOnDisappear: boolean; // Feature 027
  readonly notificationMinutes: number[]; // 通知時間（每小時的第幾分鐘）
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(data: {
    id: string;
    userId: string;
    platform: NotificationPlatform;
    name: string;
    isEnabled: boolean;
    threshold: number;
    notifyOnDisappear?: boolean; // Feature 027
    notificationMinutes?: number[]; // 通知時間
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = data.id;
    this.userId = data.userId;
    this.platform = data.platform;
    this.name = data.name;
    this.isEnabled = data.isEnabled;
    this.threshold = data.threshold;
    this.notifyOnDisappear = data.notifyOnDisappear ?? true; // Feature 027: 預設 true
    this.notificationMinutes = data.notificationMinutes ?? [50]; // 預設 :50
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  /**
   * 檢查年化收益是否超過閾值
   */
  shouldNotify(annualizedReturn: number): boolean {
    return this.isEnabled && annualizedReturn >= this.threshold;
  }

  /**
   * 轉換為 API 回應格式
   */
  toResponse(): {
    id: string;
    platform: NotificationPlatform;
    name: string;
    isEnabled: boolean;
    threshold: number;
    notifyOnDisappear: boolean;
    notificationMinutes: number[];
    createdAt: string;
    updatedAt: string;
  } {
    return {
      id: this.id,
      platform: this.platform,
      name: this.name,
      isEnabled: this.isEnabled,
      threshold: this.threshold,
      notifyOnDisappear: this.notifyOnDisappear, // Feature 027
      notificationMinutes: this.notificationMinutes,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
