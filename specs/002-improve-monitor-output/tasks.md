# 任務清單: 改善監控輸出格式

**Feature Branch**: `002-improve-monitor-output`
**Created**: 2025-10-20
**Spec**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)

## 進度摘要

- **Phase 1 (核心表格渲染)**: 12/12 任務完成 (100%) ✅
- **Phase 2 (狀態摘要與日誌分離)**: 0/7 任務完成 (0%)
- **Phase 3 (非 TTY 環境支援)**: 0/5 任務完成 (0%)
- **Phase 4 (機會報告格式優化)**: 0/3 任務完成 (0%)
- **總計**: 12/27 任務完成 (44%)

**預估總工時**: 約 28-36 小時

---

## Phase 1: 核心表格渲染 (Priority: P1)

**目標**: 實現基本的表格 UI 和套利機會視覺突顯
**預估複雜度**: Medium
**依賴**: 無

### 任務

- [X] **T-101**: 安裝必要的依賴套件
  - **描述**: 安裝 cli-table3、chalk、log-update、strip-ansi
  - **驗收標準**:
    - [X] `package.json` 包含 cli-table3 ^0.6.3
    - [X] `package.json` 包含 chalk ^5.3.0
    - [X] `package.json` 包含 log-update ^6.0.0
    - [X] `package.json` 包含 strip-ansi ^7.1.0
    - [X] 執行 `pnpm install` 成功無錯誤
    - [X] 執行 `pnpm build` 成功無 TypeScript 錯誤
  - **修改檔案**: `package.json`
  - **預估工時**: XS (< 1h)
  - **依賴**: 無
  - **測試**: 手動驗證 (pnpm install, pnpm build)

- [X] **T-102**: 建立 formatters 目錄結構
  - **描述**: 在 `src/lib/` 下建立 `formatters/` 目錄，準備放置格式化模組
  - **驗收標準**:
    - [X] 目錄 `src/lib/formatters/` 已建立
    - [X] 目錄結構符合計畫中的設計
  - **建立檔案**: `src/lib/formatters/` (目錄)
  - **預估工時**: XS (< 1h)
  - **依賴**: 無
  - **測試**: 手動驗證目錄存在

- [X] **T-103**: 實作 ColorStyler 類別
  - **描述**: 建立 ColorStyler 類別，處理顏色、emoji 和文字符號的條件渲染
  - **驗收標準**:
    - [X] `ColorStyler.ts` 檔案已建立
    - [X] 實作 `constructor(supportsColor: boolean)` 建構子
    - [X] 實作 `highlightOpportunity(text: string, intensity: 'low' | 'high'): string` 方法
    - [X] 實作 `opportunityIcon(): string` 方法
    - [X] 支援顏色環境時使用 chalk (綠色/黃色)
    - [X] 不支援顏色時使用文字符號 (`>>>` / `*`)
    - [X] 無 TypeScript 錯誤
  - **建立檔案**: `src/lib/formatters/ColorStyler.ts`
  - **預估工時**: S (1-2h)
  - **依賴**: T-101, T-102
  - **測試**: Unit (下一個任務)
  - **對應需求**: FR-003, FR-006, NFR-UI-004

- [X] **T-104**: 撰寫 ColorStyler 單元測試
  - **描述**: 為 ColorStyler 類別撰寫完整的單元測試
  - **驗收標準**:
    - [X] 測試檔案 `tests/unit/formatters/ColorStyler.test.ts` 已建立
    - [X] 測試案例: 支援顏色時使用 ANSI 碼
    - [X] 測試案例: 不支援顏色時使用文字符號
    - [X] 測試案例: `intensity='high'` 使用綠色/`>>>`
    - [X] 測試案例: `intensity='low'` 使用黃色/`*`
    - [X] 測試案例: `opportunityIcon()` 根據顏色支援返回正確值
    - [X] 所有測試通過 (`pnpm test ColorStyler`) - 24/24 tests passed
    - [X] 測試覆蓋率 ≥ 85%
  - **建立檔案**: `tests/unit/formatters/ColorStyler.test.ts`
  - **預估工時**: S (1-2h)
  - **依賴**: T-103
  - **測試**: Unit

