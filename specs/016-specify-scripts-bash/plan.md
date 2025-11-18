# Implementation Plan: 擴大交易對監控規模

**Branch**: `016-specify-scripts-bash` | **Date**: 2025-11-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/016-specify-scripts-bash/spec.md`

## Summary

將套利機器人的監控交易對從 30 個擴大至 100 個，以增加套利機會的偵測數量。技術方法採用現有的 `update-oi-symbols` 腳本，通過設定環境變數 `OI_TOP_N=100` 來更新 `config/symbols.json` 配置檔案。此功能不涉及新的資料模型或 API 變更，主要是配置擴展和系統驗證。

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS (現有專案配置)
**Primary Dependencies**:
- Binance Connector (用於獲取 OI 數據)
- CCXT 4.x (OKX, MEXC, Gate.io 連接器)
- p-limit (並發控制)
- Prisma 5.x (不涉及資料模型變更)

**Storage**:
- 配置檔案：`config/symbols.json` (JSON 檔案)
- PostgreSQL 15 + TimescaleDB (資金費率歷史數據，現有結構無需變更)

**Testing**:
- Jest/Vitest (單元測試)
- 整合測試（驗證腳本執行和系統啟動）
- 手動測試（前端頁面顯示驗證）

**Target Platform**: Node.js server environment (Linux/macOS)
**Project Type**: Single (CLI + Web，已有的專案結構)

**Performance Goals**:
- 腳本執行時間：< 5 分鐘（獲取 200+ 交易對的 OI 數據）
- API 呼叫速率：保持在 Binance 限制的 50% 以內 (600 req/min)
- 資金費率監控週期：維持 5 分鐘（100 個交易對）

**Constraints**:
- 不超過各交易所 API 速率限制
- 記憶體增加 < 1MB
- 前端頁面載入時間 < 3 秒
- 向後兼容現有的 30 個交易對配置

**Scale/Scope**:
- 交易對數量：30 → 100 (333% 增長)
- 交易所數量：4 個 (Binance, OKX, MEXC, Gate.io)
- 預期每日套利機會：15-30 個

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Trading Safety First ✅ **PASS**
- ✅ 此功能不涉及交易執行邏輯
- ✅ 僅擴大監控範圍，不影響交易安全機制
- **影響**: 無

### Principle II: Complete Observability ✅ **PASS**
- ✅ 現有日誌機制已涵蓋資金費率監控
- ✅ 腳本執行應記錄成功/失敗狀態
- ✅ 系統啟動應顯示監控的交易對數量
- **行動**: 確保腳本輸出清楚的日誌訊息

### Principle III: Defensive Programming ✅ **PASS**
- ✅ 現有的並發控制（p-limit）機制已存在
- ✅ API 錯誤處理已實作
- ✅ WebSocket 重連機制已存在
- ✅ 腳本應處理網路錯誤並保留原有配置
- **行動**: 驗證錯誤處理在 100 個交易對下仍正常運作

### Principle IV: Data Integrity ✅ **PASS**
- ✅ 不涉及資料庫 schema 變更
- ✅ `config/symbols.json` 格式與現有結構一致
- ✅ 資金費率數據仍使用 TimescaleDB hypertables
- **影響**: 無

### Principle V: Incremental Delivery ✅ **PASS**
- ✅ User Story 1 (P1) 是獨立可測試的 MVP
- ✅ User Story 2-3 可選擇性實作
- ✅ 不影響現有功能（向後兼容）
- **行動**: 優先完成 US1，US2-3 為增強功能

### Principle VI: System Architecture Boundaries ✅ **PASS**
- ✅ 遵循 CLI 負責監控的原則
- ✅ 配置更新由 CLI 腳本執行
- ✅ Web 僅讀取資料庫數據
- ✅ 不涉及 API keys 暴露問題
- **架構符合性**: 完全符合

### **總體評估**: ✅ 全部通過，無需特殊豁免

此功能是純配置擴展，不涉及架構變更或安全風險。所有 Constitution 原則自然滿足。

## Project Structure

### Documentation (this feature)

```
specs/016-specify-scripts-bash/
├── spec.md              # 功能規格（已完成）
├── plan.md              # 本檔案（技術計劃）
├── research.md          # 技術研究和決策記錄
├── data-model.md        # 資料模型（本功能無新增）
├── quickstart.md        # 快速開始指南
├── contracts/           # API 合約（本功能無變更）
│   └── api-changes.md   # 記錄無 API 變更
├── checklists/          # 檢查清單
│   └── requirements.md  # 規格品質檢查（已完成）
└── tasks.md             # 任務清單（Phase 2 生成）
```

### Source Code (repository root)

```
# 現有專案結構（不新增目錄）

config/
└── symbols.json         # ✏️ 修改：更新 top100_oi 群組

