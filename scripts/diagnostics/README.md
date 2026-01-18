# 診斷工具 (Diagnostic Scripts)

本目錄包含用於診斷和調試交易所 API 連線的工具腳本。

## ⚠️ 注意事項

- 這些腳本會與**真實的交易所 API** 互動
- 需要有效的 **API Key** 才能執行
- 建議使用**測試網**環境進行測試
- **不要在生產環境**直接執行，除非你完全了解其影響

## 工具清單

### API 連線測試

| 腳本 | 功能 | 使用時機 |
|------|------|----------|
| `test-binance-api.ts` | 測試 Binance API 連線、解密 API Key、簽名驗證 | 診斷 Binance API Key 錯誤 |
| `test-gateio-api.ts` | 測試 Gate.io API 連線 | 診斷 Gate.io API Key 錯誤 |
| `test-mexc-api.ts` | 測試 MEXC API 連線 | 診斷 MEXC API Key 錯誤 |

### 持倉查詢

| 腳本 | 功能 | 使用時機 |
|------|------|----------|
| `test-okx-position.ts` | 查詢 OKX 持倉狀態 | 診斷 OKX 持倉同步問題 |

## 使用方式

### 前置需求

1. 確保資料庫中有**有效的 API Key**
2. 確認 `.env` 環境變數正確設定
3. 執行 `pnpm install` 安裝依賴

### 執行範例

#### 測試 Binance API 連線

```bash
pnpm tsx scripts/diagnostics/test-binance-api.ts
```

**預期輸出**：
```
用戶: user@example.com
交易所: binance
環境: MAINNET
API Key (前8字元): AbCdEfGh...

發送請求到: https://api.binance.com/api/v3/account?...
HTTP Status: 200
成功！找到 5 個有餘額的幣種
```

#### 測試 OKX 持倉

```bash
pnpm tsx scripts/diagnostics/test-okx-position.ts
```

## 常見問題排查

### 1. API Key 錯誤 (-2015)

**症狀**：`Binance 錯誤碼: -2015`

**可能原因**：
- API Key 無效或已過期
- API Key 權限不足（未啟用 Futures）
- 環境錯誤（Testnet/Mainnet 不匹配）

**解決方法**：
```bash
# 1. 執行診斷腳本
pnpm tsx scripts/diagnostics/test-binance-api.ts

# 2. 檢查錯誤碼說明
# 3. 前往交易所檢查 API Key 設定
```

### 2. 時間戳不同步 (-1021)

**症狀**：`Binance 錯誤碼: -1021`

**可能原因**：
- 伺服器時間與交易所不同步

**解決方法**：
```bash
# 檢查伺服器時間
date

# 同步系統時間（macOS）
sudo sntp -sS time.apple.com

# 同步系統時間（Linux）
sudo ntpdate pool.ntp.org
```

### 3. 簽名無效 (-1022)

**症狀**：`Binance 錯誤碼: -1022`

**可能原因**：
- API Secret 錯誤
- 加密/解密邏輯有問題

**解決方法**：
```bash
# 執行診斷腳本查看簽名流程
pnpm tsx scripts/diagnostics/test-binance-api.ts

# 確認 API Secret 正確（前往交易所重新生成）
```

## 開發指南

### 新增診斷腳本

如果你需要新增診斷工具，請遵循以下規範：

1. **命名規範**：`test-{exchange}-{feature}.ts`
2. **輸出格式**：清晰的成功/失敗訊息，使用 emoji 標示
3. **錯誤處理**：捕獲並說明錯誤碼
4. **文件更新**：在本 README 中新增說明

### 範例模板

```typescript
/**
 * 測試 XXX 功能
 * 用於診斷 YYY 問題
 *
 * Usage: pnpm tsx scripts/diagnostics/test-xxx.ts
 */

import { PrismaClient } from '@/generated/prisma/client';

const prisma = new PrismaClient();

async function testXXX() {
  console.log('=== 測試 XXX 功能 ===\n');

  try {
    // 測試邏輯
    console.log('✅ 測試成功！');
  } catch (error) {
    console.error('❌ 測試失敗:', error);
    // 提供診斷建議
  } finally {
    await prisma.$disconnect();
  }
}

testXXX().catch(console.error);
```

## 相關資源

- [Binance API 文件](https://binance-docs.github.io/apidocs/futures/cn/)
- [OKX API 文件](https://www.okx.com/docs-v5/zh/)
- [Gate.io API 文件](https://www.gate.io/docs/developers/apiv4/zh_CN/)
- [MEXC API 文件](https://mexcdevelop.github.io/apidocs/contract_v1_cn/)

## 維護記錄

| 日期 | 變更 | 作者 |
|------|------|------|
| 2026-01-18 | 建立診斷工具目錄，移入 4 個腳本 | System |