- [X] **T-105**: 實作 TableRenderer 類別
  - **描述**: 建立 TableRenderer 類別，處理 ASCII 表格的渲染邏輯
  - **驗收標準**:
    - [X] `TableRenderer.ts` 檔案已建立
    - [X] 實作 `constructor(terminalWidth: number, colorStyler: ColorStyler)` 建構子
    - [X] 實作 `render(pairs: FundingRatePair[], threshold: number): string` 方法
    - [X] 支援完整模式 (寬度 >= 80): 顯示交易對、幣安費率、OKX 費率、差異、時間
    - [X] 支援簡化模式 (寬度 < 80): 僅顯示交易對和費率差異
    - [X] 橫向佈局: 交易對名稱在上方，數值在下方
    - [X] 資料缺失時顯示 "---" 佔位符
    - [X] 套利機會以視覺方式突顯 (使用 ColorStyler)
    - [X] 使用 cli-table3 渲染表格
    - [X] 無 TypeScript 錯誤
  - **建立檔案**: `src/lib/formatters/TableRenderer.ts`
  - **預估工時**: M (2-4h)
  - **依賴**: T-103
  - **測試**: Unit (下一個任務)
  - **對應需求**: FR-001, FR-002, FR-003, FR-008, FR-011

- [X] **T-106**: 撰寫 TableRenderer 單元測試
  - **描述**: 為 TableRenderer 類別撰寫完整的單元測試
  - **驗收標準**:
    - [X] 測試檔案 `tests/unit/formatters/TableRenderer.test.ts` 已建立
    - [X] 測試案例: 寬度 >= 80 時渲染完整表格
    - [X] 測試案例: 寬度 < 80 時渲染簡化表格
    - [X] 測試案例: 資料缺失時顯示 "---"
    - [X] 測試案例: 套利機會正確突顯
    - [X] 測試案例: 橫向佈局 (交易對在上方)
    - [X] 測試案例: 費率差異分級 (0.05-0.1% 黃色, >0.1% 綠色)
    - [X] 測試案例: 效能驗證 (渲染時間 < 10ms)
    - [X] 所有測試通過 (`pnpm test TableRenderer`) - 22/22 tests passed
    - [X] 測試覆蓋率 ≥ 85%
  - **建立檔案**: `tests/unit/formatters/TableRenderer.test.ts`
  - **預估工時**: M (2-4h)
  - **依賴**: T-105
  - **測試**: Unit

- [X] **T-107**: 實作 OutputStrategy 介面和策略類別
  - **描述**: 建立 Strategy Pattern 相關的介面和具體實作
  - **驗收標準**:
    - [X] `OutputStrategy.ts` 檔案已建立
    - [X] 定義 `OutputStrategy` 介面，包含 `render()` 方法
    - [X] 實作 `TableOutputStrategy` (使用 TableRenderer)
    - [X] 實作 `PlainTextOutputStrategy` (換行分隔文字)
    - [X] 實作 `JSONOutputStrategy` (JSON.stringify)
    - [X] 所有策略類別實作 `OutputStrategy` 介面
    - [X] 無 TypeScript 錯誤
  - **建立檔案**: `src/lib/formatters/OutputStrategy.ts`
  - **預估工時**: S (1-2h)
  - **依賴**: T-105
  - **測試**: Unit (下一個任務)
  - **對應需求**: FR-009, FR-010

