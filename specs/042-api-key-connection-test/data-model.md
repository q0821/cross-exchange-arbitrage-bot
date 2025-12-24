# Data Model: API Key 連線測試

**Feature**: 042-api-key-connection-test
**Date**: 2025-12-24

## 現有模型（無需修改）

### ApiKey

現有 Prisma 模型已包含所需欄位：

```prisma
model ApiKey {
  id                  String         @id @default(cuid())
  userId              String
  exchange            String         @db.VarChar(50)
  environment         ApiEnvironment @default(MAINNET)
  label               String         @db.VarChar(100)
  encryptedKey        String         @db.Text
  encryptedSecret     String         @db.Text
  encryptedPassphrase String?        @db.Text
  isActive            Boolean        @default(true)
  lastValidatedAt     DateTime?      @db.Timestamptz  // ← 用於記錄最後驗證時間
  createdAt           DateTime       @default(now()) @db.Timestamptz
  updatedAt           DateTime       @updatedAt @db.Timestamptz

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, exchange, label])
  @@index([userId, isActive])
  @@index([exchange])
  @@map("api_keys")
}
```

**說明**: `lastValidatedAt` 欄位已存在，將在測試成功時更新。

---

## 新增類型定義

### ValidationResult（擴展現有）

位置：`src/services/apikey/ApiKeyValidator.ts`

```typescript
export interface ValidationResult {
  isValid: boolean;
  hasReadPermission: boolean;
  hasTradePermission: boolean;
  error?: string;
  errorCode?: ValidationErrorCode;
  details?: ValidationDetails;
}

export type ValidationErrorCode =
  | 'INVALID_API_KEY'
  | 'INVALID_SECRET'
  | 'INVALID_PASSPHRASE'
  | 'IP_NOT_WHITELISTED'
  | 'INSUFFICIENT_PERMISSION'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'EXCHANGE_ERROR'
  | 'UNKNOWN_ERROR';

export interface ValidationDetails {
  exchange: string;
  environment: 'MAINNET' | 'TESTNET';
  balance?: {
    total: number;
    available: number;
    currency: string;
  };
  permissions?: string[];
  responseTime?: number; // ms
}
```

### ConnectionTestRequest

位置：`src/types/api-key-validation.ts`

```typescript
/**
 * 新增 API Key 時的連線測試請求
 */
export interface ConnectionTestRequest {
  exchange: 'binance' | 'okx' | 'gateio' | 'mexc';
  environment: 'MAINNET' | 'TESTNET';
  apiKey: string;
  apiSecret: string;
  passphrase?: string; // OKX only
}

/**
 * 重新測試已儲存 API Key 的請求
 */
export interface RevalidateRequest {
  apiKeyId: string;
}
```

### ConnectionTestResponse

位置：`src/types/api-key-validation.ts`

```typescript
export interface ConnectionTestResponse {
  success: boolean;
  data?: {
    isValid: boolean;
    hasReadPermission: boolean;
    hasTradePermission: boolean;
    details?: {
      balance?: {
        total: number;
        available: number;
        currency: string;
      };
      permissions?: string[];
      responseTime: number;
    };
  };
  error?: {
    code: ValidationErrorCode;
    message: string;
  };
}
```

---

## 狀態轉換

### API Key 驗證狀態（顯示用）

```
┌─────────────┐
│   UNKNOWN   │ ← 新建立的 API Key (lastValidatedAt = null)
└──────┬──────┘
       │ 用戶點擊「測試連線」
       ▼
┌─────────────┐     測試失敗     ┌─────────────┐
│   TESTING   │ ───────────────► │   INVALID   │
└──────┬──────┘                  └─────────────┘
       │ 測試成功
       ▼
┌─────────────┐
│    VALID    │ ← lastValidatedAt 更新為當前時間
└──────┬──────┘
       │ 超過 24 小時
       ▼
┌─────────────┐
│   EXPIRED   │ ← 建議重新測試
└─────────────┘
```

**說明**: 這是前端顯示用的邏輯狀態，不需要在資料庫中儲存。根據 `lastValidatedAt` 和驗證結果計算。

---

## 關係圖

```
┌─────────────────────────────────────────────────────────┐
│                      User                               │
│  id, email, name, ...                                   │
└────────────────────────┬────────────────────────────────┘
                         │ 1:N
                         ▼
┌─────────────────────────────────────────────────────────┐
│                     ApiKey                              │
│  id, userId, exchange, environment, label,              │
│  encryptedKey, encryptedSecret, encryptedPassphrase,    │
│  isActive, lastValidatedAt, createdAt, updatedAt        │
└─────────────────────────────────────────────────────────┘
                         │
                         │ 驗證時解密
                         ▼
┌─────────────────────────────────────────────────────────┐
│              DecryptedApiKey (記憶體)                    │
│  apiKey, apiSecret, passphrase?                         │
└─────────────────────────────────────────────────────────┘
                         │
                         │ 呼叫交易所 API
                         ▼
┌─────────────────────────────────────────────────────────┐
│            ValidationResult (回應)                       │
│  isValid, hasReadPermission, hasTradePermission,        │
│  error?, errorCode?, details?                           │
└─────────────────────────────────────────────────────────┘
```

---

## 無需資料庫遷移

此功能不需要修改資料庫 schema，因為：
1. `lastValidatedAt` 欄位已存在
2. 驗證狀態為計算值（前端顯示用）
3. 驗證結果不需持久化
