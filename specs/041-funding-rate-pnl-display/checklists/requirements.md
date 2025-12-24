# Requirements Checklist: 交易歷史資金費率損益顯示

**Feature**: 041-funding-rate-pnl-display
**Spec Version**: 1.0
**Created**: 2025-12-24

## Spec Quality Checklist

### Problem Definition
- [x] Problem Analysis 清楚說明現狀（fundingRatePnL 硬編碼為 0）
- [x] Root Cause 已識別（平倉時未查詢交易所資金費率歷史）
- [x] Solution Overview 提供高層次解決方案

### Background Knowledge
- [x] 結算時間點機制已說明（跨過整點才有結算，非持倉時長）
- [x] 各交易所結算頻率已說明（Binance/OKX/Gate.io/MEXC 都有 1h/4h/8h）
- [x] 結算時間點範例已提供

### User Stories
- [x] US1: 查看交易歷史中的資金費率損益 (P1) - 有明確驗收條件
- [x] US2: 資金費率損益納入總損益計算 (P1) - 有明確驗收條件
- [x] US3: 處理不同結算頻率 (P1) - 有明確驗收條件
- [x] US4: 查詢失敗時的降級處理 (P2) - 有明確驗收條件

### Edge Cases
- [x] 未跨過結算時間點的情況
- [x] 開倉/平倉時間恰好在結算點
- [x] Long/Short 結算頻率不同
- [x] API 返回空數據

### Functional Requirements
- [x] FR-001 ~ FR-007 均已定義
- [x] 每個需求有明確的 MUST 語句

### Technical Notes
- [x] 各交易所 API Endpoint 已列出
- [x] 實作位置已說明（PositionCloser.ts, FundingFeeQueryService.ts）

### Success Criteria
- [x] SC-001 ~ SC-005 均可量測
- [x] 包含效能要求（5 秒內完成）

## Implementation Readiness

### Prerequisites
- [x] Trade 模型已有 `fundingRatePnL` 欄位
- [x] TradeCard.tsx 已有顯示 fundingRatePnL 的 UI
- [x] pnl-calculator.ts 已有 fundingRatePnL 參數
- [x] 各交易所 CCXT 適配器已存在

### Dependencies
- [x] 需要各交易所的 API 金鑰（已有）
- [x] 需要 CCXT 庫支援（已有）

### Risks
- [ ] 部分交易所可能限制歷史資金費率查詢範圍
- [ ] API Rate Limit 可能影響查詢速度

## Spec Approval

- [x] 用戶已審閱並同意 spec 內容
- [x] 可進入 plan 階段
