# Data Model: Web 多用戶套利交易平台

**Feature**: 006-web-trading-platform
**Date**: 2025-10-27
**Purpose**: 定義資料庫 schema、實體關聯和驗證規則

## 概述

本文件定義 Web 多用戶套利交易平台的完整資料模型。包含新增的用戶管理模型和既有的套利監控模型。所有模型使用 Prisma ORM 定義，並儲存在 PostgreSQL 15+ with TimescaleDB 資料庫中。

---

## 資料庫配置

**資料庫**: PostgreSQL 15+ with TimescaleDB extension
**ORM**: Prisma 5.x
**連線池**: 10-20 connections (適合 < 10 用戶)
**備份策略**: 每日全量備份 + WAL 歸檔（生產環境）

---

## 新增模型 (⭐)

### 1. User（用戶）

**用途**: 代表使用平台的個人用戶

**Prisma Schema**:
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String   // bcrypt hashed password
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  apiKeys    ApiKey[]
  positions  Position[]
  trades     Trade[]
  auditLogs  AuditLog[]

  @@map("users")
}
```

**欄位說明**:
- `id`: 主鍵，使用 CUID (Collision-resistant Unique Identifier) 確保唯一性
- `email`: 用戶 Email，唯一索引，用於登入
- `password`: bcrypt 雜湊後的密碼（成本因子 10），不可逆
- `createdAt`: 註冊時間
- `updatedAt`: 最後更新時間（Prisma 自動維護）

**驗證規則**:
- `email`: 必須符合 RFC 5322 Email 格式（使用 Zod schema 驗證）
- `password`: 原始密碼長度 >= 8 字元，至少包含 1 個數字和 1 個字母（FR-003）
- `email` 不可重複（資料庫唯一約束）

**索引**:
- `email`: 唯一索引（加速登入查詢）

**安全性**:
- 密碼使用 bcrypt 雜湊，成本因子 10（平衡安全性和效能）
- 不儲存原始密碼或可逆加密的密碼
- 登入失敗次數限制由應用層實作（5 次失敗鎖定 15 分鐘）

---

### 2. ApiKey（API 金鑰）

**用途**: 儲存用戶在交易所的 API 認證資訊（加密儲存）

**Prisma Schema**:
```prisma
model ApiKey {
  id             String   @id @default(cuid())
  userId         String
  exchange       String   // "binance" | "okx"
  label          String   // User-defined label, e.g., "My Binance Account"
  encryptedKey   String   // AES-256-GCM encrypted API key
  encryptedSecret String  // AES-256-GCM encrypted secret key
  encryptedPassphrase String? // For OKX only, AES-256-GCM encrypted
  isActive       Boolean  @default(true)
  lastValidatedAt DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  // Relations
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, exchange, label])
  @@map("api_keys")
}
```

**欄位說明**:
- `id`: 主鍵 (CUID)
- `userId`: 外鍵，關聯到 User
- `exchange`: 交易所名稱，列舉值 "binance" | "okx"
- `label`: 用戶自訂的標籤（例如「我的幣安帳戶」），用於區分同一交易所的多組 API Key
- `encryptedKey`: AES-256-GCM 加密後的 API Key，格式 `{iv}:{encryptedData}:{authTag}` (base64)
- `encryptedSecret`: AES-256-GCM 加密後的 Secret Key
- `encryptedPassphrase`: 僅 OKX 需要，AES-256-GCM 加密後的 Passphrase
- `isActive`: 是否啟用（用戶可暫時停用某個 API Key，不刪除）
- `lastValidatedAt`: 最後一次驗證有效性的時間（呼叫交易所 API 測試連線）

**驗證規則**:
- `exchange`: 必須是 "binance" 或 "okx"
- `label`: 長度 1-50 字元
- `encryptedKey`, `encryptedSecret`: 非空
- `encryptedPassphrase`: OKX 必填，Binance 為空
- 同一用戶在同一交易所的 `label` 不可重複（複合唯一約束）

**索引**:
- `(userId, exchange, label)`: 複合唯一索引
- `userId`: 外鍵索引（加速查詢某用戶的所有 API Key）

**安全性** (FR-011):
- 所有敏感資料（key, secret, passphrase）使用 AES-256-GCM 加密
- 加密密鑰從環境變數 `ENCRYPTION_KEY` 讀取（32 bytes = 256 bits）
- 每次加密使用隨機 IV（Initialization Vector），防止相同明文產生相同密文
- GCM 模式提供認證加密（AEAD），防止密文被竄改
- 刪除用戶時級聯刪除所有 API Key (`onDelete: Cascade`)

**加密/解密流程**:
```typescript
// 加密
function encrypt(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${encrypted.toString('base64')}:${authTag.toString('base64')}`;
}

// 解密
function decrypt(ciphertext: string, key: Buffer): string {
  const [ivB64, encryptedB64, authTagB64] = ciphertext.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}
```

---

### 3. Position（持倉）

**用途**: 代表用戶當前持有的未平倉套利倉位

**Prisma Schema**:
```prisma
model Position {
  id               String   @id @default(cuid())
  userId           String
  opportunityId    String?  // 可選，關聯到觸發此倉位的套利機會
  symbol           String   // e.g., "BTCUSDT"

  // 倉位詳細資訊
  longExchange     String   // "binance" | "okx"
  longOrderId      String?  // 交易所回傳的訂單 ID
  longEntryPrice   Decimal  @db.Decimal(18, 8)
  longPositionSize Decimal  @db.Decimal(18, 8)
  longLeverage     Int

  shortExchange    String   // "binance" | "okx"
  shortOrderId     String?
  shortEntryPrice  Decimal  @db.Decimal(18, 8)
  shortPositionSize Decimal @db.Decimal(18, 8)
  shortLeverage    Int

  // 狀態和時間
  status           String   // "PENDING" | "OPENING" | "OPEN" | "CLOSING" | "CLOSED" | "FAILED" | "PARTIAL"
  openedAt         DateTime?
  closedAt         DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  // 資金費率資訊
  openFundingRateLong  Decimal @db.Decimal(10, 8)
  openFundingRateShort Decimal @db.Decimal(10, 8)

  // 未實現 PnL（應用層計算，不儲存）
  // unrealizedPnL: computed field

  // Relations
  user           User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  opportunity    ArbitrageOpportunity? @relation(fields: [opportunityId], references: [id], onDelete: SetNull)
  trade          Trade?                // 一對一關聯，平倉後建立 Trade 記錄

  @@map("positions")
}
```

**欄位說明**:
- `id`: 主鍵 (CUID)
- `userId`: 外鍵，關聯到 User
- `opportunityId`: 外鍵，關聯到觸發此倉位的 ArbitrageOpportunity（可選，機會可能已過期）
- `symbol`: 交易對（例如 "BTCUSDT"）
- **Long 側倉位資訊**:
  - `longExchange`: 開多的交易所
  - `longOrderId`: 交易所回傳的訂單 ID（用於追蹤和對帳）
  - `longEntryPrice`: 開倉價格（使用 Decimal 確保精確度）
  - `longPositionSize`: 倉位大小（以交易對基礎貨幣計價，例如 BTC）
  - `longLeverage`: 槓桿倍數
- **Short 側倉位資訊**: 同 Long 側
- `status`: 倉位狀態（狀態機見下方）
- `openedAt`: 雙邊都開倉成功的時間
- `closedAt`: 雙邊都平倉成功的時間
- `openFundingRateLong/Short`: 開倉時的資金費率（用於計算收益）

**狀態轉換** (State Machine):
```
PENDING  → OPENING → OPEN → CLOSING → CLOSED
   ↓          ↓        ↓        ↓
FAILED    FAILED   FAILED   PARTIAL
```

狀態說明：
- `PENDING`: 剛建立，尚未開始執行
- `OPENING`: 正在執行雙邊開倉
- `OPEN`: 雙邊都開倉成功，持倉中
- `CLOSING`: 正在執行雙邊平倉
- `CLOSED`: 雙邊都平倉成功，已建立 Trade 記錄
- `FAILED`: 開倉或平倉失敗（兩邊都失敗）
- `PARTIAL`: 部分成功（一邊成功一邊失敗），需要人工處理

**驗證規則**:
- `symbol`: 必須是支援的交易對（例如 BTCUSDT, ETHUSDT 等）
- `longExchange` != `shortExchange`: 不可在同一交易所開多和開空
- `longPositionSize` == `shortPositionSize`: 雙邊倉位大小必須相等（對沖）
- `longLeverage`, `shortLeverage`: 1-125 之間（取決於交易所限制）
- `status`: 必須是有效的狀態

**索引**:
- `userId`: 外鍵索引（查詢某用戶的所有持倉）
- `(userId, status)`: 複合索引（查詢某用戶的 OPEN 或 CLOSING 狀態倉位）
- `symbol`: 普通索引（按交易對篩選）

**未實現 PnL 計算** (應用層邏輯):
```typescript
function calculateUnrealizedPnL(position: Position, currentPrices: {long: Decimal, short: Decimal}): Decimal {
  // Long 側 PnL
  const longPnL = (currentPrices.long.minus(position.longEntryPrice))
    .times(position.longPositionSize);

  // Short 側 PnL
  const shortPnL = (position.shortEntryPrice.minus(currentPrices.short))
    .times(position.shortPositionSize);

  // 總 PnL（不含資金費率）
  const pricePnL = longPnL.plus(shortPnL);

  // 資金費率收益（需要查詢累計的資金費率結算記錄）
  const fundingPnL = await calculateAccumulatedFundingRate(position.id);

  return pricePnL.plus(fundingPnL);
}
```

---

### 4. Trade（交易記錄）

**用途**: 已平倉的交易完整記錄（不可變，immutable）

**Prisma Schema**:
```prisma
model Trade {
  id               String   @id @default(cuid())
  userId           String
  positionId       String   @unique  // 一對一關聯到 Position
  symbol           String

  // 倉位資訊（從 Position 複製）
  longExchange     String
  longEntryPrice   Decimal  @db.Decimal(18, 8)
  longExitPrice    Decimal  @db.Decimal(18, 8)
  longPositionSize Decimal  @db.Decimal(18, 8)

  shortExchange    String
  shortEntryPrice  Decimal  @db.Decimal(18, 8)
  shortExitPrice   Decimal  @db.Decimal(18, 8)
  shortPositionSize Decimal @db.Decimal(18, 8)

  // 時間資訊
  openedAt         DateTime
  closedAt         DateTime
  holdingDuration  Int      // 持倉時間（秒）

  // 收益資訊（immutable, 平倉時計算）
  priceDiffPnL     Decimal  @db.Decimal(18, 8)  // 價差收益
  fundingRatePnL   Decimal  @db.Decimal(18, 8)  // 資金費率收益
  totalPnL         Decimal  @db.Decimal(18, 8)  // 總收益
  roi              Decimal  @db.Decimal(10, 4)  // 收益率（百分比）

  // 狀態
  status           String   // "SUCCESS" | "PARTIAL" | "FAILED"

  createdAt        DateTime @default(now())

  // Relations
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  position Position @relation(fields: [positionId], references: [id], onDelete: Restrict)

  @@map("trades")
}
```

**欄位說明**:
- `id`: 主鍵 (CUID)
- `userId`: 外鍵，關聯到 User
- `positionId`: 外鍵，一對一關聯到 Position（保留追蹤）
- `symbol`: 交易對
- **Long/Short 側資訊**:
  - `entryPrice`: 開倉價格
  - `exitPrice`: 平倉價格
  - `positionSize`: 倉位大小
- **時間資訊**:
  - `openedAt`: 開倉時間（從 Position 複製）
  - `closedAt`: 平倉時間
  - `holdingDuration`: 持倉時間（秒），計算公式：`closedAt - openedAt`
- **收益資訊**:
  - `priceDiffPnL`: 價差收益 = (longExitPrice - longEntryPrice) * size + (shortEntryPrice - shortExitPrice) * size
  - `fundingRatePnL`: 資金費率收益（累計所有結算期間的資金費率收支）
  - `totalPnL`: 總收益 = priceDiffPnL + fundingRatePnL
  - `roi`: 收益率（%）= totalPnL / (投入本金) * 100
- `status`: 交易狀態
  - `SUCCESS`: 雙邊都成功平倉
  - `PARTIAL`: 部分平倉成功（需人工處理）
  - `FAILED`: 平倉失敗

**不可變性 (Immutable)**:
- Trade 記錄一旦建立就不可修改（符合 Core Principle IV: Data Integrity）
- 使用 Prisma middleware 或應用層邏輯防止 UPDATE 操作
- 刪除 Position 時不可級聯刪除 Trade (`onDelete: Restrict`)

**驗證規則**:
- `longPositionSize` == `shortPositionSize`: 倉位大小必須相等
- `openedAt` < `closedAt`: 開倉時間必須早於平倉時間
- `holdingDuration` == `closedAt - openedAt` (秒)

**索引**:
- `userId`: 外鍵索引（查詢某用戶的交易歷史）
- `(userId, closedAt DESC)`: 複合索引（按時間降序查詢交易歷史）
- `symbol`: 普通索引（按交易對篩選）
- `positionId`: 唯一索引（一對一關聯）

---

### 5. AuditLog（審計日誌）

**用途**: 記錄所有關鍵操作的審計日誌（登入、API Key 變更、開倉、平倉）

**Prisma Schema**:
```prisma
model AuditLog {
  id            String   @id @default(cuid())
  userId        String?  // 可選，某些系統事件沒有用戶
  action        String   // "LOGIN" | "REGISTER" | "APIKEY_ADD" | "APIKEY_DELETE" | "POSITION_OPEN" | "POSITION_CLOSE" | ...
  resource      String?  // 相關資源 ID (例如 positionId, apiKeyId)
  details       Json?    // 詳細資訊（JSON），例如開倉參數、錯誤訊息等
  ipAddress     String?
  userAgent     String?
  createdAt     DateTime @default(now())

  // Relations
  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@map("audit_logs")
}
```

**欄位說明**:
- `id`: 主鍵 (CUID)
- `userId`: 外鍵，關聯到 User（可選，系統事件沒有用戶）
- `action`: 操作類型，列舉值（見下方）
- `resource`: 相關資源的 ID（例如 `positionId`, `apiKeyId`）
- `details`: JSON 格式的詳細資訊，靈活儲存不同操作的額外資料
- `ipAddress`: 用戶 IP 位址（從 HTTP request 取得）
- `userAgent`: 用戶瀏覽器 User-Agent
- `createdAt`: 操作時間

**操作類型** (`action`):
- **認證相關**:
  - `LOGIN`: 用戶登入
  - `LOGOUT`: 用戶登出
  - `REGISTER`: 用戶註冊
  - `LOGIN_FAILED`: 登入失敗（記錄嘗試次數）
- **API Key 相關**:
  - `APIKEY_ADD`: 新增 API Key
  - `APIKEY_UPDATE`: 更新 API Key
  - `APIKEY_DELETE`: 刪除 API Key
  - `APIKEY_ACTIVATE`: 啟用 API Key
  - `APIKEY_DEACTIVATE`: 停用 API Key
- **交易相關**:
  - `POSITION_OPEN`: 開倉
  - `POSITION_CLOSE`: 平倉
  - `POSITION_OPEN_FAILED`: 開倉失敗
  - `POSITION_CLOSE_FAILED`: 平倉失敗
- **系統相關**:
  - `SYSTEM_ERROR`: 系統錯誤
  - `CIRCUIT_BREAKER_TRIGGERED`: 熔斷器觸發

**索引**:
- `userId`: 外鍵索引（查詢某用戶的操作日誌）
- `(userId, createdAt DESC)`: 複合索引（按時間降序查詢）
- `action`: 普通索引（按操作類型篩選）
- `createdAt`: 普通索引（按時間範圍查詢）

**使用 TimescaleDB Hypertable**（可選，用於高效時序查詢）:
```sql
-- 將 audit_logs 轉為 hypertable（按 createdAt 分區）
SELECT create_hypertable('audit_logs', 'createdAt');
```

---

## 既有模型（保留，✅）

### 6. ArbitrageOpportunity（套利機會）

**用途**: 偵測到的資金費率套利機會

**Prisma Schema** (既有，需輕微調整):
```prisma
model ArbitrageOpportunity {
  id                  String   @id @default(cuid())
  symbol              String
  exchangeA           String   // "binance" | "okx"
  exchangeB           String
  priceA              Decimal  @db.Decimal(18, 8)
  priceB              Decimal  @db.Decimal(18, 8)
  fundingRateA        Decimal  @db.Decimal(10, 8)
  fundingRateB        Decimal  @db.Decimal(10, 8)
  spreadBps           Decimal  @db.Decimal(10, 4)  // 費率差異（basis points, 1 bp = 0.01%）
  annualizedReturn    Decimal  @db.Decimal(10, 4)  // 預期年化收益率（%）

  // 新增欄位：標示開多和開空的交易所
  longExchange        String   // 應該開多的交易所
  shortExchange       String   // 應該開空的交易所

  status              String   @default("ACTIVE")  // "ACTIVE" | "EXPIRED"
  detectedAt          DateTime @default(now())
  expiredAt           DateTime?

  // Relations
  positions Position[]  // 一個機會可以被多個用戶開倉

  @@map("arbitrage_opportunities")
}
```

**調整說明**:
- 新增 `longExchange` 和 `shortExchange` 欄位，清楚標示應該在哪個交易所開多/開空（FR-023）
- 新增與 Position 的一對多關聯

---

### 7. OpportunityHistory（機會歷史）

**用途**: 追蹤套利機會的生命週期

**Prisma Schema** (既有，保持不變):
```prisma
model OpportunityHistory {
  id             String   @id @default(cuid())
  opportunityId  String
  symbol         String
  maxSpreadBps   Decimal  @db.Decimal(10, 4)
  duration       Int      // 持續時間（秒）
  detectedAt     DateTime
  expiredAt      DateTime
  createdAt      DateTime @default(now())

  @@map("opportunity_histories")
}
```

**使用 TimescaleDB Hypertable**:
```sql
SELECT create_hypertable('opportunity_histories', 'detectedAt');
```

---

### 8. NotificationLog（通知日誌）

**用途**: 系統發送的通知記錄（用於審計和防抖動）

**Prisma Schema** (既有，保持不變):
```prisma
model NotificationLog {
  id          String   @id @default(cuid())
  type        String   // "OPPORTUNITY_DETECTED" | "POSITION_OPENED" | "POSITION_CLOSED" | "ERROR" | ...
  channel     String   // "TERMINAL" | "LOG" | "WEBSOCKET" | "EMAIL" | "TELEGRAM"
  recipient   String?  // 接收者（例如用戶 ID、Email）
  content     Json     // 通知內容（JSON）
  status      String   // "SENT" | "FAILED"
  sentAt      DateTime @default(now())

  @@map("notification_logs")
}
```

---

## 實體關聯圖 (ERD)

```
User (用戶)
  |
  ├──< ApiKey (API 金鑰)              [一對多]
  ├──< Position (持倉)                [一對多]
  ├──< Trade (交易記錄)               [一對多]
  └──< AuditLog (審計日誌)            [一對多]

Position (持倉)
  ├──> User (用戶)                    [多對一]
  ├──> ArbitrageOpportunity (套利機會) [多對一, 可選]
  └──< Trade (交易記錄)               [一對一]

Trade (交易記錄)
  ├──> User (用戶)                    [多對一]
  └──> Position (持倉)                [一對一]

ArbitrageOpportunity (套利機會)
  └──< Position (持倉)                [一對多]

AuditLog (審計日誌)
  └──> User (用戶)                    [多對一, 可選]

ApiKey (API 金鑰)
  └──> User (用戶)                    [多對一]

OpportunityHistory (機會歷史)
  (獨立表，無外鍵關聯)

NotificationLog (通知日誌)
  (獨立表，無外鍵關聯)
```

---

## Prisma Schema 完整定義

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ===== 新增模型 =====

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  apiKeys    ApiKey[]
  positions  Position[]
  trades     Trade[]
  auditLogs  AuditLog[]

  @@map("users")
}

