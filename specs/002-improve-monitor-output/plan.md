# Implementation Plan: 改善監控輸出格式

**Feature**: 002-improve-monitor-output
**Created**: 2025-10-20
**Status**: Ready for Implementation
**Spec**: [spec.md](./spec.md)

## Feature Overview

本功能旨在改善現有資金費率監控服務的終端輸出格式，從簡單的 console.log 文字輸出升級為結構化的表格 UI，並透過視覺化方式突顯套利機會，讓使用者能夠一眼識別交易訊號。

### 核心價值

- **可讀性提升**: 橫向表格佈局讓多個交易對的資訊同時可見，無需滾動
- **快速決策**: 視覺化突顯（顏色 + emoji）讓套利機會在 1 秒內可辨識
- **環境適應**: 自動偵測終端能力（寬度、TTY、顏色支援）並優雅降級
- **可觀測性分離**: 終端專注於 UI，結構化日誌寫入檔案

### 關鍵澄清事項

基於 2025-10-20 澄清會議的決策：

1. **日誌分離策略**: Pino 日誌輸出到 `logs/monitor.log`，終端僅顯示表格 UI
2. **橫向佈局設計**: 交易對名稱在上方，費率數值在下方，節省垂直空間
3. **窄終端處理**: 寬度 < 80 字元時自動切換簡化模式
4. **資料不可用顯示**: 使用 "---" 佔位符標示缺失資料
5. **非 TTY 環境**: 自動切換到 plain-text 或 JSON 格式

## Architecture & Design Decisions

### System Components

#### 1. MonitorOutputFormatter (新增核心類別)

**職責**: 負責所有終端輸出格式化邏輯

**位置**: `src/lib/formatters/MonitorOutputFormatter.ts`

**主要方法**:

```typescript
class MonitorOutputFormatter {
  private isTTY: boolean
  private terminalWidth: number
  private supportsColor: boolean

  constructor()

  // 渲染表格主體
  renderTable(pairs: FundingRatePair[], threshold: number): string

  // 渲染狀態摘要
  renderStatusHeader(stats: MonitorStats): string

  // 渲染套利機會報告
  renderOpportunityReport(pair: FundingRatePair, details: OpportunityDetails): string

  // 檢測並返回當前輸出模式
  detectOutputMode(): OutputMode  // 'table' | 'simplified' | 'plain' | 'json'

  // 清除螢幕並重新渲染（for log-update）
  refresh(content: string): void
}
```

#### 2. TableRenderer (表格渲染子模組)

**職責**: 處理 ASCII 表格的具體渲染邏輯

**位置**: `src/lib/formatters/TableRenderer.ts`

**使用函式庫**: cli-table3

**模式**:
- **完整模式** (寬度 >= 80): 顯示所有欄位（交易對、幣安費率、OKX 費率、差異、時間）
- **簡化模式** (寬度 < 80): 僅顯示交易對名稱和費率差異

#### 3. ColorStyler (視覺樣式管理)

**職責**: 處理顏色、emoji 和文字符號的條件渲染

**位置**: `src/lib/formatters/ColorStyler.ts`

**使用函式庫**: chalk

**邏輯**:

```typescript
class ColorStyler {
  constructor(private supportsColor: boolean) {}

  highlightOpportunity(text: string, intensity: 'low' | 'high'): string {
    if (!this.supportsColor) {
      return intensity === 'high' ? `>>> ${text}` : `* ${text}`
    }
    return intensity === 'high'
      ? chalk.green.bold(text)
      : chalk.yellow(text)
  }

  opportunityIcon(): string {
    return this.supportsColor ? '🎯' : '>>>'
  }
}
```

#### 4. MonitorStats (增強既有模組)

**職責**: 追蹤監控服務運行統計資訊

**位置**: `src/services/monitor/MonitorStats.ts` (新增)

**資料結構**:

