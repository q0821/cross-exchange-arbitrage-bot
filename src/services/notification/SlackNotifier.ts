import axios from 'axios';
import { logger } from '../../lib/logger';
import { getPriceRiskLevel, PRICE_DIFF_WARNING_THRESHOLD } from '../../lib/priceRisk';
import type {
  INotifier,
  NotificationResult,
  ArbitrageNotificationMessage,
  OpportunityDisappearedMessage,
  TriggerNotificationMessage,
  EmergencyNotificationMessage,
} from './types';
import {
  generateExchangeUrl,
  formatPriceSmart,
  formatTime,
  formatProfitInfo,
} from './utils';

/**
 * Slack Notifier
 * 使用 Slack Incoming Webhooks 發送通知
 * Feature 026: Discord/Slack 套利機會即時推送通知
 * Feature 027: 套利機會結束監測和通知
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

      // Feature 033: 價差風險警告
      const priceRiskLevel = getPriceRiskLevel(message.priceDiffPercent);
      const riskWarningBlock = this.getRiskWarningBlock(priceRiskLevel, message.priceDiffPercent);

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
                message.longPrice ? `價格：${formatPriceSmart(message.longPrice)}` : '',
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
                message.shortPrice ? `價格：${formatPriceSmart(message.shortPrice)}` : '',
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
        // Feature 033: 風險警告區塊（如果有）
        ...(riskWarningBlock ? [riskWarningBlock] : []),
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
      const profitInfoPlain = formatProfitInfo({
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

      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `📉 套利機會結束：${message.symbol}`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*📍 交易對*\n做多：${message.longExchange.toUpperCase()} / 做空：${message.shortExchange.toUpperCase()}`,
            },
            {
              type: 'mrkdwn',
              text: `*⏱️ 持續時間*\n開始：${startTime} → 結束：${endTime}\n持續：${message.durationFormatted}`,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*📊 費差統計*\n${spreadStats}`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*💰 模擬收益*\n${profitInfoPlain}`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `📬 通知次數：${message.notificationCount} 次 | 💡 此機會的年化收益已低於您設定的閾值`,
            },
          ],
        },
      ];

      await axios.post(
        webhookUrl,
        { blocks },
        { timeout: this.timeout }
      );

      logger.info(
        {
          symbol: message.symbol,
          duration: message.durationFormatted,
          netProfit: message.netProfit,
        },
        'Slack disappeared notification sent successfully'
      );

      return {
        webhookId: '',
        success: true,
        timestamp,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to send Slack disappeared notification');

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

  /**
   * Feature 033: 取得風險警告區塊
   * @param riskLevel - 風險等級
   * @param priceDiffPercent - 價差百分比
   * @returns Slack Block 或 null
   */
  private getRiskWarningBlock(
    riskLevel: ReturnType<typeof getPriceRiskLevel>,
    priceDiffPercent?: number
  ): { type: string; text: { type: string; text: string } } | null {
    if (riskLevel === 'unknown') {
      return {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '⚠️ *風險提示*\n無價差資訊，開倉前請自行確認兩交易所的價差，避免因價差過大導致虧損。',
        },
      };
    }

    if (riskLevel === 'warning' && priceDiffPercent !== undefined) {
      return {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `⚠️ *價差警告*\n價差 ${Math.abs(priceDiffPercent).toFixed(2)}% 超過 ${PRICE_DIFF_WARNING_THRESHOLD}%，開倉成本較高，請評估是否值得進場。`,
        },
      };
    }

    return null;
  }

  // ===== Feature 050: 停損停利觸發通知 =====

  /**
   * Feature 050: 發送觸發通知
   */
  async sendTriggerNotification(
    webhookUrl: string,
    message: TriggerNotificationMessage
  ): Promise<NotificationResult> {
    const timestamp = new Date();

    try {
      const { title, emoji } = this.getTriggerInfo(message.triggerType);
      const pnlEmoji = message.pnl.totalPnL >= 0 ? '📈' : '📉';
      const pnlSign = message.pnl.totalPnL >= 0 ? '+' : '';

      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${emoji} ${title}：${message.symbol}`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: [
                '*🎯 觸發資訊*',
                `交易所：*${message.triggeredExchange.toUpperCase()}*`,
                `方向：${message.triggeredSide === 'LONG' ? '做多' : '做空'}`,
                message.triggerPrice ? `觸發價：${formatPriceSmart(message.triggerPrice)}` : '',
              ]
                .filter(Boolean)
                .join('\n'),
            },
            {
              type: 'mrkdwn',
              text: [
                '*✅ 自動平倉*',
                `交易所：*${message.closedExchange.toUpperCase()}*`,
                `方向：${message.closedSide === 'LONG' ? '做多' : '做空'}`,
                message.closePrice ? `平倉價：${formatPriceSmart(message.closePrice)}` : '',
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
              `*${pnlEmoji} 損益結算*`,
              `價差損益：${message.pnl.priceDiffPnL >= 0 ? '+' : ''}${message.pnl.priceDiffPnL.toFixed(2)} USDT`,
              `資金費率：${message.pnl.fundingRatePnL >= 0 ? '+' : ''}${message.pnl.fundingRatePnL.toFixed(2)} USDT`,
              `手續費：-${message.pnl.totalFees.toFixed(2)} USDT`,
              `───────────`,
              `*總損益：${pnlSign}${message.pnl.totalPnL.toFixed(2)} USDT* (${message.pnl.roi >= 0 ? '+' : ''}${message.pnl.roi.toFixed(2)}%)`,
            ].join('\n'),
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: [
              '*📊 持倉資訊*',
              `數量：${message.positionSize} | 槓桿：${message.leverage}x | 持倉時間：${message.holdingDuration}`,
            ].join('\n'),
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `持倉 ID: ${message.positionId}`,
            },
          ],
        },
      ];

      await axios.post(
        webhookUrl,
        { blocks },
        { timeout: this.timeout }
      );

      logger.info(
        {
          symbol: message.symbol,
          triggerType: message.triggerType,
          pnl: message.pnl.totalPnL,
        },
        'Slack trigger notification sent successfully'
      );

      return {
        webhookId: '',
        success: true,
        timestamp,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to send Slack trigger notification');

      return {
        webhookId: '',
        success: false,
        error: errorMessage,
        timestamp,
      };
    }
  }

  /**
   * Feature 050: 發送緊急通知（平倉失敗）
   */
  async sendEmergencyNotification(
    webhookUrl: string,
    message: EmergencyNotificationMessage
  ): Promise<NotificationResult> {
    const timestamp = new Date();

    try {
      const { title } = this.getTriggerInfo(message.triggerType);

      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🚨 緊急：平倉失敗 - ${message.symbol}`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*⚠️ 需要手動處理！*\n\n停損/停利已觸發，但自動平倉另一邊時發生錯誤。',
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*📍 觸發資訊*\n類型：${title}\n觸發交易所：*${message.triggeredExchange.toUpperCase()}*`,
            },
            {
              type: 'mrkdwn',
              text: `*❌ 錯誤訊息*\n\`${message.error}\``,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*⚠️ 建議操作*\n1. 立即檢查兩個交易所的持倉狀態\n2. 手動平倉未平倉的一邊\n3. 確認條件單狀態並手動取消（如需要）',
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `持倉 ID: ${message.positionId}`,
            },
          ],
        },
      ];

      await axios.post(
        webhookUrl,
        { blocks },
        { timeout: this.timeout }
      );

      logger.info(
        {
          symbol: message.symbol,
          triggerType: message.triggerType,
          error: message.error,
        },
        'Slack emergency notification sent successfully'
      );

      return {
        webhookId: '',
        success: true,
        timestamp,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to send Slack emergency notification');

      return {
        webhookId: '',
        success: false,
        error: errorMessage,
        timestamp,
      };
    }
  }

  /**
   * 取得觸發類型相關資訊
   */
  private getTriggerInfo(triggerType: string): {
    title: string;
    emoji: string;
  } {
    switch (triggerType) {
      case 'LONG_SL':
        return { title: '多方停損觸發', emoji: '🔻' };
      case 'LONG_TP':
        return { title: '多方停利觸發', emoji: '🔺' };
      case 'SHORT_SL':
        return { title: '空方停損觸發', emoji: '🔻' };
      case 'SHORT_TP':
        return { title: '空方停利觸發', emoji: '🔺' };
      case 'BOTH':
        return { title: '雙邊觸發', emoji: '⚡' };
      default:
        return { title: '觸發', emoji: '📢' };
    }
  }
}
