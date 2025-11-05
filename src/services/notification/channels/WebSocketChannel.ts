import { INotificationChannel, NotificationPayload } from '../../../types/service-interfaces.js';
import { getOpportunityHandler } from '../../../websocket/SocketServer.js';
import { logger } from '../../../lib/logger.js';

/**
 * WebSocket 通知渠道
 * 透過 Socket.io 向已連線的客戶端推送即時通知
 */
export class WebSocketChannel implements INotificationChannel {
  readonly name = 'websocket';

  async send(payload: NotificationPayload): Promise<void> {
    try {
      const opportunityHandler = getOpportunityHandler();

      if (!opportunityHandler) {
        logger.warn(
          {
            channel: this.name,
            eventType: payload.eventType,
          },
          'OpportunityHandler not initialized, skipping WebSocket notification',
        );
        return;
      }

      // 根據事件類型發送不同的 WebSocket 事件
      switch (payload.eventType) {
        case 'OPPORTUNITY_DETECTED':
          opportunityHandler.broadcastNewOpportunity(payload.data);
          logger.debug(
            {
              channel: this.name,
              eventType: payload.eventType,
              opportunityId: (payload.data as any).id,
            },
            'Broadcasted new opportunity via WebSocket',
          );
          break;

        case 'OPPORTUNITY_UPDATED':
          opportunityHandler.broadcastOpportunityUpdate(payload.data);
          logger.debug(
            {
              channel: this.name,
              eventType: payload.eventType,
              opportunityId: (payload.data as any).id,
            },
            'Broadcasted opportunity update via WebSocket',
          );
          break;

        case 'OPPORTUNITY_EXPIRED':
          const opportunityId =
            typeof payload.data === 'object' && payload.data !== null
              ? (payload.data as any).id
              : String(payload.data);
          opportunityHandler.broadcastOpportunityExpired(opportunityId);
          logger.debug(
            {
              channel: this.name,
              eventType: payload.eventType,
              opportunityId,
            },
            'Broadcasted opportunity expired via WebSocket',
          );
          break;

        default:
          logger.warn(
            {
              channel: this.name,
              eventType: payload.eventType,
            },
            'Unknown event type for WebSocket channel',
          );
      }
    } catch (error) {
      logger.error(
        {
          error,
          channel: this.name,
          eventType: payload.eventType,
        },
        'Failed to send WebSocket notification',
      );
      throw error;
    }
  }

  /**
   * 檢查 WebSocket 通道是否可用
   */
  isAvailable(): boolean {
    return getOpportunityHandler() !== null;
  }
}
