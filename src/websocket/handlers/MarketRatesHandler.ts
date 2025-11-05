/**
 * MarketRatesHandler
 * 處理市場監控的批量資金費率推送邏輯
 *
 * Feature: 006-web-trading-platform (User Story 2.5)
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { AuthenticatedSocket } from '../SocketServer';
import { ratesCache } from '../../services/monitor/RatesCache';
import { logger } from '@lib/logger';

/**
 * MarketRatesHandler
 * 處理批量費率更新的 WebSocket 訂閱和推送邏輯
 */
export class MarketRatesHandler {
  private broadcastInterval: NodeJS.Timeout | null = null;
  private readonly BROADCAST_INTERVAL_MS = 5000; // 5 秒推送一次
  private readonly DEFAULT_THRESHOLD = 0.5; // 預設閾值 0.5%

  constructor(private readonly io: SocketIOServer) {}

  /**
   * 註冊 WebSocket 事件處理器
   */
  register(socket: Socket): void {
    const authenticatedSocket = socket as AuthenticatedSocket;
    const { userId, email } = authenticatedSocket.data;

    // 訂閱市場監控更新
    socket.on('subscribe:market-rates', () => {
      const room = 'market-rates';
      socket.join(room);

      logger.info(
        {
          socketId: socket.id,
          userId,
          email,
          room,
        },
        'Client subscribed to market rates',
      );

      // 發送訂閱確認並立即發送當前數據
      socket.emit('subscribed:market-rates', {
        success: true,
        message: 'Subscribed to market rates updates',
      });

      // 立即發送一次當前數據
      this.sendRatesToSocket(socket);
    });

    // 取消訂閱市場監控更新
    socket.on('unsubscribe:market-rates', () => {
      const room = 'market-rates';
      socket.leave(room);

      logger.info(
        {
          socketId: socket.id,
          userId,
          room,
        },
        'Client unsubscribed from market rates',
      );

      // 發送取消訂閱確認
      socket.emit('unsubscribed:market-rates', {
        success: true,
        message: 'Unsubscribed from market rates updates',
      });
    });

    logger.debug(
      {
        socketId: socket.id,
        userId,
      },
      'MarketRatesHandler registered for socket',
    );
  }

  /**
   * 啟動定期廣播（每 5 秒推送一次）
   */
  startBroadcasting(): void {
    if (this.broadcastInterval) {
      logger.warn('Broadcast interval already running');
      return;
    }

    logger.info(
      {
        intervalMs: this.BROADCAST_INTERVAL_MS,
      },
      'Starting market rates broadcast',
    );

    // 立即執行一次
    this.broadcastRates();

    // 設定定時器
    this.broadcastInterval = setInterval(() => {
      this.broadcastRates();
    }, this.BROADCAST_INTERVAL_MS);
  }

  /**
   * 停止定期廣播
   */
  stopBroadcasting(): void {
    if (!this.broadcastInterval) {
      return;
    }

    logger.info('Stopping market rates broadcast');
    clearInterval(this.broadcastInterval);
    this.broadcastInterval = null;
  }

  /**
   * 向所有訂閱者廣播批量費率更新
   */
  private broadcastRates(): void {
    try {
      const room = 'market-rates';
      const rates = ratesCache.getAll();
      const stats = ratesCache.getStats(this.DEFAULT_THRESHOLD);

      if (rates.length === 0) {
        logger.debug('No rates to broadcast');
        return;
      }

      // 格式化費率數據
      const formattedRates = this.formatRates(rates);

      // 發送 rates:update 事件
      this.io.to(room).emit('rates:update', {
        type: 'rates:update',
        data: {
          rates: formattedRates,
          timestamp: new Date().toISOString(),
        },
      });

      // 發送 rates:stats 事件
      this.io.to(room).emit('rates:stats', {
        type: 'rates:stats',
        data: {
          totalSymbols: stats.totalSymbols,
          opportunityCount: stats.opportunityCount,
          approachingCount: stats.approachingCount,
          maxSpread: stats.maxSpread
            ? {
                symbol: stats.maxSpread.symbol,
                spread: stats.maxSpread.spread,
              }
            : null,
          uptime: stats.uptime,
          lastUpdate: stats.lastUpdate?.toISOString() || null,
        },
      });

      logger.debug(
        {
          room,
          rateCount: rates.length,
          opportunityCount: stats.opportunityCount,
        },
        'Broadcasted market rates update',
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to broadcast market rates',
      );
    }
  }

  /**
   * 向單一 socket 發送費率數據
   */
  private sendRatesToSocket(socket: Socket): void {
    try {
      const rates = ratesCache.getAll();
      const stats = ratesCache.getStats(this.DEFAULT_THRESHOLD);

      if (rates.length === 0) {
        logger.debug({ socketId: socket.id }, 'No rates to send');
        return;
      }

      const formattedRates = this.formatRates(rates);

      socket.emit('rates:update', {
        type: 'rates:update',
        data: {
          rates: formattedRates,
          timestamp: new Date().toISOString(),
        },
      });

      socket.emit('rates:stats', {
        type: 'rates:stats',
        data: {
          totalSymbols: stats.totalSymbols,
          opportunityCount: stats.opportunityCount,
          approachingCount: stats.approachingCount,
          maxSpread: stats.maxSpread
            ? {
                symbol: stats.maxSpread.symbol,
                spread: stats.maxSpread.spread,
              }
            : null,
          uptime: stats.uptime,
          lastUpdate: stats.lastUpdate?.toISOString() || null,
        },
      });

      logger.debug(
        {
          socketId: socket.id,
          rateCount: rates.length,
        },
        'Sent rates to socket',
      );
    } catch (error) {
      logger.error(
        {
          socketId: socket.id,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to send rates to socket',
      );
    }
  }

  /**
   * 格式化費率數據為 WebSocket payload
   */
  private formatRates(rates: any[]): any[] {
    return rates.map((rate) => {
      // 使用 bestPair 的差價數據
      const spreadPercent = rate.bestPair?.spreadPercent ?? 0;

      // 判斷狀態
      let status: 'opportunity' | 'approaching' | 'normal';
      if (spreadPercent >= this.DEFAULT_THRESHOLD) {
        status = 'opportunity';
      } else if (spreadPercent >= this.DEFAULT_THRESHOLD - 0.1 && spreadPercent < this.DEFAULT_THRESHOLD) {
        status = 'approaching';
      } else {
        status = 'normal';
      }

      // 構建所有交易所的數據
      const exchanges: Record<string, any> = {};
      for (const [exchangeName, exchangeData] of rate.exchanges) {
        exchanges[exchangeName] = {
          rate: exchangeData.rate.fundingRate,
          price: exchangeData.price || exchangeData.rate.markPrice || null,
        };
      }

      // 構建 bestPair 信息
      const bestPair = rate.bestPair
        ? {
            longExchange: rate.bestPair.longExchange,
            shortExchange: rate.bestPair.shortExchange,
            spread: rate.bestPair.spreadPercent / 100,
            spreadPercent: rate.bestPair.spreadPercent,
            annualizedReturn: rate.bestPair.spreadAnnualized,
          }
        : null;

      return {
        symbol: rate.symbol,
        exchanges,
        bestPair,
        status,
        timestamp: rate.recordedAt.toISOString(),
      };
    });
  }
}