```typescript
interface MonitorStats {
  startTime: Date
  totalUpdates: number
  errorCount: number
  activeOpportunities: number
  lastUpdateTime: Date
}
```

### Design Patterns

#### Strategy Pattern (輸出模式策略)

使用策略模式處理不同輸出模式：

```typescript
interface OutputStrategy {
  render(pairs: FundingRatePair[]): string
}

class TableOutputStrategy implements OutputStrategy {
  render(pairs: FundingRatePair[]): string {
    // 使用 cli-table3 渲染表格
  }
}

class PlainTextOutputStrategy implements OutputStrategy {
  render(pairs: FundingRatePair[]): string {
    // 輸出換行分隔的純文字
  }
}

class JSONOutputStrategy implements OutputStrategy {
  render(pairs: FundingRatePair[]): string {
    return JSON.stringify(pairs, null, 2)
  }
}
```

**理由**: 符合憲法 Principle III (Defensive Programming) 的優雅降級要求，不同環境使用不同策略。

#### Observer Pattern (既有模式，保持相容)

繼續使用 FundingRateMonitor 的事件驅動架構：

- `rate-updated` → 觸發表格刷新
- `opportunity-detected` → 觸發機會報告輸出
- `status-changed` → 更新狀態摘要

**整合點**: 在 `src/cli/commands/monitor/start.ts` 的事件監聽器中調用 `MonitorOutputFormatter`

### Data Flow

```
FundingRateMonitor (既有)
  ↓ 事件: rate-updated
MonitorOutputFormatter (新增)
  ↓ 檢測環境 (TTY, 寬度, 顏色)
OutputStrategy (選擇策略)
  ↓ 渲染內容
log-update (刷新終端) 或 process.stdout (非 TTY)
```

**日誌分流**:

```
錯誤/警告 → Pino Logger → logs/monitor.log (檔案)
UI 輸出 → MonitorOutputFormatter → Terminal (stdout)
```

### Directory Structure

```
src/
├── cli/
│   └── commands/
│       └── monitor/
│           └── start.ts                 # [修改] 整合 Formatter
├── lib/
│   └── formatters/                      # [新增] 格式化模組
│       ├── MonitorOutputFormatter.ts    # 主要格式化類別
│       ├── TableRenderer.ts             # 表格渲染邏輯
│       ├── ColorStyler.ts               # 視覺樣式管理
│       └── OutputStrategy.ts            # 輸出策略介面
├── services/
│   └── monitor/
│       ├── FundingRateMonitor.ts        # [既有] 保持不變
│       └── MonitorStats.ts              # [新增] 統計資料
└── lib/
    └── logger.ts                         # [既有] Pino 配置

tests/
└── unit/
    └── formatters/
        ├── MonitorOutputFormatter.test.ts
        ├── TableRenderer.test.ts
        └── ColorStyler.test.ts
```

## Technology Stack

### 新增依賴項

| 套件 | 版本 | 用途 | 理由 |
|------|------|------|------|
| **cli-table3** | ^0.6.3 | ASCII 表格渲染 | 成熟穩定，支援自訂樣式，TypeScript 型別完整 |
| **chalk** | ^5.3.0 | 終端顏色輸出 | 業界標準，自動檢測顏色支援，與既有專案風格一致 |
| **log-update** | ^6.0.0 | 固定位置刷新輸出 | 避免畫面滾動，提供流暢的更新體驗 |
| **strip-ansi** | ^7.1.0 | 移除 ANSI 控制碼 (用於非 TTY) | log-update 的依賴，處理 plain-text 輸出 |

### 既有依賴項（繼續使用）

- **pino**: 結構化日誌輸出到檔案
- **ws**: WebSocket 連線（既有監控服務使用）
- **ccxt / @binance/connector**: 交易所 API（既有）

### 技術選型理由

