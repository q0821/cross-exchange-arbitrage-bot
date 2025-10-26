# Technical Research: Web 多用戶套利交易平台

**Feature**: 006-web-trading-platform
**Date**: 2025-10-27
**Purpose**: 記錄技術選擇決策、研究成果和替代方案評估

## 概述

本文件記錄在規劃 Web 多用戶套利交易平台時的關鍵技術決策。每個決策都包含：選擇的方案、理由、考慮過的替代方案、以及權衡分析。

---

## 1. 全棧框架選擇

### Decision: Next.js 14 (App Router)

**Rationale**:
- **前後端一體**: 簡化部署和開發流程，單一 codebase 同時包含前端和後端
- **Server Actions**: Next.js 14 的 Server Actions 提供類型安全的後端邏輯調用，減少 API boilerplate
- **檔案系統路由**: App Router 的檔案系統路由非常直觀，適合快速開發
- **良好的 TypeScript 支援**: 與專案既有的 TypeScript 5.3+ 完美整合
- **部署簡便**: Vercel 原生支援，或可輕鬆打包成 Docker container 自架
- **開發體驗**: 熱重載、自動優化、內建圖片優化等功能提升開發效率
- **SEO 友好**: 雖然本專案是內部工具不需 SEO，但 SSR 能力在未來擴展時有價值

**Alternatives Considered**:

#### Option A: Express.js + React (前後端分離)
- **優點**:
  - 更大的靈活性，前後端完全解耦
  - Express 生態系成熟，中介軟體豐富
  - React 可以用任何狀態管理方案（Redux, Zustand 等）
- **缺點**:
  - 需要管理兩個專案（backend/ 和 frontend/）
  - API 層需要手動定義和維護（更多 boilerplate）
  - 部署更複雜（需要兩個服務或 reverse proxy）
  - TypeScript 型別在前後端之間需要手動同步或使用 tRPC
- **為何拒絕**: 對於小團隊內部工具，前後端分離增加的複雜度大於彈性帶來的好處

#### Option B: NestJS + React
- **優點**:
  - 企業級架構，適合複雜業務邏輯
  - 內建依賴注入（DI），模組化設計
  - 強大的 TypeScript 支援
  - 適合大型團隊協作
- **缺點**:
  - 學習曲線陡峭，概念抽象（modules, providers, decorators）
  - 對於 10 人以內的小團隊過於重量級
  - 初始設定複雜，開發速度較慢
  - 前後端仍需分離部署
- **為何拒絕**: Overkill，不符合 MVP 快速交付原則（Core Principle V: Incremental Delivery）

#### Option C: Remix
- **優點**:
  - 現代化的全棧框架，類似 Next.js
  - 優秀的數據載入和表單處理機制
  - 良好的開發者體驗
- **缺點**:
  - 生態系相對較小（比 Next.js 少）
  - 團隊可能不熟悉 Remix 的 loader/action 模式
  - 部署選項較少（主要是 Cloudflare Workers, Vercel, 自架）
- **為何拒絕**: Next.js 生態系更成熟，團隊學習成本更低

**Final Decision**: Next.js 14 平衡了開發速度、部署簡便性和技術成熟度，最符合專案需求。

---

## 2. 即時通訊技術

### Decision: Socket.io 4.x

**Rationale**:
- **成熟穩定**: Socket.io 是業界標準的 WebSocket 庫，經過大規模生產環境驗證
- **自動降級**: 當 WebSocket 不可用時自動降級到長輪詢（long-polling）
- **自動重連**: 內建斷線重連機制，符合 Core Principle III (Defensive Programming)
- **房間機制**: 支援 room/namespace，方便實作用戶隔離（每個用戶只收到自己的套利機會）
- **事件驅動**: 簡潔的事件發送/接收 API，易於維護
- **Next.js 整合**: 可透過自訂 server.ts 整合到 Next.js 專案中

**Alternatives Considered**:

#### Option A: Server-Sent Events (SSE)
- **優點**:
  - 實作簡單，基於 HTTP
  - 瀏覽器原生支援（EventSource API）
  - 適合單向數據流（伺服器推送到客戶端）
