# Technical Research: 修復時間基準切換功能

**Feature**: 019-fix-time-basis-switching
**Date**: 2025-01-19
**Status**: Complete

## Research Overview

本文件記錄為實作此功能所進行的技術調查和決策過程。由於這是一個錯誤修復功能，大部分技術棧已經確定，研究重點在於最佳修復策略和向後相容性。

## Decision 1: WebSocket 時間基準驗證策略

### Context
WebSocket handler 目前只接受 `[1, 8, 24]` 作為有效的時間基準值，但前端已經支援 4 小時選項。

### Decision
**選擇方案**：直接擴展驗證陣列以包含 4

```typescript
// 修改前
if (![1, 8, 24].includes(timeBasis)) { ... }

// 修改後
if (![1, 4, 8, 24].includes(timeBasis)) { ... }
```

### Rationale
- **簡單直接**：最小化變更範圍，降低引入新 bug 的風險
- **向後相容**：現有客戶端（1h, 8h, 24h）完全不受影響
- **效能無影響**：陣列查找是 O(n) 但 n=4，效能影響可忽略
- **可維護性高**：未來新增其他時間基準只需修改一個地方

### Alternatives Considered

**方案 A：使用 Zod schema 驗證**
```typescript
const TimeBasisSchema = z.union([z.literal(1), z.literal(4), z.literal(8), z.literal(24)]);
```
- **優點**：型別安全，集中管理驗證邏輯
- **拒絕原因**：引入額外複雜度，且專案已有 `fundingRateSchemas.ts` 中的 TimeBasis 型別定義，不需要重複定義

**方案 B：從共享型別推導**
```typescript
import { TimeBasis } from '@/lib/validation/fundingRateSchemas';
// 動態檢查是否為有效的 TimeBasis 值
```
- **優點**：單一資料來源
- **拒絕原因**：TypeScript 型別在 runtime 不可用，無法直接用於驗證

### References
- `src/websocket/handlers/MarketRatesHandler.ts:78-90`
- `src/lib/validation/fundingRateSchemas.ts` (TimeBasis 型別定義)

---

## Decision 2: REST API 回傳資料結構擴展

### Context
REST API 目前回傳的費率資料缺少 `normalized` 和 `originalInterval` 欄位，導致頁面重新載入後無法顯示標準化資訊。

### Decision
**選擇方案**：在現有資料結構中新增兩個欄位

```typescript
// 擴展 exchanges[exchangeName] 物件
exchanges[exchangeName] = {
  rate: exchangeData.rate.fundingRate,
  ratePercent: (exchangeData.rate.fundingRate * 100).toFixed(4),
  price: exchangeData.price || exchangeData.rate.markPrice,
  nextFundingTime: exchangeData.rate.nextFundingTime.toISOString(),
  // 新增欄位
  normalized: exchangeData.normalized || {},      // { '1h': number, '4h': number, '8h': number, '24h': number }
  originalInterval: exchangeData.originalFundingInterval  // number
};
```

### Rationale
- **向後相容**：新增欄位不會破壞現有客戶端（舊版前端會忽略不認識的欄位）
- **完整性**：與 WebSocket 推送的資料結構保持一致
- **前端友好**：前端可以直接使用相同的邏輯處理 REST 和 WebSocket 資料

### Alternatives Considered

**方案 A：新增獨立的 API 端點 `/api/market-rates/normalized`**
- **優點**：完全不影響現有 API
- **拒絕原因**：增加維護負擔，且兩個端點會返回重複資料

**方案 B：使用查詢參數控制是否回傳標準化資料**
```typescript
GET /api/market-rates?includeNormalized=true
```
- **優點**：更靈活
- **拒絕原因**：過度設計，目前前端總是需要標準化資料

### References
- `app/api/market-rates/route.ts:64-72`
- `src/websocket/handlers/MarketRatesHandler.ts:336-344` (WebSocket 格式參考)

---

## Decision 3: 費率差計算函數重構策略

### Context
費率差計算目前直接使用原始費率（`data.rate.fundingRate`），不考慮不同交易所的資金費率週期差異。

