# Requirements Checklist: 公開套利機會歷史首頁

**Purpose**: 驗證公開首頁功能需求的完整實作
**Created**: 2026-01-18
**Feature**: [spec.md](../spec.md)

## 功能需求驗證

### 公開存取

- [ ] CHK001 根路徑 `/` 無需登入即可訪問
- [ ] CHK002 首頁不顯示任何需認證的內容
- [ ] CHK003 登入/註冊按鈕正確導向對應頁面

### 套利機會列表

- [ ] CHK004 正確查詢 `OpportunityEndHistory` 表資料
- [ ] CHK005 按 `disappearedAt` 時間倒序排列
- [ ] CHK006 顯示交易對 (`symbol`)
- [ ] CHK007 顯示多方交易所 (`longExchange`)
- [ ] CHK008 顯示空方交易所 (`shortExchange`)
- [ ] CHK009 顯示最大費差 (`maxSpread`)
- [ ] CHK010 顯示最終費差 (`finalSpread`)
- [ ] CHK011 顯示實現年化報酬率 (`realizedAPY`)
- [ ] CHK012 顯示持續時間（人類可讀格式）
- [ ] CHK013 顯示機會消失時間

### 分頁功能

- [ ] CHK014 每頁顯示 20 筆記錄
- [ ] CHK015 分頁控制元件正常運作
- [ ] CHK016 分頁切換時顯示載入指示器

### 品牌與 CTA

- [ ] CHK017 顯示系統名稱和簡短說明
- [ ] CHK018 顯示登入按鈕
- [ ] CHK019 顯示註冊按鈕

### 邊界情況

- [ ] CHK020 無記錄時顯示空狀態提示
- [ ] CHK021 API 失敗時顯示錯誤訊息
- [ ] CHK022 資料載入中顯示骨架屏

### 資料隱私

- [ ] CHK023 不洩漏 `userId` 欄位
- [ ] CHK024 不洩漏 `notificationCount` 欄位
- [ ] CHK025 僅顯示客觀市場數據

### 時間範圍篩選（Clarification 新增）

- [ ] CHK026 預設顯示 90 天內的記錄
- [ ] CHK027 支援切換 7/30/90 天時間範圍
- [ ] CHK028 時間範圍篩選 UI 正常運作

### 已登入用戶行為（Clarification 新增）

- [ ] CHK029 已登入用戶訪問 `/` 自動重導向到 `/market-monitor`

## 非功能需求驗證

- [ ] CHK030 首頁初始載入 < 2 秒
- [ ] CHK031 分頁切換 < 500ms
- [ ] CHK032 響應式設計（桌面/行動裝置）
- [ ] CHK033 API 速率限制：每 IP 每分鐘 30 次請求
- [ ] CHK034 SSR 渲染支援 SEO
- [ ] CHK035 包含 meta tags 和 Open Graph 標籤

## Notes

- Check items off as completed: `[x]`
- Add comments or findings inline
- Link to relevant resources or documentation
