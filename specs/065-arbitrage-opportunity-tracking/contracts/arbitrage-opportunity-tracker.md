# Service Contract: ArbitrageOpportunityTracker

**Feature**: 065-arbitrage-opportunity-tracking
**Date**: 2026-01-18

## 概述

`ArbitrageOpportunityTracker` 負責監聽 `FundingRateMonitor` 事件並記錄套利機會到資料庫。

## Interface Definition

```typescript
interface ArbitrageOpportunityTracker {
  /**
   * 初始化追蹤器，綁定到 FundingRateMonitor 實例
   */
  attach(monitor: FundingRateMonitor): void;

  /**
   * 解除綁定
   */
  detach(): void;

  /**
   * 處理機會偵測事件
   */
  handleOpportunityDetected(pair: FundingRatePair): Promise<void>;

  /**
   * 處理機會消失事件
   */
  handleOpportunityDisappeared(symbol: string): Promise<void>;

  /**
   * 取得追蹤器統計
   */
  getStats(): TrackerStats;
}

interface TrackerStats {
  opportunitiesRecorded: number;
  opportunitiesEnded: number;
  lastRecordedAt: Date | null;
  errors: number;
}
```

## Input Types

### FundingRatePair (來自現有系統)

```typescript
interface FundingRatePair {
  symbol: string;
  timestamp: Date;
  bestPair?: {
    longExchange: string;
    shortExchange: string;
    longRate: number;
    shortRate: number;
    spreadPercent: number;
    priceDiffPercent: number;
    annualizedReturn: number;
    longIntervalHours: number;
    shortIntervalHours: number;
  };
  // ... 其他欄位
}
```

## 行為規範

### attach()

綁定到 FundingRateMonitor 並開始監聽事件。

```typescript
attach(monitor: FundingRateMonitor): void {
  this.monitor = monitor;
  monitor.on('opportunity-detected', this.handleOpportunityDetected);
  monitor.on('opportunity-disappeared', this.handleOpportunityDisappeared);
}
```

### handleOpportunityDetected()

處理新機會或更新現有機會。

**流程**:
1. 從 `pair.bestPair` 提取資料
2. 驗證 `bestPair` 存在
3. 呼叫 `repository.upsert()` 建立或更新記錄
4. 更新統計
5. 記錄日誌

**錯誤處理**:
- 資料庫錯誤不應中斷監測服務
- 記錄錯誤到日誌並增加錯誤計數

```typescript
async handleOpportunityDetected(pair: FundingRatePair): Promise<void> {
  if (!pair.bestPair) {
    logger.warn({ symbol: pair.symbol }, 'Opportunity detected but bestPair is missing');
    return;
  }

  try {
    await this.repository.upsert({
      symbol: pair.symbol,
      longExchange: pair.bestPair.longExchange,
      shortExchange: pair.bestPair.shortExchange,
      spread: pair.bestPair.spreadPercent,
      apy: pair.bestPair.annualizedReturn,
      longIntervalHours: pair.bestPair.longIntervalHours,
      shortIntervalHours: pair.bestPair.shortIntervalHours,
    });

    this.stats.opportunitiesRecorded++;
    this.stats.lastRecordedAt = new Date();

    logger.info({
      symbol: pair.symbol,
      longExchange: pair.bestPair.longExchange,
      shortExchange: pair.bestPair.shortExchange,
      spread: pair.bestPair.spreadPercent,
    }, 'Opportunity recorded');

  } catch (error) {
    this.stats.errors++;
    logger.error({
      symbol: pair.symbol,
      error: error instanceof Error ? error.message : String(error),
    }, 'Failed to record opportunity');
    // 不拋出錯誤，允許監測繼續
  }
}
```

### handleOpportunityDisappeared()

處理機會消失事件。

**流程**:
1. 查找所有 ACTIVE 狀態且 symbol 匹配的記錄
2. 對每筆記錄呼叫 `repository.markAsEnded()`
3. 更新統計
4. 記錄日誌

**注意**:
- 可能有多個 ACTIVE 記錄（不同交易所組合）
- 只結束 symbol 匹配的所有 ACTIVE 記錄

```typescript
async handleOpportunityDisappeared(symbol: string): Promise<void> {
  try {
    // 查找該 symbol 所有 ACTIVE 機會
    const activeOpportunities = await this.repository.findAllActiveBySymbol(symbol);

    for (const opportunity of activeOpportunities) {
      await this.repository.markAsEnded(
        opportunity.symbol,
        opportunity.longExchange,
        opportunity.shortExchange,
        opportunity.currentSpread.toNumber(),
        opportunity.currentAPY.toNumber()
      );

      this.stats.opportunitiesEnded++;

      logger.info({
        id: opportunity.id,
        symbol: opportunity.symbol,
        longExchange: opportunity.longExchange,
        shortExchange: opportunity.shortExchange,
        durationMs: Date.now() - opportunity.detectedAt.getTime(),
      }, 'Opportunity ended');
    }

  } catch (error) {
    this.stats.errors++;
    logger.error({
      symbol,
      error: error instanceof Error ? error.message : String(error),
    }, 'Failed to end opportunity');
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

    // 初始化套利機會追蹤器
    const repository = new ArbitrageOpportunityRepository(prisma);
    this.tracker = new ArbitrageOpportunityTracker(repository);
    this.tracker.attach(this.monitor);

    logger.info('ArbitrageOpportunityTracker initialized');
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

### 機會記錄成功

```json
{
  "level": "info",
  "msg": "Opportunity recorded",
  "symbol": "BTCUSDT",
  "longExchange": "binance",
  "shortExchange": "okx",
  "spread": 0.75
}
```

### 機會結束

```json
{
  "level": "info",
  "msg": "Opportunity ended",
  "id": "cm4abcd1234",
  "symbol": "BTCUSDT",
  "longExchange": "binance",
  "shortExchange": "okx",
  "durationMs": 8100000
}
```

### 錯誤

```json
{
  "level": "error",
  "msg": "Failed to record opportunity",
  "symbol": "BTCUSDT",
  "error": "Database connection failed"
}
```

## 測試要求

1. **單元測試**:
   - `attach()` 正確綁定事件
   - `detach()` 正確解除綁定
   - `handleOpportunityDetected()` 正常記錄
   - `handleOpportunityDetected()` 無 bestPair 時跳過
   - `handleOpportunityDetected()` 資料庫錯誤時不中斷
   - `handleOpportunityDisappeared()` 正常結束
   - `handleOpportunityDisappeared()` 結束多個機會
   - `getStats()` 回傳正確統計

2. **整合測試**:
   - 與真實 FundingRateMonitor 整合
   - 機會生命週期追蹤
