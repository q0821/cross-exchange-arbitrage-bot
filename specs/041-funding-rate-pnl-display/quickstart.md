# Quickstart: 交易歷史資金費率損益顯示

**Feature**: 041-funding-rate-pnl-display
**Created**: 2025-12-24

## Overview

本功能在平倉時從各交易所查詢持倉期間的資金費率收支歷史，計算實際的 `fundingRatePnL` 並納入 Trade 記錄。

## Prerequisites

- Node.js 20.x LTS
- PostgreSQL 15 + TimescaleDB（已配置）
- 有效的交易所 API Key（Binance, OKX, Gate.io, MEXC）
- CCXT 4.x（已安裝）

## Quick Verification

### 1. 驗證環境

```bash
# 確認資料庫運行
docker ps | grep postgres

# 確認 API Key 已配置（至少一個交易所）
pnpm tsx src/scripts/verify-api-keys.ts
```

### 2. 功能測試流程

```
1. 開倉（確保會跨過資金費率結算時間點）
2. 等待至少跨過一個結算時間點（1h/4h/8h 視幣種而定）
3. 執行平倉
4. 查看交易歷史，驗證 fundingRatePnL 不為 0
```

## Implementation Summary

### New Files

```
src/services/trading/
├── FundingFeeQueryService.ts    # 資金費率歷史查詢服務
└── adapters/
    └── FundingFeeAdapter.ts     # 查詢介面定義（可選）
```

### Modified Files

```
src/services/trading/
└── PositionCloser.ts            # 平倉時調用查詢服務
```

### Key Code Changes

#### 1. PositionCloser.ts

```typescript
// Before (line ~489)
fundingRatePnL: new Decimal(0), // 簡化：資金費率損益設為 0

// After
const fundingFeeResult = await this.fundingFeeQueryService.queryBilateralFundingFees(
  position.longExchange,
  position.shortExchange,
  position.symbol,
  position.openedAt,
  closedAt,
  position.userId
);
fundingRatePnL: fundingFeeResult.totalFundingFee,
```

#### 2. FundingFeeQueryService.ts

```typescript
class FundingFeeQueryService {
  async queryFundingFees(
    exchange: SupportedExchange,
    symbol: string,
    startTime: Date,
    endTime: Date,
    userId: string
  ): Promise<Decimal> {
    const ccxt = await this.createCcxtExchange(exchange, userId);
    const ccxtSymbol = this.convertToCcxtSymbol(symbol);

    try {
      const history = await ccxt.fetchFundingHistory(
        ccxtSymbol,
        startTime.getTime(),
        undefined,
        { until: endTime.getTime() }
      );

      return history.reduce(
        (sum, entry) => sum.plus(new Decimal(entry.amount)),
        new Decimal(0)
      );
    } catch (error) {
      logger.warn({ error, exchange, symbol }, 'Failed to fetch funding history');
      return new Decimal(0);
    }
  }
}
```

## Testing

### Unit Test Example

```typescript
// tests/unit/services/FundingFeeQueryService.test.ts
describe('FundingFeeQueryService', () => {
  describe('queryFundingFees', () => {
    it('should return sum of funding fees', async () => {
      // Arrange
      const mockCcxt = {
        fetchFundingHistory: vi.fn().mockResolvedValue([
          { amount: 0.5, timestamp: 1000 },
          { amount: -0.2, timestamp: 2000 },
        ])
      };

      // Act
      const result = await service.queryFundingFees(
        'binance', 'BTCUSDT', startTime, endTime, userId
      );

      // Assert
      expect(result.toNumber()).toBe(0.3);
    });

    it('should return 0 on API failure', async () => {
      // Arrange
      const mockCcxt = {
        fetchFundingHistory: vi.fn().mockRejectedValue(new Error('API Error'))
      };

      // Act
      const result = await service.queryFundingFees(
        'binance', 'BTCUSDT', startTime, endTime, userId
      );

      // Assert
      expect(result.toNumber()).toBe(0);
      expect(logger.warn).toHaveBeenCalled();
    });
  });
});
```

## Verification Checklist

- [ ] 新平倉的 Trade 記錄 `fundingRatePnL` 不為 0（跨過結算時間點時）
- [ ] `totalPnL = priceDiffPnL + fundingRatePnL - totalFees` 計算正確
- [ ] 交易歷史 UI 正確顯示資金費率損益
- [ ] API 查詢失敗時，平倉流程正常完成，fundingRatePnL 為 0
- [ ] 日誌記錄查詢結果和錯誤

## Troubleshooting

### fundingRatePnL 仍為 0

1. **檢查持倉時間**：確認是否跨過資金費率結算時間點
2. **檢查 API Key 權限**：確認有查詢帳戶資料的權限
3. **查看日誌**：檢查是否有警告或錯誤訊息

### API Rate Limit

如果遇到 Rate Limit 錯誤，系統會降級處理（fundingRatePnL = 0）並記錄警告。這不影響平倉功能。

## API Reference

### CCXT fetchFundingHistory

```typescript
// 方法簽名
fetchFundingHistory(
  symbol?: string,
  since?: number,
  limit?: number,
  params?: { until?: number }
): Promise<FundingHistoryEntry[]>

// 返回格式
interface FundingHistoryEntry {
  info: object;
  symbol: string;       // "BTC/USDT:USDT"
  code: string;         // "USDT"
  timestamp: number;
  datetime: string;
  id: string;
  amount: number;       // 正=收到, 負=支付
}
```