model ApiKey {
  id                  String   @id @default(cuid())
  userId              String
  exchange            String
  label               String
  encryptedKey        String
  encryptedSecret     String
  encryptedPassphrase String?
  isActive            Boolean  @default(true)
  lastValidatedAt     DateTime?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, exchange, label])
  @@map("api_keys")
}

model Position {
  id                   String   @id @default(cuid())
  userId               String
  opportunityId        String?
  symbol               String
  longExchange         String
  longOrderId          String?
  longEntryPrice       Decimal  @db.Decimal(18, 8)
  longPositionSize     Decimal  @db.Decimal(18, 8)
  longLeverage         Int
  shortExchange        String
  shortOrderId         String?
  shortEntryPrice      Decimal  @db.Decimal(18, 8)
  shortPositionSize    Decimal  @db.Decimal(18, 8)
  shortLeverage        Int
  status               String
  openedAt             DateTime?
  closedAt             DateTime?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  openFundingRateLong  Decimal  @db.Decimal(10, 8)
  openFundingRateShort Decimal  @db.Decimal(10, 8)

  user        User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  opportunity ArbitrageOpportunity? @relation(fields: [opportunityId], references: [id], onDelete: SetNull)
  trade       Trade?

  @@map("positions")
}

model Trade {
  id                String   @id @default(cuid())
  userId            String
  positionId        String   @unique
  symbol            String
  longExchange      String
  longEntryPrice    Decimal  @db.Decimal(18, 8)
  longExitPrice     Decimal  @db.Decimal(18, 8)
  longPositionSize  Decimal  @db.Decimal(18, 8)
  shortExchange     String
  shortEntryPrice   Decimal  @db.Decimal(18, 8)
  shortExitPrice    Decimal  @db.Decimal(18, 8)
  shortPositionSize Decimal  @db.Decimal(18, 8)
  openedAt          DateTime
  closedAt          DateTime
  holdingDuration   Int
  priceDiffPnL      Decimal  @db.Decimal(18, 8)
  fundingRatePnL    Decimal  @db.Decimal(18, 8)
  totalPnL          Decimal  @db.Decimal(18, 8)
  roi               Decimal  @db.Decimal(10, 4)
  status            String
  createdAt         DateTime @default(now())

  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  position Position @relation(fields: [positionId], references: [id], onDelete: Restrict)

  @@map("trades")
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String?
  action    String
  resource  String?
  details   Json?
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())

  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@map("audit_logs")
}

