# 多交易對資金費率即時監控實施計劃

**Feature**: User Story 2.5 - 多交易對資金費率即時監控
**Created**: 2025-10-31
**Status**: Planning

## 功能概述

在 Web 界面提供類似 CLI 表格模式的多交易對即時監控，讓用戶能夠：
- 同時監控 10-100 個交易對的資金費率
- 即時查看所有交易對的費率差異，無論是否達到套利閾值
- 快速識別機會和潛在機會
- 從監控表格直接開倉

## 架構設計

### 1. 前端架構

```
app/
├── (dashboard)/
│   ├── market-monitor/          # 新頁面
│   │   ├── page.tsx              # 市場監控主頁面
│   │   ├── components/
│   │   │   ├── RatesTable.tsx   # 費率表格組件
│   │   │   ├── StatsCard.tsx    # 統計卡片組件
│   │   │   ├── SymbolSelector.tsx  # 交易對選擇器
│   │   │   ├── RateRow.tsx       # 表格行組件
│   │   │   ├── StatusBadge.tsx   # 狀態標籤組件
│   │   │   └── QuickOpenButton.tsx  # 快速開倉按鈕
│   │   └── hooks/
│   │       ├── useMarketRates.ts    # 訂閱即時費率
│   │       ├── useSymbolGroups.ts   # 管理交易對群組
│   │       └── useTableSort.ts      # 表格排序邏輯
```

### 2. 後端 API 架構

```
app/api/
├── market-rates/
│   ├── route.ts                  # GET: 獲取當前所有交易對費率
│   └── [symbol]/
│       └── route.ts              # GET: 獲取單一交易對詳細資訊
└── symbol-groups/
    └── route.ts                  # GET: 獲取可用的交易對群組
```

### 3. WebSocket 事件

新增 WebSocket 事件類型：

```typescript
// rates:update - 批量費率更新
{
  type: 'rates:update',
  data: {
    rates: [
      {
        symbol: 'BTCUSDT',
        binance: { rate: 0.0001, price: 50000 },
        okx: { rate: 0.0006, price: 50010 },
        spread: 0.0005,
        annualizedReturn: 0.5475,
        status: 'opportunity' | 'approaching' | 'normal',
        timestamp: '2025-10-31T10:00:00Z'
      },
      // ... 更多交易對
    ],
    timestamp: '2025-10-31T10:00:00Z'
  }
}

// rates:stats - 統計摘要更新
{
  type: 'rates:stats',
  data: {
    totalSymbols: 10,
    opportunityCount: 2,
    approachingCount: 3,
    maxSpread: { symbol: 'ETHUSDT', spread: 0.0007 },
    uptime: 3600,
    lastUpdate: '2025-10-31T10:00:00Z'
  }
}
```

### 4. 數據流

```
CLI Monitor (後台運行)
    ↓ 監控多個交易對
    ↓ 每 5 秒獲取費率
    ↓
In-Memory Store (Node.js)
    ↓ 儲存最新費率數據
    ↓
WebSocket Server
    ↓ 批量推送更新
    ↓
Web Frontend
    ↓ 即時顯示表格
    └→ 用戶交互（排序、篩選、開倉）
```

## 實施階段

### Phase 1: 後端數據服務 (2-3 天)

#### 任務 1.1: CLI Monitor 數據暴露
- [ ] 更新 FundingRateMonitor 提供 getAllLatestRates() 方法
- [ ] 建立 in-memory 數據快取層
- [ ] 實作數據過期機制（超過 10 秒未更新標記為 stale）

**檔案**:
- `src/services/monitor/FundingRateMonitor.ts`
- `src/services/monitor/RatesCache.ts` (新建)

**程式碼示例**:
```typescript
// src/services/monitor/RatesCache.ts
export class RatesCache {
  private cache = new Map<string, CachedRate>();

  set(symbol: string, rate: FundingRatePair) {
    this.cache.set(symbol, {
      ...rate,
      cachedAt: new Date()
    });
  }

  getAll(): FundingRatePair[] {
    return Array.from(this.cache.values())
      .filter(r => Date.now() - r.cachedAt.getTime() < 10000)
      .map(r => omit(r, 'cachedAt'));
  }
}
```

