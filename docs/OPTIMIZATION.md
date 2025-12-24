# 專案審查報告與改進計劃

## 審查日期: 2025-12-20

---

## 一、專案優化建議

### 高優先級問題

#### 1. ~~Prisma Client 多次實例化~~ ✅ 已完成
- **問題**: 23 個 API routes 各自創建 `new PrismaClient()`
- **影響**: 連接池資源浪費、連接洩漏風險
- **解決方案**: 已重構為使用全局 Prisma singleton (`src/lib/db.ts`)
- **完成日期**: 2025-12-20 (Feature 039)

#### 2. 零測試覆蓋率
- **問題**: 無任何單元測試或整合測試
- **關鍵需測試模組**:
  - `PositionOrchestrator` (資金安全)
  - `BalanceValidator` (風險控制)
  - `RateDifferenceCalculator` (套利核心)
  - `pnl-calculator.ts` (損益計算)
- **預估工時**: 2-3 天

#### 3. 24 個 TODO 未完成
- **最關鍵**: WebSocket 訂閱/取消訂閱 (4 個交易所都未實作)
- **影響**: 無法即時推送數據，套利機會檢測延遲
- **檔案**: `src/connectors/binance.ts`, `okx.ts`, `gateio.ts`, `mexc.ts`

#### 4. ~~API Key 連線測試未實現~~ ✅ 已完成
- **檔案**: `src/services/apikey/ApiKeyValidator.ts`
- **解決方案**: 實作多交易所 API Key 驗證，支援 Binance (多端點策略)、OKX、Gate.io、MEXC
- **完成日期**: 2025-12-25 (Feature 042)

### 中優先級問題

#### 5. 巨大服務類需拆分
- `PositionOrchestrator.ts` - 1051 行
- `PositionCloser.ts` - 886 行
- **建議**: 提取 Exchange Trading 適配器、Saga 協調器、補償管理

#### 6. 缺乏統一 API 響應結構
- 各 routes 響應格式不一致
- **建議**: 建立 `src/lib/api-response.ts` 統一格式

#### 7. 類型安全問題
- 過多 `any` 類型斷言
- **建議**: 為 CCXT 配置建立專用 TypeScript 介面

---

## 二、MEXC 交易能力確認

### 重要發現: MEXC **完全支援**合約交易 API

經過代碼審查確認，MEXC 的整合狀態：

| 功能 | 狀態 | 檔案位置 |
|------|------|---------|
| 開倉交易 | ✅ 已實現 | `src/connectors/mexc.ts` L381-428 |
| 平倉 | ✅ 已實現 | 同上 |
| 停損停利 | ✅ 已實現 | `src/services/trading/adapters/MexcConditionalOrderAdapter.ts` |
| 持倉查詢 | ✅ 已實現 | `src/connectors/mexc.ts` L314-345 |
| 餘額查詢 | ✅ 已實現 | `src/connectors/mexc.ts` L283-312 |
| WebSocket | ⚠️ TODO | `src/connectors/mexc.ts` L475-483 |

### 結論
**不需要**隱藏 MEXC 的開倉按鈕。MEXC 與 Binance、OKX、Gate.io 享有同等的交易功能支援。

開倉按鈕顯示邏輯位於 `app/(dashboard)/market-monitor/components/RateRow.tsx` L493-499，目前沒有基於交易所類型的限制。

---

## 三、新交易所整合評估

### 整合難度對比

| 交易所 | CCXT 支援 | 期貨 API | 資金費率 | 條件訂單 | 難度 | 預估天數 |
|--------|----------|---------|---------|---------|------|---------|
| **BingX** | ✅ 完全支援 | ✅ 明確 | ✅ 有 | ✅ 支援 | ⭐⭐ 簡單 | 1-1.5 天 |
| **Backpack** | ✅ 支援 | ⚠️ 待驗證 | ⚠️ 未知 | ⚠️ 未知 | ⭐⭐⭐ 中等 | 2-3 天 |
| **XREX** | ❌ 不支援 | ❌ 無跡象 | ❌ 無 | ❌ 無 | ⭐⭐⭐⭐⭐ 極難 | 5-7+ 天 |

### 建議整合順序

```
1️⃣ BingX (強烈推薦)
   - CCXT 官方完全支援
   - API 文件完整: https://bingx-api.github.io/docs/
   - 8 小時資金費率週期
   - 風險最低，ROI 最高

2️⃣ Backpack (可選)
   - 需先驗證 Futures API 完整性
   - 主要針對 Solana 生態
   - 交易對可能有限

3️⃣ XREX (不推薦)
   - 無 CCXT 支援，需完全自建連接器
   - 無公開 API 文檔
   - 很可能不支援期貨交易
   - 除非有特殊商業需求，否則不建議
```

### BingX 整合所需修改檔案

```
新建:
- src/connectors/bingx.ts (~500 行)
- src/services/trading/adapters/BingxConditionalOrderAdapter.ts (~150 行)

修改:
- src/services/trading/ConditionalOrderAdapterFactory.ts (+10 行)
- src/types/trading.ts (SupportedExchange 添加 'bingx')
- src/connectors/types.ts (ExchangeName)
- src/connectors/factory.ts (+case 'bingx')
- src/lib/config.ts (添加 API Key 配置)
- .env.example (BINGX_API_KEY, BINGX_API_SECRET)
```

---

## 四、優先級排序建議

### 立即處理 (本週)
1. ~~Prisma Client Singleton 優化~~ ✅ 已完成

### 短期 (1-2 週)
2. ~~實現 API Key 連線測試功能~~ ✅ 已完成 (Feature 042)
3. 新增核心模組單元測試 (PositionOrchestrator, BalanceValidator)

### 中期 (2-4 週)
4. 整合 BingX 交易所
5. 實現 WebSocket 訂閱/取消訂閱功能

### 長期
6. 拆分巨大服務類
7. 統一 API 響應結構
8. 改善類型安全

---

## 五、變更記錄

| 日期 | 項目 | 狀態 |
|------|------|------|
| 2025-12-20 | Prisma Client Singleton 優化 | ✅ 完成 (Feature 039) |
| 2025-12-25 | API Key 連線測試功能 | ✅ 完成 (Feature 042) |
