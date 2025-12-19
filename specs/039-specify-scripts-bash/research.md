# Research Notes: Prisma Client Singleton 優化

**Feature**: 039-prisma-singleton-refactor
**Date**: 2025-12-20

## 研究結論

此功能為純程式碼重構，無需外部研究。所有技術決策已在專案中確立。

## 技術決策

### 決策 1: Singleton 實作方式

**Decision**: 使用現有的 `src/lib/db.ts` singleton 實作

**Rationale**:
- 已經正確實作 globalThis 模式，確保開發模式下不重複建立實例
- 已配置慢查詢監控 (>100ms 警告)
- 已配置錯誤和警告事件記錄
- 已實作優雅關閉機制 (`process.on('beforeExit')`)

**Alternatives Considered**:
- 每個模組自建 PrismaClient（現狀）- 拒絕，因為連線池浪費
- 使用依賴注入容器 - 過度複雜，不符合專案規模

### 決策 2: 修改範圍

**Decision**: 僅修改 API routes 和 repositories，排除 scripts 和 tests

**Rationale**:
- Scripts 為獨立執行的 CLI 工具，生命週期與 Web 應用不同
- Tests 需要獨立的資料庫連線以避免測試間干擾
- API routes 和 repositories 是 Web 應用核心，需共享連線池

**Alternatives Considered**:
- 全面修改所有檔案 - 拒絕，scripts 和 tests 有不同需求
- 僅修改 API routes - 拒絕，repositories 也應統一

### 決策 3: Import 路徑格式

**Decision**: 使用 `@/src/lib/db` 絕對路徑引入

**Rationale**:
- 專案已配置 `@/` 為根目錄別名
- 絕對路徑避免相對路徑深度問題
- 與現有程式碼風格一致

**Alternatives Considered**:
- 相對路徑 (`../../lib/db`) - 拒絕，不同深度的檔案需要不同路徑
- `@prisma/client` 配合自訂 output - 過度複雜

## 現有 Singleton 程式碼分析

檔案: `src/lib/db.ts`

**關鍵功能**:
1. **全域單例**: `globalThis.prisma ?? prismaClientSingleton()`
2. **開發模式保護**: `if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma`
3. **慢查詢監控**: 記錄 >100ms 的查詢
4. **錯誤記錄**: 捕捉並記錄所有 Prisma 錯誤和警告
5. **優雅關閉**: `process.on('beforeExit', async () => await prisma.$disconnect())`
6. **服務初始化**: NotificationService 和 SimulatedTrackingService

## 需修改的檔案清單

### API Routes (23 個)

| 檔案 | 用途 |
|------|------|
| `app/api/opportunities/history/route.ts` | 套利機會歷史 |
| `app/api/opportunities/history/[id]/route.ts` | 單一機會詳情 |
| `app/api/auth/register/route.ts` | 用戶註冊 |
| `app/api/auth/login/route.ts` | 用戶登入 |
| `app/api/trades/route.ts` | 交易紀錄 |
| `app/api/api-keys/route.ts` | API Key 管理 |
| `app/api/api-keys/[id]/route.ts` | 單一 API Key |
| `app/api/simulated-tracking/route.ts` | 模擬追蹤 |
| `app/api/simulated-tracking/[id]/snapshots/route.ts` | 追蹤快照 |
| `app/api/simulated-tracking/[id]/stop/route.ts` | 停止追蹤 |
| `app/api/simulated-tracking/[id]/route.ts` | 追蹤詳情 |
| `app/api/balances/route.ts` | 餘額查詢 |
| `app/api/positions/route.ts` | 持倉列表 |
| `app/api/positions/open/route.ts` | 開倉 |
| `app/api/positions/[id]/route.ts` | 持倉詳情 |
| `app/api/positions/[id]/market-data/route.ts` | 市場數據 |
| `app/api/positions/[id]/close/route.ts` | 平倉 |
| `app/api/assets/route.ts` | 資產查詢 |
| `app/api/assets/history/route.ts` | 資產歷史 |
| `app/api/assets/positions/route.ts` | 資產持倉 |
| `app/api/notifications/webhooks/route.ts` | Webhook 設定 |
| `app/api/notifications/webhooks/[id]/route.ts` | 單一 Webhook |
| `app/api/notifications/webhooks/[id]/test/route.ts` | 測試 Webhook |
| `app/api/settings/trading/route.ts` | 交易設定 |

### Repositories (2 個)

| 檔案 | 用途 |
|------|------|
| `src/repositories/TradingSettingsRepository.ts` | 交易設定存取 |
| `src/repositories/AuditLogRepository.ts` | 審計日誌存取 |

## 無需研究的項目

- ✅ Prisma singleton 最佳實踐（已實作）
- ✅ Next.js App Router 資料庫連線管理（已實作）
- ✅ 連線池設定（保持現有設定）
