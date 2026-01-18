# Research: 公開套利機會歷史首頁

**Feature**: 064-public-landing-page
**Date**: 2026-01-18

## 1. 現有架構分析

### 1.1 OpportunityEndHistory 模型

**位置**: `prisma/schema.prisma` (第 377-426 行)

現有欄位：
- `id` - 主鍵
- `symbol` - 交易對
- `longExchange` / `shortExchange` - 交易所
- `detectedAt` / `disappearedAt` - 時間區間
- `durationMs` - 持續時間
- `initialSpread` / `maxSpread` / `finalSpread` - 費差統計
- `realizedAPY` - 年化報酬率
- `userId` - 用戶關聯（**需隱藏**）
- `notificationCount` - 通知次數（**需隱藏**）

**Decision**: 使用現有模型，無需 schema 變更
**Rationale**: 模型已包含所有展示所需欄位，僅需在查詢時排除敏感欄位
**Alternatives**: 建立獨立公開表 → 拒絕（資料重複、維護成本）

### 1.2 現有 Repository

**位置**: `src/repositories/OpportunityEndHistoryRepository.ts`

現有方法：
- `create()` - 建立記錄
- `findByUserId()` - 按用戶查詢（需認證）
- `findById()` - 按 ID 查詢

**Decision**: 擴展 Repository 新增 `findAllPublic()` 方法
**Rationale**: 遵循 Repository 模式，集中資料存取邏輯
**Alternatives**: 在 API route 直接查詢 Prisma → 拒絕（違反單一職責）

### 1.3 首頁現狀

**位置**: `app/page.tsx`

```typescript
// 目前僅做重導向
if (token) redirect('/market-monitor');
redirect('/login');
```

**Decision**: 改為公開 landing page，已登入用戶自動重導向
**Rationale**: 符合 clarification 需求（已登入用戶重導向到 Dashboard）

## 2. 速率限制方案

### 2.1 方案選擇

| 方案 | 優點 | 缺點 |
|------|------|------|
| In-memory (Map) | 簡單、無外部依賴 | 單節點、重啟清空 |
| Redis | 分散式、持久 | 需額外連線、複雜度高 |
| next-rate-limit | 現成套件 | 額外依賴 |

**Decision**: In-memory Map + 滑動窗口算法
**Rationale**: 單節點部署足夠，日後可無縫升級 Redis
**Alternatives**: Redis → 延遲（目前過度設計）

### 2.2 實作細節

```typescript
// src/lib/rate-limiter.ts
interface RateLimitConfig {
  windowMs: number;    // 時間窗口（毫秒）
  maxRequests: number; // 最大請求數
}

// 30 req/min = windowMs: 60000, maxRequests: 30
```

## 3. SEO 最佳實踐

### 3.1 Meta Tags

```typescript
// app/page.tsx
export const metadata: Metadata = {
  title: 'Cross-Exchange Arbitrage Bot - 跨交易所套利機會監測',
  description: '即時監測多交易所資金費率套利機會，查看歷史套利數據和績效分析',
  openGraph: {
    title: 'Cross-Exchange Arbitrage Bot',
    description: '跨交易所套利機會監測平台',
    type: 'website',
  },
};
```

### 3.2 SSR 資料獲取

**Decision**: 使用 Next.js Server Component 直接查詢 DB
**Rationale**: 減少 API 往返，首頁載入更快

```typescript
// Server Component pattern
async function HomePage() {
  const opportunities = await getPublicOpportunities({ days: 90, page: 1 });
  return <OpportunityList data={opportunities} />;
}
```

## 4. 前端元件設計

### 4.1 元件樹

```
HomePage (Server Component)
├── PublicNav
│   ├── Logo
│   └── AuthButtons (Login/Register)
├── HeroSection
│   ├── Title
│   └── Description
├── TimeRangeFilter (Client Component)
│   └── 7/30/90 天切換
├── OpportunityList
│   └── OpportunityCard[] x N
├── Pagination (Client Component)
└── Footer
```

### 4.2 資料流

1. **首次載入 (SSR)**：Server Component 直接查詢 DB，渲染 HTML
2. **篩選/分頁 (CSR)**：Client Component 呼叫 `/api/public/opportunities`

## 5. 測試策略

| 層級 | 範圍 | 工具 |
|------|------|------|
| Unit | Repository `findAllPublic`, Rate limiter | Vitest |
| Integration | API endpoint 完整流程 | Vitest + supertest |
| E2E | 首頁載入、分頁、篩選 | Playwright |

## 6. 效能考量

### 6.1 資料庫查詢最佳化

- 使用現有索引：`@@index([disappearedAt(sort: Desc)])`
- 限制查詢範圍：最多 90 天
- 分頁：每頁 20 筆，避免大量資料傳輸

### 6.2 快取策略（未來擴展）

目前不實作快取（資料量小、更新頻繁）。未來可考慮：
- ISR (Incremental Static Regeneration) - 每分鐘重新生成
- Redis 快取熱門查詢結果

## 7. 安全考量

### 7.1 資料隱私

- ✅ 不暴露 `userId`
- ✅ 不暴露 `notificationCount`
- ✅ 不暴露 `settlementRecords`（詳細結算記錄）

### 7.2 API 保護

- ✅ IP 速率限制（30 req/min）
- ✅ 查詢參數驗證（Zod schema）
- ✅ 最大頁面大小限制（100 筆）
