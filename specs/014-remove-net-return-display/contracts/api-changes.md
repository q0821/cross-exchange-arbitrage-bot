# API Contract Changes: 移除淨收益欄位

**Feature**: 014-remove-net-return-display
**Date**: 2025-01-17
**Version**: API v1 (no version bump required)

## Overview

本文檔描述移除淨收益欄位功能對 API 合約的影響。主要變更為移除 `/api/market-rates` 端點和 WebSocket 推送中的 `netReturn` 欄位。

## HTTP API Changes

### GET /api/market-rates

**Status**: Modified (Breaking Change - 移除欄位)

#### Before (Current)

```typescript
// Response
interface MarketRatesResponse {
  rates: Array<{
    symbol: string;
    bestPair: {
      longExchange: string;
      shortExchange: string;
      spreadPercent: number;
      priceDiffPercent: number;
      annualizedReturn: number;
      netReturn: number;           // ❌ 將被移除
      longFundingRate: number;
      shortFundingRate: number;
      longPrice: number;
      shortPrice: number;
    };
    allExchanges: Array<{
      exchange: string;
      rate: number;
      price: number;
    }>;
  }>;
  timestamp: string;
}
```

#### After (New)

```typescript
// Response
interface MarketRatesResponse {
  rates: Array<{
    symbol: string;
    bestPair: {
      longExchange: string;
      shortExchange: string;
      spreadPercent: number;        // ✅ 保留
      priceDiffPercent: number;     // ✅ 保留
      annualizedReturn: number;     // ✅ 保留
      // netReturn: removed          // ❌ 已移除
      longFundingRate: number;
      shortFundingRate: number;
      longPrice: number;
      shortPrice: number;
    };
    allExchanges: Array<{
      exchange: string;
      rate: number;
      price: number;
    }>;
  }>;
  timestamp: string;
}
```

#### Breaking Change Analysis

**Impact**: Low
- **Affected Clients**: 僅 Web 前端（`app/(dashboard)/market-monitor/`）
- **Mitigation**: 前端 TypeScript 類型會自動檢測缺失欄位，編譯時報錯
- **Backward Compatibility**: 無法向後兼容（移除欄位），但這是有意為之的破壞性變更

**Migration Guide for Clients**:

1. 更新 TypeScript 介面定義，移除 `netReturn` 欄位
2. 移除所有依賴 `netReturn` 的 UI 邏輯（顏色編碼、排序、高收益標記）
3. 使用 `spreadPercent` 替代 `netReturn` 進行套利機會判斷

#### API Response Example

**Before**:
```json
{
  "rates": [
    {
      "symbol": "BTCUSDT",
      "bestPair": {
        "longExchange": "BINANCE",
        "shortExchange": "OKX",
        "spreadPercent": 0.5,
        "priceDiffPercent": 0.15,
        "annualizedReturn": 547.5,
        "netReturn": 0.05,
        "longFundingRate": 0.01,
        "shortFundingRate": -0.04,
        "longPrice": 50000.5,
        "shortPrice": 50075.75
      },
      "allExchanges": [...]
    }
  ],
  "timestamp": "2025-01-17T10:00:00.000Z"
}
```

**After**:
```json
{
  "rates": [
    {
      "symbol": "BTCUSDT",
      "bestPair": {
        "longExchange": "BINANCE",
        "shortExchange": "OKX",
        "spreadPercent": 0.5,
        "priceDiffPercent": 0.15,
        "annualizedReturn": 547.5,
        // "netReturn": removed
        "longFundingRate": 0.01,
        "shortFundingRate": -0.04,
        "longPrice": 50000.5,
        "shortPrice": 50075.75
      },
      "allExchanges": [...]
    }
  ],
  "timestamp": "2025-01-17T10:00:00.000Z"
}
```

---

## WebSocket API Changes

### Event: `market-rates:update`

**Status**: Modified (Breaking Change - 移除欄位)

#### Before (Current)

```typescript
// WebSocket Message
interface MarketRatesUpdateEvent {
  event: 'market-rates:update';
  data: {
    symbol: string;
    bestPair: {
      longExchange: string;
      shortExchange: string;
      spreadPercent: number;
      priceDiffPercent: number;
      annualizedReturn: number;
      netReturn: number;           // ❌ 將被移除
      longFundingRate: number;
      shortFundingRate: number;
      longPrice: number;
      shortPrice: number;
    };
  };
  timestamp: string;
}
```

#### After (New)

```typescript
// WebSocket Message
interface MarketRatesUpdateEvent {
  event: 'market-rates:update';
  data: {
    symbol: string;
    bestPair: {
      longExchange: string;
      shortExchange: string;
      spreadPercent: number;        // ✅ 保留
      priceDiffPercent: number;     // ✅ 保留
      annualizedReturn: number;     // ✅ 保留
      // netReturn: removed          // ❌ 已移除
      longFundingRate: number;
      shortFundingRate: number;
      longPrice: number;
      shortPrice: number;
    };
  };
  timestamp: string;
}
```

#### Breaking Change Analysis

**Impact**: Low
- **Affected Clients**: 僅 Web 前端 WebSocket 訂閱者
- **Mitigation**: 前端 Socket.io 客戶端會接收新格式數據，TypeScript 類型檢查確保正確使用
- **Backward Compatibility**: 無法向後兼容

