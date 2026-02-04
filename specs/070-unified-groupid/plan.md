# Implementation Plan: 統一持倉 groupId 架構

**Branch**: `070-unified-groupid` | **Date**: 2026-01-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/070-unified-groupid/spec.md`

## Summary

將所有持倉統一使用 groupId（必填 UUID），不再區分單獨開倉（null）和分單開倉。這是一個架構重構，目標是統一資料結構、API 回應格式和前端顯示邏輯。需要 Prisma migration 將現有 null groupId 的持倉補上獨立 UUID。

## Technical Context

**Language/Version**: TypeScript 5.8+ / Node.js 20.x LTS
**Primary Dependencies**: Prisma 7.x, Next.js 15, React 19, CCXT 4.x
**Storage**: PostgreSQL 15+ with TimescaleDB
**Testing**: Vitest 4.x
**Target Platform**: Linux server (backend) + Web browser (frontend)
**Project Type**: Web application (backend + frontend)
**Performance Goals**: 維持現有效能，無新增效能需求
**Constraints**: Migration 必須向後相容，不可破壞現有資料
**Scale/Scope**: 現有 Position 資料表約數百筆，影響 ~11 個檔案

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 狀態 | 說明 |
|------|------|------|
| 原則一：交易安全優先 | ✅ PASS | 此為架構重構，不影響交易執行邏輯 |
| 原則二：完整可觀測性 | ✅ PASS | 無需新增日誌，現有日誌已足夠 |
| 原則三：防禦性程式設計 | ✅ PASS | 使用現有 Factory pattern |
| 原則四：資料完整性 | ✅ PASS | 必須使用 Prisma Migration |
| 原則五：漸進式交付 | ✅ PASS | 可分階段實作（Migration → API → Frontend） |
| 原則六：系統架構邊界 | ✅ PASS | 不改變 CLI/Web/DB 職責劃分 |
| 原則七：TDD | ✅ PASS | 必須先寫測試再實作 |

**Migration 注意事項**（原則四強制）：
- 必須使用 `prisma migrate dev` 產生 migration 檔案
- Schema 變更必須與 migration 檔案同一個 commit
- 禁止手動編輯已產生的 migration SQL

## Project Structure

### Documentation (this feature)

```text
specs/070-unified-groupid/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code (affected files)

```text
# Database Schema
prisma/schema.prisma                    # groupId: String? → String

# Backend Services
src/services/trading/PositionGroupService.ts    # 移除 null 處理邏輯
src/services/trading/PositionOrchestrator.ts    # 單獨開倉也生成 groupId
src/lib/position-group.ts                       # 簡化分組邏輯

# Types
src/types/position-group.ts             # 更新 PositionStatusFilter
src/types/trading.ts                    # PositionInfo.groupId 必填

# API Routes
app/api/positions/route.ts              # 統一回應格式

# Frontend
app/(dashboard)/positions/              # 統一顯示邏輯

# Tests
tests/unit/services/PositionGroupService.test.ts
tests/unit/lib/position-group.test.ts
tests/integration/position-group-*.test.ts
```

**Structure Decision**: 使用現有 Web application 結構，不新增目錄。

## Complexity Tracking

> 無違規需要說明，此重構簡化了現有複雜度。

| 簡化項目 | 說明 |
|----------|------|
| 資料結構統一 | groupId 從 nullable 變 required，減少 null check |
| API 回應統一 | 移除 positions/groups 雙格式，只保留 groups |
| 前端邏輯統一 | 移除條件渲染邏輯 |
