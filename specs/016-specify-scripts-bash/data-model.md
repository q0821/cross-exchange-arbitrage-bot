# Data Model: 擴大交易對監控規模

**Feature**: 016-specify-scripts-bash | **Date**: 2025-11-18
**Status**: 無資料模型變更

## Summary

此功能為**純配置擴展**，不涉及任何資料模型變更。所有數據結構維持現有設計，僅更新配置檔案中的交易對清單。

---

## Configuration File Structure

### `config/symbols.json`

**現有結構**:
```json
{
  "description": "套利監控交易對配置",
  "note": "top100_oi 群組由 MonitorService 使用，包含 30 個高 OI 交易對（適合套利的熱門標的）",
  "lastUpdate": "2025-11-12",
  "groups": {
    "default": {
      "name": "主流幣（BTC、ETH、SOL）",
      "symbols": ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
    },
    "top30": {
      "name": "市值前 30 大及高流動性",
      "symbols": ["BTCUSDT", "ETHUSDT", ...]
    },
    "top100_oi": {
      "name": "高 OI 交易對（伺服器監控列表）",
      "symbols": [
        "BTCUSDT",
        "ETHUSDT",
        "SOLUSDT",
        // ... 目前 30 個交易對
      ]
    }
  }
}
```

**更新後結構** (僅 `top100_oi.symbols` 陣列擴展):
```json
{
  "description": "套利監控交易對配置",
  "note": "top100_oi 群組由 MonitorService 使用，包含 100 個高 OI 交易對（適合套利的熱門標的）",
  "lastUpdate": "2025-11-18",  // 自動更新
  "groups": {
    "default": { /* 不變 */ },
    "top30": { /* 不變 */ },
    "top100_oi": {
      "name": "高 OI 交易對（伺服器監控列表）",
      "symbols": [
        "BTCUSDT",
        "ETHUSDT",
        // ... 擴展至 100 個交易對
      ]
    }
  }
}
```

**變更說明**:
- ✅ 結構完全相同，僅陣列長度改變
- ✅ 向後兼容，現有程式碼無需修改
- ✅ `lastUpdate` 欄位自動更新為執行腳本的日期

---

## In-Memory Data Structures (No Changes)

### FundingRatePair (`src/models/FundingRate.ts`)

**現有介面** (維持不變):
```typescript
export interface FundingRatePair {
  symbol: string;
  exchanges: Record<ExchangeName, ExchangeRateData>;
  spreadPercent?: number;
  bestPair?: {
    longExchange: ExchangeName;
    shortExchange: ExchangeName;
    spreadPercent: number;
    longRate: number;
    shortRate: number;
  };
  updatedAt: Date;
}
```

**記憶體使用**:
- 30 個交易對: ~24 KB
- 100 個交易對: ~80 KB
- **增加量**: ~56 KB (可忽略)

### RatesCache (`src/services/monitor/RatesCache.ts`)

**現有實作** (維持不變):
```typescript
export class RatesCache {
  private cache = new Map<string, CachedRatePair>();
  // ... 無需修改
}
```

**擴展行為**:
- ✅ `Map` 自動擴展，無容量限制
- ✅ 快取邏輯完全相同
- ✅ 過期機制（10 分鐘）維持不變

---

## Database Models (No Changes)

### PostgreSQL + TimescaleDB

此功能**不涉及資料庫 schema 變更**。

**現有表結構**:
- `FundingRateValidation`: 資金費率歷史驗證記錄
- `PriceData`: 價格數據歷史記錄
- `ArbitrageAssessment`: 套利評估記錄

**更新影響**:
- ✅ 這些表僅儲存歷史數據，不依賴交易對數量
- ✅ 100 個交易對會產生更多歷史記錄，但表結構無需變更
- ✅ TimescaleDB hypertables 自動分區，效能不受影響

**預估數據增長**:
```
每日新增記錄 = 100 symbols × 4 exchanges × (1440/5) records
              = 100 × 4 × 288
              = 115,200 records/day

估算大小 = 115,200 × ~200 bytes ≈ 23 MB/day
```

✅ PostgreSQL + TimescaleDB 可輕鬆處理此數據量

---

## API Response Models (No Changes)

### GET /api/market-rates

**現有響應格式** (維持不變):
```typescript
{
  "rates": [
    {
      "symbol": "BTCUSDT",
      "exchanges": {
        "binance": { "rate": 0.0001, "nextTime": "2025-11-18T08:00:00Z" },
        "okx": { "rate": 0.0002, "nextTime": "2025-11-18T08:00:00Z" },
        // ...
      },
      "spreadPercent": 0.01,
      "bestPair": { /* ... */ },
      "updatedAt": "2025-11-18T07:55:23Z"
    },
    // ... 從 30 個擴展至 100 個物件
  ],
  "timestamp": "2025-11-18T07:55:23Z"
}
```

**變更說明**:
- ✅ JSON 陣列長度從 30 增加至 100
- ✅ 單一物件結構完全相同
- ✅ 前端程式碼無需修改（自動適應陣列長度）

---

## WebSocket Event Models (No Changes)

### `rates:update` Event