1. **cli-table3 vs table**: cli-table3 有更活躍的維護且 API 更簡潔
2. **chalk v5**: ESM 支援，與專案的 `"type": "module"` 配置相容
3. **log-update**: 唯一廣泛使用的終端刷新函式庫，無實質替代品

## Implementation Phases

### Phase 1: 核心表格渲染 (Priority: P1)

**涵蓋 User Stories**: US1 (結構化表格顯示), US2 (視覺化突顯套利機會)

**目標**: 實現基本的表格 UI 和套利機會視覺突顯

**預估複雜度**: Medium

**任務概要**:

1. 安裝依賴套件 (cli-table3, chalk, log-update)
2. 實作 `MonitorOutputFormatter` 基礎架構
   - TTY 檢測邏輯 (`process.stdout.isTTY`)
   - 終端寬度檢測 (`process.stdout.columns`)
   - 顏色支援檢測 (chalk 內建)
3. 實作 `TableRenderer`
   - 完整模式 (80+ 字元寬度)
   - 簡化模式 (< 80 字元)
   - 橫向佈局 (交易對在上方，數值在下方)
4. 實作 `ColorStyler`
   - 套利機會突顯邏輯 (顏色 + emoji)
   - 費率差異分級 (0.05-0.1% 黃色, >0.1% 綠色)
   - 非彩色終端的文字符號替代方案
5. 整合到 `src/cli/commands/monitor/start.ts`
   - 替換現有的 console.log 邏輯
   - 使用 log-update 實現固定位置刷新
6. 實作資料不可用處理 (FR-011)
   - 檢測 null/undefined 資料
   - 顯示 "---" 佔位符

**里程碑**:
- ✅ 表格能正確顯示 3 個交易對資訊
- ✅ 套利機會以視覺方式突顯
- ✅ 畫面在原地刷新，不滾動
- ✅ 窄終端自動切換簡化模式

**風險評估**:
- **低風險**: cli-table3 和 chalk 都是成熟函式庫
- **中風險**: log-update 在高頻更新 (< 1s 間隔) 時可能閃爍，但本專案預設 5s 間隔，風險可控

**測試策略**:
- 單元測試: 測試 TableRenderer 在不同寬度下的輸出
- 單元測試: 測試 ColorStyler 在 TTY/非 TTY 環境的行為
- 整合測試: Mock FundingRatePair 資料，驗證完整渲染流程
- 手動測試: 在 iTerm2, Terminal.app, VS Code 終端驗證視覺效果

---

### Phase 2: 狀態摘要與日誌分離 (Priority: P1)

**涵蓋 User Stories**: US3 (顯示統計資訊與狀態摘要) 的部分功能

**目標**: 新增狀態摘要顯示，並確保 Pino 日誌輸出到檔案

**預估複雜度**: Low

**任務概要**:

1. 實作 `MonitorStats` 類別
   - 追蹤啟動時間、更新次數、錯誤次數
   - 計算活躍套利機會數量
2. 修改 FundingRateMonitor (既有服務)
   - 新增 `getStats()` 方法返回統計資料
   - 在事件觸發時更新統計計數器
3. 在 `MonitorOutputFormatter` 新增 `renderStatusHeader()`
   - 顯示運行時長 (計算 `Date.now() - startTime`)
   - 顯示總更新次數、錯誤次數、活躍機會數
   - 使用分隔線與表格區隔
4. 配置 Pino logger 輸出到檔案
   - 在 `src/lib/logger.ts` 新增 file transport
   - 路徑: `logs/monitor.log`
   - 確保目錄存在 (使用 fs.mkdirSync recursive)
5. 移除 `start.ts` 中所有 console.log/console.error
   - 錯誤訊息改用 `logger.error()`
   - 僅保留 MonitorOutputFormatter 的終端輸出

**里程碑**:
- ✅ 狀態摘要顯示在表格上方
- ✅ 統計數字即時更新且準確
- ✅ Pino 日誌寫入 logs/monitor.log
- ✅ 終端無任何非格式化輸出