// ===== 既有模型（調整） =====

model ArbitrageOpportunity {
  id               String   @id @default(cuid())
  symbol           String
  exchangeA        String
  exchangeB        String
  priceA           Decimal  @db.Decimal(18, 8)
  priceB           Decimal  @db.Decimal(18, 8)
  fundingRateA     Decimal  @db.Decimal(10, 8)
  fundingRateB     Decimal  @db.Decimal(10, 8)
  spreadBps        Decimal  @db.Decimal(10, 4)
  annualizedReturn Decimal  @db.Decimal(10, 4)
  longExchange     String   // 新增
  shortExchange    String   // 新增
  status           String   @default("ACTIVE")
  detectedAt       DateTime @default(now())
  expiredAt        DateTime?

  positions Position[]

  @@map("arbitrage_opportunities")
}

model OpportunityHistory {
  id            String   @id @default(cuid())
  opportunityId String
  symbol        String
  maxSpreadBps  Decimal  @db.Decimal(10, 4)
  duration      Int
  detectedAt    DateTime
  expiredAt     DateTime
  createdAt     DateTime @default(now())

  @@map("opportunity_histories")
}

model NotificationLog {
  id        String   @id @default(cuid())
  type      String
  channel   String
  recipient String?
  content   Json
  status    String
  sentAt    DateTime @default(now())

  @@map("notification_logs")
}
```

---

## Migration 策略

### 1. 建立遷移檔案

```bash
pnpm prisma migrate dev --name add_web_platform_models
```

這會產生遷移檔案：`prisma/migrations/20251027_add_web_platform_models/migration.sql`

### 2. 遷移內容

```sql
-- CreateTable: User
CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ApiKey
CREATE TABLE "api_keys" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "exchange" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "encryptedKey" TEXT NOT NULL,
  "encryptedSecret" TEXT NOT NULL,
  "encryptedPassphrase" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastValidatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Position