### Decision
**選擇方案**：在 `createMultiExchangeFundingRatePair` 函數中根據時間基準選擇對應的標準化費率進行計算

**實作細節**：
1. 函數簽名擴展以接受時間基準參數：
   ```typescript
   export function createMultiExchangeFundingRatePair(
     symbol: string,
     exchangesData: Map<ExchangeName, ExchangeRateData>,
     timeBasis: TimeBasis = 8  // 新增參數，預設 8 小時
   ): FundingRatePair
   ```

2. 費率提取邏輯修改：
   ```typescript
   // 修改前
   const rate1 = data1.rate.fundingRate;
   const rate2 = data2.rate.fundingRate;

   // 修改後
   const rate1 = getNormalizedRate(data1, timeBasis);
   const rate2 = getNormalizedRate(data2, timeBasis);

   // 輔助函數
   function getNormalizedRate(data: ExchangeRateData, timeBasis: TimeBasis): number {
     const timeBasisKey = `${timeBasis}h` as '1h' | '4h' | '8h' | '24h';
     const normalized = data.normalized?.[timeBasisKey];

     // 如果有標準化費率且原始週期與目標不同，使用標準化值
     if (normalized !== undefined && data.originalFundingInterval &&
         data.originalFundingInterval !== timeBasis) {
       return normalized;
     }

     // 否則使用原始費率（已經是目標時間基準或無標準化資料）
     return data.rate.fundingRate;
   }
   ```

### Rationale
- **正確性**：使用標準化費率確保不同週期的交易所費率可以公平比較
- **降級處理**：當標準化資料缺失時，回退到原始費率
- **最小侵入性**：只修改一個核心函數，所有呼叫點自動受益
- **向後相容**：預設參數為 8 小時，現有呼叫點不需要修改

### Alternatives Considered

**方案 A：在呼叫點轉換費率**
```typescript
// 在 WebSocket handler 和 REST API 中各自處理
const normalizedRates = rates.map(rate => normalizeForTimeBasis(rate, timeBasis));
```
- **優點**：計算邏輯保持純粹
- **拒絕原因**：需要在多個地方重複實作，容易遺漏

**方案 B：建立新的計算函數**
```typescript
function createMultiExchangeFundingRatePairWithTimeBasis(...) { ... }
```
- **優點**：完全不影響現有函數
- **拒絕原因**：造成函數重複，難以維護兩個版本

**方案 C：在前端計算費率差**
- **優點**：後端不需要修改
- **拒絕原因**：違反 Principle VI（Web 不應包含業務邏輯），且前端計算可能出現精度問題

### Implementation Considerations

#### 精度處理
- 確保使用 Decimal 型別進行計算（繼承現有實作）
- 標準化費率已在 `FundingRateMonitor` 中使用 Decimal 計算

#### 錯誤處理
- 當 `normalized` 欄位缺失時，日誌警告但不中斷計算
- 當原始週期資訊缺失時，假設為 8 小時（行業標準）

#### 測試策略
- 單元測試：驗證不同時間基準下的費率差計算正確性
- 邊界測試：測試標準化資料缺失的降級行為
- 整合測試：驗證 WebSocket 和 REST API 回傳的費率差一致

### References
- `src/models/FundingRate.ts:168-266` (createMultiExchangeFundingRatePair 函數)
- `src/models/FundingRate.ts:191-193` (當前費率提取邏輯)
- `src/services/monitor/FundingRateNormalizer.ts` (標準化計算服務)

---

## Decision 4: 呼叫點更新策略

### Context
`createMultiExchangeFundingRatePair` 函數有多個呼叫點需要傳遞時間基準參數。

### Decision
**選擇方案**：使用預設參數策略，最小化變更範圍

**呼叫點分析**：
1. **RateDifferenceCalculator.calculateMultiExchangeDifference** - 不傳遞時間基準（使用預設 8h）
2. **WebSocket MarketRatesHandler.formatRates** - 不傳遞時間基準（前端會根據用戶選擇顯示）
3. **REST API /api/market-rates** - 不傳遞時間基準（前端會根據用戶選擇顯示）

