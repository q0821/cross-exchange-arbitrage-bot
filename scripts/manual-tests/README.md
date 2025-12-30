# Manual Test Scripts

這個目錄包含手動測試腳本，用於開發階段驗證交易所連接和功能。

## 執行方式

```bash
pnpm tsx scripts/manual-tests/<script-name>.ts
```

## 腳本清單

### BingX 測試
| 腳本 | 說明 |
|------|------|
| `test-bingx-connector.ts` | BingX 連接器基本功能測試 |
| `test-bingx-funding-fee.ts` | BingX 資金費率查詢測試 |
| `test-bingx-funding-history.ts` | BingX 資金費率歷史查詢 |
| `test-bingx-interval.ts` | BingX 結算間隔測試 |
| `test-bingx-native-api.ts` | BingX 原生 API 測試 |
| `test-monitor-bingx.ts` | BingX 監控服務測試 |

### MEXC 測試
| 腳本 | 說明 |
|------|------|
| `test-mexc-alt-swap.ts` | MEXC 替代 swap 測試 |
| `test-mexc-ccxt-swap.ts` | MEXC CCXT swap 測試 |
| `test-mexc-contract-api.ts` | MEXC 合約 API 測試 |
| `test-mexc-direct-api.ts` | MEXC 直接 API 測試 |
| `test-mexc-full-trade.ts` | MEXC 完整交易流程測試 |
| `test-mexc-futures.ts` | MEXC 期貨功能測試 |
| `test-mexc-order-support.ts` | MEXC 訂單支援測試 |
| `test-mexc-private-endpoints.ts` | MEXC 私有端點測試 |
| `test-mexc-verbose.ts` | MEXC 詳細日誌測試 |

### Gate.io 測試
| 腳本 | 說明 |
|------|------|
| `test-gateio-conditional-price.ts` | Gate.io 條件單價格測試 |

### OKX 測試
| 腳本 | 說明 |
|------|------|
| `test-okx-funding-history.ts` | OKX 資金費率歷史查詢 |
| `test-okx-report.ts` | OKX 報告生成測試 |
| `test-okx-simple.ts` | OKX 簡單功能測試 |

### 通用測試
| 腳本 | 說明 |
|------|------|
| `test-conditional-orders.ts` | 條件單功能測試 |
| `test-db-apikey.ts` | 資料庫 API Key 測試 |
| `test-funding-history.ts` | 資金費率歷史查詢測試 |
| `test-open-close-position.ts` | 開倉/平倉流程測試 |
| `test-api.ts` | API 端點測試 |
| `test-repo.ts` | Repository 測試 |

### 工具腳本
| 腳本 | 說明 |
|------|------|
| `check-db.ts` | 資料庫連線檢查 |
| `clean-test-data.ts` | 清理測試資料 |

## 注意事項

- 這些腳本需要有效的 API Key 才能執行
- 部分腳本會執行實際交易操作，請在測試網環境使用
- 執行前請確認環境變數已正確設定