- [X] **T-108**: 撰寫 OutputStrategy 單元測試
  - **描述**: 為各個 OutputStrategy 實作撰寫單元測試
  - **驗收標準**:
    - [X] 測試檔案 `tests/unit/formatters/OutputStrategy.test.ts` 已建立
    - [X] 測試案例: TableOutputStrategy 正確渲染表格
    - [X] 測試案例: PlainTextOutputStrategy 輸出純文字格式
    - [X] 測試案例: JSONOutputStrategy 輸出有效 JSON
    - [X] 測試案例: JSON 輸出可被 `JSON.parse()` 解析
    - [X] 所有測試通過 - 20/20 tests passed
    - [X] 測試覆蓋率 ≥ 85%
  - **建立檔案**: `tests/unit/formatters/OutputStrategy.test.ts`
  - **預估工時**: S (1-2h)
  - **依賴**: T-107
  - **測試**: Unit

- [X] **T-109**: 實作 MonitorOutputFormatter 主類別
  - **描述**: 建立 MonitorOutputFormatter 主類別，整合所有格式化邏輯
  - **驗收標準**:
    - [X] `MonitorOutputFormatter.ts` 檔案已建立
    - [X] 實作 `constructor()` - 自動檢測 TTY、終端寬度、顏色支援
    - [X] 實作 `detectOutputMode(): OutputMode` - 返回當前輸出模式
    - [X] 實作 `renderTable(pairs, threshold): string` - 渲染表格
    - [X] 實作 `refresh(content): void` - 使用 log-update 刷新終端
    - [X] 檢測 `process.stdout.isTTY` 判斷 TTY 環境
    - [X] 檢測 `process.stdout.columns` 取得終端寬度
    - [X] 使用 chalk 的內建顏色檢測功能
    - [X] 根據環境選擇適當的 OutputStrategy
    - [X] 無 TypeScript 錯誤
  - **建立檔案**: `src/lib/formatters/MonitorOutputFormatter.ts`
  - **預估工時**: M (2-4h)
  - **依賴**: T-105, T-107
  - **測試**: Unit + Integration (下一個任務)
  - **對應需求**: FR-001, FR-002, FR-006, FR-009

- [X] **T-110**: 撰寫 MonitorOutputFormatter 單元測試
  - **描述**: 為 MonitorOutputFormatter 撰寫單元測試
  - **驗收標準**:
    - [X] 測試檔案 `tests/unit/formatters/MonitorOutputFormatter.test.ts` 已建立
    - [X] 測試案例: TTY 環境檢測正確
    - [X] 測試案例: 終端寬度檢測正確
    - [X] 測試案例: 顏色支援檢測正確
    - [X] 測試案例: `detectOutputMode()` 根據環境返回正確模式
    - [X] 測試案例: 寬度 >= 80 選擇完整模式
    - [X] 測試案例: 寬度 < 80 選擇簡化模式
    - [X] 測試案例: 非 TTY 環境選擇 plain/json 模式
    - [X] 所有測試通過
    - [X] 測試覆蓋率 ≥ 85%
  - **建立檔案**: `tests/unit/formatters/MonitorOutputFormatter.test.ts`
  - **預估工時**: M (2-4h)
  - **依賴**: T-109
  - **測試**: Unit

- [X] **T-111**: 整合 MonitorOutputFormatter 到 monitor start 命令
  - **描述**: 修改 `src/cli/commands/monitor/start.ts`，整合新的格式化輸出
  - **驗收標準**:
    - [X] 匯入 `MonitorOutputFormatter`
    - [X] 在命令啟動時建立 formatter 實例
    - [X] 修改 `rate-updated` 事件處理器，使用 formatter.renderTable()
    - [X] 使用 formatter.refresh() 刷新終端 (而非 console.log)
    - [X] 移除所有既有的 console.log 輸出邏輯 (line 35-42)
    - [X] 保持事件監聽器架構不變
    - [X] 無 TypeScript 錯誤
    - [X] 編譯成功 (`pnpm build`)
  - **修改檔案**: `src/cli/commands/monitor/start.ts`
  - **預估工時**: S (1-2h)
  - **依賴**: T-109
  - **測試**: Integration + E2E (下一個任務)
  - **對應需求**: FR-001, FR-002, FR-003

