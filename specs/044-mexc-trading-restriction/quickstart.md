# Quickstart: MEXC 交易所開倉限制處理

**Feature**: 044-mexc-trading-restriction
**Date**: 2025-12-25

## 前置條件

- Node.js 20.x LTS 已安裝
- 專案依賴已安裝 (`pnpm install`)
- 開發伺服器可啟動 (`pnpm dev`)

## 快速測試步驟

### 測試 1: 一鍵開倉按鈕禁用狀態

**目標**: 驗證涉及 MEXC 的套利機會顯示禁用按鈕

**步驟**:

1. 啟動開發伺服器：
   ```bash
   pnpm dev
   ```

2. 開啟瀏覽器訪問 `http://localhost:3000/market-monitor`

3. 找到一個最佳套利對涉及 MEXC 的交易對（做多或做空方為 MEXC）

4. 觀察該交易對的一鍵開倉按鈕

**預期結果**:
- [ ] 按鈕顯示為禁用狀態（不可點擊）
- [ ] 按鈕使用警告色（琥珀色/黃色調）
- [ ] 滑鼠懸停時顯示 Tooltip：「MEXC 不支援 API 開倉，請手動建倉」

---

### 測試 2: 非 MEXC 套利對正常功能

**目標**: 驗證不涉及 MEXC 的套利機會仍可正常開倉

**步驟**:

1. 在市場監控頁面找到一個不涉及 MEXC 的套利機會（如 Binance vs OKX）

2. 點擊一鍵開倉按鈕

**預期結果**:
- [ ] 按鈕可正常點擊
- [ ] 開倉對話框正常開啟
- [ ] 無 MEXC 相關警告

---

### 測試 3: 開倉對話框警告橫幅

**目標**: 驗證涉及 MEXC 的對話框顯示警告

**步驟**:

1. 找到一個涉及 MEXC 的套利機會

2. 嘗試開啟開倉對話框（若按鈕完全禁用，可透過程式碼暫時移除禁用邏輯測試）

**預期結果**:
- [ ] 對話框頂部顯示警告橫幅
- [ ] 警告訊息：「MEXC 不支援 API 開倉，請手動建倉」
- [ ] 包含 MEXC 交易所連結按鈕
- [ ] 點擊連結在新分頁開啟 `https://futures.mexc.com/exchange`
- [ ] 開倉提交按鈕禁用

---

### 測試 4: MEXC 費率數據正常顯示

**目標**: 驗證 MEXC 欄位仍正常顯示費率數據

**步驟**:

1. 在市場監控頁面查看費率表格

2. 檢查 MEXC 欄位

**預期結果**:
- [ ] MEXC 費率正常顯示
- [ ] MEXC 價格正常顯示
- [ ] 涉及 MEXC 的套利分析數據正常顯示（費率差、年化收益）

---

### 測試 5: MEXC 持倉和資產顯示

**目標**: 驗證 MEXC 持倉和餘額仍可查看

**步驟**:

1. 訪問持倉列表頁面 `/positions`

2. 訪問資產頁面 `/assets`

**預期結果**:
- [ ] 若有 MEXC 持倉（手動建立），正常顯示
- [ ] MEXC 餘額正常顯示（需已設定 API Key）

---

## 邊界情況測試

### 測試 6: MEXC 做多方

**場景**: MEXC 是做多方，其他交易所是做空方

**預期**: 同樣禁用開倉按鈕

---

### 測試 7: MEXC 做空方

**場景**: MEXC 是做空方，其他交易所是做多方

**預期**: 同樣禁用開倉按鈕

---

## 驗收檢查清單

完成所有測試後，確認以下項目：

- [ ] 所有涉及 MEXC 的套利機會按鈕正確禁用
- [ ] Tooltip 訊息正確顯示
- [ ] 警告橫幅正確顯示（若對話框可開啟）
- [ ] MEXC 外部連結正確（開新分頁）
- [ ] 非 MEXC 套利機會不受影響
- [ ] MEXC 費率數據正常顯示
- [ ] MEXC 持倉/資產正常顯示
- [ ] 無 TypeScript 編譯錯誤
- [ ] 無 ESLint 警告

---

## 常見問題

### Q: 如何模擬 MEXC 套利機會？

A: 等待市場出現 MEXC 相關的套利機會，或暫時修改測試資料。在開發環境中，可在 `RatesCache` 中注入測試資料。

### Q: 如何驗證限制邏輯的正確性？

A: 可在瀏覽器開發者工具的 Console 中執行：

```javascript
import { isArbitragePairRestricted } from '@/lib/trading-restrictions';
console.log(isArbitragePairRestricted('mexc', 'binance')); // true
console.log(isArbitragePairRestricted('binance', 'mexc')); // true
console.log(isArbitragePairRestricted('binance', 'okx'));  // false
```
