# Research: 市場監控頁面交易所快速連結

**Feature**: 008-specify-scripts-bash
**Date**: 2025-11-06
**Purpose**: 技術決策和最佳實踐研究

## Overview

此功能需要在市場監控頁面的表格中新增交易所圖示連結，讓用戶可以快速跳轉到交易所網站。主要技術挑戰包括：URL 映射管理、圖示視覺呈現、以及與現有表格組件的整合。

## Research Questions & Decisions

### Decision 1: 交易所 URL 映射的管理方式

**Question**: 如何管理四個交易所的 URL 模板和交易對符號轉換規則？

**Research Findings**:
- **選項 A**: 在前端元件中硬編碼 URL 模板
  - 優點：簡單直接，無需額外配置
  - 缺點：難以維護，URL 變更需要修改程式碼

- **選項 B**: 建立獨立的 URL 映射配置模組
  - 優點：集中管理，易於測試和維護
  - 缺點：增加一層抽象

- **選項 C**: 從後端 API 動態載入 URL 配置
  - 優點：最靈活，可即時更新
  - 缺點：過度設計，增加複雜度

**Decision**: 選項 B - 建立獨立的 URL 映射配置模組

**Rationale**:
1. 四個交易所的 URL 結構各不相同，需要集中管理
2. 交易對符號轉換規則（BTC/USDT → BTCUSDT）可以在此模組中統一處理
3. 易於單元測試（可以獨立測試 URL 生成邏輯）
4. 未來如果需要支援更多交易所，只需擴展此模組
5. 避免過度設計（選項 C），同時保持可維護性

**Implementation Approach**:
- 檔案位置：`src/lib/exchanges/url-builder.ts`
- 導出函數：`getExchangeContractUrl(exchange: string, symbol: string): string`
- 包含符號格式轉換邏輯

### Decision 2: 圖示的視覺呈現方式

**Question**: 使用圖示、文字連結、還是組合方式？

**Research Findings**:
- **現有實作分析**：
  - 專案已使用 `lucide-react` 圖示庫（見 package.json）
  - 現有 UI 使用 Tailwind CSS 和 Radix UI 元件
  - 市場監控頁面已有表格結構（RatesTable, RateRow）

- **選項 A**: 純圖示（ExternalLink icon）
  - 優點：簡潔，節省空間
  - 缺點：可能不夠明確

- **選項 B**: 文字連結（交易所名稱）
  - 優點：最明確
  - 缺點：佔用較多空間，與現有設計不一致

- **選項 C**: 圖示 + Tooltip（結合兩者優點）
  - 優點：簡潔且提供明確提示
  - 缺點：需要 Tooltip 元件

**Decision**: 選項 C - 圖示 + Tooltip

**Rationale**:
1. 符合現代 Web UI 設計模式
2. 專案已有 Radix UI，可使用 `@radix-ui/react-tooltip`
3. Lucide React 提供 `ExternalLink` 圖示
4. 在 hover 時顯示 "前往 Binance 查看 BTC/USDT" 的提示
5. 符合規格中 FR-007 和 FR-008 的要求

**Implementation Approach**:
- 使用 `lucide-react` 的 `ExternalLink` 圖示
- 包裝在 `<a>` 標籤中，使用 `target="_blank"` 和 `rel="noopener noreferrer"`
- 使用 Radix UI Tooltip 元件
- 當交易所資料不可用時，顯示為灰色且不可點擊

### Decision 3: 圖示在表格中的位置

**Question**: 圖示應該放在表格的哪個位置？

**Research Findings**:
- **現有表格結構**：
  - RateRow 元件顯示每個交易對的資料
  - 每個交易所有獨立的欄位，顯示費率和價格
  - 表格已經相當密集，需要謹慎添加新元素

- **選項 A**: 在交易所名稱旁邊（表頭或每行的交易所標籤處）
  - 優點：與交易所名稱相關聯，語義清晰
  - 缺點：表頭不適合放置每行不同的連結