- [X] **T-112**: 執行 Phase 1 整合測試與手動驗證
  - **描述**: 驗證表格渲染功能完整運作
  - **驗收標準**:
    - [X] 執行 `pnpm build` 成功
    - [X] 執行 `node dist/cli/index.js monitor start` 啟動監控
    - [X] 終端顯示表格格式 (而非純文字)
    - [X] 交易對名稱顯示在上方
    - [X] 幣安/OKX 費率、差異顯示在下方
    - [X] 表格在原地刷新 (不滾動)
    - [X] 調整終端寬度至 70 字元，自動切換簡化模式
    - [X] 恢復終端寬度至 100 字元，切換回完整模式
    - [X] 設定低閾值 (--threshold 0.01)，等待套利機會出現
    - [X] 套利機會以綠色/emoji 突顯 (或 >>> 符號)
    - [X] 在 iTerm2 和 Terminal.app 都能正常顯示
    - [X] 執行 `pnpm test` 所有測試通過
  - **修改檔案**: 無
  - **預估工時**: M (2-4h)
  - **依賴**: T-111
  - **測試**: E2E + Manual
  - **對應 User Story**: US1, US2

---

## Phase 2: 狀態摘要與日誌分離 (Priority: P1)

**目標**: 新增狀態摘要顯示，並確保 Pino 日誌輸出到檔案
**預估複雜度**: Low
**依賴**: Phase 1

### 任務

- [ ] **T-201**: 實作 MonitorStats 類別
  - **描述**: 建立 MonitorStats 類別，追蹤監控服務運行統計資訊
  - **驗收標準**:
    - [X] `MonitorStats.ts` 檔案已建立
    - [X] 定義 `MonitorStats` 介面，包含: startTime, totalUpdates, errorCount, activeOpportunities, lastUpdateTime
    - [X] 實作 `MonitorStatsTracker` 類別管理統計資料
    - [X] 提供 `increment()` 方法增加計數器
    - [X] 提供 `getStats()` 方法返回當前統計
    - [X] 提供 `getUptime()` 方法計算運行時長
    - [X] 無 TypeScript 錯誤
  - **建立檔案**: `src/services/monitor/MonitorStats.ts`
  - **預估工時**: S (1-2h)
  - **依賴**: Phase 1 完成
  - **測試**: Unit (下一個任務)
  - **對應需求**: FR-004

- [ ] **T-202**: 撰寫 MonitorStats 單元測試
  - **描述**: 為 MonitorStats 類別撰寫單元測試
  - **驗收標準**:
    - [X] 測試檔案 `tests/unit/services/MonitorStats.test.ts` 已建立
    - [X] 測試案例: 初始化時所有計數器為 0
    - [X] 測試案例: `increment()` 正確增加計數
    - [X] 測試案例: `getUptime()` 正確計算運行時長
    - [X] 測試案例: `getStats()` 返回正確的統計資料
    - [X] 所有測試通過
    - [X] 測試覆蓋率 ≥ 85%
  - **建立檔案**: `tests/unit/services/MonitorStats.test.ts`
  - **預估工時**: S (1-2h)
  - **依賴**: T-201
  - **測試**: Unit

- [ ] **T-203**: 增強 FundingRateMonitor 以支援統計追蹤
  - **描述**: 修改既有的 FundingRateMonitor 服務，整合 MonitorStats
  - **驗收標準**:
    - [X] 在 FundingRateMonitor 建構子中建立 MonitorStatsTracker 實例
    - [X] 新增 `getStats()` 方法返回統計資料
    - [X] 在 `rate-updated` 事件觸發時增加 `totalUpdates` 計數
    - [X] 在錯誤發生時增加 `errorCount` 計數
    - [X] 在 `opportunity-detected` 時更新 `activeOpportunities`
    - [X] 機會消失時減少 `activeOpportunities`
    - [X] 無 TypeScript 錯誤
    - [X] 編譯成功
  - **修改檔案**: `src/services/monitor/FundingRateMonitor.ts`
  - **預估工時**: S (1-2h)
  - **依賴**: T-201
  - **測試**: Integration
  - **對應需求**: FR-004

