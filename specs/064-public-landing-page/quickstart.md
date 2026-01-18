# Quickstart: 公開套利機會歷史首頁

**Feature**: 064-public-landing-page
**Date**: 2026-01-18

## 先決條件

- Node.js 20.x LTS
- pnpm 9.x
- PostgreSQL 15+ with TimescaleDB
- 現有開發環境已設置完成

## 快速驗證

### 1. 切換到功能分支

```bash
git checkout 064-public-landing-page
```

### 2. 安裝依賴

```bash
pnpm install
```

### 3. 啟動開發伺服器

```bash
pnpm dev
```

### 4. 驗證功能

#### 4.1 公開首頁（無需登入）

```bash
# 開啟瀏覽器訪問首頁
open http://localhost:3000

# 預期：顯示套利機會歷史列表
```

#### 4.2 公開 API

```bash
# 查詢套利機會（預設參數）
curl http://localhost:3000/api/public/opportunities

# 指定時間範圍
curl "http://localhost:3000/api/public/opportunities?days=30"

# 分頁查詢
curl "http://localhost:3000/api/public/opportunities?page=2&limit=10"
```

#### 4.3 已登入用戶重導向

```bash
# 先登入取得 token
# 然後訪問首頁，應重導向到 /market-monitor
```

#### 4.4 速率限制測試

```bash
# 快速發送超過 30 次請求
for i in {1..35}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/public/opportunities
done

# 預期：前 30 次回傳 200，之後回傳 429
```

## 執行測試

### 單元測試

```bash
pnpm test run tests/unit/repositories/OpportunityEndHistoryRepository.public.test.ts
pnpm test run tests/unit/middleware/rateLimitMiddleware.test.ts
```

### 整合測試

```bash
pnpm test run tests/integration/api/public-opportunities.test.ts
```

### E2E 測試

```bash
pnpm test:e2e tests/e2e/public-landing-page.spec.ts
```

## 關鍵檔案

| 檔案 | 說明 |
|------|------|
| `app/page.tsx` | 公開首頁（Server Component） |
| `app/(public)/components/` | 公開頁面元件 |
| `app/api/public/opportunities/route.ts` | 公開 API endpoint |
| `src/repositories/OpportunityEndHistoryRepository.ts` | 資料存取（含 `findAllPublic`） |
| `src/middleware/rateLimitMiddleware.ts` | 速率限制中間件 |
| `src/lib/rate-limiter.ts` | 速率限制器 |

## 常見問題

### Q: 為什麼首頁顯示「目前暫無套利機會記錄」？

A: 資料庫中沒有 `OpportunityEndHistory` 記錄。確保：
1. CLI monitor 已執行過
2. 有套利機會被偵測並結束

### Q: 速率限制被觸發後要等多久？

A: 預設窗口為 1 分鐘。等待 60 秒後重試，或檢查回應的 `Retry-After` header。

### Q: 如何測試 SEO meta tags？

```bash
# 查看 HTML head 內容
curl http://localhost:3000 | head -100

# 或使用 Lighthouse
npx lighthouse http://localhost:3000 --only-categories=seo
```
