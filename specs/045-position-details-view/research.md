# Research: 持倉詳情查看功能

**Feature**: 045-position-details-view
**Date**: 2025-12-28

## Overview

本功能在技術層面較為直接，因為大部分基礎設施已存在：
- 交易所 API 查詢：使用既有的 CCXT 封裝
- 資金費率查詢：使用既有的 `FundingFeeQueryService`
- 前端框架：使用既有的 React + Tailwind CSS 元件

## Research Tasks

### 1. 即時價格查詢方式

**Decision**: 使用 CCXT `fetchTicker` API

**Rationale**:
- 專案已廣泛使用 CCXT 作為統一交易所封裝
- `fetchTicker` 提供 `last`（最新價格）、`bid`、`ask` 等資訊
- 所有支援的交易所（Binance、OKX、MEXC、Gate.io、BingX）都支援此 API

**Alternatives considered**:
- WebSocket 訂閱：過度設計，僅需即時查詢
- REST API 直連：需要為每個交易所維護不同的實作

**Code Pattern** (from existing codebase):
```typescript
// src/services/trading/PositionOrchestrator.ts
const ticker = await ccxtExchange.fetchTicker(ccxtSymbol);
const currentPrice = ticker.last || 0;
```

### 2. 未實現損益計算公式

**Decision**: 採用雙邊損益計算

**Rationale**:
- Long 損益 = (當前價格 - 開倉價格) × 持倉數量
- Short 損益 = (開倉價格 - 當前價格) × 持倉數量
- 總未實現損益 = Long 損益 + Short 損益

**Note**: 由於是對沖套利，理論上價差損益應接近零，主要收益來自資金費率差。

### 3. 資金費率歷史查詢

**Decision**: 重用既有的 `FundingFeeQueryService`

**Rationale**:
- Feature 041 已實作完整的資金費率查詢功能
- 支援雙邊查詢 `queryBilateralFundingFees`
- 已處理時間範圍過濾和交易所差異

**Existing Implementation**:
```typescript
// src/services/trading/FundingFeeQueryService.ts
async queryBilateralFundingFees(
  longExchange: SupportedExchange,
  shortExchange: SupportedExchange,
  symbol: string,
  startTime: Date,
  endTime: Date,
  userId: string,
): Promise<BilateralFundingFeeResult>
```

### 4. 年化報酬率計算

**Decision**: 按規格公式計算，持倉時間超過 1 分鐘且有損益時可計算

**Formula**:
```
年化報酬率 = (總損益 / 保證金) × (365 × 24 / 持倉小時數) × 100%

其中：
- 總損益 = 未實現價差損益 + 資金費率損益
- 保證金 = (多頭持倉價值 + 空頭持倉價值) / 槓桿倍數
- 持倉小時數 = (現在時間 - 開倉時間) / 3600000
```

**Edge Cases**:
- 持倉時間 < 1 分鐘：顯示「資料不足，無法計算年化」
- 保證金為 0：避免除以零，顯示 N/A

### 5. 開倉手續費取得

**Decision**: 從 Position 模型現有欄位取得

**Analysis**:
- Position 模型沒有直接的手續費欄位
- 但開倉時的 Trade 記錄會包含手續費資訊
- 可通過 Position → Trade 關聯查詢

**Alternative**: 如果 Trade 記錄不可用，標記為 `SHOULD`（非必要功能），不顯示手續費。

### 6. 前端展開/收起模式

**Decision**: 使用 React state 控制展開狀態

**Pattern**:
```typescript
const [expandedPositionId, setExpandedPositionId] = useState<string | null>(null);

const handleToggleExpand = (positionId: string) => {
  if (expandedPositionId === positionId) {
    setExpandedPositionId(null);
  } else {
    setExpandedPositionId(positionId);
    // 觸發 API 查詢
  }
};
```

**Alternatives considered**:
- Accordion component library：增加依賴，簡單展開不需要
- All expanded by default：違反「展開時才查詢」的需求

### 7. API 錯誤處理策略

**Decision**: 分離顯示 + 部分成功

**Rationale**:
- 單一 API 失敗（如價格查詢失敗）不應阻止其他資訊顯示
- 失敗項目顯示錯誤訊息和重試按鈕
- 成功項目正常顯示

**Pattern**:
```typescript
interface PositionDetailsResponse {
  success: boolean;
  data: {
    // 必要資訊
    longEntryPrice: string;
    shortEntryPrice: string;
    longCurrentPrice?: number;    // optional - API 可能失敗
    shortCurrentPrice?: number;   // optional
    // ...
  };
  errors?: {
    priceQuery?: string;
    fundingFeeQuery?: string;
  };
}
```

## Dependencies Review

| Dependency | Version | Purpose | Status |
|------------|---------|---------|--------|
| CCXT | 4.x | 交易所 API 統一封裝 | ✅ Already installed |
| Decimal.js | latest | 財務精度計算 | ✅ Already installed |
| Prisma | 5.x | 資料庫 ORM | ✅ Already installed |
| React | 18 | 前端框架 | ✅ Already installed |
| Tailwind CSS | latest | 樣式 | ✅ Already installed |
| Lucide React | latest | 圖示 | ✅ Already installed |

## Security Considerations

- **API Key 安全**: 交易所 API 呼叫僅在後端執行，API Key 不暴露於前端
- **授權檢查**: API endpoint 需驗證用戶擁有該 Position
- **Rate Limiting**: 依賴 CCXT 內建的 rate limiting

## Performance Considerations

- **並行查詢**: Long 和 Short 的價格查詢可並行執行
- **快取**: 本次不實作快取，每次展開重新查詢確保資料最新
- **超時**: 設定 3 秒超時，超時顯示錯誤

## Conclusion

所有技術決策已確定，無需額外研究。可進入 Phase 1 設計階段。