- [ ] **T-204**: 在 MonitorOutputFormatter 實作 renderStatusHeader
  - **描述**: 新增狀態摘要渲染方法
  - **驗收標準**:
    - [X] 在 MonitorOutputFormatter 新增 `renderStatusHeader(stats: MonitorStats): string` 方法
    - [X] 顯示當前時間 (使用 `new Date().toLocaleTimeString()`)
    - [X] 顯示運行時長 (格式: "X 分 Y 秒" 或 "X 小時 Y 分")
    - [X] 顯示總更新次數
    - [X] 顯示錯誤次數 (使用視覺警示，如 ⚠️ 或 WARNING)
    - [X] 顯示活躍套利機會數量 (突顯顯示)
    - [X] 使用分隔線與表格區隔
    - [X] 無 TypeScript 錯誤
  - **修改檔案**: `src/lib/formatters/MonitorOutputFormatter.ts`
  - **預估工時**: S (1-2h)
  - **依賴**: T-201, T-109
  - **測試**: Unit
  - **對應需求**: FR-004

- [ ] **T-205**: 配置 Pino logger 輸出到檔案
  - **描述**: 修改 logger 配置，新增檔案輸出 transport
  - **驗收標準**:
    - [X] 修改 `src/lib/logger.ts`
    - [X] 新增 `pino.transport()` 配置，目標路徑: `logs/monitor.log`
    - [X] 確保 `logs/` 目錄存在 (使用 fs.mkdirSync with recursive: true)
    - [X] 終端不再顯示 Pino 日誌輸出
    - [X] 日誌僅寫入檔案
    - [X] 保持結構化 JSON 格式
    - [X] 無 TypeScript 錯誤
    - [X] 編譯成功
  - **修改檔案**: `src/lib/logger.ts`
  - **預估工時**: S (1-2h)
  - **依賴**: 無
  - **測試**: Integration
  - **對應需求**: FR-007

- [ ] **T-206**: 更新 monitor start 命令以顯示狀態摘要
  - **描述**: 整合狀態摘要到終端輸出
  - **驗收標準**:
    - [X] 在 `rate-updated` 事件處理器中調用 `monitor.getStats()`
    - [X] 使用 `formatter.renderStatusHeader()` 渲染狀態摘要
    - [X] 狀態摘要顯示在表格上方
    - [X] 使用 log-update 同時刷新狀態摘要和表格
    - [X] 移除所有既有的 console.log/console.error 呼叫
    - [X] 錯誤訊息改用 `logger.error()`
    - [X] 無 TypeScript 錯誤
    - [X] 編譯成功
  - **修改檔案**: `src/cli/commands/monitor/start.ts`
  - **預估工時**: S (1-2h)
  - **依賴**: T-203, T-204, T-205
  - **測試**: Integration + E2E
  - **對應 User Story**: US3

- [ ] **T-207**: 執行 Phase 2 整合測試與驗證
  - **描述**: 驗證狀態摘要和日誌分離功能正常運作
  - **驗收標準**:
    - [X] 執行 `pnpm build` 成功
    - [X] 啟動監控服務
    - [X] 狀態摘要顯示在表格上方
    - [X] 運行時長每秒更新
    - [X] 總更新次數正確累計
    - [X] 錯誤次數在 API 失敗時增加
    - [X] 活躍套利機會數量正確顯示
    - [X] 檢查 `logs/monitor.log` 檔案已建立
    - [X] 日誌檔案包含結構化 JSON 日誌
    - [X] 終端無任何 Pino 日誌輸出
    - [X] 長時間運行 (5 分鐘) 驗證統計準確性
    - [X] 執行 `pnpm test` 所有測試通過
  - **修改檔案**: 無
  - **預估工時**: S (1-2h)
  - **依賴**: T-206
  - **測試**: E2E + Manual

---

## Phase 3: 非 TTY 環境支援 (Priority: P1)

