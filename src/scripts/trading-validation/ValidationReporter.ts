/**
 * 驗證報告生成器
 * Feature: 049-trading-validation-script
 */

import type {
  ValidationItem,
  ValidationReport,
  ValidationSummary,
  ValidationStatus,
} from './types';
import { formatPrice } from './utils';

/**
 * ANSI 顏色碼
 */
const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

/**
 * 檢查是否支援顏色輸出
 */
const supportsColor = (): boolean => {
  return (
    process.stdout.isTTY &&
    process.env.TERM !== 'dumb' &&
    process.env.NO_COLOR === undefined
  );
};

/**
 * 條件性套用顏色
 */
const color = (text: string, colorCode: string): string => {
  if (!supportsColor()) return text;
  return `${colorCode}${text}${COLORS.reset}`;
};

/**
 * 狀態對應的 emoji
 */
const STATUS_ICONS: Record<ValidationStatus, string> = {
  pass: '✅',
  fail: '❌',
  skip: '⏭️',
  warn: '⚠️',
};

/**
 * 狀態對應的顏色
 */
const STATUS_COLORS: Record<ValidationStatus, string> = {
  pass: COLORS.green,
  fail: COLORS.red,
  skip: COLORS.gray,
  warn: COLORS.yellow,
};

/**
 * 類別對應的標題
 */
const CATEGORY_TITLES: Record<string, { title: string; icon: string }> = {
  position: { title: '開倉驗證', icon: '📈' },
  conditional: { title: '條件單驗證', icon: '🛡️' },
  close: { title: '平倉驗證', icon: '📉' },
};

/**
 * 驗證報告生成器
 */
export class ValidationReporter {
  private items: ValidationItem[] = [];
  private startTime: number = Date.now();
  private exchange: string = '';
  private symbol: string = '';
  private mode: 'run' | 'verify' = 'run';

  /**
   * 初始化報告
   */
  initialize(exchange: string, symbol: string, mode: 'run' | 'verify'): void {
    this.items = [];
    this.startTime = Date.now();
    this.exchange = exchange;
    this.symbol = symbol;
    this.mode = mode;
  }

  /**
   * 新增驗證項目結果
   */
  addItem(item: ValidationItem): void {
    this.items.push(item);
  }

  /**
   * 計算總結統計
   */
  private getSummary(): ValidationSummary {
    return {
      total: this.items.length,
      passed: this.items.filter((i) => i.status === 'pass').length,
      failed: this.items.filter((i) => i.status === 'fail').length,
      skipped: this.items.filter((i) => i.status === 'skip').length,
      warned: this.items.filter((i) => i.status === 'warn').length,
    };
  }

  /**
   * 生成完整報告
   */
  getReport(): ValidationReport {
    return {
      timestamp: new Date(),
      exchange: this.exchange,
      symbol: this.symbol,
      mode: this.mode,
      items: this.items,
      summary: this.getSummary(),
      duration: Date.now() - this.startTime,
    };
  }

  /**
   * 輸出文字格式報告
   */
  printTextReport(): void {
    const report = this.getReport();
    const exchangeName = this.getExchangeDisplayName(report.exchange);
    const modeText = report.mode === 'run' ? '自動測試 (run)' : '查詢驗證 (verify)';

    const border = '═'.repeat(70);
    const divider = '─'.repeat(70);

    console.log('');
    console.log(color(border, COLORS.cyan));
    console.log(color(`交易驗證報告 - ${exchangeName} ${report.symbol}`, COLORS.bold));
    console.log(color(border, COLORS.cyan));
    console.log(`📍 驗證時間: ${color(this.formatTimestamp(report.timestamp), COLORS.dim)}`);
    console.log(`📊 驗證模式: ${color(modeText, COLORS.blue)}`);

    // 按類別分組輸出
    const categories = ['position', 'conditional', 'close'];
    for (const category of categories) {
      const categoryItems = report.items.filter((item) => item.category === category);
      if (categoryItems.length === 0) continue;

      const { title, icon } = CATEGORY_TITLES[category];
      console.log('');
      console.log(color(divider, COLORS.dim));
      console.log(color(`${icon} ${title}`, COLORS.bold));
      console.log(color(divider, COLORS.dim));

      for (const item of categoryItems) {
        this.printItem(item);
      }
    }

    // 總結
    console.log('');
    console.log(color(border, COLORS.cyan));
    this.printSummary(report.summary, report.duration);
    console.log(color(border, COLORS.cyan));
    console.log('');
  }

