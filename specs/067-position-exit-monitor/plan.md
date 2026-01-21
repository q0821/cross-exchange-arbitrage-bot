# Implementation Plan: 持倉平倉建議監控 (Position Exit Monitor)

**Branch**: `067-position-exit-monitor` | **Date**: 2026-01-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/067-position-exit-monitor/spec.md`

---

## Summary

實作持倉平倉建議監控功能，監聽 FundingRateMonitor 的費率更新事件，檢查用戶 OPEN 狀態的持倉是否符合平倉建議條件。當 APY 轉負或 APY 低於閾值但整體有獲利時，透過 WebSocket 和 Discord/Slack 通知用戶建議平倉。

---

## Technical Context

**Language/Version**: TypeScript 5.8 + Node.js 20.x LTS
**Primary Dependencies**: Next.js 15, React 19, Socket.io 4.8.1, CCXT 4.x, Prisma 7.x, Decimal.js
**Storage**: PostgreSQL 15 + TimescaleDB（擴展 TradingSettings 和 Position 模型）
**Testing**: Vitest 4.x
**Target Platform**: Linux server (Docker)
**Project Type**: Web application (frontend + backend)
**Performance Goals**: 當 APY 轉負時，10 秒內發送通知
**Constraints**: 5 分鐘 TTL 快取累計費率收益，1 分鐘防抖動窗口
**Scale/Scope**: 支援多用戶同時監控各自的持倉

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

本專案未定義 Constitution（constitution.md 為模板），跳過此檢查。

---

## Project Structure

### Documentation (this feature)

```text
specs/067-position-exit-monitor/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── api.yaml         # OpenAPI specification
│   └── websocket.md     # WebSocket events contract
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
# Backend
src/
├── services/
│   ├── monitor/
│   │   └── PositionExitMonitor.ts       # 核心監控服務
│   ├── websocket/
│   │   └── PositionExitEmitter.ts       # WebSocket 推送
│   └── notification/
│       ├── DiscordNotifier.ts           # 擴展：sendExitSuggestionNotification
│       ├── SlackNotifier.ts             # 擴展：sendExitSuggestionNotification
│       ├── types.ts                     # 擴展：ExitSuggestionMessage
│       └── utils.ts                     # 擴展：formatExitSuggestionMessage
├── lib/
│   ├── position-exit-monitor-init.ts    # 服務初始化
│   └── funding-pnl-calculator.ts        # 累計費率收益計算
└── repositories/
    └── TradingSettingsRepository.ts     # 擴展：exitSuggestion 欄位

# Database
prisma/
├── schema.prisma                        # 擴展 TradingSettings 和 Position
└── migrations/                          # 新增 migration

# Frontend
app/
├── (dashboard)/
│   ├── settings/
│   │   └── trading/
│   │       ├── page.tsx                 # 擴展：平倉建議設定
│   │       └── components/
│   │           └── ExitSuggestionSettings.tsx  # 新增元件
│   └── positions/
│       ├── page.tsx                     # 整合 WebSocket
│       ├── hooks/
│       │   └── useExitSuggestion.ts     # 新增 Hook
│       └── components/
│           ├── PositionCard.tsx         # 擴展：顯示警告
│           └── ExitSuggestionWarning.tsx  # 新增元件

# Tests
tests/
├── unit/
│   ├── services/
│   │   ├── PositionExitMonitor.test.ts
│   │   ├── PositionExitEmitter.test.ts
│   │   └── FundingPnLCalculator.test.ts
│   └── notification/
│       └── ExitSuggestionNotification.test.ts
└── integration/
    └── PositionExitMonitorFlow.test.ts
