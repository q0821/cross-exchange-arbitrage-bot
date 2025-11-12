# Quickstart: 基於 Open Interest 的動態交易對選擇

**Feature**: 010-open-interest-selection
**Branch**: `010-open-interest-selection`
**Goal**: 快速上手 Open Interest 動態交易對選擇功能，包括 CLI 使用和 Web 介面測試

## Prerequisites

- Node.js 20.x LTS installed
- pnpm installed
- Project dependencies installed (`pnpm install`)
- PostgreSQL 15+ with TimescaleDB running (for backend data)
- Binance API access (for OI data fetching)

## Development Setup

### 1. Checkout Feature Branch

```bash
git checkout 010-open-interest-selection
```

### 2. Install Dependencies (if needed)

```bash
pnpm install
```

### 3. Configure Environment

確保 `.env` 檔案包含 Binance API credentials（若需要）：

```bash
# .env
BINANCE_API_KEY=your_api_key_here
BINANCE_API_SECRET=your_api_secret_here

# 或使用測試網（testnet）
BINANCE_TESTNET=true
```

**注意**：Open Interest API 是公開端點，不需要 API key，但完整的監控功能可能需要。

## Quick Start Guide

### CLI Usage

#### 1. Basic Usage - 獲取前 50 個交易對（預設）

```bash
pnpm dev:cli monitor start --auto-fetch
```

**預期輸出**：
```
[INFO] Fetching symbols by Open Interest...
[INFO] OI cache miss, fetching from API
[INFO] Fetched 200 symbols from Binance
[INFO] Top 50 symbols by OI:
  1. BTCUSDT     - OI: $5,432,100,000.50
  2. ETHUSDT     - OI: $3,210,450,200.25
  3. BNBUSDT     - OI: $1,850,320,100.75
  ...
[INFO] Filtered to 48 valid symbols (2 unavailable on OKX)
[INFO] Starting monitor service with 48 symbols
```

#### 2. 指定獲取數量 - 前 100 個交易對

```bash
pnpm dev:cli monitor start --auto-fetch --top 100
```

#### 3. 設定最小 OI 門檻 - 只監控 OI > $100M 的交易對

```bash
pnpm dev:cli monitor start --auto-fetch --top 200 --min-oi 100000000
```

**參數說明**：
- `--auto-fetch`: 啟用動態獲取（必須）
- `--top N`: 獲取前 N 個交易對（預設 50）
- `--min-oi <amount>`: 最小 OI 門檻（美元，可選）
- `--testnet`: 使用測試網環境（可選）

#### 4. 使用測試網

```bash
pnpm dev:cli monitor start --auto-fetch --top 50 --testnet
```

### Web Interface

#### 1. Start Web Development Server

```bash
# Terminal 1: Start backend (CLI monitor service)
pnpm dev:cli monitor start --auto-fetch --top 100

# Terminal 2: Start frontend (Next.js)
pnpm dev
```

#### 2. Access Market Monitor Page

Navigate to: `http://localhost:3000/market-monitor`

#### 3. View Open Interest Column

在市場監控頁面上，你應該看到：
- **新增的 "Open Interest" 欄位**，顯示每個交易對的 OI 美元價值
- 格式化顯示（如 $5.43B, $123.5M, $45.2K）

#### 4. Sort by Open Interest

點擊 "Open Interest" 欄位標題：
- **第一次點擊**：按 OI 降序排列（最高 OI 在最上方）
- **第二次點擊**：切換為升序排列

**注意**：排序後列表保持穩定（Feature 009），WebSocket 更新不會觸發重新排列。

## Key Files to Understand

### Backend (CLI)

1. **src/connectors/binance.ts**
   - `getAllOpenInterest()`: 獲取所有 USDT 永續合約的 OI 資料
   - `getTopSymbolsByOI(topN)`: 獲取 OI 排名前 N 的交易對

2. **src/cli/commands/monitor/start.ts**
   - 新增 `--top` 和 `--min-oi` 參數
   - `fetchSymbolsByOI()`: 整合 OI 獲取和過濾邏輯

3. **src/lib/cache.ts**
   - `OICache` class: 15 分鐘 TTL 快取機制

4. **src/types/open-interest.ts**
   - 型別定義：`OpenInterestRecord`, `OpenInterestUSD`, `TradingPairRanking`