CREATE TABLE "positions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "opportunityId" TEXT,
  "symbol" TEXT NOT NULL,
  "longExchange" TEXT NOT NULL,
  "longOrderId" TEXT,
  "longEntryPrice" DECIMAL(18,8) NOT NULL,
  "longPositionSize" DECIMAL(18,8) NOT NULL,
  "longLeverage" INTEGER NOT NULL,
  "shortExchange" TEXT NOT NULL,
  "shortOrderId" TEXT,
  "shortEntryPrice" DECIMAL(18,8) NOT NULL,
  "shortPositionSize" DECIMAL(18,8) NOT NULL,
  "shortLeverage" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "openedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "openFundingRateLong" DECIMAL(10,8) NOT NULL,
  "openFundingRateShort" DECIMAL(10,8) NOT NULL,
  CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Trade
CREATE TABLE "trades" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "positionId" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "longExchange" TEXT NOT NULL,
  "longEntryPrice" DECIMAL(18,8) NOT NULL,
  "longExitPrice" DECIMAL(18,8) NOT NULL,
  "longPositionSize" DECIMAL(18,8) NOT NULL,
  "shortExchange" TEXT NOT NULL,
  "shortEntryPrice" DECIMAL(18,8) NOT NULL,
  "shortExitPrice" DECIMAL(18,8) NOT NULL,
  "shortPositionSize" DECIMAL(18,8) NOT NULL,
  "openedAt" TIMESTAMP(3) NOT NULL,
  "closedAt" TIMESTAMP(3) NOT NULL,
  "holdingDuration" INTEGER NOT NULL,
  "priceDiffPnL" DECIMAL(18,8) NOT NULL,
  "fundingRatePnL" DECIMAL(18,8) NOT NULL,
  "totalPnL" DECIMAL(18,8) NOT NULL,
  "roi" DECIMAL(10,4) NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AuditLog
CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "resource" TEXT,
  "details" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "api_keys_userId_exchange_label_key" ON "api_keys"("userId", "exchange", "label");
CREATE UNIQUE INDEX "trades_positionId_key" ON "trades"("positionId");
CREATE INDEX "api_keys_userId_idx" ON "api_keys"("userId");
CREATE INDEX "positions_userId_idx" ON "positions"("userId");
CREATE INDEX "positions_userId_status_idx" ON "positions"("userId", "status");
CREATE INDEX "positions_symbol_idx" ON "positions"("symbol");
CREATE INDEX "trades_userId_idx" ON "trades"("userId");
CREATE INDEX "trades_userId_closedAt_idx" ON "trades"("userId", "closedAt" DESC);
CREATE INDEX "trades_symbol_idx" ON "trades"("symbol");
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt" DESC);
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "positions" ADD CONSTRAINT "positions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "positions" ADD CONSTRAINT "positions_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "arbitrage_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "trades" ADD CONSTRAINT "trades_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trades" ADD CONSTRAINT "trades_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Update ArbitrageOpportunity table (add new fields)
ALTER TABLE "arbitrage_opportunities" ADD COLUMN "longExchange" TEXT;
ALTER TABLE "arbitrage_opportunities" ADD COLUMN "shortExchange" TEXT;

-- TimescaleDB Hypertables (optional, manual)
-- SELECT create_hypertable('opportunity_histories', 'detectedAt');
-- SELECT create_hypertable('audit_logs', 'createdAt');
```

### 3. 執行遷移

```bash
pnpm prisma migrate deploy  # 生產環境
pnpm prisma generate        # 重新生成 Prisma Client
```

---

## 下一步

- **Phase 1 (續)**: 產生 API 合約 (contracts/openapi.yaml, contracts/websocket.md)
- **Phase 1 (續)**: 產生快速開始指南 (quickstart.md)
- **Phase 2**: 產生開發任務清單 (tasks.md) - 使用 `/speckit.tasks` 指令