---

## No New Endpoints

**Status**: 無新增 API 端點

本功能僅移除現有端點的欄位，不新增任何 API 端點。

---

## API Implementation Changes

### File: `/app/api/market-rates/route.ts`

**Changes Required**:

```typescript
// Before: 計算並返回 netReturn
const TOTAL_COST_RATE = 0.005; // 0.5%
const netSpread = (spreadPercent / 100) - TOTAL_COST_RATE;
const netAnnualized = netSpread * 365 * 3 * 100;

return {
  // ... 其他欄位
  netReturn: netAnnualized,  // ❌ 移除此行
};
```

```typescript
// After: 不計算也不返回 netReturn
return {
  // ... 其他欄位
  // netReturn 欄位移除
};
```

### File: `/src/websocket/handlers/MarketRatesHandler.ts`

**Changes Required**:

```typescript
// Before: 推送 netReturn
socket.emit('market-rates:update', {
  event: 'market-rates:update',
  data: {
    symbol: rate.symbol,
    bestPair: {
      // ... 其他欄位
      netReturn: rate.bestPair.netReturn ?? calculateNetReturn(...),  // ❌ 移除
    },
  },
});
```

```typescript
// After: 不推送 netReturn
socket.emit('market-rates:update', {
  event: 'market-rates:update',
  data: {
    symbol: rate.symbol,
    bestPair: {
      // ... 其他欄位
      // netReturn 欄位移除
    },
  },
});
```

---

## Error Handling

**No Changes**: 錯誤處理邏輯保持不變

現有錯誤碼和錯誤訊息無需修改：
- `400 Bad Request`: 無效參數（本功能無新增參數）
- `500 Internal Server Error`: 伺服器錯誤（錯誤處理邏輯不變）

---

## Rate Limiting

**No Changes**: API 速率限制保持不變

- `/api/market-rates`: 每分鐘 60 次請求（無變更）
- WebSocket 連接: 每個客戶端最多 1 個連接（無變更）

---

## Authentication & Authorization

**No Changes**: 認證和授權機制保持不變

- 無需身份驗證（公開 API）
- 無需授權檢查

---

## Deprecation Notice

### Deprecated Fields

| Field | Endpoint | Deprecation Date | Removal Date | Replacement |
|-------|----------|------------------|--------------|-------------|
| `netReturn` | GET /api/market-rates | 2025-01-17 | 2025-01-17 (immediate) | Use `spreadPercent` for opportunity assessment |
| `netReturn` | WebSocket market-rates:update | 2025-01-17 | 2025-01-17 (immediate) | Use `spreadPercent` for opportunity assessment |

**Note**: 由於此欄位具有誤導性，採用**立即移除**策略，無過渡期。

---

## Client Update Checklist

### For Frontend Developers

- [ ] 更新 TypeScript 介面定義（`types.ts`）
- [ ] 移除所有 `netReturn` 相關 UI 邏輯
- [ ] 更新排序功能（移除 netReturn 排序選項）
- [ ] 更新高收益標記邏輯（使用 spreadPercent）
- [ ] 更新單元測試和 E2E 測試
- [ ] 驗證 WebSocket 數據更新正常運作

### For Backend Developers

- [ ] 移除 API route 中的 netReturn 計算
- [ ] 移除 WebSocket handler 中的 netReturn 推送
- [ ] 更新 API 文件
- [ ] 執行 API 整合測試

---

## Testing Requirements

### API Testing

```bash
# Test GET /api/market-rates
curl http://localhost:3000/api/market-rates

# Expected: Response should NOT contain "netReturn" field
# Verify: jq '.rates[0].bestPair | has("netReturn")' should return false
```

### WebSocket Testing

```javascript
// Test WebSocket market-rates:update event
socket.on('market-rates:update', (data) => {
  console.assert(
    !('netReturn' in data.bestPair),
    'netReturn field should not exist'
  );
});
```

---

## Rollback Plan

**Status**: Low Risk - Rollback Not Required

**Reason**:
- 僅移除欄位，不影響資料庫
- 前端 TypeScript 類型會確保正確使用
- 無第三方 API 依賴

**If Rollback Needed**:
1. 恢復 API route 中的 netReturn 計算邏輯
2. 恢復 WebSocket handler 中的 netReturn 推送
3. 恢復前端類型定義
4. 重新部署

---

## Summary

### Changes Overview

- ✅ 移除 `GET /api/market-rates` 返回的 `netReturn` 欄位
- ✅ 移除 WebSocket `market-rates:update` 事件中的 `netReturn` 欄位
- ✅ 保留所有其他欄位（`spreadPercent`, `priceDiffPercent`, `annualizedReturn`）
- ✅ 無新增 API 端點
- ✅ 無認證/授權變更
- ✅ 無速率限制變更

### Impact Assessment

- **Breaking Change**: Yes (field removal)
- **Impact Scope**: Web frontend only
- **Risk Level**: Low
- **Rollback Difficulty**: Easy

### Next Steps

1. 實施 API 變更（移除 netReturn 計算和返回）
2. 更新前端代碼適配新 API 合約
3. 執行 API 整合測試
4. 部署並驗證
