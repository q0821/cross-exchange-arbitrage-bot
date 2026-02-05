/**
 * TtyRenderer - TTY 互動式渲染器
 *
 * @description 使用 ANSI 控制碼在 TTY 環境中渲染儀表板
 * @feature 071-cli-status-dashboard
 */

import type {
  DashboardState,
  IDashboardRenderer,
  SystemStatus,
  BusinessMetrics,
  ConnectionStatus,
  ErrorStats,
} from '../types';

/** ANSI 控制碼 */
const ANSI = {
  CLEAR_SCREEN: '\x1B[2J',
  MOVE_CURSOR_HOME: '\x1B[0;0H',
  RESET: '\x1B[0m',
  BOLD: '\x1B[1m',
  GREEN: '\x1B[32m',
  RED: '\x1B[31m',
  YELLOW: '\x1B[33m',
  CYAN: '\x1B[36m',
  DIM: '\x1B[2m',
};

/** Box 繪製字元 */
const BOX = {
  TOP_LEFT: '╔',
  TOP_RIGHT: '╗',
  BOTTOM_LEFT: '╚',
  BOTTOM_RIGHT: '╝',
  HORIZONTAL: '═',
  VERTICAL: '║',
  SEPARATOR_LEFT: '╠',
  SEPARATOR_RIGHT: '╣',
  BRANCH: '├─',
  BRANCH_LAST: '└─',
};

/** 儀表板寬度 */
const DASHBOARD_WIDTH = 64;

export class TtyRenderer implements IDashboardRenderer {
  /**
   * 渲染儀表板
   */
  render(state: DashboardState): void {
    const lines: string[] = [];

    // 清屏並移動游標到左上角
    lines.push(ANSI.CLEAR_SCREEN + ANSI.MOVE_CURSOR_HOME);

    // 標題區
    lines.push(this.renderTopBorder());
    lines.push(this.renderCenteredLine('跨交易所套利機器人 - 狀態儀表板'));
    lines.push(this.renderSeparator());

    // 系統狀態區
    lines.push(this.renderSectionHeader('系統狀態'));
    lines.push(...this.renderSystemStatus(state.system));
    lines.push(this.renderSeparator());

    // 業務指標區
    lines.push(this.renderSectionHeader('業務指標'));
    lines.push(...this.renderBusinessMetrics(state.business));
    lines.push(this.renderSeparator());

    // WebSocket 連線區
    lines.push(this.renderSectionHeader('WebSocket 連線'));
    lines.push(...this.renderConnectionStatus(state.connection));
    lines.push(this.renderSeparator());

    // 錯誤統計
    lines.push(...this.renderErrorStats(state.errors));

    // 最後更新時間（標籤寬度 10）
    lines.push(
      this.renderLine(
        `  ${this.padRight('最後更新:', 10)} ${this.formatDateTime(state.lastUpdated)}`
      )
    );
    lines.push(this.renderBottomBorder());

    process.stdout.write(lines.join('\n') + '\n');
  }

  /**
   * 清理（清屏）
   */
  cleanup(): void {
    process.stdout.write(ANSI.CLEAR_SCREEN + ANSI.MOVE_CURSOR_HOME);
  }

  // === 私有方法：渲染區塊 ===

