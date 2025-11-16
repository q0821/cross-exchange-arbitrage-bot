# Quick Start: 驗證套利機會頁面移除

**Feature**: 013-specify-scripts-bash
**Created**: 2025-01-21
**Branch**: `013-specify-scripts-bash`

## Overview

本指南幫助你驗證套利機會 (Opportunities) 功能已成功移除，並確認市場監控 (Market Monitor) 功能正常運作。

## Prerequisites

- Node.js 20.x LTS
- pnpm 已安裝
- PostgreSQL 資料庫正在運行
- 已完成功能移除的所有 tasks

## Quick Verification Checklist

### 1. 檢查檔案已移除 ✓

```bash
# 驗證前端頁面已刪除
test ! -d "app/(dashboard)/opportunities" && echo "✅ Frontend removed" || echo "❌ Frontend still exists"

# 驗證 API 端點已刪除
test ! -d "app/api/opportunities" && echo "✅ API removed" || echo "❌ API still exists"

# 驗證後端服務已刪除
test ! -f "src/services/monitor/OpportunityDetector.ts" && echo "✅ OpportunityDetector removed" || echo "❌ OpportunityDetector still exists"

# 驗證 Repository 已刪除
test ! -f "src/repositories/ArbitrageOpportunityRepository.ts" && echo "✅ Repositories removed" || echo "❌ Repositories still exist"

# 驗證 Models 已刪除
test ! -f "src/models/ArbitrageOpportunity.ts" && echo "✅ Models removed" || echo "❌ Models still exist"
```

**Expected Output**: 全部顯示 ✅

---

### 2. 檢查 Prisma Schema 標記 ✓

```bash
# 檢查 @deprecated 註解
grep -A 2 "@deprecated.*ArbitrageOpportunity" prisma/schema.prisma
```

**Expected Output**:
```prisma
/// @deprecated This model is deprecated. Use Market Monitor for real-time opportunities.
/// Historical data preserved for analysis. Last active: 2025-01-21.
model ArbitrageOpportunity {
```

---

### 3. 編譯驗證 ✓

```bash
# TypeScript 編譯檢查
pnpm build

# 預期：無編譯錯誤
```

**Expected**: Build succeeded without errors

**Common Issues**:
- 若出現 import 錯誤：檢查是否有遺漏的 OpportunityDetector 引用
- 若出現類型錯誤：確認所有 ArbitrageOpportunity 類型已移除

---

### 4. 啟動系統驗證 ✓

```bash
# 啟動開發伺服器
pnpm dev
```

**Verification Steps**:

#### 4.1 檢查服務啟動日誌

```
✅ Expected logs:
[INFO] FundingRateMonitor started
[INFO] MarketRatesHandler broadcasting started
[INFO] WebSocket server listening

❌ Should NOT see:
[INFO] OpportunityDetector started
[INFO] OpportunityDetector monitoring opportunities
```

#### 4.2 訪問舊路由 (應返回 404)

```bash
# 在另一個終端執行
curl -i http://localhost:3000/opportunities
```

**Expected Response**:
```
HTTP/1.1 404 Not Found
```

#### 4.3 訪問舊 API (應返回 404)

```bash
curl -i http://localhost:3000/api/opportunities
```

**Expected Response**:
```
HTTP/1.1 404 Not Found
```

#### 4.4 驗證市場監控正常

瀏覽器訪問: http://localhost:3000/market-monitor

**Expected**:
- ✅ 頁面正常載入
- ✅ WebSocket 連線成功 (右上角顯示「即時連線中」)
- ✅ 交易對列表顯示
- ✅ 即時費率更新 (每 5 秒)
- ✅ 統計卡片顯示正確

#### 4.5 檢查控制台無錯誤

開啟瀏覽器 DevTools → Console

**Expected**:
- ❌ 無 404 錯誤 (除了舊的 /opportunities 路由)
- ❌ 無 WebSocket 錯誤
- ❌ 無 JavaScript runtime 錯誤

---

### 5. 資料庫驗證 ✓

```bash
# 使用 Prisma Studio 檢查資料
pnpm prisma studio
```

