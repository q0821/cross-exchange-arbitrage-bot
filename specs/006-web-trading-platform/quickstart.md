# Quick Start Guide: Web 多用戶套利交易平台

**Feature**: 006-web-trading-platform
**Date**: 2025-10-27
**Purpose**: 開發環境快速啟動指南

## 概述

本指南幫助開發者在 10 分鐘內設定完整的開發環境，並開始開發 Web 多用戶套利交易平台。

---

## 前置需求

### 必須安裝的軟體

- **Node.js**: >= 20.0.0 LTS
- **pnpm**: >= 8.0.0 (推薦) 或 npm >= 9.0.0
- **Docker**: >= 20.10.0 (用於本地 PostgreSQL + TimescaleDB)
- **Git**: >= 2.30.0

### 檢查版本

```bash
node --version    # 應顯示 v20.x.x
pnpm --version    # 應顯示 8.x.x 或更高
docker --version  # 應顯示 Docker version 20.x.x
```

### 安裝 pnpm（如果尚未安裝）

```bash
npm install -g pnpm
```

---

## Step 1: 啟動資料庫

### 1.1 啟動 PostgreSQL + TimescaleDB (Docker)

專案已經包含 `docker-compose.yml`，直接啟動：

```bash
# 確保在專案根目錄
cd /path/to/cross-exchange-arbitrage-bot

# 啟動 PostgreSQL (背景執行)
pnpm docker:up
```

### 1.2 驗證資料庫運行

```bash
# 檢查 Docker container 狀態
docker ps | grep postgres

# 應該看到類似輸出：
# postgres-arbitrage   Up 10 seconds   0.0.0.0:5432->5432/tcp
```

### 1.3 資料庫連線資訊

預設連線資訊（定義在 `.env`）：

```
DATABASE_URL="postgresql://arbitrage_user:arbitrage_password@localhost:5432/arbitrage_db?schema=public"
```

---

## Step 2: 安裝依賴

### 2.1 安裝 Node.js 依賴

```bash
pnpm install
```

這會安裝所有既有依賴 + 新增的 Web 平台依賴：

**新增依賴**（在 Phase 1 實作時會加入 `package.json`）：
```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "socket.io": "^4.6.0",
    "socket.io-client": "^4.6.0",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "zod": "^3.22.0",
    "@radix-ui/react-*": "latest",
    "tailwindcss": "^3.4.0",
    "recharts": "^2.10.0"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/jsonwebtoken": "^9.0.5",
    "playwright": "^1.40.0"
  }
}
```

---

## Step 3: 環境變數設定

### 3.1 複製環境變數範本

```bash
cp .env.example .env
```

### 3.2 填寫必要的環境變數

編輯 `.env` 檔案，新增以下變數（Web 平台專用）：

```bash
# === 資料庫 ===
DATABASE_URL="postgresql://arbitrage_user:arbitrage_password@localhost:5432/arbitrage_db?schema=public"

# === JWT 認證 ===
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"  # 至少 32 字元
JWT_EXPIRES_IN="24h"  # Token 有效期

# === API Key 加密 ===
ENCRYPTION_KEY="your-32-byte-encryption-key-change-this"  # 必須是 32 bytes (256 bits)

# === Next.js ===
NEXT_PUBLIC_API_URL="http://localhost:3000/api"
NEXT_PUBLIC_WS_URL="http://localhost:3000"

# === 交易所 API（既有，用於測試）===
BINANCE_API_KEY="your-binance-api-key"
BINANCE_SECRET_KEY="your-binance-secret-key"
OKX_API_KEY="your-okx-api-key"
OKX_SECRET_KEY="your-okx-secret-key"
OKX_PASSPHRASE="your-okx-passphrase"

# === 其他設定 ===
NODE_ENV="development"
PORT="3000"
```

**重要**：
- `JWT_SECRET`: 隨機生成，不要使用範例中的值
  ```bash
  # 生成隨機密鑰（macOS/Linux）
  openssl rand -base64 32
  ```
- `ENCRYPTION_KEY`: 必須是 32 bytes，用於 AES-256-GCM 加密
  ```bash
  # 生成 32 bytes 密鑰（macOS/Linux）
  openssl rand -hex 32
  ```

---

## Step 4: 資料庫遷移

### 4.1 執行 Prisma 遷移