- **選項 B**: 在費率數值旁邊（每個交易所欄位內）
  - 優點：與具體資料關聯，直觀
  - 缺點：每行會有 4 個圖示，可能視覺混亂

- **選項 C**: 在價格數值旁邊（每個交易所欄位內）
  - 優點：價格通常是用戶最關注的資訊
  - 缺點：同選項 B

- **選項 D**: 獨立的「操作」欄位，包含所有交易所連結
  - 優點：集中管理，視覺整齊
  - 缺點：與交易所資料分離，不夠直觀

**Decision**: 選項 B - 在費率數值旁邊（修正版）

**Rationale**:
1. 將圖示放在每個交易所欄位的 **費率數值旁邊**（小圖示）
2. 使用較小的圖示尺寸（16x16px）以避免視覺混亂
3. 只在有效費率資料的欄位顯示圖示
4. 符合用戶心智模型：點擊費率→前往交易所查看詳細資料
5. 與現有 RateRow 元件結構相容

**Implementation Approach**:
- 修改 RateRow 元件，在顯示費率的地方添加連結圖示
- 圖示尺寸：16x16px（`className="w-4 h-4"`）
- 顏色：使用 `text-gray-500 hover:text-blue-600` 來提供視覺回饋
- 位置：費率數值的右側，間距 4px

### Decision 4: 交易對符號格式轉換

**Question**: 如何處理不同交易所的交易對符號格式差異？

**Research Findings**:
- **格式差異**：
  - 內部格式：`BTC/USDT`（標準化格式）
  - Binance：`BTCUSDT`（無分隔符）
  - OKX：`BTC-USDT-SWAP`（使用連字號，加上 -SWAP 後綴）
  - MEXC：`BTC_USDT`（使用下底線）
  - Gate.io：`BTC_USDT`（使用下底線）

**Decision**: 在 URL Builder 中實作符號轉換邏輯

**Rationale**:
1. 集中管理轉換規則，避免散落在各處
2. 易於測試和維護
3. 支援未來新增交易所

**Implementation Approach**:
```typescript
function formatSymbolForExchange(symbol: string, exchange: string): string {
  // symbol format: "BTC/USDT"
  const [base, quote] = symbol.split('/');

  switch (exchange.toLowerCase()) {
    case 'binance':
      return `${base}${quote}`; // BTCUSDT
    case 'okx':
      return `${base}-${quote}-SWAP`; // BTC-USDT-SWAP
    case 'mexc':
    case 'gateio':
      return `${base}_${quote}`; // BTC_USDT
    default:
      throw new Error(`Unknown exchange: ${exchange}`);
  }
}
```

### Decision 5: 測試策略

**Question**: 如何測試此功能？

**Decision**: 多層次測試策略

**Test Levels**:

1. **單元測試**（Vitest）：
   - 測試 URL Builder 的符號轉換邏輯
   - 測試 URL 生成的正確性
   - 測試邊界情況（不支援的交易對、無效符號）

2. **元件測試**（Vitest + React Testing Library）：
   - 測試 ExchangeLink 元件的渲染
   - 測試 Tooltip 顯示
   - 測試不可用狀態的處理

3. **整合測試**（Playwright）：
   - 測試在市場監控頁面點擊圖示
   - 驗證新分頁正確開啟（檢查 URL）
   - 測試在不同瀏覽器的行為一致性

**Implementation Approach**:
- 測試檔案：
  - `tests/unit/lib/url-builder.test.ts`
  - `tests/unit/components/ExchangeLink.test.tsx`
  - `tests/e2e/market-monitor-exchange-links.spec.ts`

## Alternatives Considered

### Alternative 1: 在後端生成完整 URL

**Rejected Because**:
- 前端已有所有必要資訊（交易所名稱、交易對符號）
- 增加不必要的網路請求
- 前端 URL 生成更快速、響應更即時

### Alternative 2: 使用交易所 Logo 而非通用圖示

