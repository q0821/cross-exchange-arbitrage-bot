# Data Model: MEXC 交易所開倉限制處理

**Feature**: 044-mexc-trading-restriction
**Date**: 2025-12-25

## 概述

此功能為純前端 UI 功能，不涉及資料庫 schema 變更。僅需定義 TypeScript 型別用於配置受限交易所資訊。

## 型別定義

### RestrictedExchangeId

受限交易所的識別碼類型。

```typescript
export type RestrictedExchangeId = 'mexc';
```

**說明**: 使用聯合型別限定可能的受限交易所，便於未來擴展。

---

### RestrictionType

限制類型的列舉。

```typescript
export type RestrictionType = 'api_trading_disabled';
```

**說明**: 目前僅有 API 交易禁用一種限制類型，未來可能擴展為其他類型（如 `read_only`, `maintenance` 等）。

---

### ExchangeRestriction

交易所限制的完整資訊。

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| exchangeId | RestrictedExchangeId | ✅ | 交易所識別碼 |
| restrictionType | RestrictionType | ✅ | 限制類型 |
| message | string | ✅ | 顯示給用戶的提示訊息 |
| externalUrl | string | ✅ | 交易所外部連結（開新分頁） |

```typescript
export interface ExchangeRestriction {
  exchangeId: RestrictedExchangeId;
  restrictionType: RestrictionType;
  message: string;
  externalUrl: string;
}
```

---

## 配置常量

### RESTRICTED_EXCHANGES

受限交易所的配置映射表。

```typescript
export const RESTRICTED_EXCHANGES: Record<RestrictedExchangeId, ExchangeRestriction> = {
  mexc: {
    exchangeId: 'mexc',
    restrictionType: 'api_trading_disabled',
    message: 'MEXC 不支援 API 開倉，請手動建倉',
    externalUrl: 'https://futures.mexc.com/exchange',
  },
};
```

---

## 工具函數

### isExchangeRestricted

檢查單一交易所是否受限。

```typescript
function isExchangeRestricted(exchangeId: string): boolean
```

**參數**: exchangeId - 交易所識別碼
**返回**: 是否為受限交易所

---

### getExchangeRestriction

獲取交易所限制詳情。

```typescript
function getExchangeRestriction(exchangeId: string): ExchangeRestriction | null
```

**參數**: exchangeId - 交易所識別碼
**返回**: 限制詳情，若無限制則返回 null

---

### isArbitragePairRestricted

檢查套利對是否涉及受限交易所。

```typescript
function isArbitragePairRestricted(longExchange: string, shortExchange: string): boolean
```

**參數**:
- longExchange - 做多方交易所
- shortExchange - 做空方交易所

**返回**: 是否涉及受限交易所（任一方受限即返回 true）

---

## 使用範例

### 在 OpenPositionButton 中

```typescript
import { isArbitragePairRestricted, getExchangeRestriction } from '@/lib/trading-restrictions';

// 檢查是否受限
const isRestricted = rate?.bestPair
  ? isArbitragePairRestricted(rate.bestPair.longExchange, rate.bestPair.shortExchange)
  : false;

// 獲取限制訊息用於 Tooltip
const restriction = isRestricted
  ? getExchangeRestriction('mexc')
  : null;
```

### 在 OpenPositionDialog 中

```typescript
import { isArbitragePairRestricted, RESTRICTED_EXCHANGES } from '@/lib/trading-restrictions';

// 檢查並顯示警告
const isRestricted = isArbitragePairRestricted(longExchange, shortExchange);

{isRestricted && (
  <Alert variant="warning">
    <AlertTriangle />
    <span>{RESTRICTED_EXCHANGES.mexc.message}</span>
    <a href={RESTRICTED_EXCHANGES.mexc.externalUrl} target="_blank">
      前往 MEXC 手動操作
    </a>
  </Alert>
)}
```

---

## 擴展指南

若未來需要新增其他受限交易所：

1. 更新 `RestrictedExchangeId` 型別：
   ```typescript
   export type RestrictedExchangeId = 'mexc' | 'newexchange';
   ```

2. 在 `RESTRICTED_EXCHANGES` 中新增配置：
   ```typescript
   newexchange: {
     exchangeId: 'newexchange',
     restrictionType: 'api_trading_disabled',
     message: '提示訊息',
     externalUrl: 'https://...',
   },
   ```

無需修改任何 UI 元件，限制邏輯會自動生效。
