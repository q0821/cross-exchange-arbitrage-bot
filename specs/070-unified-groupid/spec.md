# Feature Specification: 統一持倉 groupId 架構

**Feature Branch**: `070-unified-groupid`
**Created**: 2026-01-30
**Status**: Draft
**Input**: 統一持倉 groupId 架構重構：將所有持倉統一使用 groupId，不再區分單獨開倉（null）和分單開倉（UUID）。單獨開倉時也自動生成 groupId，只是組內持倉數量為 1。這樣可以統一資料結構、API 回應格式、前端顯示和處理流程。需要處理現有 null groupId 的資料 migration。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 單獨開倉自動分配 groupId (Priority: P1)

使用者執行單獨開倉（一次開一個持倉）時，系統自動為該持倉分配一個 groupId，而不是留空（null）。這使得所有持倉都有一致的資料結構。

**Why this priority**: 這是架構統一的核心變更，所有後續功能都依賴此基礎。

**Independent Test**: 可透過單獨開倉 API 測試，驗證回傳的持倉資料包含有效的 groupId UUID。

**Acceptance Scenarios**:

1. **Given** 使用者選擇單獨開倉模式, **When** 使用者送出開倉請求, **Then** 系統建立持倉並自動分配一個 UUID 作為 groupId
2. **Given** 使用者完成單獨開倉, **When** 查詢該持倉資料, **Then** 該持倉的 groupId 欄位為有效 UUID 而非 null

---

### User Story 2 - 統一的持倉列表顯示格式 (Priority: P1)

持倉列表 API 回傳統一的 groups 格式，不再區分 positions（無 groupId）和 groups（有 groupId）兩種結構。每個 group 包含 1 個或多個持倉。

**Why this priority**: 統一 API 回應格式是簡化前端邏輯的關鍵，與 P1-1 同等重要。

**Independent Test**: 呼叫持倉列表 API，驗證回應只包含 groups 陣列，不再有獨立的 positions 陣列。

**Acceptance Scenarios**:

1. **Given** 使用者有多個持倉（包含原本的單獨開倉和分單開倉）, **When** 呼叫 GET /api/positions?grouped=true, **Then** 回應格式只包含 groups 陣列，每個 group 包含 1 個或多個持倉
2. **Given** 使用者只有單獨開倉的持倉, **When** 呼叫持倉列表 API, **Then** 每個持倉都以 group 形式呈現，positionCount 為 1

---

### User Story 3 - 現有資料 Migration (Priority: P1)

系統需要處理現有 groupId 為 null 的持倉資料，為它們補上 UUID，確保資料一致性。

**Why this priority**: 資料 migration 是部署前的必要步驟，確保現有資料與新架構相容。

**Independent Test**: 執行 migration 後，查詢資料庫驗證所有持倉都有 groupId，且原本的 null 持倉各自有獨立的 UUID。

**Acceptance Scenarios**:

1. **Given** 資料庫中存在 groupId 為 null 的持倉, **When** 執行資料 migration, **Then** 每個原本 null 的持倉被分配一個獨立的 UUID 作為 groupId
2. **Given** 資料庫中存在已有 groupId 的持倉（分單開倉）, **When** 執行資料 migration, **Then** 這些持倉的 groupId 保持不變
3. **Given** Migration 完成後, **When** 查詢所有持倉, **Then** 沒有任何持倉的 groupId 為 null

---

### User Story 4 - 前端統一顯示邏輯 (Priority: P2)

前端持倉管理介面使用統一的組別卡片顯示所有持倉，不再需要區分單獨持倉和分單持倉的顯示邏輯。

**Why this priority**: 簡化前端程式碼，但依賴後端 API 統一後才能進行。

**Independent Test**: 在前端介面查看持倉列表，驗證所有持倉（包含原本的單獨開倉）都以組別卡片形式顯示。

**Acceptance Scenarios**:

1. **Given** 使用者有單獨開倉的持倉, **When** 查看持倉管理頁面, **Then** 該持倉以組別卡片形式顯示，顯示 positionCount 為 1
2. **Given** 使用者有分單開倉的持倉組別, **When** 查看持倉管理頁面, **Then** 該組別以組別卡片形式顯示，顯示實際的 positionCount

---

### Edge Cases

- 當 migration 執行過程中服務重啟，已處理的資料應保持一致，未處理的資料在下次 migration 時繼續處理
- 當同時有多個請求建立單獨開倉時，每個持倉都應獲得獨立的 groupId（UUID 衝突機率極低，可忽略）
- 當查詢 API 在 migration 執行期間被呼叫，應能正確處理混合狀態（部分有 groupId、部分為 null）的資料

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST generate a UUID groupId for every new position, regardless of whether it's a single position or part of a split order
- **FR-002**: System MUST provide a migration mechanism to assign UUID groupId to all existing positions where groupId is null
- **FR-003**: System MUST ensure each existing null-groupId position receives its own unique UUID (not grouped together)
- **FR-004**: API MUST return positions in a unified groups format, where each group contains 1 or more positions
- **FR-005**: Database schema MUST change groupId from optional (String?) to required (String)
- **FR-006**: System MUST maintain backward compatibility during the migration period
- **FR-007**: System MUST validate that groupId is a valid UUID format when creating or querying positions

### Key Entities

- **Position**: 持倉記錄，groupId 欄位從可選改為必填，所有持倉都屬於一個 group
- **PositionGroup**: 持倉組別的邏輯概念，由相同 groupId 的持倉組成，positionCount 可為 1（單獨開倉）或多個（分單開倉）

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% 的新建持倉都有有效的 groupId UUID
- **SC-002**: Migration 完成後，資料庫中 0 個持倉的 groupId 為 null
- **SC-003**: 持倉列表 API 回應格式統一，只包含 groups 結構
- **SC-004**: 前端程式碼中不再需要區分 positions 和 groups 的顯示邏輯
- **SC-005**: 現有功能（開倉、平倉、查詢）在架構變更後正常運作，所有相關測試通過

## Assumptions

- UUID 衝突機率極低（1/2^122），不需要特別處理
- Migration 可以在服務運行期間執行，不需要停機
- 現有的分單開倉持倉（已有 groupId）不需要任何變更
- 前端更新可以與後端 API 更新同步部署，不需要支援新舊 API 格式並存的過渡期