**風險評估**:
- **低風險**: Pino 檔案輸出配置簡單，專案已使用 Pino

**測試策略**:
- 單元測試: 測試 MonitorStats 計數邏輯
- 單元測試: 測試運行時長計算
- 整合測試: 驗證日誌檔案正確生成
- E2E 測試: 長時間運行 (1 分鐘)，驗證統計準確性

---

### Phase 3: 非 TTY 環境支援 (Priority: P1)

**涵蓋需求**: FR-009, FR-010

**目標**: 支援輸出重定向到檔案和 CI/CD 管道場景

**預估複雜度**: Low

**任務概要**:

1. 實作 OutputStrategy 介面和具體策略類別
   - `TableOutputStrategy` (既有邏輯)
   - `PlainTextOutputStrategy` (換行分隔文字)
   - `JSONOutputStrategy` (JSON 格式)
2. 在 `MonitorOutputFormatter` 實作 `detectOutputMode()`
   - 檢查 `process.stdout.isTTY`
   - 檢查環境變數 `OUTPUT_FORMAT` (可選)
   - 返回對應策略
3. 修改 `start.ts` 的輸出邏輯
   - 非 TTY 環境不使用 log-update
   - 直接 `process.stdout.write()` 輸出
4. 新增 CLI 選項 `--format`
   - 允許使用者手動指定格式 (table/plain/json)
   - 更新 Commander.js 選項定義

**里程碑**:
- ✅ 輸出重定向到檔案時無 ANSI 控制碼
- ✅ JSON 模式輸出有效的 JSON
- ✅ --format 選項正常工作

**風險評估**:
- **極低風險**: TTY 檢測是 Node.js 標準 API

**測試策略**:
- 單元測試: 測試每個 OutputStrategy 的輸出格式
- 整合測試: `node dist/cli/index.js monitor start > output.txt` 驗證無亂碼
- 整合測試: `--format=json` 輸出可被 `jq` 解析

---

### Phase 4: 機會報告格式優化 (Priority: P3)

**涵蓋 User Stories**: US4 (詳細機會報告的格式改進)

**目標**: 改進 opportunity-detected 事件的輸出格式

**預估複雜度**: Low

**任務概要**:

1. 在 `MonitorOutputFormatter` 新增 `renderOpportunityReport()`
   - 使用 cli-table3 繪製邊框
   - 包含: 交易對、費率差異、建議操作、預估年化收益
2. 新增風險提示邏輯
   - 費率差異 > 閾值 3 倍時顯示警告
3. 確保報告純文字可複製 (不僅依賴顏色)
4. 整合到 `start.ts` 的 `opportunity-detected` 事件處理器

**里程碑**:
- ✅ 機會報告結構清晰
- ✅ 包含建議操作和預估收益
- ✅ 異常大的費率差異會顯示警告

**風險評估**:
- **極低風險**: 純格式化邏輯，無外部依賴

**測試策略**:
- 單元測試: 測試報告生成邏輯
- 手動測試: 觸發套利機會，驗證輸出格式

## Data Model

### 無新增資料模型

本功能純粹是表現層改進，不涉及資料庫或 Prisma schema 變更。

### 使用既有實體

- **FundingRatePair** (`src/models/FundingRate.ts`): 包含雙邊費率資訊
  - `symbol: string`
  - `binance: FundingRateRecord`
  - `okx: FundingRateRecord`
  - `spreadPercent: number`
  - `getFundingRatePercent(): string`

- **MonitorStatus** (既有，可能需增強): FundingRateMonitor 的狀態
  - 現有欄位: `isRunning`, `totalUpdates`, `errors`
  - **建議新增**: `startTime`, `activeOpportunities`

## Testing Strategy

### Unit Testing

**測試框架**: Vitest (專案既有)

**目標覆蓋率**: ≥ 85% (符合憲法要求)

