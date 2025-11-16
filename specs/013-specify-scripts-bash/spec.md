# Feature Specification: 移除套利機會頁面與 API

**Feature Branch**: `013-specify-scripts-bash`
**Created**: 2025-01-21
**Status**: Draft
**Input**: User description: "現在有市場監控了，是不是不需要套利機會的頁面跟功能，反正即時監控會即時推送資訊，有套利機會，user 再自行判斷就好，請幫我評估移除套利機會的監控及頁面是否可行"

## 背景與動機

市場監控 (Market Monitor) 頁面已經提供了完整的即時資金費率監控功能，包含：
- WebSocket 即時推送 (每 5 秒更新)
- 多交易對同時監控
- 價差計算與淨收益顯示
- 時間基準標準化 (1h/8h/24h)
- 持倉量篩選
- 即時狀態標記 (opportunity/approaching/normal)

相較之下，套利機會 (Opportunities) 頁面的功能已被市場監控完全覆蓋，且存在以下問題：
- 功能重複：市場監控提供更好的即時性
- 維護成本：需要同時維護兩套相似的功能
- 用戶困惑：兩個頁面展示類似資訊，不清楚該使用哪個

用戶決策：
- 移除方式：完全移除前端和 API
- 預設首頁：改為市場監控 (/market-monitor)
- 通知系統：保留 (為未來擴展預留)

## User Scenarios & Testing

### User Story 1 - 移除套利機會前端頁面 (Priority: P1)

作為系統維護者，我需要移除套利機會頁面及其相關組件，以減少功能重複並簡化系統架構。

**Why this priority**: 這是核心任務，移除前端是整個功能移除的第一步，也是用戶最直接感知的變更。

**Independent Test**: 可通過訪問 `/opportunities` 路由驗證是否正確返回 404 或重定向，檢查應用編譯時是否不再包含相關組件代碼。

**Acceptance Scenarios**:

1. **Given** 用戶已登入系統，**When** 訪問 `/opportunities` 路由，**Then** 應該返回 404 或重定向到市場監控頁面
2. **Given** 系統編譯完成，**When** 檢查構建產物，**Then** 不應包含 opportunities 相關的組件代碼
3. **Given** 用戶在導航菜單中，**When** 查看可用選項，**Then** 不應看到「套利機會」入口
4. **Given** 開發者查看代碼庫，**When** 搜尋 opportunities 相關文件，**Then** 應該只剩下歷史記錄 (git history)

---

### User Story 2 - 移除套利機會 API 端點 (Priority: P1)

作為系統管理員，我需要移除所有套利機會相關的 API 端點，以減少攻擊面並簡化 API 維護。

**Why this priority**: API 移除與前端移除同等重要，避免殘留無用的 API 端點造成安全隱患。

**Independent Test**: 可通過 API 測試工具 (curl/Postman) 驗證 `/api/opportunities/*` 路由是否正確返回 404。

**Acceptance Scenarios**:

1. **Given** API 伺服器正在運行，**When** 請求 `GET /api/opportunities`，**Then** 應該返回 404
2. **Given** API 伺服器正在運行，**When** 請求 `GET /api/opportunities/:id`，**Then** 應該返回 404
3. **Given** 系統日誌中，**When** 檢查錯誤記錄，**Then** 不應出現 opportunities API 相關的錯誤
4. **Given** OpenAPI 規格文件，**When** 檢查 API 定義，**Then** 不應包含 `/api/opportunities` 相關端點

---

### User Story 3 - 更新預設首頁為市場監控 (Priority: P2)

作為用戶，當我登入系統後，我希望直接看到市場監控頁面，以便立即掌握當前市場狀況。

**Why this priority**: 提升用戶體驗，讓用戶登入後直接看到最有價值的資訊。

**Independent Test**: 可通過登入系統後檢查自動導向的頁面是否為 `/market-monitor`。

**Acceptance Scenarios**:

1. **Given** 用戶已成功登入，**When** 系統完成認證，**Then** 應該自動導向 `/market-monitor`
2. **Given** 用戶訪問根路徑 `/`，**When** 請求處理完成，**Then** 應該顯示市場監控頁面或重定向到 `/market-monitor`
3. **Given** 用戶從其他頁面點擊「首頁」，**When** 導航完成，**Then** 應該顯示市場監控頁面

---

### User Story 4 - 移除後端業務邏輯 (Priority: P2)

作為開發者，我需要移除所有套利機會檢測、儲存、通知相關的後端邏輯，以減少系統複雜度。

**Why this priority**: 移除無用的業務邏輯可減少維護成本，但優先級低於前端和 API 移除。

**Independent Test**: 可通過檢查 OpportunityDetector 服務是否已停止運行，資料庫中是否不再新增 opportunity 相關記錄。

**Acceptance Scenarios**:

1. **Given** 系統啟動完成，**When** 檢查運行的服務，**Then** OpportunityDetector 服務不應該在運行
2. **Given** 系統運行一段時間後，**When** 查詢 opportunities 資料表，**Then** 不應有新的記錄產生
3. **Given** 檢查通知服務，**When** 查看通知類型，**Then** 不應發送 opportunity 相關通知
4. **Given** 檢查程式碼庫，**When** 搜尋 OpportunityDetector 引用，**Then** 應該已全部移除

