# Implementation Plan: 跨交易所資金費率套利平台

**Branch**: `001-funding-rate-arbitrage` | **Date**: 2025-10-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-funding-rate-arbitrage/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

開發一個專為永續合約市場設計的跨交易所資金費率套利平台。系統將即時監控幣安 (Binance) 和 OKX 兩個交易所的 BTC、ETH、SOL 永續合約資金費率,自動偵測套利機會,並在條件符合時執行雙邊對沖交易。核心功能包括即時監控、機會偵測、自動交易執行、平倉管理和風險控制,目標是在市場波動中持續獲取穩定收益,同時降低風險與操作成本。

## Technical Context

**Language/Version**: TypeScript 5.3+ + Node.js 20.x LTS
**Primary Dependencies**: binance-connector-node 3.x, okx-node-sdk 1.x, ccxt 4.x (備援), Prisma 5.x (ORM), ws 8.x (WebSocket)
**Storage**: PostgreSQL 15+ with TimescaleDB 2.13+ extension + Redis 7.x
**Testing**: Vitest 1.x (單元測試), Playwright 1.40+ (E2E 測試)
**Target Platform**: Linux 伺服器 (Docker 容器化部署)
**Project Type**: 單一專案 (後端服務 + CLI 介面)
**Performance Goals**:
- 資金費率更新延遲 < 5 秒
- 雙邊開倉執行時間 < 10 秒
- 支援同時監控至少 3 個幣別
- 24/7 連續運行穩定性 > 99%

**Constraints**:
- 交易所 API 限流限制 (需實作 rate limiting)
- 網路延遲影響套利機會的時效性
- 需確保雙邊交易的原子性或補償機制
- 資金費率結算時間的精確性要求

**Scale/Scope**:
- 初期支援 2 個交易所 (Binance, OKX)
- 初期支援 3 種幣別 (BTC, ETH, SOL)
- 單一使用者實例 (未來可擴展多使用者)
- 預估每日記錄數千筆資金費率數據

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**注意**: 專案憲章檔案 (`.specify/memory/constitution.md`) 尚未定義具體原則。建議在 Phase 0 研究階段建立以下基本原則:

### 建議的核心原則

1. **模組化設計**: 交易所連接器、監控引擎、交易執行器、風險管理器應為獨立可測試的模組
2. **錯誤處理**: 所有外部 API 調用必須有重試機制和錯誤記錄
3. **資料完整性**: 所有交易和資金費率數據必須持久化
4. **測試覆蓋率**: 核心交易邏輯需要 > 80% 測試覆蓋率
5. **安全性**: API 金鑰使用環境變數或密鑰管理服務,不得硬編碼

### 目前狀態
- ✅ 功能範圍清晰界定
- ⚠️ 需要在 Phase 0 研究中確認技術選型
- ⚠️ 需要在 Phase 0 研究中確認專案憲章

## Project Structure

### Documentation (this feature)

```
specs/001-funding-rate-arbitrage/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
src/
├── models/              # 資料模型 (FundingRate, ArbitrageOpportunity, HedgePosition, etc.)
├── services/            # 業務邏輯服務
│   ├── monitor/         # 監控服務 (資金費率抓取、計算差異)
│   ├── detector/        # 套利機會偵測器
│   ├── executor/        # 交易執行器 (雙邊開倉、平倉)
│   └── risk/            # 風險管理服務
├── connectors/          # 交易所連接器 (Binance, OKX)
├── cli/                 # CLI 介面
└── lib/                 # 共用工具庫 (logger, config, helpers)

tests/
├── contract/            # 合約測試 (交易所 API 整合測試)
├── integration/         # 整合測試 (服務間互動測試)
└── unit/                # 單元測試

config/                  # 設定檔 (範例設定、環境變數範本)
docs/                    # 使用者文件
scripts/                 # 部署和維護腳本
```

**Structure Decision**: 選擇單一專案結構,因為這是一個後端服務應用,不需要前端介面。所有功能透過 CLI 或未來可能的 API 提供。採用模組化設計,將交易所連接器、監控、偵測、執行和風險管理分離為獨立服務,便於測試和維護。

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

目前無憲章違規項目。專案憲章尚未正式定義,建議在 Phase 0 研究階段建立專案特定的開發規範。

---

## Phase 0: Research & Decisions

**Status**: ✅ Completed - [research.md](./research.md)

### Research Tasks

以下是需要在 Phase 0 研究的關鍵決策點:

1. **程式語言與執行環境選擇**
   - 評估 TypeScript/Node.js vs Python
   - 考量因素: 交易所 SDK 成熟度、效能、開發速度、維護性

2. **交易所 SDK 選擇**
   - ccxt (統一介面) vs 官方 SDK (Binance Python/TS SDK, OKX SDK)
   - 評估 WebSocket 支援、限流處理、錯誤恢復機制

3. **資料儲存方案**
   - 時序資料庫 (TimescaleDB, InfluxDB) vs 關聯式資料庫 (PostgreSQL) + Redis
   - 評估資料查詢需求、歷史數據保留策略

4. **雙邊交易執行策略**
   - 補償交易模式 (Saga Pattern)
   - 研究如何處理單邊失敗、部分成交、網路延遲

5. **監控與告警機制**
   - 使用者通知方式 (Webhook, Email, Telegram Bot)
   - 系統監控工具 (Prometheus + Grafana, 或雲服務監控)

6. **風險管理最佳實踐**
   - 倉位管理演算法
   - 止損策略設計
   - 異常檢測機制

**Output**: research.md 將記錄所有決策、理由和替代方案評估

---

## Phase 1: Design & Contracts

**Status**: ✅ Completed

### Deliverables

1. **data-model.md** ✅: 詳細的資料模型設計
   - 7 個核心實體完整定義 (FundingRate, ArbitrageOpportunity, HedgePosition, TradeRecord, ArbitrageCycle, RiskParameters, SystemEvent)
   - 狀態轉換圖和驗證規則
   - TimescaleDB 配置和 Redis 快取設計
   - 完整的 Prisma Schema

2. **contracts/cli-spec.md** ✅: CLI 介面規格
   - 8 大類指令定義 (監控、套利機會、交易、持倉、歷史、設定、帳戶、系統)
   - 完整的錯誤處理機制
   - 使用範例和最佳實踐

3. **quickstart.md** ✅: 快速開始指南
   - 環境需求和安裝步驟 (Ubuntu, macOS, Windows WSL2)
   - 設定檔案範例 (.env, config.yaml)
   - 基本使用範例和常見問題排解
   - 切換生產環境的完整檢查清單

---

## Next Steps

1. 執行 Phase 0 研究,解決所有 "NEEDS CLARIFICATION" 項目
2. 記錄決策於 `research.md`
3. 根據研究結果更新本檔案的 Technical Context
4. 執行 Phase 1 設計,產生資料模型和合約
5. 更新代理上下文檔案
6. 準備進入 Phase 2 任務分解 (透過 `/speckit.tasks`)