#### 任務 1.2: REST API 端點
- [ ] 實作 `GET /api/market-rates` - 返回所有交易對當前費率
- [ ] 實作 `GET /api/market-rates/[symbol]` - 返回單一交易對詳細資訊
- [ ] 實作 `GET /api/symbol-groups` - 返回可用群組配置

**檔案**:
- `app/api/market-rates/route.ts` (新建)
- `app/api/market-rates/[symbol]/route.ts` (新建)
- `app/api/symbol-groups/route.ts` (新建)

**API Response 範例**:
```json
// GET /api/market-rates
{
  "rates": [
    {
      "symbol": "BTCUSDT",
      "binance": {
        "rate": 0.0001,
        "price": 50000,
        "nextFundingTime": "2025-10-31T12:00:00Z"
      },
      "okx": {
        "rate": 0.0006,
        "price": 50010,
        "nextFundingTime": "2025-10-31T12:00:00Z"
      },
      "spread": 0.0005,
      "spreadPercent": 0.05,
      "annualizedReturn": 54.75,
      "netReturn": 49.75,
      "status": "approaching",
      "timestamp": "2025-10-31T10:00:00Z"
    }
  ],
  "stats": {
    "totalSymbols": 10,
    "opportunityCount": 2,
    "approachingCount": 3,
    "maxSpread": {
      "symbol": "ETHUSDT",
      "spread": 0.0007
    }
  }
}
```

#### 任務 1.3: WebSocket 事件擴展
- [ ] 新增 `rates:update` 事件類型
- [ ] 新增 `rates:stats` 事件類型
- [ ] 實作批量推送邏輯（每 5 秒推送一次）
- [ ] 實作增量更新（只推送變化的數據）

**檔案**:
- `lib/websocket/events.ts`
- `lib/websocket/rate-broadcaster.ts` (新建)

### Phase 2: 前端 UI 組件 (3-4 天)

#### 任務 2.1: 基礎表格組件
- [ ] 建立 RatesTable 主組件
- [ ] 實作 RateRow 組件（單行顯示）
- [ ] 實作 StatusBadge 組件（狀態標籤）
- [ ] 實作響應式表格佈局（支援手機、平板、桌面）

**檔案**:
- `app/(dashboard)/market-monitor/components/RatesTable.tsx` (新建)
- `app/(dashboard)/market-monitor/components/RateRow.tsx` (新建)
- `app/(dashboard)/market-monitor/components/StatusBadge.tsx` (新建)

