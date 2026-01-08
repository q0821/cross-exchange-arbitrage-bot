# API Contracts: 分單開倉（獨立持倉）

**Feature**: 060-split-position-open
**Date**: 2026-01-07

## 概述

此功能不新增任何 API 端點，完全複用現有的開倉 API。

## 現有 API（無修改）

### POST /api/positions/open

此 API 已存在且功能完整，分單開倉通過前端循環調用此 API 實現。

**請求格式**:

```typescript
interface OpenPositionRequest {
  symbol: string;           // 交易對符號，如 "BTCUSDT"
  longExchange: string;     // 做多交易所
  shortExchange: string;    // 做空交易所
  quantity: number;         // 開倉數量
  leverage: 1 | 2;          // 槓桿倍數
  stopLossEnabled: boolean; // 是否啟用停損
  stopLossPercent?: number; // 停損百分比
  takeProfitEnabled: boolean; // 是否啟用停利
  takeProfitPercent?: number; // 停利百分比
}
```

**響應格式**:

```typescript
interface OpenPositionResponse {
  success: boolean;
  data?: {
    positionId: string;
    symbol: string;
    quantity: number;
    longEntryPrice: number;
    shortEntryPrice: number;
  };
  error?: {
    code: string;
    message: string;
    details?: object;
  };
}
```

## 分單開倉調用模式

前端 Hook 負責分單邏輯，串行調用現有 API：

```typescript
// useOpenPosition.ts - 新增方法

async function executeSplitOpen(
  data: OpenPositionData,
  positionCount: number
): Promise<void> {
  const quantities = splitQuantity(data.quantity, positionCount);

  for (let i = 0; i < positionCount; i++) {
    setCurrentGroup(i + 1);
    setTotalGroups(positionCount);

    await executeOpen({
      ...data,
      quantity: quantities[i],
    });

    // 如果發生錯誤，executeOpen 會設置 error 狀態
    // 這裡檢查並提前返回
    if (error) {
      break;
    }
  }
}
```

## 錯誤代碼（現有）

| Code | 描述 |
|------|------|
| `LOCK_CONFLICT` | 該交易對正在開倉中 |
| `INSUFFICIENT_BALANCE` | 餘額不足 |
| `ROLLBACK_FAILED` | 開倉失敗且回滾失敗 |
| `BILATERAL_OPEN_FAILED` | 雙邊開倉都失敗 |
| `OPEN_FAILED_ROLLED_BACK` | 開倉失敗，已自動回滾 |
| `API_KEY_NOT_FOUND` | API Key 未設定 |
| `EXCHANGE_API_ERROR` | 交易所 API 錯誤 |
