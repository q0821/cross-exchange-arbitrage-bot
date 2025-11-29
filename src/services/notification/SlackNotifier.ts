import axios from 'axios';
import { logger } from '../../lib/logger';
import type {
  INotifier,
  NotificationResult,
  ArbitrageNotificationMessage,
} from './types';
import { generateExchangeUrl } from './utils';

/**
 * Slack Notifier
 * 使用 Slack Incoming Webhooks 發送通知
 * Feature 026: Discord/Slack 套利機會即時推送通知
 */
export class SlackNotifier implements INotifier {
  private readonly timeout = 30000; // 30 秒超時（遠端主機可能網路延遲較高）

  /**
   * 發送套利機會通知（Slack Block Kit 格式）
   */
  async sendArbitrageNotification(
    webhookUrl: string,
    message: ArbitrageNotificationMessage
  ): Promise<NotificationResult> {
    const timestamp = new Date();

    try {
      // 價差分析文字
      const priceAnalysis = this.formatPriceAnalysis(message);

      // 計算建議
      const recommendation = this.getRecommendation(message);

      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `套利機會：${message.symbol}`,
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: [
                `*📈 做多：${message.longExchange.toUpperCase()}*`,
                `原始：${(message.longOriginalRate * 100).toFixed(4)}% / ${message.longTimeBasis}h`,
                `標準化(8h)：${(message.longNormalizedRate * 100).toFixed(4)}%`,
                message.longPrice ? `價格：$${message.longPrice.toFixed(2)}` : '',
              ]
                .filter(Boolean)
                .join('\n'),
            },
            {
              type: 'mrkdwn',
              text: [
                `*📉 做空：${message.shortExchange.toUpperCase()}*`,
                `原始：${(message.shortOriginalRate * 100).toFixed(4)}% / ${message.shortTimeBasis}h`,
                `標準化(8h)：${(message.shortNormalizedRate * 100).toFixed(4)}%`,
                message.shortPrice ? `價格：$${message.shortPrice.toFixed(2)}` : '',
              ]
                .filter(Boolean)
                .join('\n'),
            },
          ],
        },
        {
          type: 'divider',
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: [
              '*💰 收益分析*',
              `費率差：${message.spreadPercent.toFixed(4)}%`,
              `年化收益：${message.annualizedReturn.toFixed(2)}%`,
              `回本：約 ${message.fundingPaybackPeriods} 次費率`,
            ].join('\n'),
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*📊 價差分析*\n${priceAnalysis}`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: recommendation,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*🔗 交易連結*\n<${generateExchangeUrl(message.longExchange, message.symbol)}|${message.longExchange.toUpperCase()}> | <${generateExchangeUrl(message.shortExchange, message.symbol)}|${message.shortExchange.toUpperCase()}>`,
          },
        },
      ];

      await axios.post(
        webhookUrl,
        { blocks },
        { timeout: this.timeout }
      );

      logger.info(
        { symbol: message.symbol, annualizedReturn: message.annualizedReturn },
        'Slack notification sent successfully'
      );

      return {
        webhookId: '',
        success: true,
        timestamp,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to send Slack notification');

      return {
        webhookId: '',
        success: false,
        error: errorMessage,
        timestamp,
      };
    }
  }

  /**
   * 發送測試通知
   */
  async sendTestNotification(webhookUrl: string): Promise<NotificationResult> {
    const timestamp = new Date();

    try {
      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '測試通知',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '您的 Slack Webhook 已正確設定！\n\n當套利機會符合您的閾值設定時，您將收到類似此格式的通知。',
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '套利交易平台 - 通知測試',
            },
          ],
        },
      ];

      await axios.post(
        webhookUrl,
        { blocks },
        { timeout: this.timeout }
      );

      logger.info('Slack test notification sent successfully');

      return {
        webhookId: '',
        success: true,
        timestamp,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to send Slack test notification');

      return {
        webhookId: '',
        success: false,
        error: errorMessage,
        timestamp,
      };
    }
  }

  /**
   * 格式化價差分析文字
   */
  private formatPriceAnalysis(message: ArbitrageNotificationMessage): string {
    if (message.priceDiffPercent === undefined) {
      return '無價格資料';
    }

    const direction = message.isPriceDirectionCorrect ? '✅ 正確' : '⚠️ 反向';
    const directionDesc = message.isPriceDirectionCorrect
      ? '（做多交易所價格較低）'
      : `（做多交易所價格較高 ${Math.abs(message.priceDiffPercent).toFixed(4)}%）`;

    let analysis = `方向：${direction}${directionDesc}`;

    if (!message.isPriceDirectionCorrect && message.paybackPeriods !== undefined) {
      analysis += `\n打平：需 ${message.paybackPeriods} 次費率才能打平價差損失`;
    }

    return analysis;
  }

  /**
   * 取得套利建議
   */
  private getRecommendation(message: ArbitrageNotificationMessage): string {
    if (message.isPriceDirectionCorrect) {
      return '✅ 適合套利';
    }

    if (message.paybackPeriods !== undefined && message.paybackPeriods <= 3) {
      return '⚠️ 需注意價差風險';
    }

    return '❌ 不建議套利（價差損失過大）';
  }
}
