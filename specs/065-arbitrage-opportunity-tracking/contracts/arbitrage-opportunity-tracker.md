# Service Contract: ArbitrageOpportunityTracker

**Feature**: 065-arbitrage-opportunity-tracking
**Date**: 2026-01-19
**Last Updated**: 2026-01-19

## 概述

`ArbitrageOpportunityTracker` 負責監聽 `FundingRateMonitor` 的費率更新事件並記錄套利機會到資料庫。

### 獨立生命週期設計（2026-01-19）

**設計決策**：本追蹤器採用**獨立的生命週期邏輯**，不依賴 `FundingRateMonitor` 的 `opportunity-detected` / `opportunity-disappeared` 事件。

**原因**：
- 避免與其他功能（Feature 022, 026, 027, 029）的閾值邏輯耦合
- 修改 Feature 065 的判斷條件不會影響其他服務
- 可獨立調整 Feature 065 的閾值設定

**實作方式**：
- 監聽 `rate-updated` 事件而非 `opportunity-detected`
- 使用 `TRACKER_OPPORTUNITY_THRESHOLD`（定義於 `src/lib/constants.ts`）獨立判斷
- 自行維護活躍機會的追蹤狀態（`activeOpportunities` Map）

## Interface Definition

```typescript
interface ArbitrageOpportunityTracker {
  /**
   * 初始化追蹤器，綁定到 FundingRateMonitor 實例
   * 監聽 rate-updated 事件
   */
  attach(monitor: EventEmitter): void;

  /**
   * 解除綁定
   */
  detach(): void;

  /**
   * 處理費率更新事件（主要邏輯）
   * 獨立判斷機會狀態並記錄
   */
  handleRateUpdated(pair: FundingRatePair): Promise<void>;

  /**
   * @deprecated 改用 handleRateUpdated 實作獨立邏輯
   */
  handleOpportunityDetected(pair: FundingRatePair): Promise<void>;

  /**
   * @deprecated 改用 handleRateUpdated 實作獨立邏輯
   */
  handleOpportunityDisappeared(symbol: string): Promise<void>;

  /**
   * 取得追蹤器統計
   */
  getStats(): TrackerStats;

  /**
   * 取得目前活躍機會數量
   */
  getActiveOpportunitiesCount(): number;

  /**
   * 取得機會發現閾值
   */
  getThreshold(): number;

  /**
   * 取得機會結束閾值
   */
  getEndThreshold(): number;
}

interface TrackerStats {
  opportunitiesRecorded: number;
  opportunitiesEnded: number;
  lastRecordedAt: Date | null;
  errors: number;
}
```

## 常數定義

```typescript
// src/lib/constants.ts

/**
 * ArbitrageOpportunityTracker 機會發現門檻（百分比）
 *
 * Feature 065 獨立的生命週期邏輯，不依賴其他服務的閾值設定
 * 當年化收益 >= 此值時，判定為套利機會並記錄
 *
 * 預設值: 800% 年化收益
 */
export const TRACKER_OPPORTUNITY_THRESHOLD = 800;

/**
 * ArbitrageOpportunityTracker 機會結束門檻（百分比）
 *
 * Feature 065 獨立的生命週期邏輯
 * 當年化收益 < 此值時，判定機會結束
 *
 * 預設值: 0%（只有當 APY 變為負值時才結束）
 */
export const TRACKER_OPPORTUNITY_END_THRESHOLD = 0;
```

### 雙閾值設計說明

| 閾值 | 數值 | 說明 |
|------|------|------|
| 發現閾值 | 800% | APY >= 800% 時觸發新機會記錄 |
| 結束閾值 | 0% | APY < 0% 時結束機會追蹤 |
| 中間區間 | 0% ~ 800% | 已追蹤的機會持續維持，未追蹤則不觸發 |

這種設計避免機會在閾值邊緣頻繁開啟/關閉，提供更穩定的追蹤行為。

## Input Types

### FundingRatePair (來自現有系統)

```typescript
interface FundingRatePair {
  symbol: string;
  timestamp: Date;
  exchanges: Map<string, ExchangeRate>;
  bestPair?: {
    longExchange: string;
    shortExchange: string;
    longRate: number;
    shortRate: number;
    spreadPercent: number;       // 費率差（百分比）
    spreadAnnualized: number;    // 年化報酬率（百分比）
    priceDiffPercent: number;
    longIntervalHours: number;
    shortIntervalHours: number;
  };
  // ... 其他欄位
}
```

