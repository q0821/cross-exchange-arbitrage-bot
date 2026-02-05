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
 * Socket 事件監聽器引用（用於清理）
 */
interface SocketListeners {
  subscribeHandler: () => Promise<void>;
  unsubscribeHandler: () => void;
  setTimeBasisHandler: (data: { timeBasis: 1 | 4 | 8 | 24 }) => Promise<void>;
}

/**
 * 格式化後的 bestPair 資料
 */
interface FormattedBestPair {
  longExchange: string;
  shortExchange: string;
  spread: number;
  spreadPercent: number;
  annualizedReturn: number;
  priceDiffPercent: number | null;
}

/**
 * 格式化後的費率資料（用於快取比對）
 */
interface FormattedRate {
  symbol: string;
  exchanges: Record<string, unknown>;
  bestPair: FormattedBestPair | null;
  status: 'opportunity' | 'approaching' | 'normal';
  timestamp: string;
}

/**
 * MarketRatesHandler
 * 處理批量費率更新的 WebSocket 訂閱和推送邏輯
 */
export class MarketRatesHandler {
  private broadcastInterval: NodeJS.Timeout | null = null;
  private readonly BROADCAST_INTERVAL_MS = 2000; // 2 秒推送一次

  /** 追蹤已註冊的 socket（防止重複註冊監聽器） */
  private registeredSockets: WeakSet<Socket> = new WeakSet();

  /** 儲存監聯器引用以便斷線時清理 */
  private socketListeners: WeakMap<Socket, SocketListeners> = new WeakMap();

  /** 快取格式化後的費率資料（用於差異比對減少物件創建） */
  private lastFormattedRates: Map<string, FormattedRate> = new Map();

  /** 快取費率資料的 hash（用於快速判斷是否需要重建物件） */
  private lastRatesHash: Map<string, string> = new Map();

  /** 快取大小限制（防止記憶體無限增長） */
  private readonly MAX_CACHE_SIZE = 500;

  /** 上次廣播的數據 hash（用於差異廣播） */
  private lastBroadcastHash: string = '';

  /** 上次廣播的 stats hash */
  private lastStatsHash: string = '';

  constructor(private readonly io: SocketIOServer) {}

