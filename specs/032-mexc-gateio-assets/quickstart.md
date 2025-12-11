# Quickstart: MEXC 和 Gate.io 資產追蹤

**Feature**: 032-mexc-gateio-assets

## 快速開始

### 前置需求

1. 已完成 Feature 031 (交易所資產追蹤和歷史曲線)
2. 用戶已在系統中設定 MEXC 或 Gate.io 的 API Key

### 驗證步驟

1. **啟動服務**
   ```bash
   pnpm dev
   ```

2. **確認 API Key 已設定**
   - 前往 Web 介面的 API Key 設定頁面
   - 確認 MEXC 或 Gate.io 的 API Key 狀態為「有效」

3. **查看資產總覽**
   - 前往「資產總覽」頁面
   - 確認 MEXC 和 Gate.io 的餘額卡片顯示正確金額
   - 狀態應為「成功」(綠色) 而非「未設定 API Key」

4. **驗證歷史快照**
   - 等待下一個整點（或手動觸發快照）
   - 檢查資料庫中的 `asset_snapshots` 表
   ```sql
   SELECT mexc_balance_usd, gateio_balance_usd, mexc_status, gateio_status
   FROM asset_snapshots
   WHERE user_id = 'your-user-id'
   ORDER BY recorded_at DESC
   LIMIT 1;
   ```

5. **驗證歷史曲線**
   - 在資產總覽頁面選擇時間範圍 (7/14/30 天)
   - 確認 MEXC 和 Gate.io 的曲線正確顯示

### 常見問題

**Q: MEXC 顯示「API 錯誤」**
- 確認 API Key 已啟用「讀取」權限
- 確認 API Key 未過期

**Q: Gate.io 持倉查詢失敗**
- 確認已啟用「永續合約」權限
- 確認帳戶有開通期貨交易功能

**Q: 餘額顯示 0 但交易所有資金**
- 系統只計算 USDT 餘額，其他幣種暫不換算
- 確認資金在「合約帳戶」而非「現貨帳戶」

### API Key 權限設定

**MEXC**:
- ✅ 讀取權限 (Read)
- ❌ 交易權限 (Trade) - 不需要
- 可選: IP 白名單

**Gate.io**:
- ✅ 讀取權限 (Read)
- ✅ 永續合約權限 (Perpetual) - 查詢持倉需要
- ❌ 交易權限 (Trade) - 不需要