- **缺點**:
  - 只支援單向通訊（伺服器 → 客戶端），客戶端要發送數據仍需額外 HTTP 請求
  - 瀏覽器對同時開啟的 SSE 連線有限制（6 個 per domain）
  - 需要手動實作重連和錯誤處理
- **為何拒絕**: 雖然即時套利機會推送是單向的，但未來可能需要雙向通訊（如用戶訂閱特定交易對），SSE 不夠靈活

#### Option B: WebSocket (原生 ws 庫)
- **優點**:
  - 最輕量，沒有 Socket.io 的抽象層
  - 更好的效能（減少 overhead）
- **缺點**:
  - 需要手動實作重連、心跳檢測、房間管理等機制
  - 沒有自動降級，在某些網路環境下可能無法連線
  - 開發和維護成本高
- **為何拒絕**: 手動實作這些機制違反 Core Principle V（快速交付），Socket.io 提供的高階功能更有價值

#### Option C: GraphQL Subscriptions (with Apollo)
- **優點**:
  - 統一的資料查詢和訂閱機制（GraphQL）
  - 類型安全的訂閱
  - 適合複雜的數據依賴場景
- **缺點**:
  - 需要引入整套 GraphQL 生態系（Apollo Server/Client, schema 定義）
  - 學習曲線陡峭，對於簡單的即時推送過於複雜
  - 效能 overhead 較大
- **為何拒絕**: 本專案的即時推送需求簡單（套利機會、持倉更新），不需要 GraphQL 的複雜查詢能力

**Final Decision**: Socket.io 提供了完善的 WebSocket 抽象層，並解決了許多生產環境常見問題（重連、降級、房間管理），是最佳選擇。

---

## 3. 認證機制

### Decision: Email + Password with bcrypt and JWT

**Rationale**:
- **簡單直接**: 符合規格要求（FR-001 到 FR-007），不需要第三方認證服務
- **完全掌控**: 用戶資料完全儲存在自己的資料庫中，不依賴外部服務
- **bcrypt 密碼雜湊**: 業界標準的密碼加密方式，防止彩虹表攻擊
- **JWT Token**: 無狀態的 Token 機制，適合 REST API 和 WebSocket 認證
- **HttpOnly Cookie**: 將 JWT 儲存在 HttpOnly Cookie 中防止 XSS 攻擊
- **成本低**: 無需額外的第三方服務費用

**Alternatives Considered**:

#### Option A: NextAuth.js (支援多種登入方式)
- **優點**:
  - 支援 Email/Password, Google, GitHub, OAuth 等多種登入方式
  - 內建 session 管理和 CSRF 保護
  - Next.js 整合良好
  - 省去自行實作認證的工作
- **缺點**:
  - 對於簡單的 Email/Password 登入是 overkill
  - 增加了抽象層，自訂行為較複雜（如 API Key 綁定用戶）
  - 預設使用資料庫 session 模式，需要額外的 Session 表
- **為何拒絕**: 規格明確只需要 Email + Password 認證（Assumption #8 不包含 OAuth），NextAuth.js 的多餘功能增加複雜度

#### Option B: Passport.js
- **優點**:
  - 成熟的 Node.js 認證中介軟體
  - 支援數百種認證策略（local, OAuth, SAML 等）
  - 靈活性高，可自訂各種認證流程
- **缺點**:
  - 需要手動整合到 Next.js API Routes 中（非官方支援）
  - 設定複雜，需要理解 session 和 serialization
  - 社群主要針對 Express.js，Next.js 範例較少
- **為何拒絕**: 對於簡單的 Email/Password 認證，手動實作 bcrypt + JWT 更直接、更易於理解和維護

#### Option C: Auth0 / Firebase Auth (第三方認證服務)
- **優點**:
  - 完全託管的認證服務，省去維護成本
  - 企業級安全性（多因素認證、異常偵測等）
  - 內建用戶管理界面
- **缺點**:
  - 需要額外成本（雖然有免費額度，但長期使用可能收費）
  - 依賴外部服務，網路問題或服務中斷會影響登入
  - 用戶資料儲存在第三方，可能有合規或隱私疑慮
  - 增加專案外部依賴