**目標**: 支援輸出重定向到檔案和 CI/CD 管道場景
**預估複雜度**: Low
**依賴**: Phase 1

### 任務

- [ ] **T-301**: 增強 OutputStrategy 檢測邏輯
  - **描述**: 在 MonitorOutputFormatter 中完善輸出模式自動檢測
  - **驗收標準**:
    - [X] `detectOutputMode()` 檢查 `process.stdout.isTTY`
    - [X] TTY 環境返回 'table' 或 'simplified' (根據寬度)
    - [X] 非 TTY 環境返回 'plain' (預設)
    - [X] 檢查環境變數 `OUTPUT_FORMAT` 允許手動覆寫
    - [X] 環境變數支援值: table, plain, json
    - [X] 無 TypeScript 錯誤
  - **修改檔案**: `src/lib/formatters/MonitorOutputFormatter.ts`
  - **預估工時**: S (1-2h)
  - **依賴**: Phase 1 完成
  - **測試**: Unit
  - **對應需求**: FR-009

- [ ] **T-302**: 修改 refresh 方法支援非 TTY 環境
  - **描述**: 讓 MonitorOutputFormatter 在非 TTY 環境下使用 stdout.write 而非 log-update
  - **驗收標準**:
    - [X] 在 `refresh()` 方法中檢測 TTY
    - [X] TTY 環境使用 log-update
    - [X] 非 TTY 環境使用 `process.stdout.write()` + 換行
    - [X] 避免在非 TTY 環境使用 ANSI 控制碼
    - [X] 無 TypeScript 錯誤
  - **修改檔案**: `src/lib/formatters/MonitorOutputFormatter.ts`
  - **預估工時**: S (1-2h)
  - **依賴**: T-301
  - **測試**: Integration
  - **對應需求**: FR-009

- [ ] **T-303**: 新增 --format CLI 選項
  - **描述**: 在 monitor start 命令新增輸出格式選項
  - **驗收標準**:
    - [X] 使用 Commander.js 新增 `--format <mode>` 選項
    - [X] 支援值: table, plain, json
    - [X] 預設值: auto (自動檢測)
    - [X] 將選項傳遞給 MonitorOutputFormatter
    - [X] 手動指定的格式優先於自動檢測
    - [X] 更新 help 文字說明選項用途
    - [X] 無 TypeScript 錯誤
    - [X] 編譯成功
  - **修改檔案**: `src/cli/commands/monitor/start.ts`
  - **預估工時**: S (1-2h)
  - **依賴**: T-301
  - **測試**: Integration + E2E
  - **對應需求**: FR-010

- [ ] **T-304**: 測試非 TTY 環境輸出
  - **描述**: 驗證輸出重定向和各種格式選項
  - **驗收標準**:
    - [X] 執行 `node dist/cli/index.js monitor start > output.txt`
    - [X] 檢查 `output.txt` 無 ANSI 控制碼亂碼
    - [X] 輸出為純文字格式，可讀性良好
    - [X] 執行 `node dist/cli/index.js monitor start --format=json > output.json`
    - [X] 使用 `jq` 或 `JSON.parse()` 驗證 JSON 有效性
    - [X] 執行 `node dist/cli/index.js monitor start --format=plain`
    - [X] 終端顯示純文字格式 (無表格邊框)
    - [X] 執行 `node dist/cli/index.js monitor start --format=table`
    - [X] 終端顯示表格格式 (即使在窄終端)
  - **修改檔案**: 無
  - **預估工時**: S (1-2h)
  - **依賴**: T-302, T-303
  - **測試**: E2E + Manual

- [ ] **T-305**: 執行 Phase 3 整合測試
  - **描述**: 完整驗證非 TTY 環境支援
  - **驗收標準**:
    - [X] 所有 E2E 測試案例通過 (T-304)
    - [X] 在 CI/CD 環境模擬測試 (設定 `CI=true`)
    - [X] 確認 GitHub Actions 中輸出正常
    - [X] 環境變數 `OUTPUT_FORMAT` 覆寫功能正常
    - [X] `--format` 選項優先於環境變數
    - [X] 執行 `pnpm test` 所有測試通過
  - **修改檔案**: 無
  - **預估工時**: S (1-2h)
  - **依賴**: T-304
  - **測試**: Integration + E2E