  private renderSystemStatus(system: SystemStatus | null): string[] {
    if (!system) {
      return [this.renderLine(`  ${ANSI.DIM}載入中...${ANSI.RESET}`)];
    }

    // Proxy URL 可能很長，截斷顯示
    let proxyDisplay = '';
    if (system.proxyEnabled && system.proxyUrl) {
      const maxProxyLen = 30;
      const proxyUrl = system.proxyUrl.length > maxProxyLen
        ? system.proxyUrl.substring(0, maxProxyLen) + '...'
        : system.proxyUrl;
      proxyDisplay = `${ANSI.GREEN}啟用${ANSI.RESET} (${proxyUrl})`;
    } else {
      proxyDisplay = `${ANSI.DIM}停用${ANSI.RESET}`;
    }

    const ipStatus = system.publicIp
      ? system.publicIp
      : `${ANSI.YELLOW}無法取得${ANSI.RESET}`;

    const memoryColor =
      system.heapUsagePercent > 90
        ? ANSI.RED
        : system.heapUsagePercent > 70
          ? ANSI.YELLOW
          : ANSI.GREEN;

    // 統一標籤寬度為 10（中文字元計為 2）
    const LABEL_WIDTH = 10;

    return [
      this.renderLine(
        `  ${BOX.BRANCH} ${this.padRight('運行時間:', LABEL_WIDTH)} ${ANSI.CYAN}${system.uptimeFormatted}${ANSI.RESET}`
      ),
      this.renderLine(
        `  ${BOX.BRANCH} ${this.padRight('記憶體:', LABEL_WIDTH)} ${memoryColor}${system.heapUsedMB} MB${ANSI.RESET} / ${system.heapTotalMB} MB (${memoryColor}${system.heapUsagePercent}%${ANSI.RESET})`
      ),
      this.renderLine(
        `  ${BOX.BRANCH} ${this.padRight('Proxy:', LABEL_WIDTH)} ${proxyDisplay}`
      ),
      this.renderLine(
        `  ${BOX.BRANCH_LAST} ${this.padRight('IP:', LABEL_WIDTH)} ${ipStatus}`
      ),
    ];
  }

  private renderBusinessMetrics(business: BusinessMetrics | null): string[] {
    if (!business) {
      return [this.renderLine(`  ${ANSI.DIM}載入中...${ANSI.RESET}`)];
    }

    const exchangeList = business.exchangeList.join(', ');

    // 統一標籤寬度為 12（中文字元計為 2，"監控交易對:" 為 11 寬度）
    const LABEL_WIDTH = 12;

    return [
      this.renderLine(
        `  ${BOX.BRANCH} ${this.padRight('套利機會:', LABEL_WIDTH)} ${ANSI.GREEN}${business.activeOpportunities}${ANSI.RESET} 個`
      ),
      this.renderLine(
        `  ${BOX.BRANCH} ${this.padRight('監控交易對:', LABEL_WIDTH)} ${ANSI.CYAN}${business.monitoredSymbols}${ANSI.RESET} 組`
      ),
      this.renderLine(
        `  ${BOX.BRANCH_LAST} ${this.padRight('交易所:', LABEL_WIDTH)} ${business.connectedExchanges} 個 (${exchangeList})`
      ),
    ];
  }

  private renderConnectionStatus(
    connection: ConnectionStatus | null
  ): string[] {
    if (!connection) {
      return [this.renderLine(`  ${ANSI.DIM}載入中...${ANSI.RESET}`)];
    }

    const lines: string[] = [];
    const { exchanges } = connection;

    // 統一交易所名稱寬度為 10
    const EXCHANGE_WIDTH = 10;

    for (let i = 0; i < exchanges.length; i++) {
      const ex = exchanges[i];
      if (!ex) continue;

      const isLast = i === exchanges.length - 1;
      const branch = isLast ? BOX.BRANCH_LAST : BOX.BRANCH;

      let statusIcon: string;
      let statusText: string;

      switch (ex.wsStatus) {
        case 'connected':
          statusIcon = `${ANSI.GREEN}●${ANSI.RESET}`;
          statusText = '已連線';
          break;
        case 'connecting':
          statusIcon = `${ANSI.YELLOW}◐${ANSI.RESET}`;
          statusText = '連線中';
          break;
        case 'disconnected':
          statusIcon = `${ANSI.RED}○${ANSI.RESET}`;
          statusText =
            ex.dataSourceMode === 'rest' ? 'REST 模式' : '已斷線';
          break;
        default:
          statusIcon = `${ANSI.DIM}?${ANSI.RESET}`;
          statusText = '未知';
      }

      lines.push(
        this.renderLine(
          `  ${branch} ${this.padRight(ex.exchange + ':', EXCHANGE_WIDTH)} ${statusIcon} ${statusText}`
        )
      );
    }

    return lines;
  }