  /**
   * 輸出單項驗證結果
   */
  private printItem(item: ValidationItem): void {
    const icon = STATUS_ICONS[item.status];
    const statusColor = STATUS_COLORS[item.status];
    const idPadded = String(item.id).padEnd(4);

    console.log(color(`${icon} [${idPadded}] ${item.name}`, statusColor));

    if (item.status === 'pass' || item.status === 'fail') {
      const label = '      ';
      console.log(`${label}${color('預期:', COLORS.dim)} ${item.expected}`);
      console.log(`${label}${color('實際:', COLORS.dim)} ${item.actual}`);
    }

    if (item.error) {
      console.log(`      ${color('錯誤:', COLORS.red)} ${item.error}`);
    }

    if (item.status === 'skip') {
      console.log(`      ${color('原因:', COLORS.dim)} ${item.error || '前置條件未滿足'}`);
    }
  }

  /**
   * 輸出總結
   */
  private printSummary(summary: ValidationSummary, duration: number): void {
    const parts: string[] = [];

    if (summary.passed > 0) {
      parts.push(color(`${summary.passed} 通過`, COLORS.green));
    }
    if (summary.failed > 0) {
      parts.push(color(`${summary.failed} 失敗`, COLORS.red));
    }
    if (summary.warned > 0) {
      parts.push(color(`${summary.warned} 警告`, COLORS.yellow));
    }
    if (summary.skipped > 0) {
      parts.push(color(`${summary.skipped} 跳過`, COLORS.gray));
    }

    const allPassed = summary.failed === 0 && summary.warned === 0;
    const statusIcon = allPassed ? '✅' : '❌';
    const statusText = allPassed
      ? color('成功', COLORS.green)
      : color('失敗', COLORS.red);
    const resultText = `結果: ${parts.join(' │ ')} ${statusIcon}`;

    console.log(resultText);
    console.log(`${color('執行時間:', COLORS.dim)} ${(duration / 1000).toFixed(3)} 秒`);
  }

  /**
   * 輸出 JSON 格式報告
   */
  printJsonReport(): void {
    const report = this.getReport();
    const jsonReport = {
      meta: {
        timestamp: report.timestamp.toISOString(),
        exchange: report.exchange,
        symbol: report.symbol,
        mode: report.mode,
        duration: report.duration,
      },
      items: report.items.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        status: item.status,
        expected: item.expected,
        actual: item.actual,
        ...(item.error ? { error: item.error } : {}),
      })),
      summary: {
        ...report.summary,
        success: report.summary.failed === 0 && report.summary.warned === 0,
      },
    };

    console.log(JSON.stringify(jsonReport, null, 2));
  }

  /**
   * 格式化時間戳
   */
  private formatTimestamp(date: Date): string {
    return date.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }

  /**
   * 取得交易所顯示名稱
   */
  private getExchangeDisplayName(exchange: string): string {
    const names: Record<string, string> = {
      binance: 'Binance',
      okx: 'OKX',
      gateio: 'Gate.io',
      bingx: 'BingX',
    };
    return names[exchange] || exchange;
  }

  /**
   * 取得 exit code
   */
  getExitCode(): number {
    const summary = this.getSummary();
    if (summary.failed > 0) {
      return 1;
    }
    return 0;
  }

  /**
   * 檢查是否所有項目都通過
   */
  isAllPassed(): boolean {
    const summary = this.getSummary();
    return summary.failed === 0 && summary.warned === 0;
  }
}
