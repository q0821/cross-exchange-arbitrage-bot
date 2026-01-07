# Feature Specification: 通知加入開倉連結

**Feature Branch**: `058-notification-open-link`
**Created**: 2026-01-07
**Status**: Draft
**Input**: 在 Discord/Slack 套利機會通知中加入「開倉」按鈕連結，點擊後跳轉到平台的市場監控頁面並自動帶入交易對、多方和空方交易所參數，方便用戶快速開倉。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Discord 通知快速開倉 (Priority: P1)

用戶在 Discord 收到套利機會通知時，可以直接點擊通知中的「開倉」按鈕，自動跳轉到平台的市場監控頁面，頁面會預先帶入該套利機會的交易對、多方交易所和空方交易所參數。

**Why this priority**: Discord 是主要的通知渠道，大部分用戶使用 Discord 接收套利機會通知，快速開倉功能可以大幅提升用戶體驗和操作效率。

**Independent Test**: 可以透過 Discord 發送測試通知，點擊按鈕驗證是否正確跳轉到市場監控頁面並帶入正確參數。

**Acceptance Scenarios**:

1. **Given** 用戶已設定 Discord Webhook 且收到套利機會通知, **When** 用戶點擊通知中的「開倉」按鈕, **Then** 瀏覽器開啟市場監控頁面，URL 包含正確的 symbol、long、short 參數
2. **Given** 用戶點擊開倉連結進入市場監控頁面, **When** 頁面載入完成, **Then** 開倉對話框自動開啟並預填交易對和交易所資訊
3. **Given** 套利機會通知包含多個交易所組合, **When** 系統發送通知, **Then** 連結參數對應該通知中年化收益最高的組合

---

### User Story 2 - Slack 通知快速開倉 (Priority: P2)

用戶在 Slack 收到套利機會通知時，可以直接點擊通知中的「開倉」按鈕，功能與 Discord 相同。

**Why this priority**: Slack 是次要通知渠道，功能應與 Discord 保持一致。

**Independent Test**: 可以透過 Slack 發送測試通知，點擊按鈕驗證是否正確跳轉。

**Acceptance Scenarios**:

1. **Given** 用戶已設定 Slack Webhook 且收到套利機會通知, **When** 用戶點擊通知中的「開倉」按鈕, **Then** 瀏覽器開啟市場監控頁面，URL 包含正確的 symbol、long、short 參數

---

### Edge Cases

- 當通知中的交易對在市場監控頁面已不存在時，頁面顯示「此套利機會已不存在」提示
- 當用戶未登入時點擊連結，先導向登入頁面，登入後自動跳轉到目標頁面
- 當連結參數不完整或格式錯誤時，頁面正常顯示但不自動開啟開倉對話框

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Discord 通知訊息 MUST 包含「開倉」按鈕，點擊後開啟瀏覽器
- **FR-002**: Slack 通知訊息 MUST 包含「開倉」按鈕，點擊後開啟瀏覽器
- **FR-003**: 開倉連結格式 MUST 為 `{BASE_URL}/market-monitor?symbol={symbol}&long={longExchange}&short={shortExchange}`
- **FR-004**: 市場監控頁面 MUST 能解析 URL 參數並自動開啟開倉對話框
- **FR-005**: 開倉對話框 MUST 根據 URL 參數預填交易對和交易所選擇
- **FR-006**: 連結中的 BASE_URL MUST 可透過環境變數或系統設定配置
- **FR-007**: 當套利機會有多個交易所組合時，連結 MUST 使用年化收益最高的組合

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 用戶從收到通知到開啟開倉對話框的操作時間從原本的 30 秒以上縮短至 5 秒以內
- **SC-002**: 100% 的套利機會通知都包含有效的開倉連結
- **SC-003**: 點擊連結後頁面正確載入並預填參數的成功率達 99%
- **SC-004**: 新功能不影響現有通知發送成功率（維持 99%+）

## Assumptions

- 用戶已登入平台或有有效的 session
- 平台 BASE_URL 可透過環境變數取得
- Discord 和 Slack 都支援在訊息中嵌入可點擊的按鈕或連結
- 現有通知服務已能取得套利機會的完整資訊（symbol、exchanges）

## Out of Scope

- 在通知中直接下單（不跳轉到平台）
- 新增其他通知渠道（如 Telegram、Email）
- 修改開倉對話框的核心邏輯
