import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyToken } from '@lib/jwt';
import { logger } from '@lib/logger';
import { MarketRatesHandler } from './handlers/MarketRatesHandler';

/**
 * Socket.io 伺服器初始化
 */

export interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    email: string;
    timeBasis?: number; // User's preferred time basis (1, 8, or 24 hours)
  };
}

// 全域 Handler 實例（供外部使用）
let globalMarketRatesHandler: MarketRatesHandler | null = null;

/**
 * 初始化 Socket.io 伺服器
 */
export function initializeSocketServer(httpServer: HttpServer): SocketIOServer {
  const isDevelopment = process.env.NODE_ENV === 'development';

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: isDevelopment
        ? ['http://localhost:3000', 'http://127.0.0.1:3000']
        : (process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000'),
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['polling', 'websocket'], // 先使用 polling，再升級到 websocket
    allowEIO3: true, // 允許舊版客戶端
  });

  // 認證中介軟體
  io.use((socket, next) => {
    try {
      // 從 handshake 中提取 token
      const token = extractTokenFromSocket(socket);

      if (!token) {
        logger.warn(
          {
            socketId: socket.id,
            headers: socket.handshake.headers,
            auth: socket.handshake.auth,
            query: socket.handshake.query,
          },
          'WebSocket connection rejected: No token provided',
        );
        return next(new Error('Authentication error: No token provided'));
      }

      // 驗證 token
      const payload = verifyToken(token);

      // 儲存用戶資訊到 socket.data
      socket.data.userId = payload.userId;
      socket.data.email = payload.email;

      logger.info(
        {
          socketId: socket.id,
          userId: payload.userId,
          email: payload.email,
        },
        'WebSocket connection authenticated',
      );

      next();
    } catch (error) {
      logger.warn(
        {
          socketId: socket.id,
          error: error instanceof Error ? error.message : String(error),
        },
        'WebSocket authentication failed',
      );

      return next(new Error('Authentication error: Invalid token'));
    }
  });

  // 初始化 Handlers
  const marketRatesHandler = new MarketRatesHandler(io);
  globalMarketRatesHandler = marketRatesHandler;

  // 啟動市場監控的定期廣播
  marketRatesHandler.startBroadcasting();

  // 連線處理
  io.on('connection', (socket: Socket) => {
    const authenticatedSocket = socket as AuthenticatedSocket;
    const { userId, email } = authenticatedSocket.data;

    logger.info(
      {
        socketId: socket.id,
        userId,
        email,
      },
      'WebSocket client connected',
    );

    // 加入用戶私有房間
    const userRoom = `user:${userId}`;
    void socket.join(userRoom);

    logger.info(
      {
        socketId: socket.id,
        userId,
        room: userRoom,
      },
      'Socket joined user room',
    );

    // 註冊 Handlers
    marketRatesHandler.register(socket);

    // 斷線處理
    socket.on('disconnect', (reason) => {
      // 清理 handler 監聽器（防止記憶體洩漏）
      marketRatesHandler.unregister(socket);

      logger.info(
        {
          socketId: socket.id,
          userId,
          reason,
        },
        'WebSocket client disconnected',
      );
    });

    // 錯誤處理
    socket.on('error', (error) => {
      logger.error(
        {
          socketId: socket.id,
          userId,
          error: error.message,
        },
        'WebSocket error occurred',
      );
    });
  });

  logger.info('Socket.io server initialized');

  return io;
}

/**
 * 取得全域 MarketRatesHandler 實例
 */
export function getMarketRatesHandler(): MarketRatesHandler | null {
  return globalMarketRatesHandler;
}

/**
 * 從 Socket handshake 中提取 JWT Token
 */
function extractTokenFromSocket(socket: Socket): string | null {
  // 方法 1: 從 Cookie 中提取（透過 handshake headers）
  const cookieHeader = socket.handshake.headers.cookie;
  if (cookieHeader) {
    const cookies = parseCookies(cookieHeader);
    if (cookies.token) {
      return cookies.token;
    }
  }

  // 方法 2: 從 auth object 中提取（socket.io-client 可以傳遞 auth）
  const auth = socket.handshake.auth as { token?: string } | undefined;
  if (auth?.token) {
    return auth.token;
  }

  // 方法 3: 從 query 參數中提取（不推薦，但作為備援）
  const query = socket.handshake.query;
  if (query.token && typeof query.token === 'string') {
    return query.token;
  }

  return null;
}

/**
 * 解析 Cookie 字串
 */
function parseCookies(cookieString: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  cookieString.split(';').forEach((cookie) => {
    const [name, ...rest] = cookie.split('=');
    if (name && rest.length > 0) {
      cookies[name.trim()] = rest.join('=').trim();
    }
  });

  return cookies;
}

/**
 * 向特定用戶房間發送事件
 */
export function emitToUser(io: SocketIOServer, userId: string, event: string, data: unknown): void {
  const room = `user:${userId}`;
  io.to(room).emit(event, data);

  logger.debug(
    {
      userId,
      room,
      event,
    },
    'Emitted event to user room',
  );
}

/**
 * 向所有連線的客戶端廣播事件
 */
export function broadcastToAll(io: SocketIOServer, event: string, data: unknown): void {
  io.emit(event, data);

  logger.debug(
    {
      event,
    },
    'Broadcasted event to all clients',
  );
}