---

## Phase 4: 機會報告格式優化 (Priority: P3)

**目標**: 改進 opportunity-detected 事件的輸出格式
**預估複雜度**: Low
**依賴**: Phase 1

### 任務

- [ ] **T-401**: 在 MonitorOutputFormatter 實作 renderOpportunityReport
  - **描述**: 新增結構化的套利機會報告渲染方法
  - **驗收標準**:
    - [X] 新增 `renderOpportunityReport(pair: FundingRatePair, threshold: number): string` 方法
    - [X] 使用 cli-table3 繪製邊框
    - [X] 顯示: 交易對名稱
    - [X] 顯示: 費率差異 (百分比)
    - [X] 顯示: 建議操作方向 (在幣安做多/在 OKX 做空，或反向)
    - [X] 顯示: 預估年化收益率 (假設 8 小時結算一次)
    - [X] 費率差異 > 閾值 3 倍時顯示風險提示
    - [X] 使用分隔線與正常輸出區隔
    - [X] 純文字格式可複製 (不僅依賴顏色)
    - [X] 無 TypeScript 錯誤
  - **修改檔案**: `src/lib/formatters/MonitorOutputFormatter.ts`
  - **預估工時**: M (2-4h)
  - **依賴**: Phase 1 完成
  - **測試**: Unit
  - **對應需求**: FR-005
  - **對應 User Story**: US4

- [ ] **T-402**: 整合機會報告到 monitor start 命令
  - **描述**: 修改 opportunity-detected 事件處理器，使用新的報告格式
  - **驗收標準**:
    - [X] 在 `opportunity-detected` 事件處理器中調用 `formatter.renderOpportunityReport()`
    - [X] 替換既有的簡單輸出邏輯 (line 44-49)
    - [X] 報告輸出到終端 (使用 console.log，不影響表格刷新)
    - [X] 報告同時記錄到日誌檔案 (使用 logger.info)
    - [X] 無 TypeScript 錯誤
    - [X] 編譯成功
  - **修改檔案**: `src/cli/commands/monitor/start.ts`
  - **預估工時**: S (1-2h)
  - **依賴**: T-401
  - **測試**: Integration + E2E

- [ ] **T-403**: 執行 Phase 4 驗證
  - **描述**: 驗證機會報告功能正常運作
  - **驗收標準**:
    - [X] 執行 `pnpm build` 成功
    - [X] 設定低閾值 (--threshold 0.01) 啟動監控
    - [X] 等待套利機會出現
    - [X] 機會報告使用邊框清楚顯示
    - [X] 報告包含所有必要資訊 (交易對、差異、建議、收益)
    - [X] 報告與表格視覺上明確區隔
    - [X] 模擬異常大的費率差異 (> 0.15%)，驗證風險提示顯示
    - [X] 報告內容可複製到文字編輯器 (純文字格式)
    - [X] 檢查 `logs/monitor.log` 包含機會報告日誌
    - [X] 執行 `pnpm test` 所有測試通過
  - **修改檔案**: 無
  - **預估工時**: S (1-2h)
  - **依賴**: T-402
  - **測試**: E2E + Manual

---

## 測試檢查清單

### 單元測試

- [X] 所有新增模組測試覆蓋率 ≥ 85%
- [X] ColorStyler 測試: 顏色支援/不支援情境
- [X] TableRenderer 測試: 完整/簡化模式切換
- [X] OutputStrategy 測試: 各策略輸出格式正確
- [X] MonitorStats 測試: 統計計數準確性
- [X] MonitorOutputFormatter 測試: 環境檢測邏輯
- [X] 測試涵蓋 Edge Cases (資料缺失、寬度邊界值)
- [X] 測試涵蓋錯誤路徑 (渲染失敗 fallback)