- **為何拒絕**: 對於內部工具（< 10 人），自行管理認證更簡單且無額外成本

**Final Decision**: 手動實作 Email + Password 認證（bcrypt + JWT），完全符合規格需求，且無外部依賴。

---

## 4. API Key 加密方式

### Decision: AES-256-GCM (Node.js crypto module)

**Rationale**:
- **對稱加密**: AES-256-GCM 是對稱加密算法，加密和解密速度快，符合 `< 100ms` 延遲約束
- **GCM 模式**: Galois/Counter Mode 提供認證加密（AEAD），可防止密文被竄改
- **業界標準**: AES-256 是 NIST 認可的加密標準，安全性經過驗證
- **Node.js 原生支援**: crypto 模組內建，無需額外依賴
- **符合 FR-011**: 規格要求「靜態加密」（encryption at rest），AES-256-GCM 滿足需求

**Implementation Details**:
- 加密密鑰從環境變數讀取（`ENCRYPTION_KEY`），長度 32 bytes (256 bits)
- 每次加密生成隨機 IV（Initialization Vector），與密文一起儲存
- 格式：`{iv}:{encryptedData}:{authTag}` (base64 編碼)

**Alternatives Considered**:

#### Option A: RSA 非對稱加密
- **優點**:
  - 公鑰加密、私鑰解密，可實作更複雜的密鑰管理
  - 適合多方加密場景
- **缺點**:
  - 效能較差（比 AES 慢 10-100 倍），難以滿足 `< 100ms` 約束
  - 密鑰管理更複雜（需要管理公鑰和私鑰對）
  - 對於單一伺服器加密/解密的場景，非對稱加密無優勢
- **為何拒絕**: 本專案的 API Key 只在伺服器端加密和解密，不需要非對稱加密的公鑰分發特性，且效能不符合需求

#### Option B: Bcrypt (同密碼雜湊)
- **優點**:
  - 簡單，與密碼加密使用同一個庫
- **缺點**:
  - Bcrypt 是單向雜湊函式，無法解密（只能驗證）
  - API Key 需要解密才能呼叫交易所 API，bcrypt 不適用
- **為何拒絕**: 不可逆雜湊無法滿足「解密 API Key 呼叫交易所」的需求

#### Option C: 第三方密鑰管理服務 (AWS KMS, HashiCorp Vault)
- **優點**:
  - 專業的密鑰管理和輪換機制
  - 審計日誌和權限控制
  - 硬體加密模組（HSM）支援
- **缺點**:
  - 額外成本（AWS KMS 按 API 呼叫次數收費）
  - 增加外部依賴，網路延遲可能影響效能
  - 對於小團隊內部工具過於複雜
- **為何拒絕**: Overkill，不符合專案規模（< 10 用戶）

**Final Decision**: AES-256-GCM 平衡了安全性、效能和實作簡便性，是最佳選擇。

---

## 5. UI 元件庫

### Decision: shadcn/ui + TailwindCSS 3+

**Rationale**:
- **無依賴**: shadcn/ui 不是 npm 套件，而是複製元件到專案中，完全可控
- **高度可客製化**: 基於 Radix UI 原語（primitives），可自由修改樣式
- **TailwindCSS 整合**: 與 TailwindCSS 完美搭配，使用 utility-first CSS
- **TypeScript 支援**: 所有元件都有完整的 TypeScript 型別定義
- **現代設計**: 預設風格簡潔現代，適合金融交易平台
- **無執行時成本**: 編譯時生成 CSS，沒有 CSS-in-JS 的執行時開銷

**Alternatives Considered**:

#### Option A: Material-UI (MUI)
- **優點**:
  - 成熟的元件庫，元件豐富
  - Google Material Design 設計語言
  - 社群大，資源多
- **缺點**:
  - 包體積大（~300KB gzipped），影響首次載入速度
  - 客製化複雜，需要覆寫深層樣式
  - 設計風格固定，難以打造獨特外觀
  - 使用 emotion (CSS-in-JS)，有執行時成本
