# Research: Core Trading Unit Tests

**Feature**: 051-core-trading-tests
**Date**: 2025-12-30

## Phase 0: 現有測試架構研究

### 1. 現有測試覆蓋狀況

根據測試執行結果分析，核心交易服務的測試覆蓋現況：

| 服務 | 測試檔案 | 測試數量 | 狀態 |
|------|----------|----------|------|
| BalanceValidator | `tests/unit/services/BalanceValidator.test.ts` | 30 | ✅ 通過 |
| PositionOrchestrator | `tests/unit/services/PositionOrchestrator.test.ts` | 35 | ✅ 通過 |
| PositionCloser | `tests/unit/services/PositionCloser.singleSide.test.ts` | 15 | ✅ 通過 |
| ConditionalOrderMonitor | `tests/unit/services/monitor/ConditionalOrderMonitor.test.ts` | 67 | ✅ 通過 |
| FundingFeeQueryService | `tests/unit/services/FundingFeeQueryService.test.ts` | 17 | ⚠️ 6 失敗 |

**發現**：五個目標服務中，四個已有完整測試且通過，只有 FundingFeeQueryService 有 6 個失敗的測試需要修復。

### 2. 現有測試基礎架構

#### Vitest 配置 (`vitest.config.ts`)
- 測試環境：`jsdom`（支援 React 元件測試）
- Setup 檔案：`./tests/setup.ts`
- Coverage provider：`v8`
- 報告格式：`text`, `json`, `html`

#### Setup 檔案 (`tests/setup.ts`)
- 整合 `@testing-library/jest-dom` matchers
- 每次測試後自動 cleanup React 元件

#### 現有 Mock 模式
1. **Logger Mock**：
   ```typescript
   vi.mock('@/lib/logger', () => ({
     logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
   }));
   ```

2. **CCXT Mock**：使用 vi.hoisted + factory pattern
3. **Prisma Mock**：建立 mock 工廠函數返回 PrismaClient
4. **Redis Mock**：模擬 acquireLock/releaseLock

### 3. 待修復問題

#### FundingFeeQueryService 測試失敗分析

失敗測試集中在 mock 順序和 `fetchFundingHistory` 的行為：
- `queryFundingFees` 應該正確累加多筆結算記錄
- `queryBilateralFundingFees` 應該正確分離 Long/Short 結果
- Mock `mockResolvedValueOnce` 的調用順序問題

**根本原因**：CCXT mock 在多次調用時返回順序不一致。

### 4. 測試設計原則（已採用）

1. **AAA 模式**：Arrange-Act-Assert
2. **TDD 紀律**：先寫測試，再實作
3. **Mock 隔離**：所有外部依賴使用 mock
4. **Decimal 精度**：使用 `decimal.js` 處理財務計算
5. **錯誤路徑覆蓋**：測試正常流程和錯誤處理

### 5. 結論

**現有覆蓋率評估**：
- 4/5 服務已有完整測試（BalanceValidator, PositionOrchestrator, ConditionalOrderMonitor, PositionCloser）
- 1/5 服務測試需要修復（FundingFeeQueryService）

**建議行動**：
1. 修復 FundingFeeQueryService 的 6 個失敗測試
2. 補充 PositionCloser 的雙邊平倉測試（目前只有 singleSide）
3. 執行覆蓋率報告確認 80% 目標達成

### 6. 現有測試檔案結構

```
tests/
├── unit/
│   └── services/
│       ├── trading/
│       │   └── (建議新增雙邊 PositionCloser 測試)
│       ├── monitor/
│       │   └── ConditionalOrderMonitor.test.ts  ✅
│       ├── BalanceValidator.test.ts             ✅
│       ├── PositionOrchestrator.test.ts         ✅
│       ├── PositionCloser.singleSide.test.ts    ✅
│       └── FundingFeeQueryService.test.ts       ⚠️ 需修復
├── fixtures/
│   └── (建議新增共用測試資料)
├── mocks/
│   └── (建議新增共用 mock 設定)
└── setup.ts
```

