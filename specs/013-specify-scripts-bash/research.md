# Research: 移除套利機會頁面與 API

**Feature**: 013-specify-scripts-bash
**Created**: 2025-01-21
**Phase**: 0 (Research & Decision Making)

## Overview

此文件記錄移除套利機會功能的研究決策過程。由於這是移除操作而非新增功能，研究重點在於：
1. 識別所有需要移除的檔案和依賴
2. 確認不會影響其他功能
3. 決定如何處理歷史資料
4. 規劃優雅降級策略

## Research Areas

### R1: 檔案依賴關係分析

**Question**: 哪些檔案使用了 Opportunities 相關的組件和服務？

**Investigation Method**:
- 使用 grep 搜尋 `OpportunityDetector`, `ArbitrageOpportunity`, `OpportunityHistory` 引用
- 檢查 import statements
- 分析 MonitorService 的服務註冊

**Findings**:

#### Frontend Dependencies (app/)
- `app/(dashboard)/opportunities/` - 獨立目錄，無外部引用
- `app/api/opportunities/` - 獨立 API 路由，無外部引用
- `app/layout.tsx` - 可能包含導航連結

#### Backend Dependencies (src/)
- `src/services/monitor/MonitorService.ts` - 註冊 OpportunityDetector
- `src/services/monitor/OpportunityDetector.ts` - 主要業務邏輯
  - 依賴: RatesCache, NotificationService, ArbitrageOpportunityRepository
- `src/repositories/ArbitrageOpportunityRepository.ts` - 資料存取
- `src/repositories/OpportunityHistoryRepository.ts` - 歷史記錄存取
- `src/models/ArbitrageOpportunity.ts` - 資料模型
- `src/models/OpportunityHistory.ts` - 歷史模型

#### Database Dependencies
- `prisma/schema.prisma` - ArbitrageOpportunity, OpportunityHistory models
- Existing data in database tables

**Decision**:
- ✅ 前端目錄可安全刪除 (無外部引用)
- ✅ API 路由可安全刪除 (無外部引用)
- ⚠️  MonitorService 需要修改 (移除 OpportunityDetector 註冊)
- ✅ Repository 和 Model 可刪除 (僅被 OpportunityDetector 使用)
- ⚠️  Prisma models 標記為 @deprecated (不刪除，保留歷史資料)

**Rationale**:
- Opportunities 功能設計為獨立模組，耦合度低
- 僅需修改 MonitorService 一個整合點
- 保留資料庫 schema 避免資料遺失

---

### R2: NotificationService 重用性

**Question**: NotificationService 是否只用於 Opportunities？是否應保留？

**Investigation Method**:
- 檢查 NotificationService 的使用者
- 分析通知類型定義
- 評估未來擴展需求

**Findings**:

**Current Usage**:
- OpportunityDetector 使用 NotificationService.notify()
- 通知類型：opportunity detected, opportunity closed
- 通道：Terminal, Log (未來可擴展 Telegram, Email)

**Design Analysis**:
- NotificationService 是通用通知抽象層
- 支援多種通道 (channel-based architecture)
- 不依賴 Opportunities 特定邏輯

**Decision**: ✅ 保留 NotificationService

**Rationale**:
1. **未來價值**: 市場監控可能需要警報通知
   - 例如：費率差異超過閾值警報
   - 例如：WebSocket 斷線通知
   - 例如：系統健康檢查警報

2. **架構獨立性**: NotificationService 是基礎設施層
   - 不綁定 Opportunities 業務邏輯
   - 遵循 Dependency Inversion Principle
   - 移除成本 > 保留成本

3. **用戶決策**: 用戶明確要求保留通知系統

**Alternatives Considered**:
- ❌ 一併移除 NotificationService：浪費已完成的基礎建設
- ❌ 重構為 MarketMonitor 專用：降低重用性

---

### R3: 預設首頁處理

**Question**: 如何優雅處理從 `/opportunities` 到 `/market-monitor` 的首頁遷移？

**Investigation Method**:
- 檢查 Next.js App Router 路由處理
- 分析現有首頁邏輯
- 研究 404 和重定向最佳實踐

**Findings**:

**Next.js 路由機制**:
- App Router 使用檔案系統路由
- `app/(dashboard)/opportunities/page.tsx` 對應 `/opportunities`
- 刪除檔案後自動返回 404

**Options**:

1. **方案 A: 404 處理**
   - 刪除 opportunities 目錄
   - Next.js 自動返回 404
   - 優點：簡單，符合 RESTful 語義
   - 缺點：用戶體驗較差 (突然 404)

2. **方案 B: 301 重定向**
   - 保留 `app/(dashboard)/opportunities/page.tsx`
   - 內容改為 `redirect('/market-monitor')`
   - 優點：SEO 友好，用戶無感切換
   - 缺點：保留額外檔案

3. **方案 C: 中介頁面提示**
   - 保留 `page.tsx` 但顯示遷移提示
   - 3 秒後自動跳轉
   - 優點：用戶明確知道遷移
   - 缺點：額外開發成本

**Decision**: ✅ 方案 A (404 處理)

