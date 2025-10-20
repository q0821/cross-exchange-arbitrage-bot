/**
 * MonitorStats - 監控服務統計資訊介面
 */
export interface MonitorStats {
  /** 服務啟動時間 */
  startTime: Date
  /** 總更新次數 */
  totalUpdates: number
  /** 錯誤計數 */
  errorCount: number
  /** 當前活躍套利機會數量 */
  activeOpportunities: number
  /** 最後更新時間 */
  lastUpdateTime: Date | null
}

/**
 * MonitorStatsTracker - 監控統計追蹤器
 *
 * 負責追蹤和管理監控服務的運行統計資訊
 */
export class MonitorStatsTracker {
  private stats: MonitorStats

  constructor() {
    this.stats = {
      startTime: new Date(),
      totalUpdates: 0,
      errorCount: 0,
      activeOpportunities: 0,
      lastUpdateTime: null
    }
  }

  /**
   * 增加計數器
   * @param field 要增加的欄位名稱
   * @param amount 增加量（預設為 1）
   */
  increment(field: 'totalUpdates' | 'errorCount' | 'activeOpportunities', amount: number = 1): void {
    this.stats[field] += amount

    // 如果是 totalUpdates，更新最後更新時間
    if (field === 'totalUpdates') {
      this.stats.lastUpdateTime = new Date()
    }
  }

  /**
   * 設定活躍機會數量（直接設定值，非累加）
   * @param count 活躍機會數量
   */
  setActiveOpportunities(count: number): void {
    this.stats.activeOpportunities = count
  }

  /**
   * 取得當前統計資訊
   * @returns 統計資訊快照
   */
  getStats(): Readonly<MonitorStats> {
    return { ...this.stats }
  }

  /**
   * 計算運行時長（秒）
   * @returns 從啟動到現在的秒數
   */
  getUptime(): number {
    const now = new Date()
    return Math.floor((now.getTime() - this.stats.startTime.getTime()) / 1000)
  }

  /**
   * 格式化運行時長為人類可讀格式
   * @returns 格式化後的運行時長 (例如: "1h 23m 45s")
   */
  getFormattedUptime(): string {
    const uptimeSeconds = this.getUptime()

    const hours = Math.floor(uptimeSeconds / 3600)
    const minutes = Math.floor((uptimeSeconds % 3600) / 60)
    const seconds = uptimeSeconds % 60

    const parts: string[] = []
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0) parts.push(`${minutes}m`)
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`)

    return parts.join(' ')
  }

  /**
   * 重置統計資訊
   */
  reset(): void {
    this.stats = {
      startTime: new Date(),
      totalUpdates: 0,
      errorCount: 0,
      activeOpportunities: 0,
      lastUpdateTime: null
    }
  }
}
