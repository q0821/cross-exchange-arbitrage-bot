# Research: 套利機會自動偵測系統

**Feature**: 005-arbitrage-opportunity-detection
**Date**: 2025-10-21
**Phase**: Phase 0 - Technical Research

## 概述

本文件記錄套利機會自動偵測系統的技術研究成果，解決規格中的關鍵技術決策點。

## 研究議題

### R1: 防抖動機制 (Debounce Mechanism)

#### 決策

使用**自訂的 Per-Symbol Debounce Manager**，基於 Map 資料結構管理多個符號的獨立 debounce 計時器，整合狀態追蹤功能。

#### 理由

1. **Per-Symbol 獨立性**: Map-based 架構允許 BTC、ETH、SOL 等不同符號獨立 debounce，避免一個符號的通知影響其他符號
2. **事件驅動相容**: 與現有的 FundingRateMonitor EventEmitter 架構完美整合
3. **內建狀態追蹤**: 可輕鬆追蹤每個符號的通知計數、最後通知時間等分析數據
4. **零外部依賴**: 專案目前沒有 lodash，自訂實作避免增加不必要的依賴（lodash 約 4.4MB）
5. **型別安全**: TypeScript generics 提供完整的型別安全
6. **可配置**: 支援 per-symbol 配置，可為不同符號設定不同的 debounce 時間

#### 實作模式

```typescript
export class NotificationDebouncer<T = any> {
  private timers = new Map<string, NodeJS.Timeout>();
  private notificationCounts = new Map<string, number>();
  private lastNotificationTime = new Map<string, Date>();
  private pendingData = new Map<string, T>();

  constructor(
    private defaultDebounceMs: number = 30000,
    private onNotify: (symbol: string, data: T) => void,
    private symbolDebounceOverrides?: Map<string, number>
  ) {}

  notify(symbol: string, data: T): void {
    this.pendingData.set(symbol, data);
    const existingTimer = this.timers.get(symbol);
    if (existingTimer) clearTimeout(existingTimer);

    const debounceMs = this.symbolDebounceOverrides?.get(symbol) ?? this.defaultDebounceMs;
    const timer = setTimeout(() => this.executeNotification(symbol), debounceMs);
    this.timers.set(symbol, timer);
  }

  private executeNotification(symbol: string): void {
    const data = this.pendingData.get(symbol);
    if (!data) return;

    const count = this.notificationCounts.get(symbol) ?? 0;
    this.notificationCounts.set(symbol, count + 1);
    this.lastNotificationTime.set(symbol, new Date());

    this.timers.delete(symbol);
    this.pendingData.delete(symbol);
    this.onNotify(symbol, data);
  }

  getStats(symbol: string) {
    return {
      count: this.notificationCounts.get(symbol) ?? 0,
      lastNotification: this.lastNotificationTime.get(symbol) ?? null,
      isPending: this.timers.has(symbol),
    };
  }
}
```

#### 替代方案

1. **Lodash Debounce**: 成熟但需為每個符號創建獨立 debounced function，增加 4.4MB 依賴
2. **ts-debounce Package**: TypeScript native 但仍需手動管理 Map 結構
3. **RxJS Subject with debounceTime**: 強大但引入整個 RxJS（~300KB），學習曲線陡峭
4. **Simple setTimeout Wrapper**: 最簡單但缺乏 per-symbol 管理和狀態追蹤

---

### R2: TimescaleDB Hypertable 設計

#### 決策

**不建議**將 `ArbitrageOpportunity` 資料表轉換為 TimescaleDB hypertable，保持一般 PostgreSQL 資料表。

#### 理由

