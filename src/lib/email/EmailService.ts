/**
 * 郵件服務 (Feature 061: 密碼管理)
 *
 * 使用 Nodemailer 發送郵件，支援 SMTP 配置。
 * 當 SMTP 未配置時，郵件功能被停用但不影響其他功能。
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { env, isSmtpConfigured } from '@/lib/env';
import { logger } from '@/lib/logger';

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class EmailService {
  private transporter: Transporter | null = null;
  private initialized = false;

  constructor() {
    this.initTransporter();
  }

  /**
   * 初始化郵件傳輸器
   */
  private initTransporter(): void {
    if (!isSmtpConfigured()) {
      logger.warn('SMTP not configured, email service disabled');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465, // true for 465, false for other ports
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      });

      this.initialized = true;
      logger.info({ host: env.SMTP_HOST, port: env.SMTP_PORT }, 'Email service initialized');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize email service');
      this.transporter = null;
    }
  }

  /**
   * 檢查郵件服務是否可用
   */
  public isAvailable(): boolean {
    return this.initialized && this.transporter !== null;
  }

  /**
   * 發送郵件
   */
  public async send(options: EmailOptions): Promise<EmailResult> {
    if (!this.isAvailable()) {
      logger.warn({ to: options.to }, 'Email service not available, skipping email');
      return {
        success: false,
        error: '郵件服務未配置',
      };
    }

    try {
      const result = await this.transporter!.sendMail({
        from: env.SMTP_FROM || env.SMTP_USER,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      logger.info(
        {
          to: options.to,
          subject: options.subject,
          messageId: result.messageId,
        },
        'Email sent successfully'
      );

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        {
          to: options.to,
          subject: options.subject,
          error: errorMessage,
        },
        'Failed to send email'
      );

      return {
        success: false,
        error: `郵件發送失敗：${errorMessage}`,
      };
    }
  }

  /**
   * 驗證 SMTP 連線
   */
  public async verify(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await this.transporter!.verify();
      logger.info('SMTP connection verified');
      return true;
    } catch (error) {
      logger.error({ error }, 'SMTP connection verification failed');
      return false;
    }
  }
}

// Singleton instance
let emailServiceInstance: EmailService | null = null;

/**
 * 取得 EmailService 單例
 */
export function getEmailService(): EmailService {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService();
  }
  return emailServiceInstance;
}
