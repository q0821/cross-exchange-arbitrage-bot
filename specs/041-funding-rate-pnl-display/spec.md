# Feature Specification: 交易歷史資金費率損益顯示

**Feature Branch**: `041-funding-rate-pnl-display`
**Created**: 2025-12-24
**Status**: Draft
**Input**: User description: "目前交易歷史中，已經可以正確的顯示開倉價格、平倉價格的資訊了，但是中間的資金費率看起來沒有資訊，我希望他是能夠顯示的，可以看到我開這單，除了兩邊的價差損益外，還有資金費率的損益，才能反應真實的套利情況"

## Problem Analysis

### Current State
- `TradeCard.tsx` 已有顯示 `fundingRatePnL` 的 UI 欄位
- `PositionCloser.ts:489` 將 `fundingRatePnL` 硬編碼為 0（見註解「簡化：資金費率損益設為 0」）
- `Trade` 模型有 `fundingRatePnL` 欄位但永遠是 0

### Root Cause
平倉時沒有從交易所 API 查詢持倉期間的實際資金費率收支記錄，導致無法計算真實的資金費率損益。

### Solution Overview
在平倉流程中增加資金費率收支查詢步驟，從各交易所 API 獲取持倉期間的累計資金費率損益，並將其納入 Trade 記錄中。

## Background: 資金費率結算機制

### 結算時間點（非持倉時長）

**重要**：資金費率結算是在固定整點進行，判斷是否有結算的標準是「有沒有跨過結算時間點」，而不是持倉時長。

例如：
- 23:59 開倉，00:01 平倉（跨過 00:00 整點）→ 有 1 次結算
- 00:01 開倉，07:59 平倉（未跨過 08:00 整點）→ 無結算（假設 8 小時結算頻率）
- 07:59 開倉，08:01 平倉（跨過 08:00 整點）→ 有 1 次結算

### 各交易所結算頻率

各交易所的結算頻率因幣種而異，都可能有 1 小時、4 小時、8 小時等不同週期：

| 交易所 | 結算頻率 | 說明 |
|--------|---------|------|
| Binance | 1h / 4h / 8h | 依幣種而定，熱門幣種可能是 1h 或 4h |
| OKX | 1h / 4h / 8h | 依幣種而定 |
| Gate.io | 1h / 4h / 8h | 依幣種而定 |
| MEXC | 1h / 4h / 8h | 依幣種而定 |

**結算時間點範例**：
- 8 小時週期：00:00, 08:00, 16:00 UTC
- 4 小時週期：00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC
- 1 小時週期：每整點 UTC

**注意**：
- 同一幣種在不同交易所可能有不同結算頻率
- 資金費率是在結算時間點根據當時的持倉量計算並收取/支付
- 查詢時應使用交易所 API 返回的實際結算記錄，而非自行推算

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 查看交易歷史中的資金費率損益 (Priority: P1)

作為一個套利交易者，我希望在交易歷史中看到每筆交易的資金費率損益，這樣我才能了解真實的套利收益，而不只是價差損益。

**Why this priority**: 這是核心需求，沒有這個功能用戶無法評估真實套利績效。套利的主要收益來源就是資金費率差，不顯示會讓用戶誤判策略效果。

**Independent Test**: 執行一筆完整的開倉→跨過結算時間點→平倉流程，驗證 Trade 記錄中 `fundingRatePnL` 不為 0，並在 UI 正確顯示。

**Acceptance Scenarios**:

1. **Given** 我有一個跨過至少一個結算時間點的已平倉 Position，**When** 我查看交易歷史，**Then** 該筆交易的資金費率損益欄位顯示實際數值（可能為正或負），不是 0
2. **Given** 我在 Binance Long + OKX Short 的 BTCUSDT 套利倉位已平倉，**When** 系統計算資金費率損益，**Then** 資金費率損益 = Long 邊累計資金費率收支 + Short 邊累計資金費率收支
3. **Given** 我查看交易歷史的 Trade 詳情，**When** 展開詳情，**Then** 能看到 Long 邊和 Short 邊各自的資金費率收支金額

---

### User Story 2 - 資金費率損益納入總損益計算 (Priority: P1)

作為一個套利交易者，我希望總損益公式正確包含資金費率損益，這樣我才能看到真實的整體收益。

**Why this priority**: 與 US1 同等重要，總損益是用戶最關心的數字，必須準確。

**Independent Test**: 驗證 Trade 記錄的 `totalPnL = priceDiffPnL + fundingRatePnL - totalFees` 公式正確應用。

**Acceptance Scenarios**:

1. **Given** 一筆已平倉交易有 priceDiffPnL=10, fundingRatePnL=5, totalFees=2，**When** 系統計算總損益，**Then** totalPnL = 10 + 5 - 2 = 13
2. **Given** 一筆已平倉交易的資金費率為負（付出資金費率），**When** 查看交易歷史，**Then** 總損益已扣除該負資金費率損益

---

### User Story 3 - 處理不同結算頻率 (Priority: P1)

作為一個套利交易者，我希望系統能正確處理不同交易所/幣種的資金費率結算頻率差異，這樣我的資金費率損益計算才會準確。