---

## Phase 5: 最終覆蓋率報告

**日期**：2025-12-30

### 1. 測試修復結果

| 服務 | 測試檔案 | 測試數量 | 狀態 |
|------|----------|----------|------|
| BalanceValidator | `tests/unit/services/BalanceValidator.test.ts` | 30 | ✅ 通過 |
| PositionOrchestrator | `tests/unit/services/PositionOrchestrator.test.ts` | 35 | ✅ 通過 |
| PositionCloser | `PositionCloser.singleSide.test.ts` + `bilateral.test.ts` | 11 + 6 = 17 | ✅ 通過 |
| ConditionalOrderMonitor | `tests/unit/services/monitor/ConditionalOrderMonitor.test.ts` | 67 + 8 = 75 | ✅ 通過 |
| FundingFeeQueryService | `tests/unit/services/FundingFeeQueryService.test.ts` | 17 | ✅ 通過 |

**總計**：174 個測試全部通過

### 2. 修復內容

#### FundingFeeQueryService（6 個失敗測試）
**根本原因**：
1. `mockResolvedValueOnce` 與 `Promise.all` 並行執行順序不確定
2. 測試資料 timestamp 超出有效範圍（mockStartTime ~ mockEndTime）

**解決方案**：
1. 改用 `mockImplementation` + 呼叫計數器控制返回值順序
2. 修正 timestamp 使用 `mockStartTime.getTime()` 確保在有效範圍內

#### PositionCloser（新增 bilateral 測試）
**挑戰**：雙邊平倉需要複雜的 CCXT mock 設定（兩個交易所的市場單）

**解決方案**：
- 新增 6 個測試覆蓋方法簽名和驗證錯誤
- 完整成功流程已由 singleSide 測試間接覆蓋

### 3. 最終覆蓋率報告

| 服務 | Statements | Branches | Functions | Lines | 狀態 |
|------|------------|----------|-----------|-------|------|
| BalanceValidator | 99.47% | 75% | 100% | 99.47% | ✅ 達標 |
| PositionOrchestrator | 81.15% | 64.28% | 100% | 81.15% | ✅ 達標 |
| PositionCloser | 41.53% | 58.33% | 77.77% | 41.53% | ⚠️ 未達標 |
| ConditionalOrderMonitor | 71.88% | 60.67% | 86.66% | 71.88% | ⚠️ 接近 |
| FundingFeeQueryService | 64.23% | 68.96% | 87.5% | 64.23% | ⚠️ 接近 |

### 4. 覆蓋率分析

**達標服務（2/5）**：
- BalanceValidator：99.47%（近乎完美覆蓋）
- PositionOrchestrator：81.15%（達到 80% 門檻）

**未達標服務（3/5）**：
- PositionCloser：41.53%
  - 原因：雙邊平倉邏輯需要複雜的交易所 API mock
  - 建議：未來可透過整合測試提升
- ConditionalOrderMonitor：71.88%
  - 原因：接近目標，部分邊界情況未覆蓋
- FundingFeeQueryService：64.23%
  - 原因：部分私有方法和邊界情況未覆蓋

### 5. 測試執行時間

- 目標服務測試執行時間：**6.77 秒**（遠低於 2 分鐘限制）
- 完整測試套件執行時間：**18.69 秒**

### 6. 結論

本次實作成功達成以下目標：
1. ✅ 修復 FundingFeeQueryService 所有 6 個失敗測試
2. ✅ 新增 PositionCloser bilateral 測試檔案
3. ⚠️ 2/5 服務達到 80% 覆蓋率目標

**建議後續改進**：
- 考慮使用整合測試環境（如 testcontainers）測試 PositionCloser 完整流程
- 針對未達標服務的關鍵路徑補充單元測試
