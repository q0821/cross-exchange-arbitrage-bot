/**
 * Socket Manager
 *
 * 全域 Socket.io 實例管理器
 * 提供一個集中的方式來訪問 Socket.io 實例
 */

import type { Server as SocketIOServer } from 'socket.io';

/**
 * 全域 Socket.io 實例
 */
let ioInstance: SocketIOServer | null = null;

/**
 * 設置 Socket.io 實例
 *
 * @param io - Socket.io 伺服器實例
 */
export function setIo(io: SocketIOServer): void {
  ioInstance = io;
}

/**
 * 取得 Socket.io 實例
 *
 * @returns Socket.io 伺服器實例，或 null（如果尚未初始化）
 */
export function getIo(): SocketIOServer | null {
  return ioInstance;
}

/**
 * 清除 Socket.io 實例
 * 主要用於測試環境
 */
export function clearIo(): void {
  ioInstance = null;
}

/**
 * 向特定用戶房間發送事件
 *
 * @param userId - 用戶 ID
 * @param event - 事件名稱
 * @param data - 事件資料
 * @returns 是否成功發送
 */
export function emitToUser(userId: string, event: string, data: unknown): boolean {
  if (!ioInstance) {
    return false;
  }

  const room = `user:${userId}`;
  ioInstance.to(room).emit(event, data);
  return true;
}

/**
 * 向所有連線的客戶端廣播事件
 *
 * @param event - 事件名稱
 * @param data - 事件資料
 * @returns 是否成功發送
 */
export function broadcastToAll(event: string, data: unknown): boolean {
  if (!ioInstance) {
    return false;
  }

  ioInstance.emit(event, data);
  return true;
}
