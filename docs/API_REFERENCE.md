# API 參考文件

**版本**: v0.4.0
**最後更新**: 2025-10-23

本文件提供套利機會自動偵測系統（Phase 1-3 MVP）的 API 參考。

---

## 目錄

1. [核心服務](#核心服務)
2. [Repository 層](#repository-層)
3. [領域模型](#領域模型)
4. [型別定義](#型別定義)
5. [工具函式](#工具函式)

---

## 核心服務

### OpportunityDetector

負責偵測和追蹤套利機會的核心引擎。

#### 建構函式

```typescript
constructor(
  repository: IOpportunityRepository,
  config: OpportunityDetectorConfig
)
```

**參數**:
- `repository`: 套利機會儲存庫實例
- `config`: 偵測器配置
  - `minRateDifference`: 最小費率差異閾值（Decimal）
  - `fundingInterval`: 資金費率結算間隔（小時，預設 8）

#### 方法

##### detectOpportunities()

偵測套利機會。

```typescript
async detectOpportunities(
  symbol: string,
  fundingRates: Map<string, FundingRateData>
): Promise<DetectedOpportunity[]>
```

**參數**:
- `symbol`: 幣別符號（例如: "BTC"）
- `fundingRates`: 各交易所的資金費率資料

**返回**: 偵測到的機會陣列

**範例**:
```typescript
const fundingRates = new Map([
  ['binance', {
    exchange: 'binance',
    symbol: 'BTC',
    fundingRate: new Decimal(0.0001),
    nextFundingTime: new Date(),
    recordedAt: new Date()
  }],
  ['okx', {
    exchange: 'okx',
    symbol: 'BTC',
    fundingRate: new Decimal(0.0008),
    nextFundingTime: new Date(),
    recordedAt: new Date()
  }]
])

const opportunities = await detector.detectOpportunities('BTC', fundingRates)
// 返回: [{ symbol: 'BTC', longExchange: 'binance', ... }]
```

##### updateOpportunity()

更新現有機會狀態。

```typescript
async updateOpportunity(
  opportunityId: string,
  fundingRates: Map<string, FundingRateData>
): Promise<ArbitrageOpportunity | null>
```

**參數**:
- `opportunityId`: 機會 ID
- `fundingRates`: 最新資金費率

**返回**: 更新後的機會，如果機會已消失則返回 null

##### checkExpiration()

檢查機會是否過期。

```typescript
async checkExpiration(opportunityId: string): Promise<boolean>
```

**返回**: 是否過期（true/false）

##### closeOpportunity()

關閉機會。

```typescript
async closeOpportunity(
  opportunityId: string,
  reason: DisappearReason
): Promise<void>
```

**參數**:
- `opportunityId`: 機會 ID
- `reason`: 關閉原因
  - `RATE_DROPPED`: 費率差異回落
  - `DATA_UNAVAILABLE`: 資料無法取得
  - `MANUAL_CLOSE`: 手動關閉
  - `SYSTEM_ERROR`: 系統錯誤

---

### NotificationService

負責發送各種通知到不同渠道。

#### 建構函式

```typescript
constructor(
  prisma: PrismaClient,
  debounceManager: IDebounceManager
)
```

#### 方法

##### notifyOpportunityAppeared()

發送機會出現通知。

```typescript
async notifyOpportunityAppeared(
  opportunity: ArbitrageOpportunity,
  channels: NotificationChannel[]
): Promise<void>
```

**參數**:
- `opportunity`: 機會物件
- `channels`: 通知渠道列表（`['TERMINAL', 'LOG']`）

**範例**:
```typescript
await notificationService.notifyOpportunityAppeared(
  opportunity,
  ['TERMINAL', 'LOG']
)
```

##### notifyOpportunityUpdated()

發送機會更新通知。

```typescript
async notifyOpportunityUpdated(
  opportunity: ArbitrageOpportunity,
  oldRateDifference: Decimal,
  channels: NotificationChannel[]
): Promise<void>
```

##### notifyOpportunityDisappeared()

發送機會消失通知。

```typescript
async notifyOpportunityDisappeared(
  opportunity: ArbitrageOpportunity,
  reason: DisappearReason,
  channels: NotificationChannel[]
): Promise<void>
```

##### logNotification()

記錄通知到資料庫。

```typescript
async logNotification(
  data: CreateNotificationData
): Promise<NotificationLog>
```

##### shouldNotify()

檢查是否應該發送通知（防抖動）。

```typescript
async shouldNotify(
  symbol: string,
  notificationType: NotificationType
): Promise<boolean>
```

---

## Repository 層

### ArbitrageOpportunityRepository

負責套利機會的資料持久化。

#### 方法

##### create()

建立新機會。

```typescript
async create(data: CreateOpportunityData): Promise<ArbitrageOpportunity>
```

**參數**:
```typescript
interface CreateOpportunityData {
  symbol: string
  longExchange: string
  shortExchange: string
  longFundingRate: Decimal
  shortFundingRate: Decimal
  rateDifference: Decimal
  expectedReturnRate: Decimal
  detectedAt?: Date
}
```

**範例**:
```typescript
const opportunity = await repository.create({
  symbol: 'BTC',
  longExchange: 'binance',
  shortExchange: 'okx',
  longFundingRate: new Decimal(0.0001),
  shortFundingRate: new Decimal(0.0008),
  rateDifference: new Decimal(0.0007),
  expectedReturnRate: new Decimal(0.7665)
})
```

##### findById()

根據 ID 查詢機會。

```typescript
async findById(id: string): Promise<ArbitrageOpportunity | null>
```

##### findActiveBySymbol()

根據幣別查詢活躍機會。

```typescript
async findActiveBySymbol(symbol: string): Promise<ArbitrageOpportunity[]>
```

##### findAllActive()

查詢所有活躍機會。

```typescript
async findAllActive(limit?: number): Promise<ArbitrageOpportunity[]>
```

##### update()

更新機會。

```typescript
async update(
  id: string,
  data: UpdateOpportunityData
): Promise<ArbitrageOpportunity>
```

**參數**:
```typescript
interface UpdateOpportunityData {
  longFundingRate?: Decimal
  shortFundingRate?: Decimal
  rateDifference?: Decimal
  expectedReturnRate?: Decimal
  maxRateDifference?: Decimal
  maxRateDifferenceAt?: Date
  expiredAt?: Date
  closedAt?: Date
  status?: OpportunityStatus
}
```

##### updateStatus()

更新機會狀態。

```typescript
async updateStatus(
  id: string,
  status: OpportunityStatus
): Promise<ArbitrageOpportunity>
```

**狀態值**:
- `ACTIVE`: 活躍中
- `EXPIRED`: 已過期
- `CLOSED`: 已關閉

##### incrementNotificationCount()

增加通知計數。

```typescript
async incrementNotificationCount(opportunityId: string): Promise<void>
```

##### getStatistics()

獲取統計資料。

```typescript
async getStatistics(
  filters?: OpportunityFilters
): Promise<OpportunityStatistics>
```

**返回**:
```typescript
interface OpportunityStatistics {
  totalCount: number
  activeCount: number
  expiredCount: number
  closedCount: number
  avgRateDifference: Decimal
  maxRateDifference: Decimal
  avgDurationMinutes?: number
}
```

---

### OpportunityHistoryRepository

負責機會歷史資料的持久化。

#### 方法

##### create()

建立歷史記錄。

```typescript
async create(data: CreateHistoryData): Promise<OpportunityHistory>
```

**參數**:
```typescript
interface CreateHistoryData {
  opportunityId: string
  symbol: string
  longExchange: string
  shortExchange: string
  initialRateDifference: Decimal
  maxRateDifference: Decimal
  avgRateDifference: Decimal
  durationMs: bigint
  durationMinutes: Decimal
  totalNotifications: number
  detectedAt: Date
  expiredAt: Date
  disappearReason: DisappearReason
}
```

##### findByOpportunityId()

根據機會 ID 查詢歷史。

```typescript
async findByOpportunityId(
  opportunityId: string
): Promise<OpportunityHistory | null>
```

##### findMany()

查詢歷史記錄。

```typescript
async findMany(
  filters: HistoryFilters,
  limit?: number
): Promise<OpportunityHistory[]>
```

**過濾條件**:
```typescript
interface HistoryFilters {
  symbol?: string
  disappearReason?: DisappearReason
  minDurationMs?: bigint
  maxDurationMs?: bigint
  detectedAfter?: Date
  detectedBefore?: Date
}
```

##### getStatistics()

獲取歷史統計。

```typescript
async getStatistics(
  filters?: HistoryFilters
): Promise<HistoryStatistics>
```

**返回**:
```typescript
interface HistoryStatistics {
  totalCount: number
  avgDurationMinutes: number
  maxDurationMinutes: number
  minDurationMinutes: number
  avgMaxRateDifference: Decimal
  mostCommonReason: DisappearReason
  totalNotifications: number
}
```

---

### NotificationLogRepository

負責通知記錄的持久化。

#### 方法

##### create()

建立通知記錄。

```typescript
async create(data: CreateNotificationData): Promise<NotificationLog>
```

**參數**:
```typescript
interface CreateNotificationData {
  opportunityId: string
  symbol: string
  notificationType: NotificationType
  channel: NotificationChannel
  severity: Severity
  message: string
  rateDifference: Decimal
  isDebounced?: boolean
  debounceSkippedCount?: number
}
```

##### findByOpportunityId()

根據機會 ID 查詢通知記錄。

```typescript
async findByOpportunityId(
  opportunityId: string,
  limit?: number
): Promise<NotificationLog[]>
```

##### findRecentBySymbol()

根據幣別查詢最近的通知記錄。

```typescript
async findRecentBySymbol(
  symbol: string,
  limit?: number
): Promise<NotificationLog[]>
```

##### getDebounceStats()

獲取防抖動統計。

```typescript
async getDebounceStats(
  symbol?: string,
  hoursBack?: number
): Promise<{
  totalNotifications: number
  debouncedCount: number
  totalSkipped: number
  debounceRate: number
}>
```

**範例**:
```typescript
const stats = await repository.getDebounceStats('BTC', 24)
// 返回: { totalNotifications: 50, debouncedCount: 10, totalSkipped: 25, debounceRate: 20 }
```

##### getNotificationFrequency()

獲取通知頻率統計。

```typescript
async getNotificationFrequency(
  hoursBack?: number,
  limit?: number
): Promise<Array<{
  symbol: string
  count: number
  frequency: number
}>>
```

---

## 領域模型

### ArbitrageOpportunity

套利機會領域模型。

#### 靜態方法

##### fromPrisma()

從 Prisma 物件建立領域模型。

```typescript
static fromPrisma(
  data: PrismaArbitrageOpportunity
): ArbitrageOpportunity
```

##### create()

建立新的套利機會。

```typescript
static create(params: {
  id: string
  symbol: string
  longExchange: string
  shortExchange: string
  longFundingRate: Decimal
  shortFundingRate: Decimal
  rateDifference: Decimal
  expectedReturnRate: Decimal
  detectedAt?: Date
}): ArbitrageOpportunity
```

#### 實例方法

##### isActive()

檢查機會是否為活躍狀態。

```typescript
isActive(): boolean
```

##### isExpired()

檢查機會是否已過期。

```typescript
isExpired(): boolean
```

##### isClosed()

檢查機會是否已關閉。

```typescript
isClosed(): boolean
```

##### updateRateDifference()

更新費率差異。

```typescript
updateRateDifference(
  newLongRate: Decimal,
  newShortRate: Decimal,
  newRateDifference: Decimal
): void
```

##### markAsExpired()

標記機會為過期。

```typescript
markAsExpired(): void
```

##### close()

關閉機會。

```typescript
close(reason: DisappearReason): void
```

##### recordNotification()

記錄通知發送。

```typescript
recordNotification(): void
```

##### getDurationMs()

計算機會持續時間（毫秒）。

```typescript
getDurationMs(): number
```

##### getDurationMinutes()

計算機會持續時間（分鐘）。

```typescript
getDurationMinutes(): number
```

##### toPlainObject()

轉換為簡單物件（用於日誌或序列化）。

```typescript
toPlainObject(): {
  id: string
  symbol: string
  longExchange: string
  shortExchange: string
  longFundingRate: string
  shortFundingRate: string
  rateDifference: string
  expectedReturnRate: string
  status: OpportunityStatus
  detectedAt: string
  expiredAt: string | null
  closedAt: string | null
  maxRateDifference: string | null
  maxRateDifferenceAt: string | null
  notificationCount: number
  lastNotificationAt: string | null
  durationMinutes: number
}
```

---

### OpportunityHistory

機會歷史領域模型。

#### 靜態方法

##### fromPrisma()

從 Prisma 物件建立領域模型。

```typescript
static fromPrisma(
  data: PrismaOpportunityHistory
): OpportunityHistory
```

##### fromOpportunity()

從套利機會建立歷史記錄。

```typescript
static fromOpportunity(
  historyId: string,
  opportunity: ArbitrageOpportunity,
  avgRateDifference: Decimal,
  reason: DisappearReason
): OpportunityHistory
```

#### 實例方法

##### calculateVolatility()

計算費率差異波動率。

```typescript
calculateVolatility(): number
```

##### isShortTerm()

判斷是否為短期機會（小於 5 分鐘）。

```typescript
isShortTerm(): boolean
```

##### isMediumTerm()

判斷是否為中期機會（5-30 分鐘）。

```typescript
isMediumTerm(): boolean
```

##### isLongTerm()

判斷是否為長期機會（超過 30 分鐘）。

```typescript
isLongTerm(): boolean
```

##### getNotificationFrequency()

計算通知頻率（次/分鐘）。

```typescript
getNotificationFrequency(): number
```

##### isNormalDisappearance()

判斷消失原因是否為正常情況。

```typescript
isNormalDisappearance(): boolean
```

##### isAbnormalDisappearance()

判斷消失原因是否為異常情況。

```typescript
isAbnormalDisappearance(): boolean
```

---

## 型別定義

### 事件型別

```typescript
// 機會偵測事件
interface OpportunityDetectedEvent {
  type: 'OPPORTUNITY_DETECTED'
  opportunityId: string
  symbol: string
  longExchange: string
  shortExchange: string
  longFundingRate: Decimal
  shortFundingRate: Decimal
  rateDifference: Decimal
  expectedReturnRate: Decimal
  detectedAt: Date
}

// 機會更新事件
interface OpportunityUpdatedEvent {
  type: 'OPPORTUNITY_UPDATED'
  opportunityId: string
  symbol: string
  newRateDifference: Decimal
  oldRateDifference: Decimal
  changePercentage: number
  updatedAt: Date
}

// 機會消失事件
interface OpportunityDisappearedEvent {
  type: 'OPPORTUNITY_DISAPPEARED'
  opportunityId: string
  symbol: string
  reason: DisappearReason
  durationMs: number
  maxRateDifference: Decimal
  avgRateDifference: Decimal
  disappearedAt: Date
}

// 通知發送事件
interface NotificationSentEvent {
  type: 'NOTIFICATION_SENT'
  opportunityId: string
  notificationType: NotificationType
  channel: NotificationChannel
  severity: Severity
  isDebounced: boolean
  sentAt: Date
}
```

### 枚舉型別

```typescript
// 機會狀態
enum OpportunityStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CLOSED = 'CLOSED'
}

// 消失原因
enum DisappearReason {
  RATE_DROPPED = 'RATE_DROPPED',
  DATA_UNAVAILABLE = 'DATA_UNAVAILABLE',
  MANUAL_CLOSE = 'MANUAL_CLOSE',
  SYSTEM_ERROR = 'SYSTEM_ERROR'
}

// 通知類型
enum NotificationType {
  OPPORTUNITY_APPEARED = 'OPPORTUNITY_APPEARED',
  OPPORTUNITY_DISAPPEARED = 'OPPORTUNITY_DISAPPEARED',
  OPPORTUNITY_UPDATED = 'OPPORTUNITY_UPDATED'
}

// 通知渠道
enum NotificationChannel {
  TERMINAL = 'TERMINAL',
  LOG = 'LOG',
  WEBHOOK = 'WEBHOOK',
  TELEGRAM = 'TELEGRAM'
}

// 嚴重性
enum Severity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL'
}
```

---

## 工具函式

### DebounceManager

Per-symbol 防抖動管理器。

#### 建構函式

```typescript
constructor(windowMs: number = 30000)
```

**參數**:
- `windowMs`: 防抖動窗口時間（毫秒），預設 30 秒

#### 方法

##### shouldTrigger()

檢查是否應該觸發。

```typescript
shouldTrigger(key: string): boolean
```

**範例**:
```typescript
const debouncer = new DebounceManager(30000) // 30 秒窗口

debouncer.shouldTrigger('BTC:APPEARED') // 返回 true（首次）
debouncer.shouldTrigger('BTC:APPEARED') // 返回 false（窗口內）

// 30 秒後
debouncer.shouldTrigger('BTC:APPEARED') // 返回 true（窗口外）
```

##### reset()

重置防抖動狀態。

```typescript
reset(key: string): void
```

##### clear()

清除所有防抖動狀態。

```typescript
clear(): void
```

##### getSkipCount()

獲取跳過次數。

```typescript
getSkipCount(key: string): number
```

##### getSnapshot()

獲取當前狀態快照（用於除錯）。

```typescript
getSnapshot(): Record<string, {
  lastTriggerTime: Date
  skipCount: number
  remainingMs: number
}>
```

##### cleanup()

清理過期狀態（超過 2 倍窗口時間未使用）。

```typescript
cleanup(): void
```

### createDebounceKey()

建立防抖動鍵值。

```typescript
function createDebounceKey(
  symbol: string,
  type?: string
): string
```

**範例**:
```typescript
createDebounceKey('BTC')                      // 返回: 'BTC'
createDebounceKey('BTC', 'APPEARED')          // 返回: 'BTC:APPEARED'
```

---

## 使用範例

### 完整流程範例

```typescript
import { PrismaClient } from '@prisma/client'
import { Decimal } from 'decimal.js'
import { OpportunityDetector } from './services/monitor/OpportunityDetector'
import { NotificationService } from './services/notification/NotificationService'
import { ArbitrageOpportunityRepository } from './repositories/ArbitrageOpportunityRepository'
import { DebounceManager } from './lib/debounce'

// 初始化
const prisma = new PrismaClient()
const repository = new ArbitrageOpportunityRepository(prisma)
const debouncer = new DebounceManager(30000)
const notificationService = new NotificationService(prisma, debouncer)

const detector = new OpportunityDetector(repository, {
  minRateDifference: new Decimal(0.0005) as any,
  fundingInterval: 8
})

// 模擬資金費率資料
const fundingRates = new Map([
  ['binance', {
    exchange: 'binance',
    symbol: 'BTC',
    fundingRate: new Decimal(0.0001) as any,
    nextFundingTime: new Date(),
    recordedAt: new Date()
  }],
  ['okx', {
    exchange: 'okx',
    symbol: 'BTC',
    fundingRate: new Decimal(0.0008) as any,
    nextFundingTime: new Date(),
    recordedAt: new Date()
  }]
])

// 偵測機會
const opportunities = await detector.detectOpportunities('BTC', fundingRates)

if (opportunities.length > 0) {
  // 建立機會記錄
  const opportunity = await repository.create(opportunities[0])

  // 發送通知
  await notificationService.notifyOpportunityAppeared(
    opportunity,
    ['TERMINAL', 'LOG']
  )

  console.log('偵測到套利機會！', opportunity.symbol)
}
```

---

## 錯誤處理

所有 API 方法都應該使用 try-catch 包裹：

```typescript
try {
  const opportunity = await repository.findById(id)
  if (!opportunity) {
    throw new Error('機會不存在')
  }
} catch (error) {
  logger.error({ error, id }, '查詢機會失敗')
  throw error
}
```

---

**版本歷史**:
- v0.4.0 (2025-10-23): Phase 1-3 MVP 完成，新增本 API 文件