---

### User Story 5 - 清理資料模型與 Repository (Priority: P3)

作為資料庫管理員，我需要移除或標記為廢棄的 opportunity 相關資料表和 repository，保持資料庫架構清晰。

**Why this priority**: 資料庫清理優先級較低，可以在前端和業務邏輯移除後再進行，且需要考慮歷史資料保留。

**Independent Test**: 可通過檢查資料庫 schema 和 Prisma models 驗證相關定義是否已移除或標記為廢棄。

**Acceptance Scenarios**:

1. **Given** 檢查 Prisma schema，**When** 查看 model 定義，**Then** ArbitrageOpportunity 和 OpportunityHistory 應該已移除或標記為廢棄
2. **Given** 執行資料庫遷移，**When** 應用最新 schema，**Then** 相關資料表應該保留 (避免資料遺失) 但不再被程式使用
3. **Given** 檢查 repository 程式碼，**When** 搜尋 OpportunityRepository，**Then** 相關文件應該已刪除
4. **Given** 開發者需要查詢歷史資料，**When** 直接查詢資料庫，**Then** 歷史記錄仍然可訪問

---

### Edge Cases

- **當用戶有書籤指向舊的 `/opportunities` 路由時**：系統應該優雅地處理，返回 404 或重定向到市場監控，並在首次訪問時顯示提示訊息
- **當系統中仍有舊的 opportunity 通知待發送時**：通知服務應該忽略這些通知，不應發送，並記錄警告日誌
- **當第三方服務仍在呼叫已移除的 API 端點時**：API 應該返回 404 和清楚的錯誤訊息，說明功能已移除
- **當資料庫中有大量歷史 opportunity 記錄時**：不應刪除歷史資料，保留供未來分析使用，但不在應用中展示

## Requirements

### Functional Requirements

- **FR-001**: 系統必須移除 `app/(dashboard)/opportunities` 目錄及其所有子組件
- **FR-002**: 系統必須移除 `app/api/opportunities` 目錄及其所有 API 路由處理器
- **FR-003**: 系統必須從導航菜單中移除「套利機會」相關入口
- **FR-004**: 系統必須將預設首頁重定向從 `/opportunities` 改為 `/market-monitor`
- **FR-005**: 系統必須停止 OpportunityDetector 服務的啟動和執行
- **FR-006**: 系統必須移除 OpportunityDetector 在 MonitorService 中的註冊
- **FR-007**: 系統必須移除 ArbitrageOpportunityRepository 和 OpportunityHistoryRepository
- **FR-008**: 系統必須從 Prisma schema 中移除或標記為廢棄 ArbitrageOpportunity 和 OpportunityHistory models
- **FR-009**: 系統必須保留 NotificationService，因為未來可能用於其他通知場景
- **FR-010**: 系統訪問已移除的 `/opportunities` 路由時必須返回 404 或重定向到 `/market-monitor`
- **FR-011**: 系統訪問已移除的 `/api/opportunities/*` 端點時必須返回 404
- **FR-012**: 系統必須更新相關文件 (README.md, CHANGELOG.md) 說明此功能已移除

### Key Entities

此功能主要涉及移除以下實體及其相關程式碼：

- **ArbitrageOpportunity**: 套利機會記錄實體，包含交易對、交易所對、費率差異等屬性
- **OpportunityHistory**: 機會歷史記錄實體，用於追蹤機會的狀態變化
- **OpportunityDetector**: 機會檢測服務，負責識別套利機會並發送通知
- **Opportunities Page**: 前端頁面組件，展示套利機會列表
- **Opportunities API**: API 端點，提供機會資料的 CRUD 操作

## Success Criteria

### Measurable Outcomes

- **SC-001**: 用戶訪問 `/opportunities` 路由時，100% 返回 404 或重定向到 `/market-monitor`
- **SC-002**: 系統編譯產物中，opportunities 相關代碼減少至 0 KB (完全移除)
- **SC-003**: API 測試套件中，所有 `/api/opportunities/*` 端點測試應標記為「已移除」或刪除
- **SC-004**: 系統啟動後，OpportunityDetector 服務不應出現在運行中的服務列表
- **SC-005**: 資料庫中，opportunities 資料表不應產生新的記錄 (recordedAt > 移除日期)
- **SC-006**: 程式碼庫中，搜尋 "OpportunityDetector" 應該只在 git history 和移除相關的 commit 中出現
- **SC-007**: 通知服務日誌中，不應出現 opportunity 類型的通知發送記錄
- **SC-008**: 系統文件 (README, CHANGELOG) 中應該明確說明此功能已移除及移除原因
- **SC-009**: 前端構建時間應該減少 (移除組件後)
- **SC-010**: 用戶登入後，預設頁面 100% 顯示市場監控頁面

### 非功能性需求

- **NFR-001**: 移除過程不應影響市場監控的正常運作
- **NFR-002**: 歷史資料應該保留在資料庫中，不應刪除 (資料保護)
- **NFR-003**: 移除應該通過單一 Pull Request 完成，便於 review 和回滾
- **NFR-004**: 所有變更應該有對應的測試驗證 (移除測試)
