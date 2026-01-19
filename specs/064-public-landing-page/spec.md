# Feature Specification: 公開套利機會歷史首頁

**Feature Branch**: `064-public-landing-page`
**Created**: 2026-01-18
**Status**: Draft
**Input**: User description: "要有個正式, 且不需要登入才能觀看的資訊首頁, 首頁中會顯示監測記錄到的歷史套利機會列表"

## Clarifications

### Session 2026-01-18

- Q: 公開首頁應顯示多久以前的歷史套利機會記錄？ → A: 回傳 90 天內資料，用戶可切換顯示 7/30/90 天
- Q: 已登入用戶訪問根路徑 `/` 時應如何處理？ → A: 自動重導向到 `/market-monitor` Dashboard
- Q: 公開 API 是否需要速率限制？ → A: 每 IP 每分鐘 30 次請求限制
- Q: 公開首頁是否需要 SEO 優化？ → A: 基本 SEO（SSR + meta tags + Open Graph）
- Q: 套利機會列表是否需要自動刷新？ → A: 不自動刷新，用戶手動重新載入

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 訪客瀏覽套利機會歷史 (Priority: P1)

訪客（未登入用戶）可以直接訪問首頁，瀏覽系統監測到的歷史套利機會列表，了解系統的監測能力和套利機會品質。

**Why this priority**: 這是核心功能，讓潛在用戶在註冊前就能了解系統價值，直接影響用戶轉換率。

**Independent Test**: 可透過無痕瀏覽器訪問首頁，驗證能否看到套利機會列表，無需任何登入動作。

**Acceptance Scenarios**:

1. **Given** 訪客未登入, **When** 訪問網站根路徑 `/`, **Then** 顯示公開首頁，包含套利機會歷史列表
2. **Given** 資料庫中有歷史套利機會記錄, **When** 訪客瀏覽首頁, **Then** 按時間倒序顯示最新的機會記錄
3. **Given** 訪客在首頁, **When** 頁面載入完成, **Then** 不需要任何認證即可查看所有公開資訊

---

### User Story 2 - 查看套利機會詳細資訊 (Priority: P2)

訪客可以查看每個套利機會的關鍵資訊，包括交易對、交易所組合、費差、持續時間、年化報酬率等。

**Why this priority**: 詳細資訊能讓訪客評估套利機會的品質，建立對系統的信任。

**Independent Test**: 訪客可在列表中看到每筆機會的完整資訊欄位。

**Acceptance Scenarios**:

1. **Given** 首頁顯示套利機會列表, **When** 訪客查看單筆記錄, **Then** 顯示交易對（如 BTCUSDT）、多方交易所、空方交易所
2. **Given** 首頁顯示套利機會列表, **When** 訪客查看單筆記錄, **Then** 顯示最大費差、最終費差、年化報酬率
3. **Given** 首頁顯示套利機會列表, **When** 訪客查看單筆記錄, **Then** 顯示機會發現時間和持續時長

---

### User Story 3 - 分頁瀏覽歷史記錄 (Priority: P2)

當歷史記錄數量龐大時，訪客可透過分頁機制瀏覽更多記錄。

**Why this priority**: 分頁確保頁面效能，同時讓訪客能瀏覽完整歷史。

**Independent Test**: 當記錄超過單頁顯示數量時，可透過分頁元件切換頁面。

**Acceptance Scenarios**:

1. **Given** 歷史記錄超過 20 筆, **When** 訪客瀏覽首頁, **Then** 顯示第一頁（20 筆）和分頁控制元件
2. **Given** 訪客在第一頁, **When** 點擊下一頁, **Then** 顯示第二頁的記錄
3. **Given** 分頁載入中, **When** 資料正在獲取, **Then** 顯示載入指示器

---

### User Story 4 - 首頁品牌與行動呼籲 (Priority: P3)

首頁包含品牌資訊、產品簡介，以及引導訪客註冊或登入的行動呼籲按鈕。

**Why this priority**: 品牌展示和 CTA 能提升轉換率，但不是核心功能。

**Independent Test**: 首頁頂部顯示品牌 Logo、簡介文字，以及登入/註冊按鈕。

**Acceptance Scenarios**:

1. **Given** 訪客訪問首頁, **When** 頁面載入, **Then** 顯示系統名稱、Logo 和簡短說明
2. **Given** 訪客未登入, **When** 查看首頁導覽, **Then** 顯示「登入」和「註冊」按鈕
3. **Given** 訪客點擊「註冊」, **When** 跳轉至註冊頁, **Then** 成功導向 `/signup` 頁面

---

### Edge Cases

- 資料庫中沒有任何歷史記錄時，顯示「目前暫無套利機會記錄」的空狀態提示
- API 獲取失敗時，顯示錯誤提示並提供重試按鈕
- 資料載入中時，顯示骨架屏（Skeleton）避免頁面跳動

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 在根路徑 `/` 提供公開首頁，不需登入即可訪問
- **FR-011**: 系統 MUST 將已登入用戶從 `/` 自動重導向到 `/market-monitor`
- **FR-002**: 系統 MUST 顯示 `OpportunityEndHistory` 表中的套利機會歷史（聚合所有用戶的公開記錄）
- **FR-003**: 系統 MUST 按 `disappearedAt` 時間倒序排列顯示記錄
- **FR-004**: 系統 MUST 實作分頁機制，每頁顯示 20 筆記錄
- **FR-010**: 系統 MUST 提供時間範圍篩選功能（7/30/90 天），預設顯示 90 天內的記錄
- **FR-005**: 系統 MUST 顯示每筆記錄的以下欄位：
  - 交易對 (`symbol`)
  - 多方交易所 (`longExchange`)
  - 空方交易所 (`shortExchange`)
  - 最大費差 (`maxSpread`)
  - 最終費差 (`finalSpread`)
  - 實現年化報酬率 (`realizedAPY`)
  - 持續時間 (`durationMs` 轉換為人類可讀格式)
  - 機會消失時間 (`disappearedAt`)
- **FR-006**: 系統 MUST 在首頁頂部顯示品牌區塊，包含系統名稱和簡短說明
- **FR-007**: 系統 MUST 為未登入訪客顯示「登入」和「註冊」導覽按鈕
- **FR-008**: 系統 MUST 在無記錄時顯示空狀態提示
- **FR-009**: 系統 MUST 遮蔽用戶相關資訊（不顯示 `userId` 等敏感欄位）

### Non-Functional Requirements

- **NFR-001**: 首頁初始載入時間應在 2 秒內完成
- **NFR-002**: 分頁切換應在 500ms 內完成
- **NFR-003**: 首頁應支援響應式設計，適配桌面和行動裝置
- **NFR-004**: 公開 API MUST 實作速率限制：每 IP 每分鐘 30 次請求
- **NFR-005**: 首頁 MUST 使用伺服器端渲染（SSR）並包含 meta tags 和 Open Graph 標籤以支援 SEO

### Key Entities *(include if feature involves data)*

- **OpportunityEndHistory**: 現有模型，儲存套利機會歷史記錄
  - 公開首頁將聚合所有用戶的記錄（去識別化）
  - 按 `disappearedAt` 時間倒序排列

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 訪客無需登入即可在 3 次點擊內查看套利機會歷史
- **SC-002**: 首頁 Lighthouse Performance 分數達到 90+
- **SC-003**: 首頁在 3G 網路下可在 5 秒內完成首次有意義繪製（FCP）
- **SC-004**: 100% 的歷史記錄正確顯示，無敏感資訊洩漏

## Technical Notes

### API Endpoint

需新增公開 API endpoint：

```
GET /api/public/opportunities
Query Parameters:
  - page: number (default: 1)
  - limit: number (default: 20, max: 100)
  - days: number (7 | 30 | 90, default: 90) - 時間範圍篩選
Response:
  - data: OpportunityEndHistory[] (去識別化)
  - pagination: { page, limit, total, totalPages }
  - filter: { days }
```

### UI 路徑

- 首頁: `/` (公開)
- 登入後 Dashboard: `/market-monitor` (需認證)

### 資料隱私

- 不顯示 `userId` 欄位
- 不顯示 `notificationCount` 等用戶行為相關欄位
- 僅顯示套利機會的客觀市場數據

### 設計決策

- **資料刷新**：不實作自動刷新，用戶透過手動重新載入或切換分頁/篩選來獲取最新資料
- **渲染策略**：使用 Next.js SSR 以支援 SEO，首頁資料在伺服器端預先獲取