**組件結構**:
```tsx
// RatesTable.tsx
export function RatesTable({
  rates,
  sortBy,
  filterStatus
}: RatesTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead>
          <tr>
            <th>交易對</th>
            <th>Binance 費率</th>
            <th>OKX 費率</th>
            <th>費率差異</th>
            <th>年化收益</th>
            <th>狀態</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {rates.map(rate => (
            <RateRow key={rate.symbol} rate={rate} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

#### 任務 2.2: 統計卡片組件
- [ ] 建立 StatsCard 組件
- [ ] 顯示總交易對數、機會數、接近數
- [ ] 顯示最高費率差異
- [ ] 顯示系統運行時長

**檔案**:
- `app/(dashboard)/market-monitor/components/StatsCard.tsx` (新建)

#### 任務 2.3: 交易對選擇器
- [ ] 建立 SymbolSelector 組件
- [ ] 支援選擇預設群組（top10, top20, defi 等）
- [ ] 支援自訂交易對輸入
- [ ] 讀取 config/symbols.json 配置

**檔案**:
- `app/(dashboard)/market-monitor/components/SymbolSelector.tsx` (新建)

#### 任務 2.4: 快速開倉按鈕
- [ ] 建立 QuickOpenButton 組件
- [ ] 只在「機會」狀態顯示
- [ ] 點擊後打開開倉對話框，預填數據
- [ ] 復用現有的開倉對話框組件

**檔案**:
- `app/(dashboard)/market-monitor/components/QuickOpenButton.tsx` (新建)

### Phase 3: 數據訂閱與狀態管理 (2 天)

#### 任務 3.1: WebSocket 訂閱 Hook
- [ ] 建立 useMarketRates hook
- [ ] 訂閱 `rates:update` 和 `rates:stats` 事件
- [ ] 處理斷線重連
- [ ] 本地狀態管理（useReducer）

**檔案**:
- `app/(dashboard)/market-monitor/hooks/useMarketRates.ts` (新建)

**Hook 範例**:
```typescript
export function useMarketRates(symbols: string[]) {
  const [rates, setRates] = useState<MarketRate[]>([]);
  const [stats, setStats] = useState<MarketStats>();
  const socket = useWebSocket();

  useEffect(() => {
    socket.on('rates:update', (data) => {
      setRates(data.rates);
    });

    socket.on('rates:stats', (data) => {
      setStats(data);
    });

    return () => {
      socket.off('rates:update');
      socket.off('rates:stats');
    };
  }, [socket]);

  return { rates, stats, isConnected: socket.connected };
}
```

#### 任務 3.2: 表格排序與篩選
- [ ] 建立 useTableSort hook
- [ ] 實作按欄位排序（費率差異、年化收益、交易對名稱）
- [ ] 實作狀態篩選（全部、機會、接近）
- [ ] 實作搜尋功能

**檔案**:
- `app/(dashboard)/market-monitor/hooks/useTableSort.ts` (新建)

#### 任務 3.3: 交易對群組管理
- [ ] 建立 useSymbolGroups hook
- [ ] 從 API 載入群組配置
- [ ] 管理選中的群組
- [ ] 保存用戶偏好到 localStorage

**檔案**:
- `app/(dashboard)/market-monitor/hooks/useSymbolGroups.ts` (新建)

### Phase 4: 主頁面整合 (1-2 天)

#### 任務 4.1: 市場監控主頁面
- [ ] 建立 `/market-monitor` 頁面
- [ ] 整合所有組件
- [ ] 實作佈局（統計卡片 + 表格）
- [ ] 新增頁面導航

**檔案**:
- `app/(dashboard)/market-monitor/page.tsx` (新建)

**頁面結構**:
```tsx
export default function MarketMonitorPage() {
  const { rates, stats } = useMarketRates(selectedSymbols);
  const { sortedRates, sortBy, setSortBy } = useTableSort(rates);
  const { groups, selectedGroup, setSelectedGroup } = useSymbolGroups();

  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <div className="flex justify-between items-center">
        <h1>市場監控</h1>
        <SymbolSelector
          groups={groups}
          selected={selectedGroup}
          onChange={setSelectedGroup}
        />
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard stats={stats} />
      </div>

      {/* 費率表格 */}
      <RatesTable
        rates={sortedRates}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />
    </div>
  );
}
```

#### 任務 4.2: 導航整合
- [ ] 更新側邊欄導航，新增「市場監控」入口
- [ ] 新增頁面圖標
- [ ] 設定權限（需登入）

**檔案**:
- `components/layout/Sidebar.tsx`

### Phase 5: 進階功能（可選，2-3 天）

#### 任務 5.1: 歷史走勢圖
- [ ] 建立交易對詳情對話框
- [ ] 整合 Chart.js 或 Recharts
- [ ] 顯示過去 24 小時費率走勢
- [ ] 顯示歷史最高/最低差異

**檔案**:
- `app/(dashboard)/market-monitor/components/SymbolDetailDialog.tsx` (新建)
- `app/(dashboard)/market-monitor/components/RateChart.tsx` (新建)

#### 任務 5.2: 數據匯出
- [ ] 新增「匯出 CSV」按鈕
- [ ] 實作 CSV 生成邏輯
- [ ] 支援匯出當前表格數據

**檔案**:
- `app/(dashboard)/market-monitor/utils/export-csv.ts` (新建)

#### 任務 5.3: 通知設定
- [ ] 允許用戶設定自訂閾值
- [ ] 當某交易對達到閾值時發送通知
- [ ] 整合瀏覽器通知 API

**檔案**:
- `app/(dashboard)/market-monitor/components/NotificationSettings.tsx` (新建)

## 測試計劃

### 單元測試
- [ ] RatesCache 測試
- [ ] useMarketRates hook 測試
- [ ] useTableSort hook 測試
- [ ] StatusBadge 組件測試

### 整合測試
- [ ] REST API 端點測試
- [ ] WebSocket 事件推送測試
- [ ] 前後端整合測試

### E2E 測試
- [ ] 頁面載入和數據顯示
- [ ] 即時更新功能
- [ ] 排序和篩選功能
- [ ] 快速開倉流程

## 技術棧

### 前端
- **Framework**: Next.js 14 (App Router)
- **UI**: Tailwind CSS + Headless UI
- **狀態管理**: React Context + useReducer
- **WebSocket**: Socket.io Client
- **圖表**: Recharts（可選）

### 後端
- **Runtime**: Node.js 20.x
- **WebSocket**: Socket.io Server
- **數據快取**: In-Memory Map
- **配置管理**: JSON 檔案

## 依賴項

### 現有功能
- ✅ CLI Monitor 服務（已實作）
- ✅ WebSocket 基礎設施（已實作）
- ✅ 認證系統（已實作）
- ✅ 開倉對話框組件（可復用）

### 新依賴
```json
{
  "dependencies": {
    "recharts": "^2.10.0"  // 可選，用於走勢圖
  }
}
```

## 效能考量

### 前端效能
- **虛擬滾動**: 監控 100+ 交易對時使用虛擬滾動
- **防抖動**: 排序和篩選操作使用 debounce
- **Memo**: 對 RateRow 組件使用 React.memo

### 後端效能
- **批量推送**: 每 5 秒推送一次，避免頻繁更新
- **增量更新**: 只推送變化的數據
- **快取策略**: 使用 in-memory 快取，避免重複計算

### WebSocket 最佳化
- **房間機制**: 用戶只訂閱自己選擇的交易對群組
- **壓縮**: 啟用 WebSocket 壓縮
- **心跳**: 實作 ping/pong 心跳機制

## 安全考量

- **權限驗證**: 所有 API 需驗證用戶登入狀態
- **Rate Limiting**: 限制 API 請求頻率
- **數據驗證**: 驗證用戶提交的自訂交易對列表
- **XSS 防護**: 所有用戶輸入需要淨化

## 部署清單

- [ ] 更新環境變數配置
- [ ] 確保 CLI Monitor 服務運行
- [ ] 部署前端更新
- [ ] 運行資料庫遷移（如需要）
- [ ] 更新 API 文件
- [ ] 部署到生產環境
- [ ] 監控錯誤日誌
- [ ] 效能監控和優化

## 時程估計

| 階段 | 預計時間 | 關鍵里程碑 |
|------|---------|-----------|
| Phase 1: 後端數據服務 | 2-3 天 | REST API 可用 |
| Phase 2: 前端 UI 組件 | 3-4 天 | 靜態表格顯示 |
| Phase 3: 數據訂閱 | 2 天 | 即時更新運作 |
| Phase 4: 頁面整合 | 1-2 天 | 功能可用 |
| Phase 5: 進階功能 | 2-3 天 | 完整體驗 |
| **總計** | **10-14 天** | MVP 完成 |

## 驗收標準

### 必要功能（MVP）
- ✅ 可同時監控至少 10 個交易對
- ✅ 數據每 5 秒自動更新
- ✅ 顯示所有必要欄位（費率、價格、差異等）
- ✅ 狀態指示正確（機會/接近/正常）
- ✅ 支援排序和基本篩選
- ✅ 可選擇預設交易對群組
- ✅ 快速開倉功能正常運作

### 進階功能（可選）
- ⭕ 歷史走勢圖顯示
- ⭕ 數據匯出功能
- ⭕ 自訂通知設定
- ⭕ 虛擬滾動（100+ 交易對）

## 後續優化

1. **效能優化**
   - 實作虛擬滾動支援更多交易對
   - 優化 WebSocket 推送策略
   - 新增前端快取層

2. **功能擴展**
   - 支援更多交易所（如 Bybit）
   - 新增更多技術指標
   - 實作警報和通知系統

3. **用戶體驗**
   - 新增深色模式
   - 自訂表格欄位顯示
   - 保存用戶偏好設定

## 參考文件

- [User Story 2.5 規格](./spec.md#user-story-25)
- [功能需求 FR-025-1 ~ FR-025-8](./spec.md#多交易對即時監控)
- [WebSocket 事件規格](./contracts/websocket.md)
- [CLI Monitor 文件](../../docs/監控多個交易對.md)
