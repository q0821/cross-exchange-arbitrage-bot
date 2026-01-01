# Feature Specification: 修復餘額顯示不一致問題

**Feature Branch**: `056-fix-balance-display`
**Created**: 2026-01-01
**Status**: Draft
**Input**: 修復開倉時餘額顯示不準確，以及資產總覽各交易所計算方式不一致的問題

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 開倉時顯示真實可用餘額 (Priority: P1)

作為套利交易者，當我在開倉對話框中查看餘額時，我希望看到的是「可用餘額」而非「總餘額」，這樣我才能準確判斷是否有足夠的保證金開倉。

目前問題：Binance、OKX、BingX 顯示的餘額是總餘額（包含已被現有倉位佔用的保證金），導致用戶誤以為有足夠資金開倉，但實際執行時可能因可用保證金不足而失敗。

**Why this priority**: 這直接影響用戶的交易決策和體驗。錯誤的餘額資訊可能導致開倉失敗、資金損失或錯過套利機會。

**Independent Test**: 用戶在有現有倉位的情況下，打開開倉對話框，確認顯示的餘額是扣除現有倉位佔用保證金後的可用餘額。

**Acceptance Scenarios**:

1. **Given** 用戶在 Binance 有 1000 USDT 總餘額，現有倉位佔用 300 USDT 保證金，**When** 用戶打開開倉對話框，**Then** Binance 顯示的可用餘額應為 700 USDT
2. **Given** 用戶在 OKX 有 500 USDT 總餘額，無任何倉位，**When** 用戶打開開倉對話框，**Then** OKX 顯示的可用餘額應為 500 USDT
3. **Given** 用戶在 BingX 有多個倉位佔用保證金，**When** 用戶打開開倉對話框，**Then** BingX 顯示的可用餘額應反映扣除所有倉位佔用後的真實可用金額
4. **Given** 用戶嘗試以顯示的可用餘額開倉，**When** 提交開倉請求，**Then** 不應因保證金不足而失敗（假設用戶輸入金額在可用範圍內）

---

### User Story 2 - 資產總覽 Gate.io 納入持倉價值 (Priority: P1)

作為套利交易者，當我查看資產總覽頁面時，我希望 Gate.io 的資產計算方式與其他交易所一致（納入持倉價值），這樣總資產線圖不會因為開/平倉而產生不正常的大幅波動。

目前問題：Gate.io 統一帳戶 API 返回的是「可用餘額」（已扣除持倉佔用的保證金），而其他交易所返回的是「總權益」（包含持倉價值）。這導致 Gate.io 開倉時資產突然下降，平倉時突然上升。

**Why this priority**: 資產總覽是用戶追蹤投資組合表現的核心功能。不一致的計算方式會造成誤導性的資產曲線，影響用戶對投資績效的判斷。

**Independent Test**: 用戶在 Gate.io 開倉前後查看資產總覽，確認總資產不會因開倉動作而大幅下降。

**Acceptance Scenarios**:

1. **Given** 用戶在 Gate.io 有 1000 USDT 總權益（500 可用 + 500 持倉價值），**When** 用戶查看資產總覽，**Then** Gate.io 顯示的資產應為 1000 USDT
2. **Given** 用戶在 Gate.io 開了一個新倉位（使用 200 USDT 保證金），**When** 開倉完成後查看資產總覽，**Then** Gate.io 的總資產應維持不變（只是從可用餘額轉為持倉價值）
3. **Given** 用戶同時在 Binance 和 Gate.io 有持倉，**When** 查看資產總覽的總資產曲線，**Then** 兩個交易所的資產計算方式應一致，不會因為開/平倉產生異常波動

---

### Edge Cases

- 當交易所 API 無法獲取持倉資訊時，應如何處理？（預設：顯示可用餘額並標註資料可能不完整）
- 當持倉有未實現虧損導致總權益低於可用餘額時？（預設：正確計算負的未實現損益）
- 當用戶在短時間內連續開多個倉位時，餘額更新是否即時？（預設：每次開倉前重新查詢最新可用餘額）

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 為每個交易所區分「總權益」(totalEquityUSD) 和「可用餘額」(availableBalanceUSD)
- **FR-002**: 開倉對話框 MUST 顯示各交易所的「可用餘額」，而非總餘額
- **FR-003**: 餘額驗證邏輯 MUST 使用「可用餘額」來判斷是否有足夠保證金開倉
- **FR-004**: 資產總覽 MUST 顯示各交易所的「總權益」（包含持倉價值）
- **FR-005**: Gate.io 連接器 MUST 額外查詢持倉資訊，計算總權益 = 可用餘額 + 持倉價值
- **FR-006**: Binance 連接器 MUST 從合約 API 獲取 availableBalance 作為可用餘額
- **FR-007**: OKX 連接器 MUST 從餘額 API 獲取可用餘額（free balance）
- **FR-008**: BingX 連接器 MUST 從餘額 API 獲取可用餘額

### Key Entities

- **AccountBalance**: 表示用戶在某交易所的資產狀態
  - totalEquityUSD: 總權益（用於資產總覽）
  - availableBalanceUSD: 可用餘額（用於開倉驗證）
  - exchange: 交易所名稱
  - timestamp: 查詢時間

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 用戶在有現有倉位的情況下，開倉對話框顯示的餘額與交易所 App 顯示的「可用保證金」一致
- **SC-002**: 用戶依據顯示的可用餘額開倉時，不會因為保證金不足而失敗（在正常網路條件下）
- **SC-003**: Gate.io 開倉前後，資產總覽的總資產變化不超過交易手續費（不因保證金轉移而大幅波動）
- **SC-004**: 所有交易所的資產總覽計算方式一致，使用總權益（可用餘額 + 持倉價值）
- **SC-005**: 資產曲線不再因開/平倉動作產生異常的階梯式波動

## Assumptions

- 各交易所 API 都提供可用餘額和持倉資訊的查詢接口
- Gate.io 持倉 API 返回的資訊足以計算持倉價值
- 用戶對「可用餘額」和「總權益」的概念有基本理解