  /**
   * 註冊 WebSocket 事件處理器
   */
  register(socket: Socket): void {
    // 防止重複註冊（避免事件監聽器累積導致記憶體洩漏）
    if (this.registeredSockets.has(socket)) {
      logger.debug({ socketId: socket.id }, 'Socket already registered, skipping');
      return;
    }

    const authenticatedSocket = socket as AuthenticatedSocket;
    const { userId, email } = authenticatedSocket.data;

    // 定義具名監聽器（保存引用以便斷線時清理）
    const subscribeHandler = async (): Promise<void> => {
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
    };

    const unsubscribeHandler = (): void => {
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
    };

    const setTimeBasisHandler = async (data: { timeBasis: 1 | 4 | 8 | 24 }): Promise<void> => {
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
    };

    // 註冊事件監聽器
    socket.on('subscribe:market-rates', subscribeHandler);
    socket.on('unsubscribe:market-rates', unsubscribeHandler);
    socket.on('set-time-basis', setTimeBasisHandler);

    // 記錄已註冊狀態和監聽器引用（用於斷線時清理）
    this.registeredSockets.add(socket);
    this.socketListeners.set(socket, {
      subscribeHandler,
      unsubscribeHandler,
      setTimeBasisHandler,
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
   * 取消註冊 socket 的事件監聽器（斷線時呼叫以防止記憶體洩漏）
   */
  unregister(socket: Socket): void {
    const listeners = this.socketListeners.get(socket);
    if (!listeners) {
      return;
    }

    // 移除所有事件監聽器
    socket.off('subscribe:market-rates', listeners.subscribeHandler);
    socket.off('unsubscribe:market-rates', listeners.unsubscribeHandler);
    socket.off('set-time-basis', listeners.setTimeBasisHandler);

    // 清理追蹤狀態
    this.socketListeners.delete(socket);
    this.registeredSockets.delete(socket);

    logger.debug({ socketId: socket.id }, 'MarketRatesHandler unregistered for socket');
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
   * 使用差異廣播機制：數據沒變則跳過，減少無效的 JSON 序列化和網路傳輸
   */
  private broadcastRates(): void {
    try {
      const room = 'market-rates';

      // 檢查是否有訂閱者，沒有則跳過（避免無謂的物件創建造成記憶體浪費）
      const subscriberCount = this.io.sockets.adapter.rooms.get(room)?.size || 0;
      if (subscriberCount === 0) {
        logger.trace({ room }, 'No subscribers, skipping broadcast');
        return;
      }

      const rates = ratesCache.getAll();
      const stats = ratesCache.getStats(rates);  // 傳入 rates 避免重複呼叫 getAll()

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

      // 差異廣播：計算整體 hash，相同則跳過 rates:update
      const ratesHash = this.computeBroadcastHash(formattedRates);
      const shouldBroadcastRates = ratesHash !== this.lastBroadcastHash;

      if (shouldBroadcastRates) {
        this.lastBroadcastHash = ratesHash;

        // 發送 rates:update 事件
        this.io.to(room).emit('rates:update', {
          type: 'rates:update',
          data: {
            rates: formattedRates,
            timestamp: new Date().toISOString(),
          },
        });
      }

      // 差異廣播：計算 stats hash，相同則跳過 rates:stats
      const statsHash = this.computeStatsHash(stats);
      const shouldBroadcastStats = statsHash !== this.lastStatsHash;

      if (shouldBroadcastStats) {
        this.lastStatsHash = statsHash;

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
      }

      // 只在有實際廣播時記錄日誌
      if (shouldBroadcastRates || shouldBroadcastStats) {
        logger.info(
          {
            room,
            rateCount: rates.length,
            opportunityCount: stats.opportunityCount,
            subscriberCount,
            lastUpdate: stats.lastUpdate?.toISOString() || null,
            broadcastedRates: shouldBroadcastRates,
            broadcastedStats: shouldBroadcastStats,
            sampleRateWithSpread: formattedRates[0]?.bestPair
              ? {
                  symbol: formattedRates[0].symbol,
                  spreadPercent: formattedRates[0].bestPair.spreadPercent,
                  priceDiffPercent: formattedRates[0].bestPair.priceDiffPercent,
                }
              : null,
          },
          'Broadcasted market rates update with price spread',
        );
      } else {
        logger.trace({ room, subscriberCount }, 'Rates unchanged, skipped broadcast');
      }
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
      const stats = ratesCache.getStats(rates);  // 傳入 rates 避免重複呼叫 getAll()

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
   * 使用差異快取機制：只在資料變更時重建物件，減少記憶體壓力
   */
  private formatRates(rates: any[]): FormattedRate[] {
    const result: FormattedRate[] = [];
    const currentSymbols = new Set<string>();

    for (const rate of rates) {
      const symbol = rate.symbol;
      currentSymbols.add(symbol);

      // 計算 hash 用於快速判斷資料是否變更
      const hash = this.computeRateHash(rate);

      // 檢查快取命中
      if (hash === this.lastRatesHash.get(symbol)) {
        const cached = this.lastFormattedRates.get(symbol);
        if (cached) {
          result.push(cached);
          continue;
        }
      }

      // 快取未命中，建立新的格式化物件
      const formatted = this.buildFormattedRate(rate);

      // 更新快取（LRU：刪除再插入確保順序）
      this.lastFormattedRates.delete(symbol);
      this.lastFormattedRates.set(symbol, formatted);
      this.lastRatesHash.delete(symbol);
      this.lastRatesHash.set(symbol, hash);

      result.push(formatted);
    }

    // 清理不再存在的交易對快取
    this.cleanupStaleCache(currentSymbols);

    // LRU 淘汰：超過限制時移除最舊的項目
    this.enforceCacheLimit();

    return result;
  }

  /**
   * 計算費率資料的 hash（用於快速判斷是否需要重建物件）
   */
  private computeRateHash(rate: any): string {
    const recordedAt = rate.recordedAt?.getTime() ?? 0;
    const spreadPercent = rate.bestPair?.spreadPercent ?? 0;
    const spreadAnnualized = rate.bestPair?.spreadAnnualized ?? 0;

    // 包含交易所數量，確保交易所變更時也會重建
    const exchangeCount = rate.exchanges?.size ?? 0;

    return `${recordedAt}-${spreadPercent}-${spreadAnnualized}-${exchangeCount}`;
  }

  /**
   * 建立單一費率的格式化物件
   */
  private buildFormattedRate(rate: any): FormattedRate {
    // 計算門檻（使用年化收益）
    const opportunityThreshold = DEFAULT_OPPORTUNITY_THRESHOLD_ANNUALIZED;
    const approachingThreshold = opportunityThreshold * APPROACHING_THRESHOLD_RATIO;

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
  }

  /**
   * 清理不再存在的交易對快取
   */
  private cleanupStaleCache(currentSymbols: Set<string>): void {
    for (const symbol of this.lastFormattedRates.keys()) {
      if (!currentSymbols.has(symbol)) {
        this.lastFormattedRates.delete(symbol);
        this.lastRatesHash.delete(symbol);
      }
    }
  }

  /**
   * 強制執行快取大小限制（LRU 淘汰）
   */
  private enforceCacheLimit(): void {
    while (this.lastFormattedRates.size > this.MAX_CACHE_SIZE) {
      const firstKey = this.lastFormattedRates.keys().next().value;
      if (firstKey) {
        this.lastFormattedRates.delete(firstKey);
        this.lastRatesHash.delete(firstKey);
      } else {
        break;
      }
    }
  }

  /**
   * 清除格式化快取（用於測試或重置）
   */
  clearFormatCache(): void {
    this.lastFormattedRates.clear();
    this.lastRatesHash.clear();
    this.lastBroadcastHash = '';
    this.lastStatsHash = '';
  }

  /**
   * 計算廣播數據的整體 hash（用於差異廣播）
   * 只比對關鍵欄位，避免時間戳導致的誤判
   */
  private computeBroadcastHash(rates: FormattedRate[]): string {
    // 使用所有費率的關鍵數據組合成 hash
    // 包含：symbol 數量、每個 symbol 的 bestPair spread、status
    const parts: string[] = [rates.length.toString()];

    for (const rate of rates) {
      parts.push(
        `${rate.symbol}:${rate.bestPair?.spreadPercent ?? 0}:${rate.status}`
      );
    }

    return parts.join('|');
  }

  /**
   * 計算統計數據的 hash（用於差異廣播）
   */
  private computeStatsHash(stats: import('../../services/monitor/RatesCache').MarketStats): string {
    return `${stats.totalSymbols}:${stats.opportunityCount}:${stats.approachingCount}:${stats.maxSpread?.spread ?? 0}`;
  }

  /**
   * 取得快取統計資訊（用於監控）
   */
  getFormatCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.lastFormattedRates.size,
      maxSize: this.MAX_CACHE_SIZE,
    };
  }
}
