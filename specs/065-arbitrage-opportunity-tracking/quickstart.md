# Quickstart: ArbitrageOpportunity 即時追蹤記錄

**Feature**: 065-arbitrage-opportunity-tracking
**Date**: 2026-01-18

## 功能概述

此功能建立獨立的 `ArbitrageOpportunity` 資料模型，在監測服務偵測到套利機會時立即記錄，讓公開首頁能顯示歷史套利機會，不依賴用戶或 Webhook。

## 快速驗證

### 1. 資料庫遷移

```bash
# 確認 schema 變更
pnpm prisma generate

# 執行 migration
pnpm prisma migrate dev --name add-arbitrage-opportunity
```

### 2. 驗證資料表建立

```bash
# 連接資料庫確認
pnpm prisma studio
# 或使用 psql
psql $DATABASE_URL -c "SELECT * FROM arbitrage_opportunities LIMIT 1;"
```

### 3. 啟動監測服務

```bash
# 啟動 CLI 監測
pnpm dev:monitor

# 觀察日誌輸出
# 應該看到 "ArbitrageOpportunityTracker initialized"
# 當偵測到機會時應該看到 "Opportunity recorded"
```

### 4. 驗證公開 API

```bash
# 查詢歷史機會
curl http://localhost:3000/api/public/opportunities

# 應回傳：
# {
#   "success": true,
#   "data": {
#     "opportunities": [...],
#     "pagination": { "page": 1, "limit": 20, "total": N }
#   }
# }
```

### 5. 驗證首頁顯示

1. 開啟瀏覽器 `http://localhost:3000`
2. 確認歷史套利機會列表有顯示（或空狀態訊息）
3. 確認資料包含：交易對、交易所、費差、持續時間

## 關鍵檔案

| 檔案 | 用途 |
|------|------|
| `prisma/schema.prisma` | ArbitrageOpportunity model 定義 |
| `src/repositories/ArbitrageOpportunityRepository.ts` | 資料存取層 |
| `src/services/monitor/ArbitrageOpportunityTracker.ts` | 事件監聽與記錄 |
| `app/api/public/opportunities/route.ts` | 公開 API |

## 測試執行

```bash
# 執行單元測試
pnpm test tests/unit/repositories/ArbitrageOpportunityRepository.test.ts
pnpm test tests/unit/services/ArbitrageOpportunityTracker.test.ts

# 執行整合測試（需要資料庫）
RUN_INTEGRATION_TESTS=true pnpm test tests/integration/ArbitrageOpportunityFlow.test.ts
```

## 預期行為

1. **機會偵測時**：
   - 自動建立 ACTIVE 狀態記錄
   - 記錄初始費差和年化報酬

2. **機會持續時**：
   - 更新 currentSpread 和 currentAPY
   - 追蹤 maxSpread 和 maxAPY

3. **機會消失時**：
   - 狀態更新為 ENDED
   - 計算並記錄 durationMs

4. **首頁顯示**：
   - 顯示已結束的機會列表
   - 支援時間範圍篩選（7/30/90 天）
   - 支援分頁

## 故障排除

### 問題：監測服務啟動但沒有記錄

**檢查**：
1. 確認有偵測到套利機會（費差 ≥ 0.5%）
2. 檢查日誌是否有 "Opportunity recorded" 訊息
3. 檢查資料庫連線是否正常

### 問題：API 回傳空陣列

**檢查**：
1. 確認資料庫有記錄：`SELECT COUNT(*) FROM arbitrage_opportunities;`
2. 確認查詢時間範圍（預設 7 天）
3. 確認狀態篩選（預設 ENDED）

### 問題：首頁不顯示資料

**檢查**：
1. 開發者工具查看 API 回應
2. 確認前端組件正確使用新的 API 格式
3. 檢查是否有 JavaScript 錯誤

## 回滾指南

如果需要回滾此功能：

```bash
# 回滾 migration
pnpm prisma migrate resolve --rolled-back "add-arbitrage-opportunity"

# 或直接刪除資料表（謹慎！）
psql $DATABASE_URL -c "DROP TABLE arbitrage_opportunities;"
psql $DATABASE_URL -c "DROP TYPE opportunity_status;"
```
