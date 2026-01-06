# Quickstart: 通知價差過濾

**Feature**: 057-notification-price-filter
**Date**: 2026-01-06

## 功能概述

此功能讓用戶可以啟用「價差過濾」，只在套利機會真正有利可圖時才收到通知。

## 啟用條件

當用戶啟用價差過濾後，通知只在以下兩個條件同時滿足時發送：

1. **淨收益 > 0**: 資費差減去 0.5% 總成本後仍為正
2. **價差方向正確**: 空方價格 >= 多方價格，或價差在 0.05% 容忍範圍內

## 使用方式

### 在 UI 中啟用

1. 前往 **設定 > 通知設定**
2. 找到要編輯的 Webhook
3. 點擊「編輯」按鈕
4. 切換「只在價差有利時通知」開關為開啟
5. 點擊「儲存」

### 通過 API 啟用

```bash
# 更新現有 Webhook
curl -X PUT /api/notifications/webhooks/{id} \
  -H "Content-Type: application/json" \
  -d '{"requireFavorablePrice": true}'
```

## 預設行為

- **新建 Webhook**: 預設關閉（`requireFavorablePrice: false`）
- **現有 Webhook**: 預設關閉（不影響現有用戶）

## 測試驗證

### 單元測試

```bash
pnpm test tests/unit/services/NotificationService.passesPriceFilter.test.ts
```

### 整合測試

```bash
pnpm test tests/integration/notification-price-filter.test.ts
```

## 相關常數

| 常數 | 值 | 說明 |
|------|-----|------|
| `TOTAL_COST_RATE` | 0.5% | 總交易成本 |
| `MAX_ACCEPTABLE_ADVERSE_PRICE_DIFF` | 0.05% | 可接受的不利價差 |

## 故障排除

### 為什麼沒有收到通知？

如果啟用了價差過濾但沒有收到通知，可能是：

1. **淨收益為負**: 資費差不足以覆蓋成本
2. **價差方向不利**: 空方價格低於多方價格超過 0.05%
3. **價格數據不完整**: 系統無法判斷價差方向

檢查方式：查看後端日誌中的 `Price filter rejected` 訊息。
