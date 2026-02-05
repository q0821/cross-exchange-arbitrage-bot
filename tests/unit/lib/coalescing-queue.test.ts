/**
 * CoalescingQueue 單元測試
 *
 * 測試 Validated Coalescing 模式的核心功能：
 * - 只保留每個 key 的最新值
 * - 批量處理減少事件迴圈開銷
 * - 正確處理並發和邊界情況
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CoalescingQueue } from '@/lib/coalescing-queue';

describe('CoalescingQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('基本功能', () => {
    it('應該只保留每個 key 的最新值', async () => {
      const processed: Map<string, number>[] = [];
      const queue = new CoalescingQueue<number>(
        (items) => {
          processed.push(new Map(items));
        },
        100
      );

      // 同一個 key 入隊多次
      queue.enqueue('A', 1);
      queue.enqueue('A', 2);
      queue.enqueue('A', 3);

      // 等待處理
      await vi.advanceTimersByTimeAsync(100);

      expect(processed).toHaveLength(1);
      expect(processed[0].get('A')).toBe(3); // 只有最新值
    });

    it('應該正確處理多個不同的 key', async () => {
      const processed: Map<string, number>[] = [];
      const queue = new CoalescingQueue<number>(
        (items) => {
          processed.push(new Map(items));
        },
        100
      );

      queue.enqueue('A', 1);
      queue.enqueue('B', 2);
      queue.enqueue('C', 3);

      await vi.advanceTimersByTimeAsync(100);

      expect(processed).toHaveLength(1);
      expect(processed[0].size).toBe(3);
      expect(processed[0].get('A')).toBe(1);
      expect(processed[0].get('B')).toBe(2);
      expect(processed[0].get('C')).toBe(3);
    });

    it('應該在指定間隔後批量處理', async () => {
      const handler = vi.fn();
      const queue = new CoalescingQueue<number>(handler, 50);

      queue.enqueue('A', 1);

      // 還沒到處理時間
      expect(handler).not.toHaveBeenCalled();

      // 等待處理
      await vi.advanceTimersByTimeAsync(50);

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('批量入隊', () => {
    it('enqueueBatch 應該正確處理批量資料', async () => {
      const processed: Map<string, { id: string; value: number }>[] = [];
      const queue = new CoalescingQueue<{ id: string; value: number }>(
        (items) => {
          processed.push(new Map(items));
        },
        100
      );

      const items = [
        { id: 'A', value: 1 },
        { id: 'B', value: 2 },
        { id: 'A', value: 3 }, // 覆蓋 A
      ];

      queue.enqueueBatch(items, (item) => item.id);

      await vi.advanceTimersByTimeAsync(100);

      expect(processed).toHaveLength(1);
      expect(processed[0].size).toBe(2); // A 和 B
      expect(processed[0].get('A')?.value).toBe(3); // A 的最新值
      expect(processed[0].get('B')?.value).toBe(2);
    });
  });

  describe('去抖動機制', () => {
    it('連續入隊應該只觸發一次處理', async () => {
      const handler = vi.fn();
      const queue = new CoalescingQueue<number>(handler, 100);

      // 連續入隊
      for (let i = 0; i < 10; i++) {
        queue.enqueue('A', i);
        await vi.advanceTimersByTimeAsync(10);
      }

      // 等待最後一次處理
      await vi.advanceTimersByTimeAsync(100);

      // 應該只處理一次
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(new Map([['A', 9]])); // 最新值
    });

    it('處理完成後的新入隊應該觸發新的處理', async () => {
      const handler = vi.fn();
      const queue = new CoalescingQueue<number>(handler, 100);

      // 第一批
      queue.enqueue('A', 1);
      await vi.advanceTimersByTimeAsync(100);

      expect(handler).toHaveBeenCalledTimes(1);

      // 第二批
      queue.enqueue('A', 2);
      await vi.advanceTimersByTimeAsync(100);

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('flush 方法', () => {
    it('flush 應該立即處理所有待處理項目', async () => {
      vi.useRealTimers(); // flush 需要真實計時器

      const processed: Map<string, number>[] = [];
      const queue = new CoalescingQueue<number>(
        (items) => {
          processed.push(new Map(items));
        },
        1000 // 長間隔
      );

      queue.enqueue('A', 1);
      queue.enqueue('B', 2);

      // 立即 flush，不等待間隔
      await queue.flush();

      expect(processed).toHaveLength(1);
      expect(processed[0].size).toBe(2);
    });

    it('flush 後佇列應該為空', async () => {
      vi.useRealTimers();

      const queue = new CoalescingQueue<number>(() => {}, 1000);

      queue.enqueue('A', 1);
      expect(queue.size()).toBe(1);

      await queue.flush();

      expect(queue.size()).toBe(0);
    });
  });

  describe('clear 方法', () => {
    it('clear 應該清空佇列而不觸發處理', async () => {
      const handler = vi.fn();
      const queue = new CoalescingQueue<number>(handler, 100);

      queue.enqueue('A', 1);
      queue.enqueue('B', 2);

      queue.clear();

      // 等待原本應該處理的時間
      await vi.advanceTimersByTimeAsync(100);

      expect(handler).not.toHaveBeenCalled();
      expect(queue.size()).toBe(0);
    });
  });

  describe('並發處理', () => {
    it('處理期間入隊的項目應該在下一批處理', async () => {
      vi.useRealTimers();

      const processed: Map<string, number>[] = [];
      let resolveProcessing: () => void;
      const processingPromise = new Promise<void>((resolve) => {
        resolveProcessing = resolve;
      });

      const queue = new CoalescingQueue<number>(
        async (items) => {
          processed.push(new Map(items));
          if (processed.length === 1) {
            // 第一批處理時，等待外部訊號
            await processingPromise;
          }
        },
        10
      );

      // 第一批
      queue.enqueue('A', 1);

      // 等待第一批開始處理
      await new Promise((r) => setTimeout(r, 20));

      // 在處理期間入隊新項目
      queue.enqueue('B', 2);

      // 完成第一批處理
      resolveProcessing!();

      // 等待第二批處理
      await new Promise((r) => setTimeout(r, 50));

      expect(processed).toHaveLength(2);
      expect(processed[0].get('A')).toBe(1);
      expect(processed[1].get('B')).toBe(2);
    });
  });

  describe('異步處理函數', () => {
    it('應該正確處理異步處理函數', async () => {
      vi.useRealTimers();

      const results: number[] = [];

      const queue = new CoalescingQueue<number>(
        async (items) => {
          // 模擬異步操作
          await new Promise((r) => setTimeout(r, 10));
          for (const [, value] of items) {
            results.push(value);
          }
        },
        10
      );

      queue.enqueue('A', 1);
      queue.enqueue('B', 2);

      await queue.flush();

      expect(results).toContain(1);
      expect(results).toContain(2);
    });
  });

  describe('狀態查詢', () => {
    it('size 應該返回當前佇列大小', () => {
      const queue = new CoalescingQueue<number>(() => {}, 100);

      expect(queue.size()).toBe(0);

      queue.enqueue('A', 1);
      expect(queue.size()).toBe(1);

      queue.enqueue('B', 2);
      expect(queue.size()).toBe(2);

      queue.enqueue('A', 3); // 覆蓋
      expect(queue.size()).toBe(2);
    });

    it('isProcessing 應該返回正確的處理狀態', async () => {
      vi.useRealTimers();

      let isProcessingDuringHandler = false;

      const queue = new CoalescingQueue<number>(
        async () => {
          isProcessingDuringHandler = queue.isProcessing();
          await new Promise((r) => setTimeout(r, 10));
        },
        10
      );

      expect(queue.isProcessing()).toBe(false);

      queue.enqueue('A', 1);

      // 等待處理開始
      await new Promise((r) => setTimeout(r, 20));

      expect(isProcessingDuringHandler).toBe(true);
    });
  });

  describe('destroy 方法', () => {
    it('destroy 應該清理所有資源', async () => {
      const handler = vi.fn();
      const queue = new CoalescingQueue<number>(handler, 100);

      queue.enqueue('A', 1);
      queue.destroy();

      await vi.advanceTimersByTimeAsync(100);

      expect(handler).not.toHaveBeenCalled();
      expect(queue.size()).toBe(0);
    });
  });
});