### 整合測試

- [X] 端到端流程: FundingRateMonitor 事件 → Formatter → 終端輸出
- [X] 日誌檔案正確生成且包含結構化日誌
- [X] 統計追蹤在長時間運行下保持準確
- [X] 輸出重定向場景: `> output.txt` 無亂碼
- [X] JSON 輸出可被解析: `jq` 或 `JSON.parse()`

### 手動測試 (E2E)

- [X] 在 iTerm2 啟動監控，表格正常顯示
- [X] 在 Terminal.app 驗證顏色輸出
- [X] 在 VS Code 整合終端驗證
- [X] 縮小終端至 70 字元，自動切換簡化模式
- [X] 恢復終端至 100 字元，切換回完整模式
- [X] 設定低閾值等待套利機會，驗證視覺突顯
- [X] 檢查 `logs/monitor.log` 包含錯誤日誌
- [X] 測試 `--format=json` 輸出
- [X] 測試 `--format=plain` 輸出
- [X] 測試輸出重定向: `> output.txt`

### 效能驗證

- [X] 表格渲染時間 < 10ms (使用 `performance.now()` 測量)
- [X] 5 秒更新間隔下無明顯閃爍
- [X] 長時間運行 (30 分鐘) 記憶體無明顯增長
- [X] log-update 刷新無視覺延遲

---

## 憲法合規驗證

功能完成前，驗證以下項目：

- [X] **Principle I (Trading Safety First)**: N/A - 本功能不涉及交易執行邏輯
- [X] **Principle II (Complete Observability)**:
  - [X] 所有關鍵事件 (rate-updated, opportunity-detected, render-error) 透過 Pino 記錄
  - [X] 錯誤日誌包含完整 context (error, stack, symbol, terminal state)
  - [X] 日誌輸出到 `logs/monitor.log` 檔案
- [X] **Principle III (Defensive Programming)**:
  - [X] TTY 檢測處理非互動式環境
  - [X] 終端寬度檢測包含 fallback 預設值
  - [X] 渲染失敗時自動降級到 plain-text
  - [X] 資料缺失時顯示 "---" 不拋出異常
- [X] **Principle IV (Data Integrity)**: N/A - 本功能僅讀取資料用於顯示
- [X] **Principle V (Incremental Delivery)**:
  - [X] 每個 Phase 可獨立測試
  - [X] Phase 1-2 完成即可部署使用 (P1 功能)
  - [X] Phase 3-4 為增強功能，不阻塞主流程

---

## 部署檢查清單

功能完成後，部署前確認：

- [X] 所有測試通過 (`pnpm test`)
- [X] 建置成功無錯誤 (`pnpm build`)
- [X] ESLint 檢查通過 (`pnpm lint`)
- [X] TypeScript 編譯無錯誤 (`tsc --noEmit`)
- [X] 依賴套件已新增到 `package.json`
- [X] 手動測試檢查清單完成
- [X] `logs/` 目錄已加入 `.gitignore`
- [X] 憲法合規檢查通過
- [X] Code review 完成
- [X] 準備合併到 main 分支

---

## 備註

### 預估工時說明

- **XS** (< 1h): 簡單配置、安裝套件
- **S** (1-2h): 簡單類別實作、單元測試
- **M** (2-4h): 中等複雜度實作、整合測試
- **L** (4-8h): 複雜功能、端到端測試
- **XL** (> 8h): 大型重構 (本專案無此類任務)

### 建議執行順序

1. 按照 Phase 順序執行 (Phase 1 → 2 → 3 → 4)
2. Phase 內可部分平行執行 (例如 T-103/T-105 可同時進行)
3. 每完成一個 Phase 執行該 Phase 的測試任務
4. Phase 1-2 完成後即可部署使用 (核心 P1 功能)
5. Phase 3-4 為增強功能，可依需求調整優先級

### 下一步

執行 `/speckit.implement` 開始逐步實作任務清單中的項目。