src/
├── scripts/
│   └── update-oi-symbols.ts  # ✓ 現有：OI 更新腳本（無需修改）
├── services/
│   └── monitor/
│       ├── FundingRateMonitor.ts  # ✓ 現有：監控服務（可能需小幅調整日誌）
│       └── RatesCache.ts           # ✓ 現有：快取（無需修改）
├── connectors/
│   ├── binance.ts       # ✓ 現有：Binance 連接器（無需修改）
│   ├── okx.ts           # ✓ 現有：OKX 連接器（無需修改）
│   ├── mexc.ts          # ✓ 現有：MEXC 連接器（無需修改）
│   └── gateio.ts        # ✓ 現有：Gate.io 連接器（無需修改）
└── cli/
    └── commands/monitor/
        └── start.ts     # ✓ 現有：CLI 啟動命令（可能需增強日誌）

tests/
├── unit/
│   └── scripts/
│       └── update-oi-symbols.test.ts  # ✏️ 新增/更新：腳本測試
└── integration/
    └── monitor-100-pairs.test.ts  # ✏️ 新增：整合測試

app/                     # Next.js Web 前端
└── (dashboard)/
    └── market-monitor/  # ✓ 現有：市場監控頁面（無需修改，自動適應）
```

**Structure Decision**: 採用現有的單一專案結構（Option 1）。此功能不需要新增目錄或模組，主要是配置變更和驗證。所有必要的基礎設施（腳本、監控服務、連接器）已存在。

## Complexity Tracking

*本功能無 Constitution 違規，此節留空。*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A       | N/A        | N/A |

---

## Phase 0: Research & Technical Decisions

### Research Tasks

由於此功能主要使用現有基礎設施，研究重點在於驗證可行性和識別潛在瓶頸：

1. **OI 數據來源驗證**
   - 確認 Binance 上有至少 100 個符合 OI 門檻的 USDT 永續合約
   - 驗證 `update-oi-symbols` 腳本支援自訂數量參數

2. **交易所交易對覆蓋率分析**
   - 調查 100 個高 OI 交易對中有多少在所有 4 個交易所都支援
   - 識別可能需要特殊處理的交易對

3. **API 速率限制計算**
   - 計算 100 個交易對在 5 分鐘週期下的 API 呼叫總量
   - 驗證不會超過各交易所的限制

4. **效能影響評估**
   - 預估記憶體使用量增加
   - 評估前端渲染 100 個交易對的效能

5. **錯誤處理機制審查**
   - 檢查現有錯誤處理是否能應對更大規模
   - 識別需要增強的錯誤處理場景

**輸出**: `research.md` 檔案記錄所有研究結果和技術決策

---

## Phase 1: Design Artifacts

### Data Model (`data-model.md`)

**結論**: 無新增資料模型。

現有的資料模型（`config/symbols.json` 結構）已足夠：

```json
{
  "groups": {
    "top100_oi": {
      "symbols": ["BTCUSDT", "ETHUSDT", ...],  // 從 30 個擴大到 100 個
      "lastUpdated": "2025-11-18T..."
    }
  }
}
```

`data-model.md` 將記錄：
- 現有的 symbols.json 結構說明
- 更新流程說明
- 無需 Prisma migration

### API Contracts (`contracts/`)

**結論**: 無 API 變更。

此功能不修改任何 API 端點或 WebSocket 事件。現有的 API 會自動適應更多交易對。

`contracts/api-changes.md` 將記錄：
- GET /api/market-rates：無變更（自動返回所有監控的交易對）
- WebSocket rates:update：無變更（自動推送所有監控的交易對）
- 向後兼容性：完全兼容

### Quickstart Guide (`quickstart.md`)

為管理員提供快速擴大監控的指南：

**內容大綱**:
1. **前置需求**：Node.js 20.x, pnpm, 環境變數配置
2. **執行步驟**：
   - 備份現有配置
   - 執行 `OI_TOP_N=100 pnpm update-oi-symbols`
   - 驗證 `config/symbols.json` 更新
   - 重啟監控服務
3. **驗證**：
   - 檢查日誌確認監控數量
   - 訪問前端頁面確認顯示
4. **回滾**：如何恢復到 30 個交易對
5. **故障排除**：常見問題和解決方案

### Agent Context Update

執行 `.specify/scripts/bash/update-agent-context.sh claude` 以更新 `CLAUDE.md`：

**新增技術資訊**:
- 此功能使用現有技術棧（TypeScript 5.6, Node.js 20.x）
- 無新增依賴
- 配置管理：config/symbols.json

---

## Post-Phase 1 Constitution Re-check

*所有原則維持 PASS 狀態。*

無設計變更，Constitution 符合性未受影響。

---

## Next Steps

Phase 1 完成後，執行 `/speckit.tasks` 生成任務清單。

預計任務數量：8-12 個（主要是驗證和測試任務）
預計工時：2-4 小時（包含測試）
