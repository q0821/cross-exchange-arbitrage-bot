# Research: 通知價差過濾

**Feature**: 057-notification-price-filter
**Date**: 2026-01-06

## Research Summary

此功能的所有技術依賴都已存在於代碼庫中，無需額外研究。以下是確認的現有實作：

---

## Decision 1: 淨收益計算方式

**Decision**: 使用現有的 `netReturn` 欄位

**Rationale**:
- `netReturn` 已在 Feature 012 (Price Spread Net Return) 實作
- 在 `createMultiExchangeFundingRatePair()` 函數中計算
- 使用 `NetProfitCalculator` 服務進行計算
- 已扣除所有成本（手續費 0.2% + 滑點 0.1% + 價差成本 0.15% + 安全邊際 0.05% = 總成本 0.5%）

**Alternatives Considered**:
- 重新計算淨收益：不必要，現有實作已完整
- 使用 `spreadPercent - TOTAL_COST_RATE`：簡化版，但 `netReturn` 更準確

**Location**: `src/models/FundingRate.ts:178`

---

## Decision 2: 價差方向判斷方式

**Decision**: 複用現有的 `isPriceDiffFavorableForBestPair()` 邏輯，並將結果存入 `BestArbitragePair`

**Rationale**:
- `RateDifferenceCalculator.isPriceDiffFavorableForBestPair()` 已實作完整邏輯
- 判斷條件：`(shortPrice - longPrice) / shortPrice >= -0.0005` (0.05% 容忍值)
- 只需將計算結果存入 `BestArbitragePair.isPriceDirectionCorrect` 供通知服務使用

**Alternatives Considered**:
- 在 NotificationService 中重新計算：不符合 DRY 原則
- 使用 `priceDiffPercent > 0` 簡單判斷：不考慮容忍範圍

**Location**: `src/services/monitor/RateDifferenceCalculator.ts:130-184`

---

## Decision 3: 資料庫欄位命名

**Decision**: 使用 `requireFavorablePrice`

**Rationale**:
- 語義明確：「要求有利的價差」
- 與現有 `notifyOnDisappear` 命名風格一致（動詞 + 名詞）
- Boolean 型態，預設 `false`

**Alternatives Considered**:
- `enablePriceFilter`：較通用但語義不夠明確
- `priceFilterEnabled`：過去分詞命名，與現有風格不符
- `onlyFavorablePrice`：副詞開頭，讀起來怪

---

## Decision 4: 價格數據不完整時的處理

**Decision**: 保守策略 - 不發送通知

**Rationale**:
- 用戶啟用價差過濾的意圖是「只在確定有利時通知」
- 無法判斷時假設「不利」比「有利」更安全
- 避免誤導用戶進場不利的交易

**Alternatives Considered**:
- 視為「有利」並發送通知：可能導致用戶收到無效通知
- 拋出錯誤：過於嚴格，會中斷通知流程

---

## Existing Code References

| Component | File Path | Line |
|-----------|-----------|------|
| `netReturn` 計算 | `src/models/FundingRate.ts` | 259-275 |
| `isPriceDiffFavorableForBestPair` | `src/services/monitor/RateDifferenceCalculator.ts` | 130-184 |
| `TOTAL_COST_RATE` | `src/lib/cost-constants.ts` | 42 |
| `MAX_ACCEPTABLE_ADVERSE_PRICE_DIFF` | `src/lib/cost-constants.ts` | 74 |
| `WebhookConfig` type | `src/services/notification/types.ts` | 15-26 |
| Webhook Repository | `src/repositories/NotificationWebhookRepository.ts` | 18-150 |
| NotificationService | `src/services/notification/NotificationService.ts` | 44-240 |

---

## No NEEDS CLARIFICATION Items

所有技術決策都基於現有代碼庫的模式和最佳實踐，無需額外澄清。
