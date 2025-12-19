# Implementation Plan: Prisma Client Singleton 優化

**Branch**: `039-prisma-singleton-refactor` | **Date**: 2025-12-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/039-specify-scripts-bash/spec.md`

## Summary

將專案中 23 個 API routes 和 2 個 repositories 中各自建立的 `new PrismaClient()` 替換為統一使用 `src/lib/db.ts` 匯出的 singleton 實例。此優化可減少資料庫連線數（從潛在 100+ 降至單一連線池）、啟用集中化慢查詢監控、並統一程式碼模式。

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**: Next.js 14 App Router, Prisma 5.x ORM
**Storage**: PostgreSQL 15 + TimescaleDB (via Docker Compose)
**Testing**: 手動整合測試（本次重構不新增自動化測試）
**Target Platform**: Linux server / Docker containers
**Project Type**: Web application (Next.js full-stack)
**Performance Goals**: 連線數維持在 10 條以內，慢查詢 (>100ms) 完整記錄
**Constraints**: 不修改 scripts/*.ts 和 tests/*.ts，不調整連線池大小
**Scale/Scope**: 25 個檔案需修改（23 API routes + 2 repositories）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Trading Safety First | ✅ PASS | 純重構，不影響交易邏輯 |
| II. Complete Observability | ✅ IMPROVES | 統一使用 singleton 後，慢查詢監控和錯誤記錄將覆蓋所有 API routes |
| III. Defensive Programming | ✅ PASS | singleton 已實作優雅關閉和重連機制 |
| IV. Data Integrity | ✅ PASS | 純重構，不修改 schema 或資料邏輯 |
| V. Incremental Delivery | ✅ PASS | 簡單重構，可逐檔案驗證 |
| VI. System Architecture | ✅ PASS | 不改變 CLI/Web 分離架構 |

**Gate Result**: ✅ PASSED - 無違規，可進行實作

## Project Structure

### Documentation (this feature)

```
specs/039-specify-scripts-bash/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output (研究筆記)
├── quickstart.md        # Phase 1 output (快速驗證指南)
└── tasks.md             # Phase 2 output (待 /speckit.tasks 產生)
```

### Source Code (修改範圍)

```
src/lib/
└── db.ts                # 現有 singleton 定義（不修改，僅作為引用來源）

app/api/                  # 23 個 API routes 需修改
├── opportunities/
│   ├── history/route.ts
│   └── history/[id]/route.ts
├── auth/
│   ├── register/route.ts
│   └── login/route.ts
├── trades/route.ts
├── api-keys/
│   ├── route.ts
│   └── [id]/route.ts
├── simulated-tracking/
│   ├── route.ts
│   ├── [id]/snapshots/route.ts
│   ├── [id]/stop/route.ts
│   └── [id]/route.ts
├── balances/route.ts
├── positions/
│   ├── route.ts
│   ├── open/route.ts
│   ├── [id]/route.ts
│   ├── [id]/market-data/route.ts
│   └── [id]/close/route.ts
├── assets/
│   ├── route.ts
│   ├── history/route.ts
│   └── positions/route.ts
├── notifications/webhooks/
│   ├── route.ts
│   ├── [id]/route.ts
│   └── [id]/test/route.ts
└── settings/trading/route.ts

src/repositories/         # 2 個 repositories 需修改
├── TradingSettingsRepository.ts
└── AuditLogRepository.ts
```

**Structure Decision**: 使用現有 Next.js App Router 結構，僅修改檔案內的 import 語句，不改變目錄結構。

## Complexity Tracking

*無需填寫 - 本次重構不違反任何 Constitution 原則*

## Implementation Strategy

### 修改模式

每個檔案的修改模式相同：

**Before**:
```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
```

**After**:
```typescript
import { prisma } from '@/src/lib/db';
```

### 驗證策略

1. **編譯驗證**: `pnpm build` 確認無 TypeScript 錯誤
2. **功能驗證**: 手動測試關鍵 API endpoints
3. **連線驗證**: 檢查資料庫連線數（應維持在單一連線池範圍內）

## Risk Assessment

| 風險 | 可能性 | 影響 | 緩解措施 |
|------|--------|------|----------|
| 循環依賴 | 低 | 中 | db.ts 無外部依賴，不會造成循環引用 |
| 初始化順序 | 低 | 中 | singleton 使用 globalThis 確保單一實例 |
| 開發模式熱重載 | 低 | 低 | singleton 已處理開發模式特殊邏輯 |
