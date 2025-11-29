import axios from 'axios';
import { logger } from '../../lib/logger';
import type {
  INotifier,
  NotificationResult,
  ArbitrageNotificationMessage,
} from './types';
import { generateExchangeUrl, formatPriceSmart } from './utils';

/**
 * Discord Notifier
 * 使用 Discord Webhook API 發送通知
 * Feature 026: Discord/Slack 套利機會即時推送通知
 */
export class DiscordNotifier implements INotifier {
  private readonly timeout = 30000; // 30 秒超時（遠端主機可能網路延遲較高）

  /**
   * 發送套利機會通知（Discord Embed 格式）
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

      const embed = {
        title: `套利機會：${message.symbol}`,
        color: recommendation.color,
        fields: [
          {
            name: '📈 做多',
            value: [
              `**${message.longExchange.toUpperCase()}**`,
              `原始：${(message.longOriginalRate * 100).toFixed(4)}% / ${message.longTimeBasis}h`,
              `標準化(8h)：${(message.longNormalizedRate * 100).toFixed(4)}%`,
              message.longPrice ? `價格：${formatPriceSmart(message.longPrice)}` : '',
            ]
              .filter(Boolean)
              .join('\n'),
            inline: true,
          },
          {
            name: '📉 做空',
            value: [
              `**${message.shortExchange.toUpperCase()}**`,
              `原始：${(message.shortOriginalRate * 100).toFixed(4)}% / ${message.shortTimeBasis}h`,
              `標準化(8h)：${(message.shortNormalizedRate * 100).toFixed(4)}%`,
              message.shortPrice ? `價格：${formatPriceSmart(message.shortPrice)}` : '',
            ]
              .filter(Boolean)
              .join('\n'),
            inline: true,
          },
          {
            name: '💰 收益分析',
            value: [
              `費率差：${message.spreadPercent.toFixed(4)}%`,
              `年化收益：${message.annualizedReturn.toFixed(2)}%`,
              `回本：約 ${message.fundingPaybackPeriods} 次費率`,
            ].join('\n'),
            inline: false,
          },
          {
            name: '📊 價差分析',
            value: priceAnalysis,
            inline: false,
          },
          {
            name: '🔗 交易連結',
            value: [
              `[${message.longExchange.toUpperCase()}](${generateExchangeUrl(message.longExchange, message.symbol)})`,
              `[${message.shortExchange.toUpperCase()}](${generateExchangeUrl(message.shortExchange, message.symbol)})`,
            ].join(' | '),
            inline: false,
          },
        ],
        footer: {
          text: recommendation.text,
        },
        timestamp: message.timestamp.toISOString(),
      };

      await axios.post(
        webhookUrl,
        { embeds: [embed] },
        { timeout: this.timeout }
      );

      logger.info(
        { symbol: message.symbol, annualizedReturn: message.annualizedReturn },
        'Discord notification sent successfully'
      );

      return {
        webhookId: '',
        success: true,
        timestamp,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to send Discord notification');

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
      const embed = {
        title: '測試通知',
        description: '您的 Discord Webhook 已正確設定！\n\n當套利機會符合您的閾值設定時，您將收到類似此格式的通知。',
        color: 0x00ff00, // 綠色
        footer: {
          text: '套利交易平台 - 通知測試',
        },
        timestamp: timestamp.toISOString(),
      };

      await axios.post(
        webhookUrl,
        { embeds: [embed] },
        { timeout: this.timeout }
      );

      logger.info('Discord test notification sent successfully');

      return {
        webhookId: '',
        success: true,
        timestamp,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to send Discord test notification');

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
  private getRecommendation(message: ArbitrageNotificationMessage): {
    text: string;
    color: number;
  } {
    if (message.isPriceDirectionCorrect) {
      return {
        text: '✅ 適合套利',
        color: 0x00ff00, // 綠色
      };
    }

    if (message.paybackPeriods !== undefined && message.paybackPeriods <= 3) {
      return {
        text: '⚠️ 需注意價差風險',
        color: 0xffff00, // 黃色
      };
    }

    return {
      text: '❌ 不建議套利（價差損失過大）',
      color: 0xff0000, // 紅色
    };
  }
}