1. **資料量太小**: 預期 90 天約 43,000 筆記錄（~5-10 MB），完全可放入記憶體快取，PostgreSQL 原生 B-tree 索引已足夠高效
2. **非純 Append-Only**: 機會記錄有狀態變更（PENDING → EXECUTING → COMPLETED/FAILED/EXPIRED），會被更新（`updated_at`、`executed_at`、`completed_at`、`failure_reason`），不符合 TimescaleDB 最佳實務
3. **外鍵關聯限制**: 與 `ArbitrageCycle` 有 one-to-one 關聯，TimescaleDB 不支援外鍵指向 hypertable
4. **現有索引策略良好**: 現有的 `status`、`detected_at`、`symbol + detected_at`、`expires_at` 索引已涵蓋主要查詢模式

#### Prisma Schema 建議

保持現狀，使用一般 PostgreSQL 資料表：

```prisma
model ArbitrageOpportunity {
  id                    String             @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  symbol                String             @db.VarChar(20)
  long_exchange         String             @db.VarChar(50)
  short_exchange        String             @db.VarChar(50)
  long_funding_rate     Decimal            @db.Decimal(10, 8)
  short_funding_rate    Decimal            @db.Decimal(10, 8)
  rate_difference       Decimal            @db.Decimal(10, 8)
  expected_return_rate  Decimal            @db.Decimal(10, 8)
  estimated_profit_usdt Decimal?           @db.Decimal(20, 8)
  status                OpportunityStatus  @default(PENDING)
  detected_at           DateTime           @default(now()) @db.Timestamptz
  expires_at            DateTime           @db.Timestamptz
  executed_at           DateTime?          @db.Timestamptz
  completed_at          DateTime?          @db.Timestamptz
  failure_reason        String?            @db.Text
  created_at            DateTime           @default(now()) @db.Timestamptz
  updated_at            DateTime           @updatedAt @db.Timestamptz

  arbitrage_cycle ArbitrageCycle?

  @@index([status])
  @@index([detected_at(sort: Desc)])
  @@index([symbol, detected_at(sort: Desc)])
  @@index([expires_at])
  @@map("arbitrage_opportunities")
}
```

#### 90 天保留策略

使用應用層或 pg_cron 實作：

```typescript
// 每日清理過期資料
await prisma.arbitrageOpportunity.deleteMany({
  where: {
    detected_at: {
      lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    }
  }
});
```

#### 混合策略（最佳實務）

- **高頻 Append-Only 資料**（`FundingRate`、`SystemEvent`）→ TimescaleDB hypertable ✅
- **業務邏輯資料**（`ArbitrageOpportunity`、`HedgePosition`）→ 一般 PostgreSQL 資料表 ✅

這是 PostgreSQL + TimescaleDB 混合使用的最佳實務。

#### 替代方案

1. **TimescaleDB Hypertable**: 資料量不足以需要分區，有更新操作和外鍵限制
2. **PostgreSQL Native Partitioning**: 需手動管理分區，資料量不足以需要分區
3. **保持一般資料表** ✅: 簡單、易維護、效能已足夠
4. **混合策略** ✅: 目前已採用，最佳實務

---

### R3: 事件驅動通知架構

#### 決策

使用 **Native TypeScript EventEmitter with Typed Event Interfaces**，利用 TypeScript 5.3+ 泛型支援。

#### 理由

1. **已在使用**: `FundingRateMonitor` 已擴展 EventEmitter 並定義 `MonitorEvents` 介面，證明此模式運作良好
2. **零依賴**: Node.js 原生 EventEmitter 不需額外函式庫，符合最小依賴原則
3. **型別安全**: 現代 `@types/node`（Node.js 20.x）支援泛型型別參數，提供編譯時型別檢查
4. **鬆耦合**: EventEmitter 模式天然支援鬆耦合，服務發出事件不需知道誰在監聽
5. **優雅降級**: EventEmitter 允許每個事件有多個監聽器，一個監聽器的錯誤不影響其他監聽器
6. **效能**: EventEmitter 預設同步執行，適合需要立即通知的套利機會偵測

#### 事件結構

