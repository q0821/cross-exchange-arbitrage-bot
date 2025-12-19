# Research: 手動標記持倉已平倉

**Feature**: 037-mark-position-closed
**Date**: 2025-12-19

## Technical Decisions

### 1. API 設計

**Decision**: 使用 PATCH /api/positions/[id] 端點

**Rationale**:
- PATCH 語義符合部分更新 (只更新 status 和 closedAt)
- RESTful 設計與現有 API 一致
- 使用 body 傳遞 action 參數而非 query string

**Alternatives considered**:
- POST /api/positions/[id]/mark-closed - 過於具體，不符合 REST 風格
- PUT /api/positions/[id] - 語義為完整替換，不適合部分更新

### 2. 狀態驗證

**Decision**: 在 API 層驗證狀態轉換規則

**Rationale**:
- 安全性：防止非法狀態轉換
- 明確：只允許 OPEN、PARTIAL、FAILED → CLOSED
- 清晰的錯誤訊息

**Alternatives considered**:
- 資料庫層約束 - 過於複雜且難以提供友善錯誤訊息
- 前端驗證 - 不足夠，必須有後端驗證

### 3. 用戶授權

**Decision**: 使用現有 authenticate 中間件 + 所有權驗證

**Rationale**:
- 複用現有認證機制
- 在查詢時檢查 userId 確保只能標記自己的持倉

**Alternatives considered**:
- 新增專用中間件 - 不必要，現有機制足夠

### 4. UI 按鈕位置

**Decision**: 在 PositionCard 組件內，平倉按鈕下方新增「標記已平倉」按鈕

**Rationale**:
- 視覺層次：平倉按鈕為主要操作，標記為次要操作
- 使用灰色系區分功能

**Alternatives considered**:
- 下拉選單 - 過於複雜
- 右鍵選單 - 不直觀

## No Clarifications Needed

此功能範圍小且明確，無需額外澄清：
- 技術棧：使用現有 Next.js + Prisma 模式
- API 設計：標準 RESTful PATCH
- UI 設計：簡單按鈕，無需確認對話框