- **為何拒絕**: 對於需要高度客製化的交易平台，MUI 的設計限制太多

#### Option B: Ant Design
- **優點**:
  - 企業級 UI 設計，適合後台管理系統
  - 元件豐富，包含表格、表單、圖表等
  - 中文文檔完整
- **缺點**:
  - 包體積大，且必須整包引入（難以 tree-shaking）
  - 設計風格固定（藍色主題），客製化困難
  - Less 樣式系統與 TailwindCSS 衝突
- **為何拒絕**: 與 TailwindCSS 不相容，且設計風格不夠現代

#### Option C: Headless UI (無樣式元件)
- **優點**:
  - 完全無樣式，最大靈活性
  - Tailwind Labs 官方維護
  - 輕量級
- **缺點**:
  - 需要從零開始設計所有元件樣式
  - 缺少預設設計，開發速度慢
  - 元件數量少於 shadcn/ui
- **為何拒絕**: shadcn/ui 基於 Radix UI（類似 Headless UI），但提供了美觀的預設樣式，開發速度更快

**Final Decision**: shadcn/ui + TailwindCSS 提供了完美的平衡：預設美觀、高度可控、無執行時成本、與 Next.js 整合良好。

---

## 6. 圖表庫 (收益統計)

### Decision: Recharts (with React Server Components 相容性考慮)

**Rationale**:
- **React 整合**: 原生 React 元件，API 設計符合 React 習慣
- **聲明式**: 使用 JSX 宣告圖表結構，易於理解和維護
- **響應式**: 內建響應式設計，適配不同螢幕尺寸
- **可客製化**: 支援自訂樣式、tooltip、legend 等
- **輕量級**: 相對於 ECharts 等庫，包體積較小
- **TailwindCSS 友好**: 可以使用 Tailwind 類名自訂樣式

**Alternatives Considered**:

#### Option A: Chart.js (with react-chartjs-2)
- **優點**:
  - 最流行的圖表庫之一
  - 效能優秀（基於 Canvas）
  - 文檔完整，社群大
- **缺點**:
  - 基於 Canvas，不是原生 React 元件（需要 wrapper）
  - 在 Next.js Server Components 中需要額外配置
  - 客製化需要理解 Chart.js 的 options 物件，學習曲線較陡
- **為何拒絕**: react-chartjs-2 wrapper 增加了抽象層，不如 Recharts 原生

#### Option B: Victory
- **優點**:
  - React 原生，基於 SVG
  - 模組化設計，可組合不同圖表類型
  - 動畫效果豐富
- **缺點**:
  - 效能較差（大數據集下 SVG 渲染慢）
  - 社群較小，更新頻率低
  - 包體積較大
- **為何拒絕**: 效能問題可能影響使用者體驗，且社群活躍度不如 Recharts

#### Option C: ECharts (with echarts-for-react)
- **優點**:
  - 功能強大，圖表類型豐富
  - 大數據集效能優秀（基於 Canvas）
  - 中文文檔完整
- **缺點**:
  - 包體積非常大（~1MB+ 未壓縮）
  - 配置複雜，需要理解 ECharts 的 option 物件
  - 與 React 整合需要 wrapper，不夠原生
  - 對於簡單的收益趨勢圖是 overkill
- **為何拒絕**: 本專案的圖表需求簡單（折線圖、柱狀圖），不需要 ECharts 的複雜功能

**Final Decision**: Recharts 平衡了易用性、效能和包體積，最適合本專案的收益統計需求。

**Implementation Notes**:
- 由於 Recharts 依賴瀏覽器 API，在 Next.js Server Components 中需要標記為 `'use client'`
- 圖表元件放在 `components/stats/RevenueChart.tsx` 中，作為 Client Component

---

## 7. E2E 測試框架

### Decision: Playwright