### Frontend (Web)

1. **app/(dashboard)/market-monitor/types.ts**
   - 新增 `SortField` 支援 `'openInterest'`

2. **app/(dashboard)/market-monitor/components/RatesTable.tsx**
   - 新增 OI 欄位顯示
   - 新增 OI 欄位標題的排序點擊處理

3. **app/(dashboard)/market-monitor/utils/sortComparator.ts**
   - 新增 OI 排序邏輯（`case 'openInterest'`）

4. **app/(dashboard)/market-monitor/hooks/useMarketRates.ts**
   - WebSocket 事件包含 `openInterest` 欄位

## Testing the Feature

### Manual Testing Checklist

#### CLI Testing

- [ ] **基本功能**：執行 `--auto-fetch` 成功獲取交易對
- [ ] **參數測試**：
  - [ ] `--top 50`: 返回 50 個交易對
  - [ ] `--top 100`: 返回 100 個交易對
  - [ ] `--min-oi 50000000`: 只返回 OI >= $50M 的交易對
- [ ] **快取測試**：
  - [ ] 第一次執行：Cache miss，呼叫 API（檢查日誌）
  - [ ] 15 分鐘內再次執行（相同 --top 值）：Cache hit，不呼叫 API
  - [ ] 15 分鐘後執行：Cache expired，重新呼叫 API
- [ ] **錯誤處理**：
  - [ ] 網路中斷時顯示錯誤訊息
  - [ ] 無效的 --top 值（如 -1）顯示錯誤

#### Web Testing

- [ ] **顯示測試**：
  - [ ] OI 欄位正確顯示在表格中
  - [ ] OI 數值格式化正確（$5.43B, $123.5M, $45.2K）
  - [ ] 沒有 OI 資料的交易對顯示 "N/A"
- [ ] **排序測試**：
  - [ ] 點擊 OI 欄位標題，列表按 OI 降序排列
  - [ ] 再次點擊，切換為升序
  - [ ] 排序後，WebSocket 更新不改變順序（穩定排序）
- [ ] **即時更新測試**：
  - [ ] WebSocket 推送新資料時，OI 數值更新
  - [ ] 列表順序保持穩定（不跳動）

### Automated Testing

#### Unit Tests

```bash
# 測試 Binance OI API
pnpm test src/connectors/binance-oi.test.ts

# 測試快取機制
pnpm test src/lib/cache.test.ts

# 測試 OI 排序邏輯
pnpm test app/(dashboard)/market-monitor/utils/oi-sorting.test.ts
```

#### Integration Tests

```bash
# 測試 OI 資料獲取流程（with mocked API）
pnpm test tests/integration/oi-fetching.test.ts
```

#### E2E Tests

```bash
# 測試 CLI 啟動和 Web 顯示
pnpm test:e2e tests/e2e/market-monitor-oi.spec.ts
```

## Common Issues & Troubleshooting

### Issue 1: OI API 呼叫失敗

**Symptom**: CLI 啟動時顯示 "Failed to fetch Open Interest"

**Possible Causes**:
1. 網路連線問題
2. Binance API 暫時不可用
3. 觸發速率限制（429 error）

**Solutions**:
1. 檢查網路連線：`ping api.binance.com`
2. 檢查 Binance API 狀態：https://www.binance.com/en/support/announcement
3. 等待一段時間後重試（避免觸發速率限制）
4. 檢查日誌中的詳細錯誤訊息

### Issue 2: Cache 未生效

**Symptom**: 每次執行 CLI 都呼叫 API（Cache always miss）

**Possible Causes**:
1. 使用不同的 `--top` 值（cache key 不同）
2. 超過 15 分鐘 TTL
3. CLI 重啟（in-memory cache 清空）

**Solutions**:
1. 確認使用相同的 `--top` 參數值
2. 檢查執行時間間隔（應 < 15 分鐘）
3. 這是正常行為（in-memory cache 不持久化）

### Issue 3: Web 介面不顯示 OI 欄位

**Symptom**: 市場監控頁面沒有 "Open Interest" 欄位

**Possible Causes**:
1. WebSocket 未連線或未推送 OI 資料
2. 前端程式碼未正確整合

