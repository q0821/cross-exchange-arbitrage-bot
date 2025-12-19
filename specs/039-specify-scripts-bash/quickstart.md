# Quickstart Guide: Prisma Client Singleton 優化

**Feature**: 039-prisma-singleton-refactor
**Date**: 2025-12-20

## 快速驗證步驟

### 1. 編譯驗證

確認所有修改後的程式碼可以正確編譯：

```bash
pnpm build
```

**預期結果**: 編譯成功，無 TypeScript 錯誤

### 2. 功能驗證

啟動開發伺服器並測試關鍵 API：

```bash
pnpm dev
```

測試以下 API endpoints（使用瀏覽器或 curl）：

```bash
# 登入（需要有效帳號）
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# 查詢持倉（需要認證）
curl http://localhost:3000/api/positions \
  -H "Authorization: Bearer <token>"

# 查詢餘額（需要認證）
curl http://localhost:3000/api/balances \
  -H "Authorization: Bearer <token>"
```

**預期結果**: API 正常回應，無 500 錯誤

### 3. 連線數驗證

連接到資料庫檢查連線數：

```bash
# 進入 PostgreSQL 容器
docker exec -it postgres psql -U postgres -d arbitrage

# 查詢活動連線數
SELECT count(*) FROM pg_stat_activity WHERE datname = 'arbitrage';
```

**預期結果**: 連線數應在 10 條以內（單一連線池）

### 4. 慢查詢監控驗證

查看伺服器日誌，確認慢查詢被記錄：

```bash
# 開發模式下的日誌輸出
# 應包含類似以下的慢查詢警告（如果有查詢超過 100ms）
# {"level":40,"msg":"Slow query detected","query":"...","duration":150}
```

### 5. 程式碼驗證

確認沒有遺漏的 `new PrismaClient()` 呼叫：

```bash
# 在 API routes 和 repositories 中搜尋
grep -r "new PrismaClient" app/api/ src/repositories/
```

**預期結果**: 應無任何輸出（所有 `new PrismaClient()` 已移除）

## 驗收檢查清單

- [ ] `pnpm build` 成功
- [ ] 所有 API endpoints 正常運作
- [ ] 資料庫連線數維持在 10 條以內
- [ ] `grep` 搜尋 API routes 和 repositories 中無 `new PrismaClient()`
- [ ] 伺服器日誌正常輸出（無初始化錯誤）

## 回滾計劃

如果發現問題，可以快速回滾：

```bash
# 還原到修改前的狀態
git checkout main -- app/api/ src/repositories/
```

## 常見問題排查

### Q: 編譯失敗 - 找不到 `@/src/lib/db`

**原因**: TypeScript 路徑別名配置問題

**解決**: 確認 `tsconfig.json` 包含：
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

### Q: 執行時錯誤 - Prisma 未初始化

**原因**: 可能的循環依賴問題

**解決**: 檢查 `src/lib/db.ts` 是否有其他 import 造成循環引用

### Q: 連線數沒有減少

**原因**: 可能有遺漏的檔案未修改

**解決**:
```bash
# 搜尋所有 new PrismaClient 呼叫
grep -r "new PrismaClient" --include="*.ts" .
```
