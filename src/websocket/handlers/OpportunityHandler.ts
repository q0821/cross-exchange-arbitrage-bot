import { Server as SocketIOServer, Socket } from 'socket.io';
import { AuthenticatedSocket } from '../SocketServer.js';
import { logger } from '../../lib/logger.js';

/**
 * OpportunityHandler
 * 處理套利機會的 WebSocket 訂閱和推送邏輯
 */

export class OpportunityHandler {
  constructor(private readonly io: SocketIOServer) {}

  /**
   * 註冊 WebSocket 事件處理器
   */
  register(socket: Socket): void {
    const authenticatedSocket = socket as AuthenticatedSocket;
    const { userId, email } = authenticatedSocket.data;

    // 訂閱套利機會更新
    socket.on('subscribe:opportunities', () => {
      const room = 'opportunities';
      socket.join(room);

      logger.info(
        {
          socketId: socket.id,
          userId,
          email,
          room,
        },
        'Client subscribed to opportunities',
      );

      // 發送訂閱確認
      socket.emit('subscribed:opportunities', {
        success: true,
        message: 'Subscribed to opportunities updates',
      });
    });

    // 取消訂閱套利機會更新
    socket.on('unsubscribe:opportunities', () => {
      const room = 'opportunities';
      socket.leave(room);

      logger.info(
        {
          socketId: socket.id,
          userId,
          room,
        },
        'Client unsubscribed from opportunities',
      );

      // 發送取消訂閱確認
      socket.emit('unsubscribed:opportunities', {
        success: true,
        message: 'Unsubscribed from opportunities updates',
      });
    });

    // 訂閱特定幣別的機會
    socket.on('subscribe:symbol', (data: { symbol: string }) => {
      const { symbol } = data;
      const room = `symbol:${symbol}`;
      socket.join(room);

      logger.info(
        {
          socketId: socket.id,
          userId,
          symbol,
          room,
        },
        'Client subscribed to symbol opportunities',
      );

      socket.emit('subscribed:symbol', {
        success: true,
        symbol,
        message: `Subscribed to ${symbol} opportunities`,
      });
    });

    // 取消訂閱特定幣別的機會
    socket.on('unsubscribe:symbol', (data: { symbol: string }) => {
      const { symbol } = data;
      const room = `symbol:${symbol}`;
      socket.leave(room);

      logger.info(
        {
          socketId: socket.id,
          userId,
          symbol,
          room,
        },
        'Client unsubscribed from symbol opportunities',
      );

      socket.emit('unsubscribed:symbol', {
        success: true,
        symbol,
        message: `Unsubscribed from ${symbol} opportunities`,
      });
    });

    logger.debug(
      {
        socketId: socket.id,
        userId,
      },
      'OpportunityHandler registered for socket',
    );
  }

  /**
   * 向所有訂閱者廣播新機會
   */
  broadcastNewOpportunity(opportunity: unknown): void {
    const room = 'opportunities';
    this.io.to(room).emit('opportunity:new', opportunity);

    logger.debug(
      {
        room,
        opportunityId: (opportunity as any).id,
      },
      'Broadcasted new opportunity',
    );
  }

  /**
   * 向所有訂閱者廣播機會更新
   */
  broadcastOpportunityUpdate(opportunity: unknown): void {
    const room = 'opportunities';
    this.io.to(room).emit('opportunity:update', opportunity);

    logger.debug(
      {
        room,
        opportunityId: (opportunity as any).id,
      },
      'Broadcasted opportunity update',
    );
  }

  /**
   * 向所有訂閱者廣播機會過期
   */
  broadcastOpportunityExpired(opportunityId: string): void {
    const room = 'opportunities';
    this.io.to(room).emit('opportunity:expired', { id: opportunityId });

    logger.debug(
      {
        room,
        opportunityId,
      },
      'Broadcasted opportunity expired',
    );
  }

  /**
   * 向特定幣別訂閱者廣播新機會
   */
  broadcastSymbolOpportunity(symbol: string, opportunity: unknown): void {
    const room = `symbol:${symbol}`;
    this.io.to(room).emit('opportunity:new', opportunity);

    logger.debug(
      {
        room,
        symbol,
        opportunityId: (opportunity as any).id,
      },
      'Broadcasted symbol opportunity',
    );
  }
}