**Rationale**:
- **跨瀏覽器**: 支援 Chromium, Firefox, WebKit（Safari），確保相容性
- **快速穩定**: 比 Cypress 快，且更少 flaky tests
- **TypeScript 原生支援**: 完整的 TypeScript 型別定義
- **並行執行**: 支援多個瀏覽器和多個測試檔案並行執行
- **內建等待機制**: 自動等待元素可見、可點擊等，減少手動 `wait` 呼叫
- **錄製功能**: Playwright Codegen 可以錄製操作生成測試程式碼
- **Next.js 整合**: 官方提供 Next.js 整合範例

**Alternatives Considered**:

#### Option A: Cypress
- **優點**:
  - 最流行的 E2E 測試框架
  - 優秀的開發者體驗（Time Travel Debug, 視覺化測試執行器）
  - 社群大，資源豐富
- **缺點**:
  - 只支援瀏覽器測試（不支援 Safari WebKit，除非使用付費版）
  - 並行執行需要付費版（Cypress Dashboard）
  - 執行速度較慢
  - 與 Next.js 整合需要額外配置
- **為何拒絕**: Playwright 功能更強大（免費支援並行執行和 WebKit），且執行速度更快

#### Option B: Selenium WebDriver
- **優點**:
  - 業界標準，歷史悠久
  - 支援所有主流瀏覽器
  - 跨語言（Java, Python, JavaScript 等）
- **缺點**:
  - 配置複雜（需要安裝瀏覽器驅動）
  - API 設計老舊，不夠現代
  - 測試穩定性差，常有等待和同步問題
  - 執行速度慢
- **為何拒絕**: Playwright 是 Selenium 的現代化替代品，API 更友善，執行更快

#### Option C: TestCafe
- **優點**:
  - 不需要 WebDriver，直接在瀏覽器中執行
  - 自動等待機制
  - 支援並行執行
- **缺點**:
  - 社群較小，更新頻率較低
  - 與現代框架（Next.js, React）整合不如 Playwright 好
  - 執行速度不如 Playwright
- **為何拒絕**: Playwright 功能更強大，社群更活躍

**Final Decision**: Playwright 是最現代、最快、功能最強大的 E2E 測試框架，且與 Next.js 整合良好。

---

## 8. 密碼強度要求

### Decision: 最少 8 字元，至少包含 1 個數字和 1 個字母

**Rationale**:
- **符合規格**: FR-003 明確要求此強度
- **平衡安全性和易用性**: 對於內部工具（< 10 人），此強度已足夠
- **防止弱密碼**: 排除純數字或純字母的簡單密碼

**Alternatives Considered**:

#### Option A: 更嚴格的要求（12+ 字元，包含大小寫、數字、特殊符號）
- **優點**:
  - 更高的安全性
  - 符合企業級安全標準（如 NIST 建議）
- **缺點**:
  - 用戶體驗差，難以記憶
  - 對於內部工具是 overkill
  - 可能導致用戶使用密碼管理器或寫在紙上（降低安全性）
- **為何拒絕**: 規格明確只需要 8 字元 + 數字 + 字母，更嚴格的要求不符合專案範圍

#### Option B: 更寬鬆的要求（6 字元，無其他限制）
- **優點**:
  - 易於記憶
  - 用戶體驗好
- **缺點**:
  - 安全性不足，容易被暴力破解
  - 不符合規格要求（FR-003）
- **為何拒絕**: 違反規格

**Final Decision**: 遵循規格要求（FR-003），8 字元 + 數字 + 字母已足夠。

**Implementation Notes**:
- 使用 Zod schema 驗證密碼強度
- 在前端和後端都進行驗證（前端提供即時反饋，後端確保安全性）

---

## 9. WebSocket 自訂 Server 整合

### Decision: 使用 Next.js Custom Server (server.ts)

**Rationale**:
- **Socket.io 整合**: Next.js 預設不支援 WebSocket，需要自訂 server 來整合 Socket.io
- **控制權**: 自訂 server 允許完全控制 HTTP server 和 WebSocket server
- **共用 port**: 可以在同一個 port 上提供 Next.js 頁面和 WebSocket 服務

**Implementation**:
```typescript
// server.ts (專案根目錄)
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { initializeSocketHandlers } from './src/websocket/SocketServer';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(server);
  initializeSocketHandlers(io);

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
```

**Alternatives Considered**:

#### Option A: 分離的 WebSocket 服務（在不同 port）
- **優點**:
  - 完全解耦，Next.js 和 WebSocket 服務獨立
  - 可以獨立擴展 WebSocket 服務
- **缺點**:
  - 需要管理兩個 port
  - 部署更複雜（需要 reverse proxy 或多個服務）
  - CORS 配置更複雜
- **為何拒絕**: 對於小團隊內部工具，單一服務更簡單

#### Option B: Vercel 部署（使用 serverless functions + Pusher/Ably）
- **優點**:
  - 完全 serverless，無需管理 server
  - 自動擴展
- **缺點**:
  - Vercel 的 serverless functions 不支援長連線（WebSocket）
  - 需要使用第三方 WebSocket 服務（Pusher, Ably），增加成本
  - 依賴外部服務
- **為何拒絕**: 增加外部依賴和成本，不符合專案需求

**Final Decision**: 使用 Next.js Custom Server 整合 Socket.io，簡單且可控。

**Trade-offs**:
- ⚠️ **無法部署到 Vercel**: Vercel 不支援自訂 server，需要改用 Docker 部署或其他平台（Railway, Render, 自架 VPS）
- ✅ **完全控制**: 可以自由配置 WebSocket 服務和中介軟體

---

## 10. 多用戶 API Key 管理策略

### Decision: 改造既有的 ExchangeConnector，支援動態 API Key 注入

**Rationale**:
- **重用既有程式碼**: 保留 `BinanceConnector` 和 `OkxConnector` 的核心邏輯
- **最小化變更**: 只需修改建構子，接受 `apiKey` 和 `secret` 作為參數（而非從全域配置讀取）
- **用戶隔離**: 每個請求根據用戶 ID 從資料庫讀取對應的 API Key，動態建立 Connector 實例

**Implementation**:
```typescript
// 既有設計（單用戶）
class BinanceConnector {
  constructor() {
    this.apiKey = config.binance.apiKey;  // 從全域配置讀取
    this.secret = config.binance.secret;
  }
}

// 新設計（多用戶）
class BinanceConnector {
  constructor(apiKey: string, secret: string) {
    this.apiKey = apiKey;  // 動態注入
    this.secret = secret;
  }
}

// 使用方式
const userApiKey = await apiKeyService.getDecryptedApiKey(userId, 'binance');
const connector = new BinanceConnector(userApiKey.key, userApiKey.secret);
```

**Alternatives Considered**:

#### Option A: Connector Pool（連線池）
- **優點**:
  - 重用 Connector 實例，減少建立開銷
  - 適合高並發場景
- **缺點**:
  - 實作複雜（需要管理池、逾期、清理等）
  - 對於 < 10 用戶的小團隊是 overkill
  - 安全風險（如果池管理不當，可能洩漏 API Key）
- **為何拒絕**: 過度設計，不符合專案規模

#### Option B: 每個用戶維護長期 Connector 實例（in-memory cache）
- **優點**:
  - 避免重複建立 Connector
  - 可以在用戶 session 期間重用
- **缺點**:
  - 記憶體管理複雜（需要清理閒置的 Connector）
  - 如果用戶更新 API Key，需要手動失效快取
  - 伺服器重啟會失效
- **為何拒絕**: 複雜度不值得，建立 Connector 的成本很低

**Final Decision**: 每次請求動態建立 Connector 實例，簡單且安全，符合專案規模。

---

## 總結

所有技術決策都遵循以下原則：

1. **重用既有程式碼**: 最大化保留 `src/services/`, `src/repositories/`, `src/connectors/` 中的邏輯
2. **符合憲法**: 所有決策都通過 Constitution Check，確保安全性、可觀測性和數據完整性
3. **適合專案規模**: 避免過度設計，專注於 < 10 用戶的內部工具需求
4. **快速交付**: 選擇成熟、文檔完整、易於整合的技術，加速 MVP 開發
5. **型別安全**: 所有選擇都完整支援 TypeScript 5.3+

下一步：**Phase 1 - 設計與合約**（產生 data-model.md, contracts/, quickstart.md）
