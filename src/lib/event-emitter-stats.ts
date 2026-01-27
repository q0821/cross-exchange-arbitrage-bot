/**
 * EventEmitter 統計工具
 *
 * 用於取得 EventEmitter 的 listener 數量統計
 * Feature: 066-memory-monitoring
 */

import { EventEmitter } from 'events';

/**
 * EventEmitter 統計資訊
 */
export interface EventEmitterStats {
  /** listener 總數 */
  totalListeners: number;
  /** 各事件的 listener 數量 */
  listenersByEvent: Record<string, number>;
}

/**
 * 取得 EventEmitter 的統計資訊
 *
 * @param emitter - EventEmitter 實例
 * @returns EventEmitter 統計資訊
 *
 * @example
 * ```typescript
 * class MyService extends EventEmitter {
 *   getDataStructureStats(): DataStructureStats {
 *     const emitterStats = getEventEmitterStats(this);
 *     return {
 *       name: 'MyService',
 *       sizes: { ... },
 *       totalItems: 0,
 *       eventListenerCount: emitterStats.totalListeners,
 *     };
 *   }
 * }
 * ```
 */
export function getEventEmitterStats(emitter: EventEmitter): EventEmitterStats {
  const eventNames = emitter.eventNames();
  const listenersByEvent: Record<string, number> = {};
  let total = 0;

  for (const name of eventNames) {
    const count = emitter.listenerCount(name);
    listenersByEvent[String(name)] = count;
    total += count;
  }

  return {
    totalListeners: total,
    listenersByEvent,
  };
}
