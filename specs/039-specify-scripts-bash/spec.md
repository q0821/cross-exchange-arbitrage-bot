# Feature Specification: Prisma Client Singleton 優化

**Feature Branch**: `039-prisma-singleton-refactor`
**Created**: 2025-12-20
**Status**: Draft
**Input**: 將專案中所有 API routes 和 repositories 中重複建立的 new PrismaClient() 替換為統一使用 src/lib/db.ts 匯出的 prisma singleton 實例

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 資料庫連線資源優化 (Priority: P1)

作為系統維運人員，我希望系統使用單一資料庫連線池，避免連線資源浪費和潛在的連線池耗盡問題，以確保系統在高負載下仍能穩定運行。

**Why this priority**: 資料庫連線是系統最關鍵的共享資源，連線池耗盡會導致整個系統無法運作。目前 23 個 API endpoints 各自建立獨立連線池，可能消耗超過 100 條連線，超出資料庫預設上限。

**Independent Test**: 可透過監控資料庫連線數來驗證 - 優化前後連線數應從潛在的 115+ 條降至單一連線池的預設 5-10 條

**Acceptance Scenarios**:

1. **Given** 系統啟動後, **When** 同時呼叫多個不同的 API endpoints, **Then** 所有請求共用同一個資料庫連線池
2. **Given** 系統運行中, **When** 查詢資料庫連線數, **Then** 活動連線數不超過單一連線池的設定上限
3. **Given** 系統在開發模式下熱重載, **When** 程式碼變更觸發重載, **Then** 不會產生新的連線池實例（避免連線洩漏）

---

### User Story 2 - 集中化資料庫監控 (Priority: P2)

作為開發人員，我希望所有資料庫操作都經過統一的監控層，讓慢查詢日誌和錯誤記錄能夠完整捕捉系統狀態，以便快速診斷效能問題。

**Why this priority**: 現有的 singleton 實例已配置慢查詢監控和錯誤記錄功能，但因為各模組自建連線，這些監控功能無法生效。統一使用 singleton 可立即啟用這些既有功能。

**Independent Test**: 執行一個慢查詢後，確認日誌系統記錄了該查詢的執行時間和詳細資訊

**Acceptance Scenarios**:

1. **Given** 任何 API endpoint 執行資料庫查詢, **When** 查詢執行時間超過 100ms, **Then** 系統記錄慢查詢警告日誌
2. **Given** 資料庫操作發生錯誤, **When** 錯誤被拋出, **Then** 系統記錄包含錯誤詳情的錯誤日誌

---

### User Story 3 - 程式碼一致性維護 (Priority: P3)

作為開發人員，我希望專案中資料庫存取方式統一，減少程式碼重複並降低維護成本，以便未來擴展或修改資料庫設定時只需變更一處。

**Why this priority**: 統一的程式碼模式降低新進開發人員的學習成本，也減少因為不同實作方式導致的潛在 bug。

**Independent Test**: 程式碼審查確認所有資料庫存取都使用相同的引入方式

**Acceptance Scenarios**:

1. **Given** 開發人員需要新增資料庫查詢, **When** 引入資料庫客戶端, **Then** 只有一種標準引入方式可用
2. **Given** 專案程式碼庫, **When** 搜尋 PrismaClient 使用方式, **Then** 只有 singleton 定義檔包含 new PrismaClient()

---

### Edge Cases

- 當資料庫連線暫時中斷時，singleton 會如何處理重連？（依賴內建重連機制）
- 當某個 API 請求造成連線池阻塞時，是否會影響其他請求？（需確認連線池設定適當）
- 獨立腳本（scripts/）是否也應該使用 singleton？（腳本通常獨立執行，可保持現狀）

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 使用單一資料庫客戶端實例處理所有 API routes 的資料庫操作
- **FR-002**: 系統 MUST 使用單一資料庫客戶端實例處理所有 repositories 的資料庫操作
- **FR-003**: 所有資料庫操作 MUST 經過集中的監控層（慢查詢日誌、錯誤記錄）
- **FR-004**: 系統 MUST 在應用程式關閉時正確釋放資料庫連線
- **FR-005**: 開發模式下的熱重載 MUST NOT 造成連線池重複建立

### 範圍外（Out of Scope）

- 獨立執行腳本（scripts/*.ts）的資料庫客戶端使用方式不在此次重構範圍
- 測試檔案（tests/*.ts）的資料庫客戶端使用方式不在此次重構範圍
- 連線池大小調整和效能調優不在此次範圍

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 專案中 API routes 和 repositories 的獨立資料庫客戶端實例數從 25+ 降至 1
- **SC-002**: 系統在高負載下（同時 50 個 API 請求）的資料庫連線數維持在 10 條以內
- **SC-003**: 所有執行超過 100ms 的查詢都被記錄到日誌系統
- **SC-004**: 程式碼審查通過：所有 API routes 和 repositories 使用統一的引入方式

## Assumptions

- 現有的 singleton 實作已經是正確且穩定的
- 所有 API routes 和 repositories 的資料庫操作都與 singleton 實例相容
- 獨立腳本因為獨立執行的特性，可以保持各自建立資料庫客戶端的方式