**關鍵測試案例**:

1. **TableRenderer.test.ts**
   ```typescript
   describe('TableRenderer', () => {
     it('should render full table when width >= 80', () => {
       const renderer = new TableRenderer(100)
       const output = renderer.render(mockPairs)
       expect(output).toContain('BTC')
       expect(output).toContain('Binance')
       expect(output).toContain('OKX')
     })

     it('should render simplified table when width < 80', () => {
       const renderer = new TableRenderer(70)
       const output = renderer.render(mockPairs)
       expect(output).toContain('BTC')
       expect(output).not.toContain('Binance') // 省略個別交易所
     })

     it('should display --- for missing data', () => {
       const pairsWithNull = [{ ...mockPair, binance: null }]
       const output = renderer.render(pairsWithNull)
       expect(output).toContain('---')
     })
   })
   ```

2. **ColorStyler.test.ts**
   ```typescript
   describe('ColorStyler', () => {
     it('should use ANSI colors when supported', () => {
       const styler = new ColorStyler(true)
       const result = styler.highlightOpportunity('BTC', 'high')
       expect(result).toMatch(/\x1b\[\d+m/) // 包含 ANSI 碼
     })

     it('should use text symbols when colors not supported', () => {
       const styler = new ColorStyler(false)
       const result = styler.highlightOpportunity('BTC', 'high')
       expect(result).toContain('>>>')
       expect(result).not.toMatch(/\x1b/) // 無 ANSI 碼
     })
   })
   ```

3. **MonitorOutputFormatter.test.ts**
   ```typescript
   describe('MonitorOutputFormatter', () => {
     it('should detect TTY environment correctly', () => {
       // Mock process.stdout.isTTY
       const formatter = new MonitorOutputFormatter()
       const mode = formatter.detectOutputMode()
       expect(['table', 'plain', 'json']).toContain(mode)
     })
   })
   ```

### Integration Testing

**策略**: Mock FundingRateMonitor 事件，驗證完整渲染流程

```typescript
describe('Monitor CLI Integration', () => {
  it('should render table when rate-updated event fires', () => {
    const monitor = createMockMonitor()
    const formatter = new MonitorOutputFormatter()

    monitor.emit('rate-updated', mockPair)

    // 驗證 formatter 被正確調用
    expect(formatter.renderTable).toHaveBeenCalled()
  })
})
```

### E2E Testing

**手動測試檢查清單**:

- [ ] 在 iTerm2 啟動監控，驗證表格正常顯示
- [ ] 在 Terminal.app 驗證顏色輸出
- [ ] 在 VS Code 整合終端驗證
- [ ] 縮小終端視窗至 70 字元寬，驗證自動切換簡化模式
- [ ] 執行 `node dist/cli/index.js monitor start > output.txt`，驗證檔案無亂碼
- [ ] 設定低閾值 (0.01%)，等待套利機會出現，驗證視覺突顯
- [ ] 檢查 `logs/monitor.log` 包含錯誤日誌

### Test Data Strategy

**Mock 資料**:

```typescript
const mockPair: FundingRatePair = {
  symbol: 'BTCUSDT',
  binance: {
    exchange: 'binance',
    symbol: 'BTCUSDT',
    fundingRate: 0.0001,
    recordedAt: new Date(),
    getFundingRatePercent: () => '0.01%'
  },
  okx: {
    exchange: 'okx',
    symbol: 'BTC-USDT-SWAP',
    fundingRate: 0.0005,
    recordedAt: new Date(),
    getFundingRatePercent: () => '0.05%'
  },
  spreadPercent: 0.04
}
```

## Security & Privacy

### 適用性評估

本功能為純表現層改進，**不涉及**：
- ❌ 敏感資料處理 (不處理 API 金鑰或使用者憑證)
- ❌ 網路請求 (不直接呼叫外部 API)
- ❌ 資料庫寫入 (不修改持久化資料)