```bash
# 生成 Prisma Client
pnpm prisma generate

# 執行資料庫遷移（建立所有表）
pnpm prisma migrate dev --name init_web_platform

# 或者，如果已有遷移檔案
pnpm prisma migrate deploy
```

### 4.2 驗證資料庫 Schema

```bash
# 開啟 Prisma Studio（資料庫 GUI）
pnpm prisma studio
```

瀏覽器會自動開啟 `http://localhost:5555`，檢查是否有以下表：

**新增的表**:
- `users`
- `api_keys`
- `positions`
- `trades`
- `audit_logs`

**既有的表**:
- `arbitrage_opportunities`
- `opportunity_histories`
- `notification_logs`

---

## Step 5: 啟動開發伺服器

### 5.1 啟動 Next.js 開發伺服器

```bash
# 使用自訂 server（整合 Socket.io）
pnpm dev
```

**預期輸出**:
```
> cross-exchange-arbitrage-bot@0.4.0 dev
> tsx server.ts

✔ Ready on http://localhost:3000
✔ Socket.io server initialized
✔ WebSocket handlers registered
```

### 5.2 驗證服務運行

開啟瀏覽器訪問：

1. **首頁**: `http://localhost:3000`
   - 應該看到登入頁面或首頁

2. **API Health Check** (手動測試):
   ```bash
   curl http://localhost:3000/api/health

   # 預期回應：
   {"success":true,"data":{"status":"ok","database":"connected"}}
   ```

3. **WebSocket 連線測試** (瀏覽器 Console):
   ```javascript
   const socket = io('http://localhost:3000', { withCredentials: true });
   socket.on('connect', () => console.log('Connected!', socket.id));
   ```

---

## Step 6: 執行測試

### 6.1 執行單元測試

```bash
# 執行所有測試
pnpm test

# 執行特定測試檔案
pnpm test src/services/auth/AuthService.test.ts

# 執行測試並顯示覆蓋率
pnpm test:coverage
```

### 6.2 執行整合測試

```bash
# 執行整合測試（需要 Docker PostgreSQL 運行）
pnpm test:integration
```

### 6.3 執行 E2E 測試（Playwright）

```bash
# 安裝 Playwright 瀏覽器（首次執行）
pnpm playwright install

# 執行 E2E 測試
pnpm test:e2e

# 以 UI 模式執行（可視化測試執行）
pnpm test:e2e:ui
```

---

## Step 7: 開發工作流程

### 7.1 啟動所有服務（開發時）

開啟 **3 個終端機視窗**：

**終端機 1: Next.js 開發伺服器**
```bash
pnpm dev
```

**終端機 2: TypeScript 型別檢查（watch mode）**
```bash
pnpm tsc --watch --noEmit
```

**終端機 3: Vitest 測試（watch mode）**
```bash
pnpm test:watch
```

### 7.2 程式碼檢查和格式化

```bash
# 執行 ESLint 檢查
pnpm lint

# 自動修復 ESLint 錯誤
pnpm lint:fix

# 格式化程式碼（Prettier）
pnpm format

# 檢查格式（不修改檔案）
pnpm format:check
```

### 7.3 資料庫管理常用指令

```bash
# 建立新的遷移
pnpm prisma migrate dev --name add_new_field

# 重置資料庫（刪除所有資料）
pnpm prisma migrate reset

# 開啟 Prisma Studio（資料庫 GUI）
pnpm prisma studio

# 手動執行種子資料（如果有）
pnpm prisma db seed
```

---

## Step 8: 建立第一個測試用戶

### 8.1 使用 API 註冊用戶（cURL）

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123"
  }'
```

**預期回應**:
```json
{
  "success": true,
  "data": {
    "userId": "clhv8j9k40000ld08x5k8f8b2",
    "email": "test@example.com"
  }
}
```

### 8.2 登入並獲取 Token

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123"
  }' \
  -c cookies.txt  # 儲存 Cookie（包含 JWT Token）
```

### 8.3 使用 Token 呼叫受保護的 API

```bash
# 查詢 API Keys（使用儲存的 Cookie）
curl -X GET http://localhost:3000/api/api-keys \
  -b cookies.txt
```

---

## Step 9: 前端開發

### 9.1 開啟前端開發工具

訪問 `http://localhost:3000` 並開啟瀏覽器開發者工具（F12）：