## 行為規範

### attach()

綁定到 FundingRateMonitor 並開始監聽 `rate-updated` 事件（非 `opportunity-detected`）。

```typescript
attach(monitor: EventEmitter): void {
  this.monitor = monitor;
  this.boundHandleRateUpdated = this.handleRateUpdated.bind(this);

  // 監聽 rate-updated 事件（獨立邏輯）
  monitor.on('rate-updated', this.boundHandleRateUpdated);

  logger.info(
    { threshold: this.opportunityThreshold },
    'ArbitrageOpportunityTracker attached with independent lifecycle logic'
  );
}
```

### handleRateUpdated()（主要邏輯）

處理費率更新事件，獨立判斷機會狀態。

**判斷邏輯（雙閾值設計）**:
1. 計算當前 APY（年化報酬率）
2. 如果 APY >= 800% 且 尚未追蹤 → 記錄新機會
3. 如果已在追蹤 且 APY >= 0% → 更新機會（維持追蹤）
4. 如果已在追蹤 且 APY < 0% → 結束機會
5. 如果 APY 在 0% ~ 800% 之間 且 尚未追蹤 → 不觸發

**內部追蹤狀態**:
```typescript
type OpportunityKey = string; // 格式: symbol:longExchange:shortExchange

interface ActiveOpportunity {
  symbol: string;
  longExchange: string;
  shortExchange: string;
  lastSpread: number;
  lastAPY: number;
  detectedAt: Date;
}

private activeOpportunities: Map<OpportunityKey, ActiveOpportunity> = new Map();
```

**處理流程**:

```typescript
async handleRateUpdated(pair: FundingRatePair): Promise<void> {
  if (!pair.bestPair) {
    return; // 沒有 bestPair 無法判斷
  }

  const { symbol, bestPair } = pair;
  const { longExchange, shortExchange, spreadAnnualized: apy, spreadPercent: spread } = bestPair;

  const key = this.getOpportunityKey(symbol, longExchange, shortExchange);
  const isCurrentlyTracked = this.activeOpportunities.has(key);
  const isNewOpportunity = this.isOpportunityForTracking(apy);  // APY >= 800%
  const shouldEnd = this.shouldEndOpportunity(apy);             // APY < 0%

  try {
    if (isNewOpportunity && !isCurrentlyTracked) {
      // 情況 1：新機會發現（APY >= 800% 且尚未追蹤）
      await this.recordNewOpportunity({ ... });
      this.activeOpportunities.set(key, { ... });
      logger.info({ ... }, '[Feature 065] New opportunity detected');
    } else if (isCurrentlyTracked && shouldEnd) {
      // 情況 2：機會結束（已追蹤 且 APY < 0%）
      await this.endOpportunity(...);
      this.activeOpportunities.delete(key);
      logger.info({ ... }, '[Feature 065] Opportunity ended (APY below end threshold)');
    } else if (isCurrentlyTracked) {
      // 情況 3：更新現有機會（已追蹤 且 APY >= 0%）
      await this.updateOpportunity({ ... });
    }
    // 情況 4：APY 在 0% ~ 800% 且未追蹤 → 不做任何事
  } catch (error) {
    this.stats.errors++;
    logger.error({ ... }, '[Feature 065] Failed to process rate update');
  }
}

// 判斷是否為新機會（發現閾值）
private isOpportunityForTracking(apy: number): boolean {
  return apy >= this.opportunityThreshold;  // 800%
}

// 判斷是否應結束機會（結束閾值）
private shouldEndOpportunity(apy: number): boolean {
  return apy < this.opportunityEndThreshold;  // 0%
}
```

### handleOpportunityDetected() (Deprecated)

保留向後相容，內部轉發到 `handleRateUpdated()`。

```typescript
/**
 * @deprecated 改用 handleRateUpdated 實作獨立邏輯
 */
async handleOpportunityDetected(pair: FundingRatePair): Promise<void> {
  await this.handleRateUpdated(pair);
}
```

### handleOpportunityDisappeared() (Deprecated)

保留向後相容，處理舊的事件格式。