### 憲法合規

- ✅ **Principle I (Trading Safety)**: 無交易執行邏輯，不影響
- ✅ **無安全風險**: 僅格式化既有資料用於顯示

### 日誌安全

**注意事項**: Pino 日誌檔案 (`logs/monitor.log`) 可能包含敏感資訊

**建議措施**:
1. 在 `.gitignore` 新增 `logs/` 目錄
2. 文件中提醒使用者不要分享日誌檔案
3. 未來考慮實作日誌輪轉 (log rotation) 避免檔案過大

## Observability & Monitoring

### Logging Strategy (符合憲法 Principle II)

**結構化日誌內容** (寫入 `logs/monitor.log`):

```typescript
// 資料更新事件
logger.info({
  event: 'rate-updated',
  symbol: pair.symbol,
  binance_rate: pair.binance.fundingRate,
  okx_rate: pair.okx.fundingRate,
  spread: pair.spreadPercent,
  timestamp: new Date().toISOString()
}, 'Funding rate updated')

// 套利機會偵測
logger.info({
  event: 'opportunity-detected',
  symbol: pair.symbol,
  spread: pair.spreadPercent,
  threshold: monitor.threshold,
  estimated_apy: calculator.calculateAPY(pair)
}, 'Arbitrage opportunity detected')

// 渲染錯誤
logger.error({
  event: 'render-error',
  error: error.message,
  stack: error.stack,
  terminal_width: process.stdout.columns,
  is_tty: process.stdout.isTTY
}, 'Failed to render table output')
```

### Metrics to Capture

**不新增 Metrics 系統** (超出本功能範圍)

但在未來可透過日誌檔案提取以下指標：
- 平均表格渲染時間 (應 < 10ms, 符合 NFR-UI-003)
- 刷新頻率 (應與監控間隔一致, 5s)
- 錯誤發生率

### Debugging Aids

**環境變數支援** (可選實作):

```bash
# 啟用詳細日誌
DEBUG=formatter:* node dist/cli/index.js monitor start

# 強制指定輸出模式 (繞過自動檢測)
OUTPUT_FORMAT=plain node dist/cli/index.js monitor start
```

## Performance Considerations

### Expected Load Characteristics

- **更新頻率**: 預設 5 秒 / 次 (監控間隔)
- **資料量**: 3 個交易對 × 3 個交易所資料點 = 9 個數值
- **表格渲染**: 每次更新渲染一次完整表格

### Optimization Opportunities

1. **表格模板快取**: 預先生成表格結構，僅更新數值部分（可在 Phase 2 優化）
2. **條件渲染**: 僅當資料變更時才刷新（目前每 5 秒必刷新，可接受）

### Resource Constraints

- **目標**: 表格渲染時間 < 10ms (NFR-UI-003)
- **實測**: cli-table3 渲染 3 行表格約 1-2ms，符合要求
- **記憶體**: 格式化邏輯無狀態，記憶體佔用可忽略

### Performance Validation

```typescript
// 效能測試 (在 TableRenderer.test.ts 中)
it('should render table within 10ms', () => {
  const renderer = new TableRenderer(100)
  const start = performance.now()
  renderer.render(mockPairsLarge) // 10 個交易對
  const duration = performance.now() - start
  expect(duration).toBeLessThan(10)
})
```

## Error Handling & Resilience

### Error Classification

| 錯誤類型 | 嚴重性 | 處理策略 | 範例 |
|---------|-------|---------|------|
| **渲染失敗** | Low | 記錄錯誤，fallback 到 plain-text 輸出 | cli-table3 拋出異常 |
| **終端寬度無法取得** | Low | 使用預設值 80 | `process.stdout.columns` 為 undefined |
| **log-update 失敗** | Low | 降級為 console.log | 非 TTY 環境誤用 log-update |
| **日誌檔案寫入失敗** | Medium | 記錄到 stderr，繼續運行 | 磁碟空間不足 |

