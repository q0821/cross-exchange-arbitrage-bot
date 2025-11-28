/**
 * 價差回本次數計算結果
 *
 * 此介面定義了回本指標的所有可能狀態和顯示資訊
 */
export interface PaybackResult {
  /**
   * 回本狀態
   * - favorable: 價差有利（立即有正報酬）
   * - payback_needed: 需要回本（1-100 次資費）
   * - too_many: 回本次數過多（> 100 次）
   * - impossible: 無法回本（費率差為零或負數）
   * - no_data: 無價格數據
   */
  status: 'favorable' | 'payback_needed' | 'too_many' | 'impossible' | 'no_data'

  /**
   * 回本次數（僅當 status = 'payback_needed' 或 'too_many' 時有值）
   * 精度：小數點後 1 位
   */
  periods?: number

  /**
   * 預估回本時間（小時）
   * 計算公式：periods × timeBasis
   */
  estimatedHours?: number

  /**
   * 顯示文字（用於 UI 渲染）
   * 範例：
   * - "✓ 價差有利"
   * - "⚠️ 需 3.0 次資費回本"
   * - "❌ 回本次數過多 (50+ 次)"
   * - "無法回本（費率差為零）"
   * - "N/A（無價格數據）"
   */
  displayText: string

  /**
   * 顯示顏色（用於 UI 樣式）
   */
  color: 'green' | 'orange' | 'red' | 'gray'

  /**
   * 詳細資訊（用於 Tooltip）
   */
  details?: {
    priceDiff: number | null    // 當前價差百分比
    rateSpread: number          // 當前費率差百分比
    formula: string             // 計算公式說明
    warning?: string            // 警告訊息（如有）
  }
}