1. **Network 標籤**: 檢視 API 請求和回應
2. **Console 標籤**: 檢視 WebSocket 事件和 console.log 輸出
3. **Application 標籤**: 檢視 Cookie（JWT Token）和 LocalStorage

### 9.2 使用 React DevTools

安裝 React DevTools 瀏覽器擴充功能：
- Chrome: [React Developer Tools](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi)
- Firefox: [React DevTools](https://addons.mozilla.org/en-US/firefox/addon/react-devtools/)

### 9.3 使用 TailwindCSS IntelliSense

安裝 VS Code 擴充功能：
- [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)

---

## Step 10: 除錯技巧

### 10.1 後端除錯（Node.js）

使用 VS Code 內建除錯器：

**`.vscode/launch.json`**:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Next.js",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["dev"],
      "port": 9229,
      "console": "integratedTerminal"
    }
  ]
}
```

按 `F5` 啟動除錯模式，可以設定中斷點。

### 10.2 前端除錯（React）

在 React 元件中設定 `debugger;` 語句：

```typescript
function MyComponent() {
  debugger;  // 瀏覽器會在此停止
  return <div>Hello</div>;
}
```

### 10.3 檢視 Pino 日誌

Pino 日誌預設輸出 JSON 格式，較難閱讀。安裝 `pino-pretty` 美化輸出：

```bash
pnpm add -D pino-pretty

# 啟動時使用 pino-pretty
pnpm dev | pnpm pino-pretty
```

### 10.4 WebSocket 除錯

使用瀏覽器 Console 監聽所有 WebSocket 事件：

```javascript
const socket = io('http://localhost:3000', { withCredentials: true });

// 監聽所有事件
socket.onAny((eventName, ...args) => {
  console.log(`[WS] ${eventName}:`, args);
});
```

---

## 常見問題 (FAQ)

### Q1: `pnpm install` 失敗

**問題**: 安裝依賴時出現錯誤

**解決方法**:
```bash
# 清除 pnpm cache 並重新安裝
pnpm store prune
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Q2: Prisma migrate 失敗

**問題**: 執行遷移時出現 "relation already exists" 錯誤

**解決方法**:
```bash
# 重置資料庫（警告：會刪除所有資料）
pnpm prisma migrate reset

# 或手動刪除 Docker volume 重建
docker-compose down -v
docker-compose up -d
pnpm prisma migrate deploy
```

### Q3: Next.js 編譯錯誤

**問題**: 啟動 `pnpm dev` 時出現 TypeScript 錯誤

**解決方法**:
```bash
# 確保 Prisma Client 已生成
pnpm prisma generate

# 重新啟動 TypeScript server (VS Code)
# Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"
```

### Q4: WebSocket 連線失敗

**問題**: 瀏覽器 Console 顯示 "WebSocket connection failed"

**解決方法**:
1. 確認 `server.ts` 正在運行（不是 `next dev`）
2. 檢查 `.env` 中的 `NEXT_PUBLIC_WS_URL` 設定正確
3. 清除瀏覽器 Cookie 並重新登入

### Q5: JWT Token 無效

**問題**: API 回應 "Authentication error: Invalid token"

**解決方法**:
1. 確認 `.env` 中的 `JWT_SECRET` 與產生 Token 時相同
2. 檢查 Token 是否過期（預設 24 小時）
3. 清除瀏覽器 Cookie 並重新登入

---

## 下一步

開發環境設定完成後，您可以：

1. **閱讀技術文件**:
   - [plan.md](./plan.md) - 技術實作計畫
   - [data-model.md](./data-model.md) - 資料模型設計
   - [contracts/openapi.yaml](./contracts/openapi.yaml) - REST API 規格
   - [contracts/websocket.md](./contracts/websocket.md) - WebSocket 事件規格

2. **開始開發**:
   - 執行 `/speckit.tasks` 指令產生開發任務清單
   - 按照 tasks.md 中的優先級開始實作

3. **測試和除錯**:
   - 編寫測試來驗證功能
   - 使用瀏覽器開發者工具除錯前端
   - 使用 VS Code 除錯器除錯後端

---

**Happy Coding! 🚀**

如有問題，請參考：
- 專案憲法: `.specify/memory/constitution.md`
- 既有 README: `README.md`
- Prisma 文件: https://www.prisma.io/docs
- Next.js 文件: https://nextjs.org/docs
- Socket.io 文件: https://socket.io/docs/v4/
