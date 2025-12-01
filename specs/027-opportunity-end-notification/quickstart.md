# Quick Start: 套利機會結束監測和通知

**Feature**: 027-opportunity-end-notification
**Date**: 2025-12-01

## 開發環境準備

### 先決條件

- Node.js 20.x LTS
- PostgreSQL 15+ with TimescaleDB
- pnpm 8.x+

### 環境設定

```bash
# 確保在專案根目錄
cd /path/to/cross-exchange-arbitrage-bot

# 安裝依賴
pnpm install

# 確保資料庫運行中
docker compose up -d postgres

# 執行資料庫遷移
pnpm prisma migrate dev
```

---

## 功能實作順序

建議按以下順序實作，每個階段可獨立測試：

### Phase 1: 資料庫變更 (P1 基礎)

```bash
# 1. 修改 prisma/schema.prisma
# 2. 建立遷移
pnpm prisma migrate dev --name add_opportunity_end_notification

# 3. 驗證
pnpm prisma studio  # 確認欄位已新增
```

### Phase 2: 類型定義 (P1 基礎)

修改 `src/services/notification/types.ts`：
- 新增 `TrackedOpportunity` interface
- 新增 `FundingSettlement` interface
- 新增 `OpportunityDisappearedMessage` interface

### Phase 3: NotificationService 機會追蹤 (P1 核心)

修改 `src/services/notification/NotificationService.ts`：
- 新增 `trackedOpportunities` Map
- 在 `checkAndNotify()` 中追蹤新機會
- 實作 `checkDisappearedOpportunities()` 方法
- 實作防抖動邏輯

### Phase 4: Notifier 結束通知 (P1 核心)

修改 `DiscordNotifier.ts` 和 `SlackNotifier.ts`：
- 新增 `sendDisappearedNotification()` 方法
- 實作結束通知訊息格式

### Phase 5: 模擬收益計算 (P2)

在 `NotificationService.ts` 中：
- 實作結算時間點費率記錄
- 實作 `calculateRealizedProfit()` 方法

### Phase 6: 前端開關 (P2)

修改 `app/(dashboard)/settings/notifications/page.tsx`：
- 新增「接收結束通知」開關
- 更新 API 調用

### Phase 7: 歷史記錄 (P3)

- 新增 `OpportunityHistoryRepository.ts`
- 實作 `/api/opportunities/history` API

---

## 測試指南

### 單元測試

```bash
# 測試 NotificationService 機會追蹤
pnpm test src/services/notification/NotificationService.test.ts

# 測試模擬收益計算
pnpm test src/services/notification/profitCalculation.test.ts
```

### 手動測試流程

1. **設定低閾值 Webhook**
   - 在設定頁面新增 Discord/Slack Webhook
   - 設定較低的年化收益閾值（如 100%）

2. **等待機會通知**
   - 啟動監控服務
   - 等待收到套利機會通知

3. **驗證結束通知**
   - 等待機會費差降低
   - 確認收到結束通知
   - 檢查通知內容是否完整

4. **驗證歷史記錄**
   - 查詢 `opportunity_histories` 表
   - 確認記錄完整

---

## 關鍵檔案清單

| 檔案 | 變更類型 | 說明 |
|------|----------|------|
| `prisma/schema.prisma` | 修改 | 新增 notifyOnDisappear、OpportunityHistory |
| `src/services/notification/types.ts` | 修改 | 新增類型定義 |
| `src/services/notification/NotificationService.ts` | 修改 | 機會追蹤和結束檢測 |
| `src/services/notification/DiscordNotifier.ts` | 修改 | 結束通知格式 |
| `src/services/notification/SlackNotifier.ts` | 修改 | 結束通知格式 |
| `src/services/notification/utils.ts` | 修改 | 時間格式化函式 |
| `src/repositories/OpportunityHistoryRepository.ts` | 新增 | 歷史記錄 CRUD |
| `src/models/OpportunityHistory.ts` | 新增 | Domain Model |
| `app/api/notifications/webhooks/route.ts` | 修改 | 支援新欄位 |
| `app/api/opportunities/history/route.ts` | 新增 | 歷史查詢 API |
| `app/(dashboard)/settings/notifications/page.tsx` | 修改 | 新增開關 |

---

## 常見問題

### Q: 服務重啟後追蹤資料會遺失嗎？

A: 是的，`TrackedOpportunity` 存在記憶體中。重啟後正在追蹤的機會會被視為新機會。歷史記錄不受影響。

### Q: 如何測試不同結算週期？

A: 可以使用 mock 資料，設定 `originalFundingInterval` 為 1、4 或 8 小時。

### Q: 防抖動時間可以調整嗎？

A: 目前硬編碼為 1 分鐘。如需調整，可在 `NotificationService` 中新增配置常數。

---

## 相關文件

- [功能規格](./spec.md)
- [技術計劃](./plan.md)
- [研究文件](./research.md)
- [資料模型](./data-model.md)
- [API 合約](./contracts/api.md)
