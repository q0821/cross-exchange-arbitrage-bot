/**
 * 速率限制器
 * 使用滑動窗口算法追蹤請求計數
 */
export class RateLimiter {
  private readonly requests: Map<string, number[]> = new Map();

  /**
   * @param maxRequests 最大請求次數
   * @param windowMs 時間窗口（毫秒）
   */
  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number
  ) {}

  /**
   * 檢查請求是否允許通過
   * @param key 唯一識別碼（如 IP 地址）
   * @returns true 允許通過, false 超過限制
   */
  check(key: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];

    // 移除過期的請求記錄（滑動窗口）
    const validTimestamps = timestamps.filter((ts) => now - ts < this.windowMs);

    // 檢查是否超過限制
    if (validTimestamps.length >= this.maxRequests) {
      return false;
    }

    // 記錄新請求
    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);

    return true;
  }

  /**
   * 手動重置特定 key 的計數
   * @param key 唯一識別碼
   */
  reset(key: string): void {
    this.requests.delete(key);
  }

  /**
   * 清理所有過期記錄（定期執行）
   */
  cleanup(): void {
    const now = Date.now();

    for (const [key, timestamps] of this.requests.entries()) {
      const validTimestamps = timestamps.filter((ts) => now - ts < this.windowMs);

      if (validTimestamps.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validTimestamps);
      }
    }
  }
}