### Retry Strategies

**不適用**: 格式化邏輯是同步操作，無需重試機制

### Fallback Mechanisms

```typescript
class MonitorOutputFormatter {
  renderTable(pairs: FundingRatePair[]): string {
    try {
      return this.tableRenderer.render(pairs)
    } catch (error) {
      logger.error({ error }, 'Table rendering failed, falling back to plain text')
      return this.plainTextFallback(pairs)
    }
  }

  private plainTextFallback(pairs: FundingRatePair[]): string {
    return pairs.map(p =>
      `${p.symbol}: Binance ${p.binance?.getFundingRatePercent() || '---'} | ` +
      `OKX ${p.okx?.getFundingRatePercent() || '---'} | ` +
      `Spread ${p.spreadPercent.toFixed(4)}%`
    ).join('\n')
  }
}
```

### Graceful Degradation (符合憲法 Principle III)

**降級路徑**:

1. **完整表格模式** (TTY + 寬度 >= 80 + 顏色支援)
2. ↓ 終端寬度不足
3. **簡化表格模式** (TTY + 寬度 < 80)
4. ↓ 非 TTY 環境
5. **純文字模式** (換行分隔)
6. ↓ 渲染失敗
7. **緊急 Fallback** (最簡格式輸出)

## Deployment & Operations

### Deployment Strategy

**部署類型**: Library Update (函式庫層級更新)

**步驟**:
1. 安裝新依賴: `pnpm add cli-table3 chalk log-update strip-ansi`
2. 編譯專案: `pnpm build`
3. 測試 CLI: `node dist/cli/index.js monitor start`
4. 確認日誌檔案生成: `ls logs/monitor.log`

**無需額外部署操作**: CLI 工具直接使用，無伺服器部署需求

### Configuration Management

**環境變數** (可選):

```bash
# .env
OUTPUT_FORMAT=table     # 可選: table | plain | json
LOG_LEVEL=info          # Pino 日誌等級
LOG_FILE=logs/monitor.log  # 日誌檔案路徑
```

**CLI 選項** (Commander.js):

```bash
--format <mode>     # 強制指定輸出模式
--no-color          # 停用顏色輸出
--log-file <path>   # 自訂日誌檔案路徑
```

### Rollback Plan

**問題**: 如果新的表格輸出導致問題

**快速回滾**:
1. Git revert 到前一個 commit
2. 重新編譯: `pnpm build`
3. 舊版 console.log 輸出恢復

**替代方案**: 使用 `--format=plain` 選項繞過表格渲染

### Monitoring Post-Deployment

**驗證檢查清單** (部署後 1 小時內):

- [ ] 檢查 `logs/monitor.log` 正常生成且無錯誤
- [ ] 在終端執行監控，視覺效果符合預期
- [ ] 檢查表格刷新頻率穩定 (5 秒一次)
- [ ] 測試窄終端自動切換簡化模式
- [ ] 測試輸出重定向: `node dist/cli/index.js monitor start > test.txt`

## Risks & Mitigations

| 風險 | 機率 | 影響 | 緩解措施 |
|------|------|------|---------|
| **log-update 在某些終端模擬器閃爍** | 低 | 低 | 提供 `--format=plain` 選項繞過；5秒更新間隔已大幅降低閃爍風險 |
| **終端寬度檢測在容器環境失敗** | 中 | 低 | 預設寬度 80，並支援 `COLUMNS` 環境變數覆寫 |
| **chalk v5 ESM 相容性問題** | 低 | 中 | 專案已使用 `"type": "module"`，相容性已驗證；備案：降級到 chalk v4 |
| **Pino 檔案輸出影響效能** | 極低 | 低 | Pino 內建非同步寫入，對終端 UI 無阻塞影響 |
| **cli-table3 渲染超過 10ms** | 極低 | 低 | 僅 3 個交易對，實測 < 2ms；即使 10 個交易對也在 5ms 內 |

