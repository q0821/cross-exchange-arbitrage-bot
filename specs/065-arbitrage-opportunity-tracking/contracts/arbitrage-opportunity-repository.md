# Repository Contract: ArbitrageOpportunityRepository

**Feature**: 065-arbitrage-opportunity-tracking
**Date**: 2026-01-18

## 概述

`ArbitrageOpportunityRepository` 負責 `ArbitrageOpportunity` 資料模型的 CRUD 操作。

## Interface Definition

```typescript
interface ArbitrageOpportunityRepository {
  /**
   * 建立新的套利機會記錄
   */
  create(data: CreateOpportunityInput): Promise<ArbitrageOpportunity>;

  /**
   * 更新進行中的機會
   */
  update(id: string, data: UpdateOpportunityInput): Promise<ArbitrageOpportunity>;

  /**
   * 查找進行中的機會（依據 symbol + exchanges 組合）
   */
  findActiveByKey(
    symbol: string,
    longExchange: string,
    shortExchange: string
  ): Promise<ArbitrageOpportunity | null>;

  /**
   * 將機會標記為已結束
   */
  markAsEnded(
    symbol: string,
    longExchange: string,
    shortExchange: string,
    finalSpread: number,
    finalAPY: number
  ): Promise<ArbitrageOpportunity | null>;

  /**
   * 建立或更新機會（用於定期更新）
   */
  upsert(data: UpsertOpportunityInput): Promise<ArbitrageOpportunity>;

  /**
   * 查詢公開機會列表（用於 API）
   */
  getPublicOpportunities(options: PublicOpportunitiesOptions): Promise<{
    opportunities: ArbitrageOpportunity[];
    total: number;
  }>;

  /**
   * 統計數據
   */
  getStats(): Promise<{
    activeCount: number;
    endedCount: number;
    avgDurationMs: number;
  }>;
}
```

## Input Types

### CreateOpportunityInput

```typescript
interface CreateOpportunityInput {
  symbol: string;
  longExchange: string;
  shortExchange: string;
  initialSpread: number;
  currentSpread: number;
  initialAPY: number;
  currentAPY: number;
  longIntervalHours: number;
  shortIntervalHours: number;
}
```

### UpdateOpportunityInput

```typescript
interface UpdateOpportunityInput {
  currentSpread?: number;
  currentAPY?: number;
  maxSpread?: number;
  maxSpreadAt?: Date;
  maxAPY?: number;
}
```

### UpsertOpportunityInput

```typescript
interface UpsertOpportunityInput {
  symbol: string;
  longExchange: string;
  shortExchange: string;
  spread: number;
  apy: number;
  longIntervalHours: number;
  shortIntervalHours: number;
}
```

### PublicOpportunitiesOptions

```typescript
interface PublicOpportunitiesOptions {
  days?: number;          // 預設 7
  page?: number;          // 預設 1
  limit?: number;         // 預設 20
  status?: 'ACTIVE' | 'ENDED' | 'all';  // 預設顯示 ENDED
}
```

## Output Type

```typescript
interface ArbitrageOpportunity {
  id: string;
  symbol: string;
  longExchange: string;
  shortExchange: string;
  status: 'ACTIVE' | 'ENDED';
  detectedAt: Date;
  endedAt: Date | null;
  durationMs: bigint | null;
  initialSpread: Decimal;
  maxSpread: Decimal;
  maxSpreadAt: Date;
  currentSpread: Decimal;
  initialAPY: Decimal;
  maxAPY: Decimal;
  currentAPY: Decimal;
  longIntervalHours: number;
  shortIntervalHours: number;
  createdAt: Date;
  updatedAt: Date;
}
```

## 方法說明

### create()

建立新的 ACTIVE 狀態機會記錄。

**行為**:
- 設定 `status = ACTIVE`
- 設定 `maxSpread = initialSpread`
- 設定 `maxSpreadAt = now()`
- 設定 `maxAPY = initialAPY`

**錯誤處理**:
- 若已存在相同 key 的 ACTIVE 記錄，拋出 `UniqueConstraintViolation`

### findActiveByKey()

根據 symbol + longExchange + shortExchange 查找 ACTIVE 狀態的記錄。

**行為**:
- 回傳 ACTIVE 狀態的單一記錄
- 找不到則回傳 `null`

### markAsEnded()

將進行中的機會標記為已結束。

**行為**:
1. 查找 ACTIVE 狀態的記錄
2. 更新 `status = ENDED`
3. 設定 `endedAt = now()`
4. 計算並設定 `durationMs = endedAt - detectedAt`
5. 更新 `currentSpread` 和 `currentAPY` 為最終值

**錯誤處理**:
- 若找不到 ACTIVE 記錄，回傳 `null`

### upsert()

建立或更新機會記錄（原子操作）。

**行為**:
- 若不存在 ACTIVE 記錄 → 建立新記錄
- 若存在 ACTIVE 記錄 → 更新 `currentSpread`, `currentAPY`，必要時更新 `maxSpread`, `maxAPY`

### getPublicOpportunities()

查詢公開機會列表，支援分頁和時間篩選。

**行為**:
- 依據 `status` 篩選（預設 ENDED）
- 依據 `days` 篩選時間範圍
- 依據 `endedAt` 或 `detectedAt` 降序排序
- 回傳分頁結果和總數

## 使用範例

```typescript
const repository = new ArbitrageOpportunityRepository(prisma);

// 建立新機會
const opportunity = await repository.create({
  symbol: 'BTCUSDT',
  longExchange: 'binance',
  shortExchange: 'okx',
  initialSpread: 0.75,
  currentSpread: 0.75,
  initialAPY: 273.75,
  currentAPY: 273.75,
  longIntervalHours: 8,
  shortIntervalHours: 8,
});

// 更新機會
await repository.update(opportunity.id, {
  currentSpread: 0.85,
  currentAPY: 310.25,
  maxSpread: 0.85,
  maxSpreadAt: new Date(),
  maxAPY: 310.25,
});

// 標記結束
await repository.markAsEnded(
  'BTCUSDT',
  'binance',
  'okx',
  0.48,  // finalSpread
  175.2  // finalAPY
);

// 查詢公開機會
const { opportunities, total } = await repository.getPublicOpportunities({
  days: 7,
  page: 1,
  limit: 20,
  status: 'ENDED',
});
```

## 測試要求

1. **單元測試**:
   - `create()` 正常建立
   - `create()` 重複 key 錯誤處理
   - `findActiveByKey()` 找到/找不到
   - `markAsEnded()` 正常結束
   - `markAsEnded()` 找不到 ACTIVE 記錄
   - `upsert()` 建立新記錄
   - `upsert()` 更新現有記錄
   - `getPublicOpportunities()` 分頁
   - `getPublicOpportunities()` 時間篩選

2. **整合測試**:
   - 完整生命週期：create → update → markAsEnded
   - 並發更新處理
