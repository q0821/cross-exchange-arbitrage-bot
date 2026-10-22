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

## 推送後相容性修正規格與計畫

精確 SHA 的 Cloudflare Pages 建置日誌顯示 .tool-versions 中 node 名稱無對應 asdf plugin，導致建置初始化失敗。本次問題類型是 mise／asdf 共用設定名稱不相容，七個本輪新增檔案均需修正。

目標與範圍：只將 .tool-versions 的 node 22.23.4 改為 nodejs 22.23.4，保留既有 Node.js 版本與功能。mise 官方 FAQ 確認 nodejs 是支援別名，且 .tool-versions 應使用 asdf 名稱。否決移除版本固定，因會失去安全修補版約束。

計畫：先回填本規格，再修改一行設定；驗證 mise 實際解析為 22.23.4、diff 僅該設定與本文件，逐一提交並推送已核定的同名功能分支，依新 SHA 重查 Cloudflare 結果。原其他未提交檔案保留。Moneygame 日誌 API 回 403，其失敗根因尚未確認，不以淺草籤日誌代替它的證據。

參考：https://mise.jdx.dev/faq.html

【本機已驗證】mise current node 回 22.23.4，diff --check 通過。Cloudflare 結果依新 SHA 另存任務結果，不以本機解析代替遠端建置。

## 合併後 GitHub Actions 相容性修正

問題：修補分支合併至 `main` 後，精確 SHA `df4088f78310756a1f6bdc6407b1da88e8f35a97` 的 GitHub Actions 在 `pnpm/action-setup@v4` 階段失敗。四份 workflow 共八處明確指定 pnpm 9，但 `package.json` 已固定 `packageManager: pnpm@10.34.5`，action 拒絕同時存在兩個不一致版本，因此測試尚未開始。

目標與範圍：刪除八處 workflow 的 `version: 9`，讓 `pnpm/action-setup` 使用 `package.json` 的單一版本來源 10.34.5；Node.js 22.23.4、工作步驟、資料庫與交易設定不變。否決把 `packageManager` 降回 pnpm 9，因 lockfile 與本機已使用 pnpm 10，降級會擴大相容性風險。

計畫：先修改本文件，再移除四份 workflow 的八個重複版本參數；以 YAML 差異、`packageManager` 與所有 action setup 節點一致性驗證；只提交本次文件與 workflow，不包含工作目錄原有的後端、測試、除錯腳本與規格變更。推送修補分支後再快轉 `main`，並以新 SHA 查核 GitHub Actions。

【已驗證】補修提交 `1882eb060855b1820c1eefe534e96cac1f1e9739` 已合併至遠端 `main`。所有工作已通過 pnpm 10.34.5 與 Node.js 22.23.4 的安裝階段；Lint、TypeScript、Prisma migration consistency 通過。單元測試實際執行後為 147 個測試檔通過、1 個失敗，2,656 項通過、3 項失敗，均位於本次開始前已有未提交修改的 `tests/unit/services/FundingFeeQueryService.test.ts`，未納入本次提交。整合測試為 21 個測試檔通過、1 個失敗，153 項通過、5 項 Binance Funding WebSocket 測試失敗；這些測試需要外部即時資料，未將其誤判為 Node.js 或 pnpm 安裝失敗。CI 設定衝突已排除，但完整測試仍非全綠。