```typescript
// src/types/events.ts

export interface OpportunityDetectorEvents {
  'opportunity:appeared': (data: OpportunityAppearedEvent) => void;
  'opportunity:disappeared': (data: OpportunityDisappearedEvent) => void;
  'opportunity:updated': (data: OpportunityUpdatedEvent) => void;
  'error': (error: Error) => void;
}

export interface OpportunityAppearedEvent {
  symbol: string;
  pair: FundingRatePair;
  assessment?: ArbitrageAssessment;
  detectedAt: Date;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface OpportunityDisappearedEvent {
  symbol: string;
  lastPair: FundingRatePair;
  durationMs: number;
  disappearedAt: Date;
}

export interface OpportunityUpdatedEvent {
  symbol: string;
  currentPair: FundingRatePair;
  previousSpread: number;
  spreadChange: number;
  updatedAt: Date;
}
```

#### 服務整合流程

```typescript
// FundingRateMonitor → OpportunityDetector → NotificationService

// 1. Monitor 發出費率更新事件
monitor.on('rate-updated', (pair) => {
  detector.handleRateUpdate(pair);
});

// 2. Detector 偵測機會並發出事件
detector.on('opportunity:appeared', (event) => {
  notifier.notifyOpportunityAppeared(event);
});

detector.on('opportunity:disappeared', (event) => {
  notifier.notifyOpportunityDisappeared(event);
});

// 3. Notifier 發送到多個通道（Terminal, Log, Webhook）
notifier.registerChannel(new TerminalChannel());
notifier.registerChannel(new LogChannel());
```

#### 優雅降級實作

```typescript
private async sendToAllChannels(message: string, data: unknown): Promise<void> {
  const promises = Array.from(this.channels.entries()).map(async ([name, channel]) => {
    try {
      await channel.send(message, data);
      this.emit('notification:sent', name, data);
    } catch (error) {
      // Graceful degradation: 記錄錯誤但不拋出
      const notificationError: NotificationError = {
        channel: name,
        message: `Failed to send notification via ${name}`,
        originalError: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      };
      this.emit('notification:failed', notificationError);
    }
  });

  await Promise.allSettled(promises);
}
```

#### 替代方案

1. **RxJS Observables**: 強大但增加 ~200KB 依賴，學習曲線陡峭，對於簡單通知過於複雜
2. **Custom Pub-Sub Pattern**: 完全控制但重新發明輪子，需額外測試和維護
3. **Message Queue (Redis Pub/Sub, RabbitMQ)**: 支援分散式架構但需外部服務，對單行程通知過於複雜
4. **Third-party Typed EventEmitter (typed-emitter, tsee)**: 零位元組型別函式庫，但現代 `@types/node` 已足夠

---

## 技術決策總結

| 議題 | 決策 | 關鍵理由 |
|------|------|----------|
| 防抖動機制 | 自訂 Per-Symbol Debounce Manager | 零依賴、型別安全、內建狀態追蹤、Per-Symbol 獨立 |
| TimescaleDB Hypertable | 不使用（保持一般 PostgreSQL 資料表）| 資料量小、有更新操作、外鍵限制、現有索引已足夠 |
| 事件驅動架構 | Native TypeScript EventEmitter | 已在使用、零依賴、型別安全、鬆耦合、優雅降級 |

## 參考資料

- Node.js EventEmitter: https://nodejs.org/api/events.html
- TypeScript 5.3 Generics: https://www.typescriptlang.org/docs/handbook/2/generics.html
- TimescaleDB Best Practices: https://docs.timescale.com/use-timescale/latest/hypertables/about-hypertables/
- PostgreSQL Index Strategies: https://www.postgresql.org/docs/15/indexes.html

## 後續行動

所有 NEEDS CLARIFICATION 已解決，準備進入 Phase 1 設計階段：

1. ✅ 防抖動機制設計已確定
2. ✅ 資料庫架構決策已確定
3. ✅ 事件驅動架構設計已確定

下一步：建立 data-model.md、contracts/、quickstart.md
