/**
 * MarketRatesHandler
 * 處理市場監控的批量資金費率推送邏輯
 *
 * Feature: 006-web-trading-platform (User Story 2.5)
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { AuthenticatedSocket } from '../SocketServer';
import { ratesCache } from '../../services/monitor/RatesCache';
import { getMonitorInstance } from '../../services/MonitorService';
import { logger } from '@lib/logger';
import { prisma } from '../../lib/db';
import {
  DEFAULT_OPPORTUNITY_THRESHOLD_ANNUALIZED,
  APPROACHING_THRESHOLD_RATIO,
} from '../../lib/constants';

/**
 * MarketRatesHandler
 * 處理批量費率更新的 WebSocket 訂閱和推送邏輯
 */
export class MarketRatesHandler {
  private broadcastInterval: NodeJS.Timeout | null = null;
  private readonly BROADCAST_INTERVAL_MS = 2000; // 2 秒推送一次

  constructor(private readonly io: SocketIOServer) {}

  /**
   * 註冊 WebSocket 事件處理器
   */
  register(socket: Socket): void {
    const authenticatedSocket = socket as AuthenticatedSocket;
    const { userId, email } = authenticatedSocket.data;

    // 訂閱市場監控更新
    socket.on('subscribe:market-rates', async () => {
      const room = 'market-rates';
      socket.join(room);

      // 從資料庫載入用戶的 timeBasis 偏好
      let userTimeBasis = 8; // 預設值
      try {
        const userData = await prisma.user.findUnique({
          where: { id: userId },
          select: { timeBasisPreference: true },
        });
        if (userData?.timeBasisPreference) {
          userTimeBasis = userData.timeBasisPreference;
          authenticatedSocket.data.timeBasis = userTimeBasis;
        }
      } catch (dbError) {
        logger.error(
          {
            socketId: socket.id,
            userId,
            error: dbError instanceof Error ? dbError.message : String(dbError),
          },
          'Failed to load user time basis preference from database',
        );
      }

      logger.info(
        {
          socketId: socket.id,
          userId,
          email,
          room,
          timeBasis: userTimeBasis,
        },
        'Client subscribed to market rates',
      );

      // 獲取當前啟用的交易所列表
      const monitorInstance = getMonitorInstance();
      const activeExchanges = monitorInstance?.getStatus().connectedExchanges || [];

      // 發送訂閱確認並附帶用戶偏好和啟用交易所
      socket.emit('subscribed:market-rates', {
        success: true,
        message: 'Subscribed to market rates updates',
        timeBasis: userTimeBasis,
        activeExchanges,
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

    // 設定時間基準偏好（異步持久化到資料庫）
    socket.on('set-time-basis', async (data: { timeBasis: 1 | 4 | 8 | 24 }) => {
      try {
        const { timeBasis } = data;

        // 驗證 timeBasis
        if (![1, 4, 8, 24].includes(timeBasis)) {
          socket.emit('error', {
            message: 'Invalid time basis',
            code: 'INVALID_INPUT',
            details: { received: timeBasis, expected: [1, 4, 8, 24] },
          });
          return;
        }

        // 暫存在 socket.data（立即生效）
        authenticatedSocket.data.timeBasis = timeBasis;

        // 異步持久化到資料庫（不阻塞回應）
        prisma.user
          .update({
            where: { id: userId },
            data: { timeBasisPreference: timeBasis },
          })
          .then(() => {
            logger.info(
              {
                socketId: socket.id,
                userId,
                timeBasis,
              },
              'User time basis preference persisted to database',
            );
          })
          .catch((dbError) => {
            logger.error(
              {
                socketId: socket.id,
                userId,
                timeBasis,
                error: dbError instanceof Error ? dbError.message : String(dbError),
              },
              'Failed to persist time basis preference to database',
            );
          });

        logger.info(
          {
            socketId: socket.id,
            userId,
            timeBasis,
          },
          'User updated time basis preference',
        );

        // 發送確認
        socket.emit('time-basis-updated', {
          success: true,
          timeBasis,
        });
      } catch (error) {
        logger.error(
          {
            socketId: socket.id,
            userId,
            error: error instanceof Error ? error.message : String(error),
          },
          'Failed to set time basis',
        );
        socket.emit('error', {
          message: 'Failed to set time basis',
          code: 'INTERNAL_ERROR',
        });
      }
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
      const stats = ratesCache.getStats();

      if (rates.length === 0) {
        logger.warn(
          {
            cacheSize: ratesCache.size(),
            lastUpdate: stats.lastUpdate?.toISOString() || 'never',
            uptime: stats.uptime,
          },
          'No rates to broadcast - cache may be stale or empty',
        );
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

      logger.info(
        {
          room,
          rateCount: rates.length,
          opportunityCount: stats.opportunityCount,
          subscriberCount: this.io.sockets.adapter.rooms.get(room)?.size || 0,
          lastUpdate: stats.lastUpdate?.toISOString() || null,
          sampleRateWithSpread: formattedRates[0]?.bestPair
            ? {
                symbol: formattedRates[0].symbol,
                spreadPercent: formattedRates[0].bestPair.spreadPercent,
                priceDiffPercent: formattedRates[0].bestPair.priceDiffPercent,
                // netReturn removed - Feature 014: 移除淨收益欄位
              }
            : null,
        },
        'Broadcasted market rates update with price spread',
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
      const stats = ratesCache.getStats();

      if (rates.length === 0) {
        logger.warn(
          {
            socketId: socket.id,
            cacheSize: ratesCache.size(),
            lastUpdate: stats.lastUpdate?.toISOString() || 'never',
          },
          'No rates to send - cache may be stale or empty',
        );
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
    // 計算門檻（使用年化收益）
    const opportunityThreshold = DEFAULT_OPPORTUNITY_THRESHOLD_ANNUALIZED;
    const approachingThreshold = opportunityThreshold * APPROACHING_THRESHOLD_RATIO;

    return rates.map((rate) => {
      // Feature 022: 使用年化收益判斷狀態
      const annualizedReturn = rate.bestPair?.spreadAnnualized ?? 0;

      // 判斷狀態（基於年化收益門檻）
      let status: 'opportunity' | 'approaching' | 'normal';
      if (annualizedReturn >= opportunityThreshold) {
        status = 'opportunity';
      } else if (annualizedReturn >= approachingThreshold) {
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
          // Feature 012: 推送所有標準化版本（1h, 8h, 24h）
          normalized: exchangeData.normalized || {},
          originalInterval: exchangeData.originalFundingInterval,
          // Feature: 持倉頁面即時費率 - 新增下次結算時間
          nextFundingTime: exchangeData.rate.nextFundingTime?.toISOString() || null,
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
            priceDiffPercent: rate.bestPair.priceDiffPercent ?? null,
            // netReturn field removed - Feature 014: 移除淨收益欄位
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