**現有事件格式** (維持不變):
```typescript
{
  "type": "rates:update",
  "data": {
    "rates": [
      { /* FundingRatePair */ },
      // ... 從 30 個擴展至 100 個
    ],
    "timestamp": "2025-11-18T07:55:23Z"
  }
}
```

**影響分析**:
- ✅ 事件結構不變，僅陣列長度增加
- ✅ Socket.io 可處理更大的 payload (估算 ~40KB)
- ✅ 前端 WebSocket 監聽器無需修改

---

## Configuration Schema (No Changes)

### TypeScript Type Definitions

**現有型別** (`src/types/*.ts` 維持不變):
```typescript
export interface SymbolsConfig {
  description: string;
  note: string;
  lastUpdate: string;
  groups: {
    [key: string]: {
      name: string;
      symbols: string[];  // ✅ 陣列長度可變，無需修改型別
    };
  };
}
```

**Zod Schema** (如使用，維持不變):
```typescript
import { z } from 'zod';

const symbolsConfigSchema = z.object({
  description: z.string(),
  note: z.string(),
  lastUpdate: z.string(),
  groups: z.record(z.object({
    name: z.string(),
    symbols: z.array(z.string()),  // ✅ 自動驗證任意長度陣列
  })),
});
```

---

## Migration Guide

### 無需執行 Prisma Migration

```bash
# 不需要執行
# pnpm prisma migrate dev
```

### 無需執行資料庫 Schema 變更

```sql
-- 不需要任何 SQL 指令
```

### 配置更新流程

**唯一需要的操作**:
```bash
# 1. 備份現有配置（建議）
cp config/symbols.json config/symbols.json.backup

# 2. 執行 OI 更新腳本
OI_TOP_N=100 pnpm update-oi-symbols

# 3. 驗證更新
cat config/symbols.json | jq '.groups.top100_oi.symbols | length'
# 輸出應為: 100
```

---

## Data Flow (No Changes)

### 監控流程

```
1. FundingRateMonitor 讀取 config/symbols.json
   ↓
2. 載入 top100_oi.symbols 陣列（30 → 100 個）
   ↓
3. 對每個 symbol，呼叫 4 個交易所 API
   ↓
4. 將結果儲存至 RatesCache (in-memory)
   ↓
5. 透過 WebSocket 推送至前端
   ↓
6. 前端顯示所有交易對
```

**變更點**: 僅步驟 2 的陣列長度改變，其他步驟邏輯完全相同

---

## Validation & Constraints

### 配置驗證 (由腳本自動處理)

**`update-oi-symbols.ts` 驗證**:
```typescript
// 自動驗證
1. ✅ 所有 symbols 必須是 USDT 永續合約 (endsWith('USDT'))
2. ✅ OI 必須 > 0
3. ✅ 按 OI 降序排列
4. ✅ 取前 N 名（N = OI_TOP_N）
5. ✅ 更新 lastUpdate 欄位
```

### 系統約束 (現有，維持不變)

```typescript
// src/services/monitor/FundingRateMonitor.ts
constructor(symbols: string[] = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']) {
  this.symbols = symbols;  // ✅ 無陣列長度限制
}
```

**結論**: 無硬編碼限制，系統自動適應任意數量的交易對

---

## Rollback Strategy

### 回滾至 30 個交易對

**選項 1: 從備份恢復**
```bash
cp config/symbols.json.backup config/symbols.json
pnpm dev  # 重啟服務
```

**選項 2: 重新執行腳本**
```bash
OI_TOP_N=30 pnpm update-oi-symbols
pnpm dev  # 重啟服務
```

**選項 3: 手動編輯**
```bash
# 編輯 config/symbols.json，將 top100_oi.symbols 陣列縮減至 30 個
pnpm dev  # 重啟服務
```

---

## Related Files

### 配置讀取
- `src/services/monitor/FundingRateMonitor.ts` - 讀取 symbols 陣列
- `src/cli/commands/monitor/start.ts` - CLI 啟動命令

### 配置更新
- `src/scripts/update-oi-symbols.ts` - OI 更新腳本

### 資料模型定義
- `src/models/FundingRate.ts` - FundingRatePair 介面
- `src/services/monitor/RatesCache.ts` - 快取實作

### API 響應
- `app/api/market-rates/route.ts` - REST API 端點
- `server.ts` - WebSocket 事件推送

---

## Summary

| 項目 | 變更 | 說明 |
|------|------|------|
| **Prisma Schema** | ❌ 無 | 不涉及資料庫結構 |
| **TypeScript 介面** | ❌ 無 | 現有型別已支援可變長度陣列 |
| **配置檔案結構** | ❌ 無 | 僅陣列內容改變，結構不變 |
| **API 響應格式** | ❌ 無 | 僅陣列長度改變，格式不變 |
| **WebSocket 事件** | ❌ 無 | 僅 payload 大小改變，格式不變 |
| **記憶體使用** | ✅ 增加 ~56KB | 可忽略不計 |
| **資料庫數據量** | ✅ 增加 ~23MB/天 | PostgreSQL 可輕鬆處理 |

**結論**: ✅ 無任何資料模型變更，完全向後兼容
