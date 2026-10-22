# Node.js 安全性修補規格與計畫

日期：2026-10-22。

## 規格

問題：舊版或未指定版本的 Node.js 建置／測試環境，可能選到 2026-10-21 安全性更新之前的版本。

目標：以 Node.js 22.23.4 驗證本專案，固定本機版本選擇，並更新專案中明確的 Node.js 20 設定。

範圍：新增 `.node-version` 與 mise 使用的 `.tool-versions`；有 engines.node 時改為 `>=22.23.4 <23`；只有 Boardgames 更新 Docker 建置基底；只有套利工具更新明確使用 Node.js 20 的 CI。版本要求同步至 lockfile 根層中繼資料，不更新套件解析。

不處理：不更動功能、不啟動正式伺服器、不做 migration、不接觸 API 金鑰或交易、不 push 或部署、不修改既有無關工作。原生 App 不重建或安裝到裝置。

決策：使用已安裝的 22.23.4，因為是受支援且可對照既有 22 系列的安全修補版。否決直接跳到 26 或全量更新套件，避免增加不相關相容性差異。

驗收：實際 node 版本與執行路徑正確；執行本專案可用的既有建置／離線測試；相依缺少、環境限制及失敗如實回填。

## 修補前檢查清單

- [x] 保留本次開始前的 Git 變更。
- [x] 不執行會連線交易所、修改資料庫或發送通知的測試。
- [x] 不因套件引擎檢查衝突而自動升級第三方套件。
- [x] 修改版本要求與同類 CI 設定時同步處理。
- [x] 區分本地驗證、既有長駐程序與正式部署。

## 實作計畫

1. 讀取 package.json、lockfile 與既有版本／CI 設定。
2. 新增版本檔，最小化更新舊版設定與 lockfile 根中繼資料。
3. 使用固定 runtime 執行安全的既有測試或建置；不執行 start 或部署腳本。
4. 回填結果與尚待核定的正式環境項目。

## 結果

【已驗證】使用原 pnpm lockfile、--frozen-lockfile --ignore-scripts 安裝既有相依。兩組純函式 20 項測試在 Node.js 22.23.4 通過；使用任務目錄的獨立 Vitest 設定，排除讀取 .env.test 與可能執行 migration 的全域 setup。四份 CI 中八處 Node.js 20 已改為 22.23.4。完整建置、資料庫、交易所、WebSocket、native bcrypt 與其他測試均未驗；未執行 Prisma generate 或安裝腳本，不能當作完整金融系統驗收。

本次 git diff --check、JSON／版本檔一致性與 mise current node 檢查通過。未 commit、push 或部署。


第二輪結果：沒有環境檔的隔離追蹤來源副本，在 Node.js 22.23.4 下 Prisma generate、bcrypt 假字串 smoke、tsc --noEmit 與完整 Next.js production build 通過。Prisma 只使用假 DB 位址產生 client；建置只允許固定 Google Fonts 下載，其他對外連線阻擋，未連實際 DB／交易所或執行 migration。先前失敗分別為禁止字型下載及非標準 NODE_ENV；最小 production 環境重驗通過。真實 DB、交易與完整路徑仍未驗。