### Rationale
- **最小變更**：由於資料結構已包含所有標準化版本，計算時使用預設 8h 基準
- **前端控制**：前端根據用戶選擇的時間基準從 `normalized` 物件中提取對應費率
- **向後相容**：現有呼叫點不需要修改

### Future Consideration
如果未來需要後端根據時間基準動態計算費率差，可以：
1. 在 WebSocket `set-time-basis` 事件處理中記住用戶偏好
2. 在 `formatRates` 時傳遞時間基準參數
3. REST API 支援查詢參數 `?timeBasis=4`

但目前階段不需要，因為前端已經可以正確處理。

### References
- `src/services/monitor/RateDifferenceCalculator.ts:28-56`
- `src/websocket/handlers/MarketRatesHandler.ts:319-367`
- `app/api/market-rates/route.ts:47-94`

---

## Best Practices Applied

### 1. TypeScript 型別安全
- 使用現有的 `TimeBasis` 型別（`1 | 4 | 8 | 24`）
- 使用 `as` 型別斷言而非 `any` 來處理動態鍵值

### 2. 錯誤處理
- 所有驗證失敗都應返回清晰的錯誤訊息
- 使用結構化日誌記錄異常情況

### 3. 向後相容性
- 使用可選鏈運算符 `?.` 處理可能缺失的欄位
- 提供合理的預設值和降級行為

### 4. 測試覆蓋
- 單元測試：核心計算邏輯
- 整合測試：WebSocket 和 REST API 端到端流程
- E2E 測試：前端切換時間基準的完整使用者流程

---

## Dependencies and Integration Points

### Existing Dependencies (No Changes Required)
- **FundingRateNormalizer**: 已實作標準化計算，CLI 監控服務使用
- **RatesCache**: 已儲存標準化費率資料，Web 層讀取
- **TimeBasisSelector**: 前端元件已支援 4 種選項

### Integration Points
1. **WebSocket Handler** ↔ **RatesCache**: 讀取標準化資料
2. **REST API** ↔ **RatesCache**: 讀取標準化資料
3. **費率計算函數** ↔ **標準化資料**: 使用 normalized 欄位

### No New Dependencies
此功能不需要引入任何新的外部依賴套件。

---

## Performance Considerations

### WebSocket Handler
- **當前效能**: 5 秒推送一次，約 100 個交易對
- **預期影響**: 無（只是驗證邏輯從 3 個值改為 4 個值）

### REST API
- **當前效能**: <500ms 回應時間
- **預期影響**: +10-20ms（增加兩個欄位的序列化）
- **可接受**: 遠低於 500ms 目標

### 費率差計算
- **當前效能**: 每次計算 <1ms
- **預期影響**: +0.1ms（增加條件判斷和欄位查找）
- **可接受**: 仍然可以在 100ms 內處理 100 個交易對

---

## Rollout Strategy

### Deployment Steps
1. **部署後端修復**（WebSocket + REST API + 計算函數）
2. **驗證**：現有客戶端（1h, 8h, 24h）仍正常運作
3. **驗證**：新客戶端可以使用 4h 選項
4. **監控**：檢查 WebSocket 錯誤率和 API 延遲

### Rollback Plan
如果出現問題，可以快速回滾：
- 後端變更完全向後相容
- 前端已經支援 4h（只是後端之前會拒絕）
- 回滾後，用戶選擇 4h 會看到錯誤（但 1h/8h/24h 不受影響）

### Monitoring Metrics
- WebSocket 連線錯誤率（應保持 <1%）
- REST API P95 延遲（應保持 <500ms）
- 費率差計算準確性（與手動計算比對，誤差 <0.0001%）

---

## Summary

所有技術決策都聚焦於最小化變更範圍、保持向後相容性和確保計算正確性。主要修改點：

1. **WebSocket 驗證** - 簡單陣列擴展
2. **REST API 擴展** - 新增欄位（向後相容）
3. **費率差計算** - 重構以使用標準化費率（預設參數確保相容）

無需引入新的依賴或架構變更，所有修改都在現有邊界內進行。