```typescript
/**
 * @deprecated 改用 handleRateUpdated 實作獨立邏輯
 */
async handleOpportunityDisappeared(symbol: string): Promise<void> {
  // 找出該 symbol 所有活躍機會並結束
  const keysToEnd: OpportunityKey[] = [];

  for (const [key, tracked] of this.activeOpportunities.entries()) {
    if (tracked.symbol === symbol) {
      keysToEnd.push(key);
    }
  }

  for (const key of keysToEnd) {
    const tracked = this.activeOpportunities.get(key)!;
    await this.endOpportunity(...);
    this.activeOpportunities.delete(key);
    logger.info({ ... }, '[Feature 065] Opportunity ended via legacy event');
  }
}
```

## 整合方式

### 在 MonitorService 中初始化

```typescript
// src/services/MonitorService.ts

import { ArbitrageOpportunityTracker } from './monitor/ArbitrageOpportunityTracker';
import { ArbitrageOpportunityRepository } from '../repositories/ArbitrageOpportunityRepository';

class MonitorService {
  private tracker?: ArbitrageOpportunityTracker;

  async start() {
    // ... 現有邏輯 ...

    // 初始化套利機會追蹤器（獨立生命週期）
    const repository = new ArbitrageOpportunityRepository(prisma);
    this.tracker = new ArbitrageOpportunityTracker(repository);
    this.tracker.attach(this.monitor);

    logger.info(
      { threshold: this.tracker.getThreshold() },
      'ArbitrageOpportunityTracker initialized with independent lifecycle'
    );
  }

  async stop() {
    // ... 現有邏輯 ...

    if (this.tracker) {
      this.tracker.detach();
      logger.info('ArbitrageOpportunityTracker detached');
    }
  }
}
```

## 日誌格式

### 新機會偵測

```json
{
  "level": "info",
  "msg": "[Feature 065] New opportunity detected",
  "symbol": "BTCUSDT",
  "longExchange": "binance",
  "shortExchange": "okx",
  "apy": 850.5,
  "spread": 0.0097,
  "threshold": 800
}
```

### 機會結束

```json
{
  "level": "info",
  "msg": "[Feature 065] Opportunity ended (APY below threshold)",
  "symbol": "BTCUSDT",
  "longExchange": "binance",
  "shortExchange": "okx",
  "lastAPY": 810.2,
  "currentAPY": 750.3,
  "threshold": 800,
  "durationMs": 8100000
}
```

### 錯誤

```json
{
  "level": "error",
  "msg": "[Feature 065] Failed to process rate update",
  "symbol": "BTCUSDT",
  "longExchange": "binance",
  "shortExchange": "okx",
  "error": "Database connection failed"
}
```

## 測試要求

1. **單元測試**:
   - `attach()` 正確綁定 `rate-updated` 事件
   - `detach()` 正確解除綁定
   - `handleRateUpdated()` APY >= 800% 且未追蹤時記錄新機會
   - `handleRateUpdated()` APY >= 800% 且已追蹤時更新機會
   - `handleRateUpdated()` APY 在 0% ~ 800% 且已追蹤時更新機會（維持追蹤）
   - `handleRateUpdated()` APY < 0% 且已追蹤時結束機會
   - `handleRateUpdated()` APY 在 0% ~ 800% 且未追蹤時不做任何事
   - `handleRateUpdated()` 無 bestPair 時跳過
   - `handleRateUpdated()` 資料庫錯誤時不中斷
   - `handleOpportunityDetected()` 轉發到 handleRateUpdated（deprecated）
   - `handleOpportunityDisappeared()` 結束該 symbol 所有機會（deprecated）
   - `getStats()` 回傳正確統計
   - `getActiveOpportunitiesCount()` 回傳正確數量
   - `getThreshold()` 回傳發現閾值（800%）
   - `getEndThreshold()` 回傳結束閾值（0%）

2. **整合測試**:
   - 與真實 FundingRateMonitor 整合（監聯 rate-updated）
   - 獨立生命週期追蹤（不受其他服務閾值影響）
   - 雙閾值行為驗證（發現 800%，結束 0%）

## 與其他功能的關係

| Feature | 關係 | 說明 |
|---------|------|------|
| 022 | 獨立 | 不依賴其閾值邏輯，使用 `TRACKER_OPPORTUNITY_THRESHOLD` |
| 026 | 獨立 | 通知服務使用自己的閾值，不影響本追蹤器 |
| 027 | 獨立 | FundingRateMonitor 的判斷邏輯不影響本追蹤器 |
| 029 | 獨立 | RatesCache 的數據用於 UI 顯示，不影響本追蹤器邏輯 |
