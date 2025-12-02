# Quick Start: 追蹤記錄累計收益 Tooltip 明細

## 開發環境設置

```bash
# 確認專案已安裝依賴
pnpm install

# 啟動開發伺服器
pnpm dev
```

## 實作步驟

### Step 1: 更新 TrackingData Interface

在 `app/(dashboard)/simulated-tracking/components/TrackingHistoryTable.tsx` 和 `page.tsx` 加入新欄位：

```typescript
interface TrackingData {
  // ... 現有欄位
  exitLongPrice: number | null;
  exitShortPrice: number | null;
  fundingPnl: number | null;
  pricePnl: number | null;
}
```

### Step 2: 加入 Radix UI Tooltip

```typescript
import * as Tooltip from '@radix-ui/react-tooltip';

// 在累計收益欄位使用
<Tooltip.Provider delayDuration={300}>
  <Tooltip.Root>
    <Tooltip.Trigger asChild>
      <span className="cursor-help">
        {/* 累計收益顯示 */}
      </span>
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content className="bg-gray-900 text-white rounded-lg px-3 py-2">
        {/* Tooltip 內容 */}
        <Tooltip.Arrow className="fill-gray-900" />
      </Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
</Tooltip.Provider>
```

### Step 3: 驗證功能

1. 前往 `/simulated-tracking` 頁面
2. 在「歷史記錄」區塊找到任一筆追蹤
3. 將滑鼠移到「累計收益」數值上
4. 確認 Tooltip 顯示：
   - 開倉價格（雙交易所）
   - 關倉價格（雙交易所）
   - 結算次數
   - 資費收益

## 驗收標準

- [ ] Tooltip 在 0.3 秒內顯示
- [ ] 顯示所有 6 項資訊
- [ ] 缺失資料顯示 "N/A"
- [ ] 滑鼠移開後 Tooltip 消失

## 相關檔案

| 檔案 | 說明 |
|------|------|
| `TrackingHistoryTable.tsx` | Tooltip 實作位置 |
| `page.tsx` | TrackingData interface 定義 |
| `SimulatedTrackingRepository.ts` | API 回傳資料定義 |