**Solutions**:
1. 檢查瀏覽器 Console 是否有 WebSocket 連線錯誤
2. 檢查 WebSocket 事件是否包含 `openInterest` 欄位（Network tab）
3. 確認前端程式碼已更新（`git status` 查看修改）

### Issue 4: OI 排序不穩定

**Symptom**: 排序後列表順序會跳動

**Possible Causes**:
1. 未正確整合 Feature 009 穩定排序
2. `sortedSymbols` useMemo 依賴包含 `ratesMap`

**Solutions**:
1. 確認 `sortedSymbols` useMemo 只依賴 `[sortBy, sortDirection]`
2. 檢查 sortComparator 是否包含次要排序鍵（symbol）

## Development Workflow

### 1. Implement Changes

按照 `tasks.md` 的順序實作（由 `/speckit.tasks` 生成）：
1. 擴展 BinanceConnector 支援 OI API
2. 實作 OICache 快取機制
3. 修改 CLI start command
4. 整合 Web 前端

### 2. Write Tests

```bash
# 建立測試檔案
touch tests/unit/connectors/binance-oi.test.ts
touch tests/unit/lib/cache.test.ts
touch tests/integration/oi-fetching.test.ts

# 撰寫並執行測試
pnpm test --run
```

### 3. Manual QA

按照上述 "Manual Testing Checklist" 進行手動測試

### 4. Commit Changes

```bash
git add src/ app/ tests/
git commit -m "feat: implement Open Interest dynamic trading pair selection

- Add Binance OI API integration with getTopSymbolsByOI()
- Implement 15-min TTL in-memory cache for OI data
- Extend CLI --auto-fetch with --top N parameter
- Add OI column to Web market monitor with sorting
- Add error handling and retry logic for API calls"
```

## Performance Benchmarks

### CLI Startup Time

| Scenario | First Run (Cache Miss) | Subsequent Run (Cache Hit) |
|----------|------------------------|---------------------------|
| --top 50 | ~8 seconds             | < 1 second                |
| --top 100| ~12 seconds            | < 1 second                |
| --top 200| ~20 seconds            | < 1 second                |

**Note**: 首次執行需要獲取所有交易對的 OI 資料，因此耗時較長。快取生效後啟動時間大幅縮短。

### Web Sorting Performance

| Trading Pairs | Sort Time (OI field) |
|---------------|----------------------|
| 30 pairs      | < 100 ms             |
| 50 pairs      | < 200 ms             |
| 100 pairs     | < 500 ms             |

**Note**: 符合 Feature 009 的排序效能標準（< 500ms）。

### API Call Optimization

| Metric | Value |
|--------|-------|
| API calls without cache | 200+ requests per startup |
| API calls with cache (15 min) | < 10 requests per hour |
| Cache hit rate (typical usage) | > 95% |

## Success Criteria Validation

驗證 spec.md 中定義的成功標準：

- [ ] **SC-001**: CLI `--auto-fetch --top 100` 在 30 秒內完成（首次執行）
- [ ] **SC-002**: 90% 的交易對在幣安和 OKX 都可用
- [ ] **SC-003**: Web 介面 OI 資料延遲 < 1 分鐘
- [ ] **SC-004**: 快取機制減少 95% 的 API 呼叫
- [ ] **SC-005**: 24 小時運行期間，速率限制失敗率 < 1%
- [ ] **SC-006**: Web OI 排序在 500 ms 內完成
- [ ] **SC-007**: CLI 顯示的交易對 100% 能成功監控

## References

- [Feature Spec](./spec.md) - 功能需求和驗收標準
- [Technical Plan](./plan.md) - 技術規劃和架構設計
- [Research](./research.md) - 技術決策和最佳實踐
- [Data Model](./data-model.md) - 資料模型和狀態管理
- [Tasks](./tasks.md) - 詳細實作任務清單（由 `/speckit.tasks` 生成）

## Next Steps

完成 quickstart 測試後，可執行：

1. **`/speckit.tasks`**: 產生詳細的實作任務清單
2. **`/speckit.implement`**: 開始逐步實作功能

## Questions?

如果遇到問題，檢查：
1. Console logs for errors or warnings
2. Network tab for WebSocket connection status
3. `research.md` for technical decision rationale
4. `data-model.md` for data structure details