**Rejected Because**:
- 需要維護和載入多個圖片資源
- 增加頁面載入時間
- 在小尺寸（16x16px）下，Logo 可能不夠清晰
- 通用的 ExternalLink 圖示語義更明確

### Alternative 3: 點擊整個費率欄位就跳轉

**Rejected Because**:
- 用戶可能只是想選取或複製費率數值
- 意外點擊會開啟新分頁，用戶體驗不佳
- 明確的圖示連結更符合 Web 標準

## Technology Stack Alignment

此功能完全符合現有技術棧：

- **Next.js 14 App Router**: 無需修改路由，純前端功能
- **React 18**: 使用標準 React 元件和 hooks
- **TypeScript 5.6**: 所有新程式碼使用 TypeScript
- **Tailwind CSS**: 使用專案現有的 Tailwind 工具類別
- **Radix UI**: 使用 `@radix-ui/react-tooltip`（需新增依賴）
- **Lucide React**: 使用現有的圖示庫
- **Vitest**: 單元測試
- **Playwright**: E2E 測試

## Dependencies & Installation

**新增依賴**:
```bash
pnpm add @radix-ui/react-tooltip
```

**理由**: 提供無障礙的 Tooltip 元件，符合 WCAG 標準。

## Performance Considerations

- **URL 生成**: 純計算，無網路請求，<1ms
- **圖示渲染**: 使用 SVG，輕量級
- **Tooltip**: 僅在 hover 時渲染，無效能影響
- **整體影響**: 可忽略不計（<5KB 新增程式碼）

## Security Considerations

- **rel="noopener noreferrer"**: 防止新分頁存取原頁面的 window.opener
- **URL 驗證**: URL Builder 僅接受已知的交易所名稱
- **XSS 防護**: 交易對符號已在後端驗證，前端僅進行格式轉換

## Accessibility (a11y)

- **Keyboard Navigation**: 圖示連結可通過 Tab 鍵訪問
- **Screen Reader**: 使用 `aria-label="前往 {交易所} 查看 {交易對}"`
- **Focus Indicator**: 使用 Tailwind 的 `focus:ring` 工具類別
- **Tooltip**: Radix UI Tooltip 元件符合 ARIA 標準

## Monitoring & Observability

**不需要**額外的監控或日誌：
- 純前端功能，無後端 API 呼叫
- 成功/失敗由瀏覽器處理
- 如果需要追蹤點擊行為，可在未來新增（但目前 Out of Scope）

## Risks & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 交易所 URL 格式變更 | High | Low | 集中管理 URL 模板，易於更新 |
| 用戶瀏覽器阻止彈出視窗 | Medium | Low | 使用 `target="_blank"`（非 window.open），降低被阻擋機率 |
| 交易對符號轉換錯誤 | High | Low | 完整的單元測試覆蓋 |
| 視覺混亂（太多圖示） | Low | Medium | 使用小尺寸圖示、灰色配色、僅在有資料時顯示 |

## Implementation Timeline

**預估時間**: 4-6 小時

- Phase 0 (Research): ✅ 完成
- Phase 1 (Design): 1 小時
  - 撰寫 data-model.md
  - 建立 TypeScript interfaces
- Phase 2 (Implementation): 2-3 小時
  - URL Builder 模組
  - ExchangeLink 元件
  - 整合到 RateRow
- Phase 3 (Testing): 1-2 小時
  - 單元測試
  - 元件測試
  - E2E 測試

## References

- [Radix UI Tooltip Documentation](https://www.radix-ui.com/primitives/docs/components/tooltip)
- [Lucide React Icons](https://lucide.dev/)
- [Next.js Link Component](https://nextjs.org/docs/app/api-reference/components/link)
- [MDN: rel=noopener](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel/noopener)

## Conclusion

所有技術決策已完成，無剩餘的 NEEDS CLARIFICATION。功能設計簡潔、可測試、且符合專案現有架構和編碼標準。準備進入 Phase 1（設計階段）。