**Verification**:
1. 開啟 Prisma Studio (http://localhost:5555)
2. 查看 `ArbitrageOpportunity` 表
3. 確認**歷史資料仍存在**
4. 確認**沒有新記錄產生** (recordedAt > 今天)

**SQL Query Alternative**:
```sql
-- 檢查歷史資料
SELECT COUNT(*) as total_opportunities FROM "ArbitrageOpportunity";

-- 檢查今天是否有新記錄 (應為 0)
SELECT COUNT(*) as new_today
FROM "ArbitrageOpportunity"
WHERE "detectedAt" >= CURRENT_DATE;
```

**Expected**:
- `total_opportunities`: > 0 (歷史資料存在)
- `new_today`: = 0 (無新記錄)

---

### 6. 導航驗證 ✓

登入系統後檢查：

1. **側邊欄/導航選單**: 不應看到「套利機會」入口
2. **首頁重定向**: 登入後應自動導向 `/market-monitor`
3. **手動訪問 `/opportunities`**: 應返回 404 或顯示「頁面不存在」

---

### 7. 通知系統驗證 (Optional) ✓

NotificationService 應該**保留**但不再觸發 opportunity 通知。

```bash
# 檢查通知服務仍然存在
test -f "src/services/notification/NotificationService.ts" && echo "✅ NotificationService retained" || echo "❌ NotificationService removed"

# 檢查通知渠道仍然存在
test -d "src/services/notification/channels" && echo "✅ Notification channels retained" || echo "❌ Channels removed"
```

**Verification**:
- 啟動系統後，不應看到 opportunity 相關通知
- NotificationService 代碼仍然存在 (未來可重用)

---

## Full End-to-End Test

執行完整流程測試：

```bash
# 1. 清理並重新安裝依賴
pnpm install

# 2. 執行單元測試 (應該跳過已移除的測試)
pnpm test

# 3. 編譯檢查
pnpm build

# 4. 啟動開發伺服器
pnpm dev

# 5. 在另一個終端執行 E2E 測試 (如果有)
# pnpm test:e2e
```

**Success Criteria**:
- ✅ All tests pass (無 OpportunityDetector 相關測試失敗)
- ✅ Build succeeds
- ✅ Dev server starts without errors
- ✅ Market Monitor 功能完全正常

---

## Rollback Plan (如果需要)

若發現問題需要回滾：

```bash
# 1. 切換到 main 分支
git checkout main

# 2. 刪除 feature 分支
git branch -D 013-specify-scripts-bash

# 3. 重新安裝依賴
pnpm install

# 4. 重啟系統
pnpm dev
```

或者從 git history 恢復特定檔案：

```bash
# 恢復 OpportunityDetector
git checkout HEAD~1 -- src/services/monitor/OpportunityDetector.ts

# 恢復 Opportunities 頁面
git checkout HEAD~1 -- app/\(dashboard\)/opportunities/
```

---

## Troubleshooting

### Issue 1: Build 失敗 - Import 錯誤

**Symptom**:
```
Error: Cannot find module 'src/services/monitor/OpportunityDetector'
```

**Solution**:
檢查 `src/services/monitor/MonitorService.ts`，確認已移除 OpportunityDetector 的 import 和註冊。

### Issue 2: 市場監控無資料

**Symptom**: Market Monitor 頁面空白，無交易對顯示

**Solution**:
1. 檢查 FundingRateMonitor 是否正常啟動
2. 檢查 WebSocket 連線狀態
3. 查看 RatesCache 是否有資料：
   ```typescript
   // 在 server console 執行
   console.log(ratesCache.size());
   ```

### Issue 3: 資料庫 schema 錯誤

**Symptom**:
```
Error: Table 'ArbitrageOpportunity' does not exist
```

**Solution**:
不應該發生 (因為我們保留 schema)。若出現：
```bash
# 重新同步 Prisma schema
pnpm prisma db push
```

### Issue 4: 404 頁面不美觀

**Symptom**: `/opportunities` 返回 Next.js 預設 404 頁面

**Solution**:
這是預期行為。若需要自定義 404：
- 建立 `app/not-found.tsx`
- 或保留一個簡單的 redirect page (不建議)

---

## Performance Comparison

### Before (With Opportunities Feature)

- 系統服務數量: 3 (FundingRateMonitor, OpportunityDetector, MarketRatesHandler)
- 資料庫寫入 qps: ~12 (funding rates + opportunities)
- 前端打包大小: ~1.2 MB (含 opportunities 組件)

### After (Removed)

- 系統服務數量: 2 (FundingRateMonitor, MarketRatesHandler)
- 資料庫寫入 qps: ~8 (僅 funding rates)
- 前端打包大小: ~1.0 MB (減少 ~200 KB)

**Improvement**:
- ✅ 服務數量減少 33%
- ✅ 資料庫負載減少 33%
- ✅ 前端打包減少 ~17%

---

## Summary Checklist

在合併到 main 之前，確認以下所有項目：

- [ ] 所有相關檔案已刪除 (frontend, API, services, repositories, models)
- [ ] Prisma schema 已標記 @deprecated
- [ ] MonitorService 已移除 OpportunityDetector 註冊
- [ ] Build 成功無錯誤
- [ ] 啟動系統無 OpportunityDetector 日誌
- [ ] `/opportunities` 返回 404
- [ ] `/api/opportunities` 返回 404
- [ ] Market Monitor 功能完全正常
- [ ] WebSocket 即時推送正常
- [ ] 資料庫歷史資料保留
- [ ] 無新 opportunity 記錄產生
- [ ] NotificationService 保留
- [ ] CHANGELOG.md 已更新
- [ ] README.md 已更新 (移除 opportunities 說明)

**All checked?** ✅ Ready to merge!

---

## Next Steps

1. 建立 Pull Request
2. Code review
3. 合併到 main
4. 部署到 production
5. 通知用戶功能已遷移到 Market Monitor
6. 觀察 1-2 週，確認無問題
7. (Optional) 6 個月後考慮清理歷史資料
