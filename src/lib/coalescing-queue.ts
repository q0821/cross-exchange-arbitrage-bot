/**
 * CoalescingQueue - 合併佇列，只保留每個 key 的最新值
 *
 * 適用於高頻更新場景，如：
 * - WebSocket 價格更新（同一 symbol 只需最新價格）
 * - 資金費率更新（同一 exchange:symbol 只需最新值）
 *
 * 優化效果：
 * - 減少不必要的物件創建
 * - 批量處理減少事件迴圈開銷
 * - 自動合併短時間內的多次更新
 *
 * @template T 值的類型
 */
export class CoalescingQueue<T> {
  /** 內部佇列：key -> 最新值 */
  private queue: Map<string, T> = new Map();

  /** 是否正在處理中 */
  private processing = false;

  /** 排程的計時器 */
  private scheduledTimer: ReturnType<typeof setTimeout> | null = null;

  /** 批量處理間隔（毫秒） */
  private readonly batchIntervalMs: number;

  /** 處理函數 */
  private readonly handler: (items: Map<string, T>) => Promise<void> | void;

  /**
   * 建立 CoalescingQueue 實例
   *
   * @param handler 批量處理函數，接收 Map<key, latestValue>
   * @param batchIntervalMs 批量處理間隔，預設 100ms
   */
  constructor(
    handler: (items: Map<string, T>) => Promise<void> | void,
    batchIntervalMs = 100
  ) {
    this.handler = handler;
    this.batchIntervalMs = batchIntervalMs;
  }

  /**
   * 入隊：覆蓋相同 key 的舊值（Coalescing）
   *
   * @param key 唯一識別符（如 "binance:BTCUSDT"）
   * @param value 最新值
   */
  enqueue(key: string, value: T): void {
    this.queue.set(key, value); // 直接覆蓋，舊值丟棄
    this.scheduleProcess();
  }

  /**
   * 批量入隊
   *
   * @param items 要入隊的項目陣列
   * @param keyExtractor 從項目中提取 key 的函數
   */
  enqueueBatch(items: T[], keyExtractor: (item: T) => string): void {
    for (const item of items) {
      const key = keyExtractor(item);
      this.queue.set(key, item);
    }
    this.scheduleProcess();
  }

  /**
   * 排程批量處理
   * 使用去抖動機制，確保在 batchIntervalMs 內的多次 enqueue 只觸發一次處理
   */
  private scheduleProcess(): void {
    if (this.scheduledTimer !== null) {
      return; // 已經排程過了
    }

    this.scheduledTimer = setTimeout(() => {
      this.scheduledTimer = null;
      void this.processQueue();
    }, this.batchIntervalMs);
  }

  /**
   * 批量處理：取出所有最新值並清空佇列
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.size === 0) {
      return;
    }

    this.processing = true;

    try {
      // 取出當前所有項目並清空佇列
      const items = new Map(this.queue);
      this.queue.clear();

      // 執行處理函數
      await this.handler(items);
    } finally {
      this.processing = false;

      // 如果在處理期間有新的項目入隊，再次排程處理
      if (this.queue.size > 0) {
        this.scheduleProcess();
      }
    }
  }

  /**
   * 強制立即處理所有待處理的項目
   * 用於關閉時確保所有資料都被處理
   */
  async flush(): Promise<void> {
    // 取消排程的計時器
    if (this.scheduledTimer !== null) {
      clearTimeout(this.scheduledTimer);
      this.scheduledTimer = null;
    }

    // 等待正在進行的處理完成
    while (this.processing) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // 處理剩餘的項目
    if (this.queue.size > 0) {
      await this.processQueue();
    }
  }

  /**
   * 清空佇列（不觸發處理）
   */
  clear(): void {
    if (this.scheduledTimer !== null) {
      clearTimeout(this.scheduledTimer);
      this.scheduledTimer = null;
    }
    this.queue.clear();
  }

  /**
   * 取得當前佇列大小
   */
  size(): number {
    return this.queue.size;
  }

  /**
   * 檢查是否正在處理中
   */
  isProcessing(): boolean {
    return this.processing;
  }

  /**
   * 銷毀佇列，清理所有資源
   */
  destroy(): void {
    this.clear();
    this.processing = false;
  }
}
