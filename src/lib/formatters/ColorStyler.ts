import chalk, { Chalk } from 'chalk'

/**
 * ColorStyler - 處理終端顏色和視覺樣式
 *
 * 負責根據終端能力選擇適當的視覺提示方式：
 * - 支援顏色時使用 ANSI 顏色碼 (chalk)
 * - 不支援顏色時使用純文字符號
 *
 * 注意：chalk 預設會自動檢測終端顏色支援，但我們提供明確控制
 */
export class ColorStyler {
  private readonly chalk: Chalk

  constructor(private readonly supportsColor: boolean) {
    // 建立自訂 chalk 實例，強制套用顏色設定
    this.chalk = new Chalk({ level: supportsColor ? 3 : 0 })
  }

  /**
   * 突顯套利機會文字
   * @param text 要突顯的文字
   * @param intensity 突顯強度 ('low': 黃色/*, 'high': 綠色/>>>)
   * @returns 格式化後的文字
   */
  highlightOpportunity(text: string, intensity: 'low' | 'high'): string {
    if (!this.supportsColor) {
      // 不支援顏色時使用文字符號
      return intensity === 'high' ? `>>> ${text}` : `* ${text}`
    }

    // 支援顏色時使用 chalk
    return intensity === 'high'
      ? this.chalk.green.bold(text)
      : this.chalk.yellow(text)
  }

  /**
   * 取得套利機會圖示
   * @returns emoji (支援顏色) 或文字符號 (不支援顏色)
   */
  opportunityIcon(): string {
    return this.supportsColor ? '🎯' : '>>>'
  }

  /**
   * 根據費率差異大小選擇顏色
   * @param value 要格式化的數值文字
   * @param spreadPercent 費率差異百分比
   * @param threshold 套利閾值
   * @returns 格式化後的文字
   */
  formatSpread(value: string, spreadPercent: number, threshold: number): string {
    if (!this.supportsColor) {
      return value
    }

    const absSpread = Math.abs(spreadPercent)

    // 差異 > 0.1% 使用綠色 (高價值機會)
    if (absSpread > 0.1) {
      return this.chalk.green.bold(value)
    }

    // 差異 0.05-0.1% 使用黃色 (中等機會)
    if (absSpread >= threshold && absSpread <= 0.1) {
      return this.chalk.yellow(value)
    }

    // 未達閾值使用預設顏色
    return value
  }

  /**
   * 格式化錯誤訊息
   * @param text 錯誤文字
   * @returns 紅色文字 (支援顏色) 或原文字
   */
  error(text: string): string {
    return this.supportsColor ? this.chalk.red(text) : text
  }

  /**
   * 格式化警告訊息
   * @param text 警告文字
   * @returns 黃色文字 (支援顏色) 或原文字
   */
  warning(text: string): string {
    return this.supportsColor ? this.chalk.yellow(text) : text
  }

  /**
   * 格式化成功訊息
   * @param text 成功文字
   * @returns 綠色文字 (支援顏色) 或原文字
   */
  success(text: string): string {
    return this.supportsColor ? this.chalk.green(text) : text
  }

  /**
   * 格式化暗淡文字 (用於次要資訊)
   * @param text 要格式化的文字
   * @returns 暗淡文字 (支援顏色) 或原文字
   */
  dim(text: string): string {
    return this.supportsColor ? this.chalk.dim(text) : text
  }
}