  private renderErrorStats(errors: ErrorStats | null): string[] {
    const errorCount = errors?.totalErrors ?? 0;
    const errorColor = errorCount > 0 ? ANSI.RED : ANSI.GREEN;

    // 統一標籤寬度為 10
    const LABEL_WIDTH = 10;

    return [
      this.renderLine(
        `  ${this.padRight('錯誤統計:', LABEL_WIDTH)} ${errorColor}${errorCount}${ANSI.RESET} 次`
      ),
    ];
  }

  // === 私有方法：輔助函數 ===

  private renderTopBorder(): string {
    return (
      BOX.TOP_LEFT +
      BOX.HORIZONTAL.repeat(DASHBOARD_WIDTH - 2) +
      BOX.TOP_RIGHT
    );
  }

  private renderBottomBorder(): string {
    return (
      BOX.BOTTOM_LEFT +
      BOX.HORIZONTAL.repeat(DASHBOARD_WIDTH - 2) +
      BOX.BOTTOM_RIGHT
    );
  }

  private renderSeparator(): string {
    return (
      BOX.SEPARATOR_LEFT +
      BOX.HORIZONTAL.repeat(DASHBOARD_WIDTH - 2) +
      BOX.SEPARATOR_RIGHT
    );
  }

  private renderLine(content: string): string {
    // 計算可見字元寬度（排除 ANSI 控制碼，中文字元計為 2）
    const visibleWidth = this.getDisplayWidth(content);
    const padding = Math.max(0, DASHBOARD_WIDTH - 4 - visibleWidth);
    return `${BOX.VERTICAL}  ${content}${' '.repeat(padding)}${BOX.VERTICAL}`;
  }

  private renderCenteredLine(content: string): string {
    const visibleWidth = this.getDisplayWidth(content);
    const totalPadding = DASHBOARD_WIDTH - 4 - visibleWidth;
    const leftPadding = Math.floor(totalPadding / 2);
    const rightPadding = totalPadding - leftPadding;
    return `${BOX.VERTICAL}${' '.repeat(leftPadding + 2)}${ANSI.BOLD}${content}${ANSI.RESET}${' '.repeat(rightPadding + 2)}${BOX.VERTICAL}`;
  }

  private renderSectionHeader(title: string): string {
    return this.renderLine(`${ANSI.BOLD}${title}${ANSI.RESET}`);
  }

  private stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '');
  }

  /**
   * 計算字串的顯示寬度（考慮中文字元佔 2 個寬度）
   */
  private getDisplayWidth(str: string): number {
    const stripped = this.stripAnsi(str);
    let width = 0;
    for (const char of stripped) {
      // 中文、日文、韓文等全形字元佔 2 個寬度
      const code = char.codePointAt(0) ?? 0;
      if (
        (code >= 0x4e00 && code <= 0x9fff) ||   // CJK 統一漢字
        (code >= 0x3000 && code <= 0x303f) ||   // CJK 標點符號
        (code >= 0xff00 && code <= 0xffef) ||   // 全形字元
        (code >= 0x3040 && code <= 0x309f) ||   // 平假名
        (code >= 0x30a0 && code <= 0x30ff) ||   // 片假名
        (code >= 0xac00 && code <= 0xd7af)      // 韓文
      ) {
        width += 2;
      } else {
        width += 1;
      }
    }
    return width;
  }

  private padRight(str: string, targetWidth: number): string {
    const currentWidth = this.getDisplayWidth(str);
    const padding = Math.max(0, targetWidth - currentWidth);
    return str + ' '.repeat(padding);
  }

  private formatDateTime(date: Date): string {
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
}