**Why this priority**: 結算頻率差異是常見情況，各交易所都有 1h/4h/8h 不同頻率的幣種，必須正確處理。

**Independent Test**: 使用不同結算頻率的幣種組合開倉，驗證兩邊各自結算週期的費率都被正確累加。

**Acceptance Scenarios**:

1. **Given** Long 端的幣種是 1 小時結算，Short 端是 8 小時結算，**When** 跨過 4 個整點（如 00:00, 01:00, 02:00, 03:00）後平倉，但未跨過 Short 端的下一個結算點，**Then** Long 邊有 4 次結算記錄，Short 邊有 0 次結算記錄
2. **Given** 同一幣種在兩個交易所都是 8 小時結算，**When** 跨過 00:00 和 08:00 兩個結算點後平倉，**Then** 兩邊各有 2 次結算記錄被累加

---

### User Story 4 - 查詢失敗時的降級處理 (Priority: P2)

作為一個系統管理者，我希望當資金費率查詢失敗時系統能正常運作，這樣不會因為查詢失敗導致平倉流程卡住。

**Why this priority**: 確保系統健壯性，但不是核心功能。

**Independent Test**: 模擬 API 查詢失敗，驗證平倉流程正常完成，fundingRatePnL 記為 0 並記錄警告日誌。

**Acceptance Scenarios**:

1. **Given** 交易所 API 查詢資金費率歷史失敗，**When** 執行平倉，**Then** 平倉流程正常完成，fundingRatePnL 設為 0，並記錄警告日誌
2. **Given** Long 邊查詢成功但 Short 邊查詢失敗，**When** 執行平倉，**Then** 使用 Long 邊的資金費率數據，Short 邊視為 0

---

### Edge Cases

- 持倉期間未跨過任何結算時間點：資金費率損益應為 0
- 開倉時間恰好在結算時間點（如 00:00:00 開倉）：該次結算應計入（持倉時已有倉位）
- 平倉時間恰好在結算時間點（如 08:00:00 平倉）：該次結算應計入
- 跨多個結算時間點：需累加所有結算記錄
- 交易所 API 返回空數據：視為 0，不應報錯
- Long 邊和 Short 邊結算頻率不同：需分別按各自的結算時間點查詢記錄

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 在平倉時查詢 Long 邊交易所的資金費率歷史記錄
- **FR-002**: 系統 MUST 在平倉時查詢 Short 邊交易所的資金費率歷史記錄
- **FR-003**: 系統 MUST 計算持倉期間（openedAt ~ closedAt）跨過的所有結算時間點的累計資金費率損益
- **FR-004**: 系統 MUST 將資金費率損益存入 Trade 記錄的 `fundingRatePnL` 欄位
- **FR-005**: 系統 MUST 在總損益計算中包含資金費率損益：`totalPnL = priceDiffPnL + fundingRatePnL - totalFees`
- **FR-006**: 系統 MUST 在 API 查詢失敗時降級處理，將 fundingRatePnL 設為 0 並記錄警告
- **FR-007**: 系統 MUST 正確處理不同結算頻率（1h, 4h, 8h）的資金費率查詢

### Key Entities *(include if feature involves data)*

- **Trade**: 已有 `fundingRatePnL` 欄位，目前永遠為 0，需要實際填入計算結果
- **Position**: 提供 `openedAt`、`symbol`、`longExchange`、`shortExchange` 等查詢所需參數
- **FundingFeeRecord**: 各交易所返回的資金費率結算記錄（symbol, timestamp, fee, side）

## Technical Notes

### Exchange API Endpoints

| Exchange | API Endpoint | Method | 說明 |
|----------|--------------|--------|------|
| Binance | `/fapi/v1/income` (type=FUNDING_FEE) | GET | 返回資金費率收支歷史 |
| OKX | `/api/v5/account/bills` (type=8) | GET | type=8 為資金費率 |
| Gate.io | `/api/v4/futures/usdt/account_book` (type=fund) | GET | 資金費率帳單 |
| MEXC | `/api/v1/private/account/assets/funding_records` | GET | 資金費率記錄 |

### Implementation Location

修改 `src/services/trading/PositionCloser.ts`：
1. 在 `closePosition()` 方法中，平倉成功後、計算 PnL 前
2. 調用新建的 `FundingFeeQueryService` 查詢兩邊的資金費率
3. 將查詢結果傳入 `calculatePnL()` 函數

新建 `src/services/trading/FundingFeeQueryService.ts`：
1. 封裝各交易所資金費率歷史查詢邏輯
2. 提供統一介面：`queryFundingFees(exchange, symbol, startTime, endTime, userId)`
3. 返回累計資金費率損益金額

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 所有新平倉的 Trade 記錄，`fundingRatePnL` 欄位包含實際資金費率損益（跨過結算時間點時不為 0）
- **SC-002**: Trade 的 `totalPnL` 正確反映 `priceDiffPnL + fundingRatePnL - totalFees`
- **SC-003**: 交易歷史頁面正確顯示資金費率損益數值
- **SC-004**: API 查詢失敗時，平倉流程仍能在 5 秒內正常完成
- **SC-005**: 不同結算頻率的幣種（1h, 4h, 8h）資金費率都能正確查詢和累加
