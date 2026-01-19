# Implementation Plan: 公開套利機會歷史首頁

**Branch**: `064-public-landing-page` | **Date**: 2026-01-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/064-public-landing-page/spec.md`

## Summary

建立一個不需登入即可訪問的公開首頁，展示系統監測到的歷史套利機會列表。技術方案採用 Next.js App Router 的 SSR 渲染支援 SEO，透過新增公開 API endpoint 查詢去識別化的 `OpportunityEndHistory` 資料，並實作 IP 速率限制保護。

## Technical Context

**Language/Version**: TypeScript 5.8 + Node.js 20.x LTS
**Primary Dependencies**: Next.js 15, React 19, Prisma 7.x, Tailwind CSS, Radix UI
**Storage**: PostgreSQL 15 + TimescaleDB（現有 `OpportunityEndHistory` 模型）
**Testing**: Vitest 4.x
**Target Platform**: Web (SSR)
**Project Type**: Web（Next.js App Router）
**Performance Goals**: 首頁初始載入 < 2 秒, 分頁切換 < 500ms, Lighthouse Performance 90+
**Constraints**: 每 IP 每分鐘 30 次請求限制, 最多顯示 90 天內資料
**Scale/Scope**: 公開頁面，預期較高流量

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Trading Safety First | ✅ N/A | 此功能為唯讀展示，不涉及交易 |
| II. Complete Observability | ✅ Pass | 使用 Pino structured logging |
| III. Defensive Programming | ✅ Pass | 需實作 API 錯誤處理和速率限制 |
| IV. Data Integrity | ✅ Pass | 無 schema 變更，使用現有模型 |
| V. Incremental Delivery | ✅ Pass | 獨立功能，可單獨部署測試 |
| VI. System Architecture | ✅ Pass | Web 僅讀取 DB 資料，符合架構邊界 |
| VII. TDD Discipline | ✅ Pass | 將遵循 Red-Green-Refactor 流程 |

**Gate Result**: ✅ PASS - 可進入 Phase 0

## Project Structure

### Documentation (this feature)

```
specs/064-public-landing-page/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api.md           # API 規格
└── tasks.md             # Phase 2 output (by /speckit.tasks)
```

### Source Code (repository root)

```
app/
├── page.tsx                           # 修改：公開首頁（SSR）
├── (public)/                          # 新增：公開路由群組
│   └── components/
│       ├── HeroSection.tsx            # 品牌區塊
│       ├── OpportunityList.tsx        # 套利機會列表
│       ├── OpportunityCard.tsx        # 單一機會卡片
│       ├── TimeRangeFilter.tsx        # 時間範圍篩選 (7/30/90 天)
│       ├── Pagination.tsx             # 分頁元件
│       └── PublicNav.tsx              # 公開頁導覽列
├── api/
│   └── public/
│       └── opportunities/
│           └── route.ts               # 新增：公開 API endpoint

src/
├── repositories/
│   └── OpportunityEndHistoryRepository.ts  # 修改：新增 findAllPublic 方法
├── middleware/
│   └── rateLimitMiddleware.ts         # 新增：IP 速率限制中間件
└── lib/
    └── rate-limiter.ts                # 新增：速率限制器（in-memory 或 Redis）

tests/
├── unit/
│   ├── middleware/
│   │   └── rateLimitMiddleware.test.ts
│   └── repositories/
│       └── OpportunityEndHistoryRepository.public.test.ts
└── integration/
    └── api/
        └── public-opportunities.test.ts
```

**Structure Decision**: 使用 Next.js App Router 的路由群組 `(public)` 來組織公開頁面元件，保持與現有 `(dashboard)` 和 `(auth)` 結構一致。

## Complexity Tracking

*No violations - no complexity justification needed.*

## Phase 0: Research Summary

### 現有資源分析

1. **OpportunityEndHistory 模型**
   - 已存在於 `prisma/schema.prisma`
   - Repository 已實作於 `src/repositories/OpportunityEndHistoryRepository.ts`
   - 現有 `findByUserId` 方法需擴展為公開查詢

2. **現有 API 模式**
   - 已有 `/api/opportunities/history` 私有 API（需認證）
   - 新增 `/api/public/opportunities` 公開 API（去識別化）

3. **速率限制**
   - 專案目前無通用速率限制中間件
   - 需新增 IP-based rate limiter

4. **首頁現狀**
   - 目前 `app/page.tsx` 僅做重導向
   - 需改為公開 landing page

### 技術決策

| Decision | Rationale | Alternatives Rejected |
|----------|-----------|----------------------|
| 使用 Next.js SSR | SEO 需求，首頁資料需被搜尋引擎索引 | CSR (無法 SEO)，ISR (資料即時性不足) |
| In-memory rate limiter | 簡單場景足夠，可後續升級 Redis | Redis (目前過度設計) |
| 路由群組 `(public)` | 與現有結構一致，便於維護 | 扁平結構 (混亂) |
| 去識別化 DTO | 保護用戶隱私，僅暴露市場數據 | 完整 DTO (洩漏隱私) |

## Phase 1: Design Artifacts

生成以下文件：
- `data-model.md` - 資料模型說明
- `contracts/api.md` - API 規格
- `quickstart.md` - 快速啟動指南