**Rationale**:
- 這是內部開發工具，無 SEO 需求
- 用戶數量少，可直接溝通更新書籤
- 簡化代碼，完全移除而非保留殘留檔案
- 404 清楚表達「功能已移除」

**Implementation**:
- 刪除整個 `app/(dashboard)/opportunities/` 目錄
- 更新 `app/layout.tsx` 或導航組件，移除 "套利機會" 連結
- 更新登入後重定向邏輯，改為 `/market-monitor`

---

### R4: 歷史資料保留策略

**Question**: 如何處理資料庫中已存在的 opportunity 記錄？

**Investigation Method**:
- 檢查 Prisma migration 最佳實踐
- 評估資料量和業務價值
- 研究 schema 廢棄標記方式

**Findings**:

**Data Volume Estimate**:
- 假設每日產生 50-100 條 opportunity 記錄
- 運行 2-3 個月 ≈ 3,000-9,000 條記錄
- 資料庫體積影響：< 10 MB (negligible)

**Business Value**:
- 歷史資料可用於回測驗證
- 分析過去機會分佈
- 比較 Market Monitor 與舊系統差異

**Technical Options**:

1. **Hard Delete**: DROP TABLE
   - 優點：徹底清理
   - 缺點：資料永久遺失，違反 Constitution Principle IV

2. **Soft Delete**: 標記 models 為 @deprecated
   - 優點：保留資料，schema 仍可查詢
   - 缺點：Prisma 仍生成類型 (需手動忽略)

3. **Archive**: 將資料匯出至 JSON/CSV
   - 優點：資料保留，schema 可刪除
   - 缺點：失去 SQL 查詢能力

**Decision**: ✅ Soft Delete (方案 2)

**Rationale**:
- 遵循 Constitution Principle IV (Data Integrity)
- 資料量小，保留成本極低
- 未來若需分析，可直接 SQL 查詢
- Prisma `@deprecated` 標記清楚表達意圖

**Implementation**:
```prisma
/// @deprecated This model is deprecated. Use Market Monitor for real-time opportunities.
model ArbitrageOpportunity {
  // ... existing schema
}

/// @deprecated This model is deprecated along with ArbitrageOpportunity.
model OpportunityHistory {
  // ... existing schema
}
```

---

### R5: 移除影響範圍驗證

**Question**: 移除後是否影響 Market Monitor 或其他功能？

**Investigation Method**:
- 分析 Market Monitor 的資料來源
- 檢查 RatesCache 共用
- 驗證 WebSocket 推送獨立性

**Findings**:

**Market Monitor Architecture**:
```
FundingRateMonitor → RatesCache → MarketRatesHandler → WebSocket → Frontend
```

**OpportunityDetector Architecture** (被移除):
```
RatesCache → OpportunityDetector → ArbitrageOpportunityRepository → Database
                ↓
         NotificationService
```

**Key Observations**:
- ✅ Market Monitor 直接從 RatesCache 讀取
- ✅ OpportunityDetector 僅監聽 RatesCache，不修改
- ✅ WebSocket 推送由 MarketRatesHandler 負責 (與 OpportunityDetector 無關)
- ✅ NotificationService 雖被 OpportunityDetector 使用，但設計為通用服務

**Decision**: ✅ 移除 OpportunityDetector 不影響 Market Monitor

**Rationale**:
- 兩者共享 RatesCache 作為資料源，但處理邏輯獨立
- Market Monitor 的 WebSocket 推送鏈路完全獨立
- OpportunityDetector 是純消費者 (read-only from RatesCache)

**Verification Plan**:
1. 移除後啟動系統
2. 檢查 FundingRateMonitor 正常運行
3. 驗證 WebSocket 推送仍然工作
4. 確認 Market Monitor 頁面功能正常

---

## Summary of Decisions

| Decision Point | Choice | Rationale |
|---------------|--------|-----------|
| 檔案刪除範圍 | 完全刪除前端、API、服務、Repository、Models | 減少維護負擔，清理代碼庫 |
| NotificationService | 保留 | 通用基礎設施，未來可重用 |
| 首頁處理 | 404 (不保留重定向) | 簡化實作，清楚表達移除 |
| 歷史資料 | Soft Delete (schema 保留 + @deprecated) | 遵循 Data Integrity 原則 |
| Market Monitor 影響 | 無影響 | 架構獨立，驗證計劃充分 |

## Open Questions

**Q1**: 是否需要在 CHANGELOG.md 中記錄 breaking change？
**A1**: 是，因為移除了公開的 `/api/opportunities` 端點。需標記為 `BREAKING CHANGE`。

**Q2**: 是否需要通知現有用戶？
**A2**: 建議在系統中顯示一次性通知，或通過內部溝通管道告知。

**Q3**: 未來是否可能恢復此功能？
**A3**: 可能性低，因為 Market Monitor 功能更強。若需恢復，可從 git history 中還原。

## Next Steps

1. ✅ Research 完成 → 進入 Phase 1 (Design & Contracts)
2. 生成 data-model.md (記錄被廢棄的 models)
3. 生成 quickstart.md (驗證移除步驟)
4. 更新 CLAUDE.md (移除 opportunities 相關技術棧)
5. 進入 Phase 2 (Task Generation)