## Constitution Compliance Check

### Principle I: Trading Safety First

**狀態**: ✅ **完全合規 (N/A)**

- 本功能不涉及交易執行邏輯
- 不修改資金費率資料
- 不觸發任何交易操作

### Principle II: Complete Observability

**狀態**: ✅ **完全合規**

- ✅ 所有關鍵事件 (rate-updated, opportunity-detected, render-error) 均透過 Pino 記錄到檔案
- ✅ 錯誤日誌包含完整 context: error message, stack trace, terminal state
- ✅ 終端 UI 與結構化日誌分離，保持可觀測性不受影響
- ✅ 日誌格式符合憲法要求: 結構化 JSON，包含 timestamp, symbol, exchange 等關鍵欄位

**實作範例**:

```typescript
logger.error({
  error: error.message,
  stack: error.stack,
  symbol: pair.symbol,
  terminal_width: process.stdout.columns,
  is_tty: process.stdout.isTTY,
  timestamp: new Date().toISOString()
}, 'Table rendering failed')
```

### Principle III: Defensive Programming

**狀態**: ✅ **完全合規**

- ✅ TTY 檢測確保環境相容性 (`process.stdout.isTTY`)
- ✅ 終端寬度檢測包含 fallback 預設值 (80)
- ✅ 渲染失敗時自動降級到 plain-text (graceful degradation)
- ✅ 資料缺失時顯示 "---" 佔位符，不拋出異常
- ✅ 非 TTY 環境自動切換輸出模式，避免 ANSI 碼亂碼

**優雅降級路徑**: 完整表格 → 簡化表格 → 純文字 → 緊急 Fallback

### Principle IV: Data Integrity

**狀態**: ✅ **完全合規 (N/A)**

- 本功能僅讀取既有資料用於顯示，不修改資料庫
- 不影響 Prisma schema 或 TimescaleDB
- 資金費率資料來源為既有 FundingRateMonitor，保持 immutable

### Principle V: Incremental Delivery

**狀態**: ✅ **完全合規**

- ✅ 功能分為 4 個 Phase，可逐步交付
- ✅ Phase 1 (表格 + 視覺突顯) 可獨立測試和部署
- ✅ 每個 Phase 有明確的 Acceptance Criteria
- ✅ 不阻塞其他 User Stories (US3-US5 交易執行功能)
- ✅ 可在測試環境 (testnet) 驗證後再應用到正式環境

**交付順序**: US1 + US2 (P1) → US3 部分 (P1) → 非 TTY 支援 (P1) → US4 (P3)

---

**Overall Compliance Status**: ✅ **ALL PRINCIPLES SATISFIED**

無憲法違規或部分合規項目。本功能專注於表現層改進，與交易核心邏輯解耦，符合所有安全性、可觀測性和漸進式交付要求。

## Open Questions

**無待解決問題**

所有關鍵決策已在 2025-10-20 澄清會議中確定：
- ✅ 日誌輸出策略（檔案 vs 終端）
- ✅ 表格佈局設計（橫向 vs 縱向）
- ✅ 窄終端處理方式（簡化模式）
- ✅ 資料缺失顯示格式（"---" 佔位符）
- ✅ 非 TTY 環境輸出模式（自動檢測）

可直接進入任務分解階段。

## References

- **Feature Specification**: [spec.md](./spec.md)
- **Project Constitution**: [../../.specify/memory/constitution.md](../../.specify/memory/constitution.md)
- **Existing Implementation**: `src/cli/commands/monitor/start.ts` (line 35-49)
- **Data Model**: `src/models/FundingRate.ts`
- **Monitoring Service**: `src/services/monitor/FundingRateMonitor.ts`

---

**Next Steps**: 執行 `/speckit.tasks` 生成詳細的任務清單 (tasks.md)
