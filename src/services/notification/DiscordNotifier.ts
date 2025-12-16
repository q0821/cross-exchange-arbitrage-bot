import axios from 'axios';
import { logger } from '../../lib/logger';
import { getPriceRiskLevel, PRICE_DIFF_WARNING_THRESHOLD } from '../../lib/priceRisk';
import type {
  INotifier,
  NotificationResult,
  ArbitrageNotificationMessage,
  OpportunityDisappearedMessage,
} from './types';
import {
  generateExchangeUrl,
  formatPriceSmart,
  formatTime,
  formatProfitInfoDiscord,
} from './utils';

/**
 * Discord Notifier
 * 使用 Discord Webhook API 發送通知
 * Feature 026: Discord/Slack 套利機會即時推送通知
 * Feature 027: 套利機會結束監測和通知
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

      // Feature 033: 價差風險警告
      const priceRiskLevel = getPriceRiskLevel(message.priceDiffPercent);
      const riskWarningField = this.getRiskWarningField(priceRiskLevel, message.priceDiffPercent);

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
          // Feature 033: 風險警告區塊（如果有）
          ...(riskWarningField ? [riskWarningField] : []),
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
   * Feature 027: 發送機會結束通知
   */
  async sendDisappearedNotification(
    webhookUrl: string,
    message: OpportunityDisappearedMessage
  ): Promise<NotificationResult> {
    const timestamp = new Date();

    try {
      // 時間資訊
      const startTime = formatTime(message.detectedAt);
      const endTime = formatTime(message.disappearedAt);

      // 費差統計
      const spreadStats = `初始：${(message.initialSpread * 100).toFixed(2)}% → 最高：${(message.maxSpread * 100).toFixed(2)}%（${formatTime(message.maxSpreadAt)}）→ 結束：${(message.finalSpread * 100).toFixed(2)}%`;

      // 收益資訊（Feature 030: 顯示各交易所結算間隔）
      const profitInfo = formatProfitInfoDiscord({
        longSettlementCount: message.longSettlementCount,
        shortSettlementCount: message.shortSettlementCount,
        longExchange: message.longExchange,
        shortExchange: message.shortExchange,
        longIntervalHours: message.longIntervalHours,
        shortIntervalHours: message.shortIntervalHours,
        totalFundingProfit: message.totalFundingProfit,
        totalCost: message.totalCost,
        netProfit: message.netProfit,
        realizedAPY: message.realizedAPY,
      });

      const embed = {
        title: `📉 套利機會結束：${message.symbol}`,
        color: 0x9b59b6, // 紫色 (9807270 in decimal)
        fields: [
          {
            name: '📍 交易對',
            value: `做多：**${message.longExchange.toUpperCase()}** / 做空：**${message.shortExchange.toUpperCase()}**`,
            inline: false,
          },
          {
            name: '⏱️ 持續時間',
            value: `開始：${startTime} → 結束：${endTime}\n持續：${message.durationFormatted}`,
            inline: false,
          },
          {
            name: '📊 費差統計',
            value: spreadStats,
            inline: false,
          },
          {
            name: '💰 模擬收益',
            value: profitInfo,
            inline: false,
          },
          {
            name: '📬 通知次數',
            value: `${message.notificationCount} 次`,
            inline: true,
          },
        ],
        footer: {
          text: '💡 此機會的年化收益已低於您設定的閾值',
        },
        timestamp: message.timestamp.toISOString(),
      };

      await axios.post(
        webhookUrl,
        { embeds: [embed] },
        { timeout: this.timeout }
      );

      logger.info(
        {
          symbol: message.symbol,
          duration: message.durationFormatted,
          netProfit: message.netProfit,
        },
        'Discord disappeared notification sent successfully'
      );

      return {
        webhookId: '',
        success: true,
        timestamp,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to send Discord disappeared notification');

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

  /**
   * Feature 033: 取得風險警告欄位
   * @param riskLevel - 風險等級
   * @param priceDiffPercent - 價差百分比
   * @returns Discord embed field 或 null
   */
  private getRiskWarningField(
    riskLevel: ReturnType<typeof getPriceRiskLevel>,
    priceDiffPercent?: number
  ): { name: string; value: string; inline: boolean } | null {
    if (riskLevel === 'unknown') {
      return {
        name: '⚠️ 風險提示',
        value: '**無價差資訊**\n開倉前請自行確認兩交易所的價差，避免因價差過大導致虧損。',
        inline: false,
      };
    }

    if (riskLevel === 'warning' && priceDiffPercent !== undefined) {
      return {
        name: '⚠️ 價差警告',
        value: `**價差 ${Math.abs(priceDiffPercent).toFixed(2)}% 超過 ${PRICE_DIFF_WARNING_THRESHOLD}%**\n開倉成本較高，請評估是否值得進場。`,
        inline: false,
      };
    }

    return null;
  }
}
