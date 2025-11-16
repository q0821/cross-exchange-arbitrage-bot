# Data Model: 移除套利機會頁面與 API

**Feature**: 013-specify-scripts-bash
**Created**: 2025-01-21
**Phase**: 1 (Design & Contracts)

## Overview

此文件記錄被移除或廢棄的資料模型。這些模型將從應用代碼中刪除，但在資料庫 schema 中標記為 `@deprecated` 以保留歷史資料。

## Deprecated Models

### ArbitrageOpportunity (已廢棄)

**Purpose**: 記錄檢測到的套利機會

**Status**: 🗑️ DEPRECATED - 被 Market Monitor 即時監控替代

**Schema** (Prisma):
```prisma
/// @deprecated This model is deprecated. Use Market Monitor for real-time opportunities.
/// Historical data preserved for analysis. Last active: 2025-01-21.
model ArbitrageOpportunity {
  id                String   @id @default(uuid())
  symbol            String   // e.g., BTC/USDT:USDT
  longExchange      String   // Exchange to go long
  shortExchange     String   // Exchange to go short
  spreadPercent     Float    // Funding rate spread (%)
  spreadAnnualized  Float    // Annualized return (%)

  longRate          Float    // Long exchange funding rate
  shortRate         Float    // Short exchange funding rate
  longPrice         Float?   // Long exchange mark price
  shortPrice        Float?   // Short exchange mark price

  status            String   // 'detected', 'notified', 'expired'
  detectedAt        DateTime @default(now())
  expiredAt         DateTime?

  // Relationships
  history           OpportunityHistory[]

  @@index([symbol, status])
  @@index([detectedAt])
}
```

**Fields**:
- `id`: UUID 主鍵
- `symbol`: 交易對符號
- `longExchange`, `shortExchange`: 套利對 (做多/做空交易所)
- `spreadPercent`: 費率差異百分比
- `spreadAnnualized`: 年化收益率
- `longRate`, `shortRate`: 兩交易所的資金費率
- `longPrice`, `shortPrice`: 標記價格 (可選)
- `status`: 狀態 (detected/notified/expired)
- `detectedAt`, `expiredAt`: 時間戳

**Relationships**:
- `history`: 一對多關聯到 OpportunityHistory (狀態變更歷史)

**Replacement**: 市場監控頁面即時計算並顯示套利機會，不再持久化

---

### OpportunityHistory (已廢棄)

**Purpose**: 記錄套利機會的狀態變更歷史

**Status**: 🗑️ DEPRECATED - 隨 ArbitrageOpportunity 一併廢棄

**Schema** (Prisma):
```prisma
/// @deprecated This model is deprecated along with ArbitrageOpportunity.
/// Historical data preserved for analysis. Last active: 2025-01-21.
model OpportunityHistory {
  id              String              @id @default(uuid())
  opportunityId   String
  opportunity     ArbitrageOpportunity @relation(fields: [opportunityId], references: [id], onDelete: Cascade)

  fromStatus      String?  // Previous status
  toStatus        String   // New status
  reason          String?  // Reason for status change
  metadata        Json?    // Additional context (spread change, expiry reason, etc.)

  recordedAt      DateTime @default(now())

  @@index([opportunityId])
  @@index([recordedAt])
}
```

**Fields**:
- `id`: UUID 主鍵
- `opportunityId`: 外鍵關聯到 ArbitrageOpportunity
- `fromStatus`, `toStatus`: 狀態轉換
- `reason`: 變更原因
- `metadata`: JSON 格式的額外資訊
- `recordedAt`: 記錄時間

**Relationships**:
- `opportunity`: 多對一關聯到 ArbitrageOpportunity

**Replacement**: 無需歷史追蹤，市場監控提供即時狀態

---

## Retained Models (Not Affected)

以下模型**不受影響**，繼續正常使用：

### FundingRate

**Purpose**: 記錄交易所資金費率時間序列

**Status**: ✅ ACTIVE - 被 Market Monitor 和 FundingRateMonitor 使用

**Usage**:
- FundingRateMonitor 寫入
- Market Monitor 讀取 (透過 RatesCache)

---

### User

**Purpose**: 用戶帳戶管理

**Status**: ✅ ACTIVE - Web 登入和認證使用

---

### ApiKey

**Purpose**: 用戶 API 金鑰管理