```

**Structure Decision**: 選擇 Web application 結構，因為此功能涉及前後端整合（後端監控服務 + 前端設定頁面和警告顯示）。

---

## Implementation Phases

### Phase 1: 資料模型與基礎設施

**目標**: 擴展 Prisma schema 並建立核心型別定義

**範圍**:
- 擴展 TradingSettings 模型（3 個新欄位）
- 擴展 Position 模型（5 個新欄位）
- 執行 migration
- 定義 TypeScript 型別

**交付物**:
- `prisma/migrations/*_add_exit_suggestion_fields/migration.sql`
- `src/services/monitor/types.ts`（ExitSuggestion 型別）

---

### Phase 2: 核心監控服務

**目標**: 實作 PositionExitMonitor 核心邏輯

**範圍**:
- 監聽 rate-updated 事件
- 查詢 OPEN 狀態的持倉
- 實作 shouldSuggestClose() 邏輯
- 實作累計費率收益計算（含快取）
- 實作價差損失計算
- 更新 Position 的建議狀態

**交付物**:
- `src/services/monitor/PositionExitMonitor.ts`
- `src/lib/funding-pnl-calculator.ts`
- `src/lib/position-exit-monitor-init.ts`

**依賴**: Phase 1

---

### Phase 3: WebSocket 推送

**目標**: 實作即時通知推送

**範圍**:
- 建立 PositionExitEmitter
- 發送 position:exit:suggested 事件
- 發送 position:exit:canceled 事件
- 整合防抖動機制

**交付物**:
- `src/services/websocket/PositionExitEmitter.ts`

**依賴**: Phase 2

---

### Phase 4: Discord/Slack 通知

**目標**: 整合外部通知管道

**範圍**:
- 擴展 DiscordNotifier
- 擴展 SlackNotifier
- 新增通知訊息格式化函數
- 根據用戶設定發送通知

**交付物**:
- `src/services/notification/DiscordNotifier.ts`（擴展）
- `src/services/notification/SlackNotifier.ts`（擴展）
- `src/services/notification/utils.ts`（擴展）
- `src/services/notification/types.ts`（擴展）

**依賴**: Phase 2

---

### Phase 5: API 與 Repository

**目標**: 提供設定管理 API

**範圍**:
- 擴展 TradingSettingsRepository
- 修改 `/api/settings/trading` 端點

**交付物**:
- `src/repositories/TradingSettingsRepository.ts`（擴展）
- `app/api/settings/trading/route.ts`（擴展）

**依賴**: Phase 1

---

### Phase 6: 前端設定頁面

**目標**: 提供用戶設定界面

**範圍**:
- 新增 ExitSuggestionSettings 元件
- 整合到交易設定頁面
- 表單驗證

**交付物**:
- `app/(dashboard)/settings/trading/components/ExitSuggestionSettings.tsx`
- `app/(dashboard)/settings/trading/page.tsx`（擴展）

**依賴**: Phase 5

---

### Phase 7: 前端持倉頁面整合

**目標**: 顯示平倉建議警告

**範圍**:
- 新增 ExitSuggestionWarning 元件
- 新增 useExitSuggestion Hook
- 整合 WebSocket 事件
- 修改 PositionCard 顯示警告

**交付物**:
- `app/(dashboard)/positions/components/ExitSuggestionWarning.tsx`
- `app/(dashboard)/positions/hooks/useExitSuggestion.ts`
- `app/(dashboard)/positions/components/PositionCard.tsx`（擴展）
- `app/(dashboard)/positions/page.tsx`（擴展）

**依賴**: Phase 3, Phase 6

---

### Phase 8: 測試與整合

**目標**: 確保功能正確性

**範圍**:
- 單元測試（PositionExitMonitor, FundingPnLCalculator）
- 整合測試（完整流程）
- 手動測試

**交付物**:
- `tests/unit/services/PositionExitMonitor.test.ts`
- `tests/unit/services/FundingPnLCalculator.test.ts`
- `tests/integration/PositionExitMonitorFlow.test.ts`

**依賴**: Phase 7

---

## Risk Assessment

| 風險 | 影響 | 緩解措施 |
|------|------|----------|
| 交易所 API rate limit | 累計收益計算延遲 | 使用 5 分鐘 TTL 快取 |
| 價格數據過時 | 價差損失計算不準確 | 標記 stalePrice 並在通知中提示 |
| WebSocket 連線中斷 | 用戶錯過通知 | 同時發送 Discord/Slack 通知作為備援 |

---

## Complexity Tracking

無需追蹤，本功能符合現有架構模式，無特殊複雜性。