**Status**: ✅ ACTIVE - 未來交易功能需要

---

## Data Migration Plan

### Phase 1: Schema Update (Deprecation Marking)

**File**: `prisma/schema.prisma`

**Changes**:
```diff
+/// @deprecated This model is deprecated. Use Market Monitor for real-time opportunities.
+/// Historical data preserved for analysis. Last active: 2025-01-21.
 model ArbitrageOpportunity {
   // ... existing schema
 }

+/// @deprecated This model is deprecated along with ArbitrageOpportunity.
+/// Historical data preserved for analysis. Last active: 2025-01-21.
 model OpportunityHistory {
   // ... existing schema
 }
```

**Rationale**:
- `@deprecated` 註解清楚標記意圖
- JSDoc-style 註解，Prisma 會保留在生成的類型中
- 包含廢棄日期和原因說明

### Phase 2: No Database Migration

**Decision**: **不執行 DROP TABLE migration**

**Rationale**:
- 保留歷史資料用於未來分析
- 遵循 Constitution Principle IV (Data Integrity)
- 資料量小 (< 10 MB)，保留成本可忽略

**Verification**:
```sql
-- Verify data still accessible
SELECT COUNT(*) FROM "ArbitrageOpportunity";
SELECT COUNT(*) FROM "OpportunityHistory";

-- Check latest opportunities (historical analysis)
SELECT * FROM "ArbitrageOpportunity"
ORDER BY "detectedAt" DESC
LIMIT 10;
```

### Phase 3: Code Cleanup

**Files to Delete**:
- `src/models/ArbitrageOpportunity.ts` ❌
- `src/models/OpportunityHistory.ts` ❌
- `src/repositories/ArbitrageOpportunityRepository.ts` ❌
- `src/repositories/OpportunityHistoryRepository.ts` ❌

**Rationale**:
- Prisma Client 仍會生成這些模型的類型 (從 schema)
- 但應用代碼中不再使用
- 若未來需要查詢歷史資料，可直接使用 Prisma Client generated types

---

## Impact Analysis

### Database Size Impact

**Before Removal**:
- ArbitrageOpportunity: ~5,000 records, ~2 MB
- OpportunityHistory: ~15,000 records, ~5 MB
- Total: ~7 MB

**After Removal**:
- No new records written
- Historical data preserved
- No size reduction (data retained)

**Conclusion**: ✅ 無負面影響

### Query Performance Impact

**Before**:
- OpportunityDetector 查詢: ~10 qps (inserts/updates)
- Opportunities API 查詢: ~2 qps (selects)

**After**:
- 減少 ~12 qps 資料庫負載
- TimescaleDB hypertable 資源釋放

**Conclusion**: ✅ 輕微性能提升

### Backup & Recovery

**Concern**: 若需要恢復功能怎麼辦？

**Mitigation**:
1. Git history 保留所有代碼
2. Database schema 保留，資料完整
3. 可隨時從 `git log` 找回相關 commits
4. 估計恢復時間：2-4 小時

**Conclusion**: ✅ 恢復可行性高

---

## Future Considerations

### Archival Strategy (Optional)

若未來資料庫空間成為問題，可考慮：

**Option 1: Export to JSON**
```bash
npx prisma db execute --stdin < export-opportunities.sql > opportunities-archive.json
```

**Option 2: Move to Archive Table**
```sql
CREATE TABLE archived_opportunities AS SELECT * FROM "ArbitrageOpportunity";
CREATE TABLE archived_opportunity_history AS SELECT * FROM "OpportunityHistory";
```

**Option 3: TimescaleDB Data Retention Policy**
```sql
-- Auto-delete records older than 1 year
SELECT add_retention_policy('ArbitrageOpportunity', INTERVAL '1 year');
```

**Recommendation**: 暫不執行，觀察 6 個月後再決定

---

## Summary

| Model | Status | Action | Data Retained? |
|-------|--------|--------|----------------|
| ArbitrageOpportunity | Deprecated | Mark @deprecated in schema | ✅ Yes |
| OpportunityHistory | Deprecated | Mark @deprecated in schema | ✅ Yes |
| FundingRate | Active | No change | ✅ Yes |
| User | Active | No change | ✅ Yes |
| ApiKey | Active | No change | ✅ Yes |

**Key Principle**: 移除代碼，保留資料 (Remove code, preserve data)
