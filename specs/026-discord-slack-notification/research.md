# Research: Discord/Slack 套利機會即時推送通知

## Discord Webhook API

**Decision**: 使用 Discord Webhook REST API 發送 Embed 訊息

**Rationale**:
- Discord Webhook 是官方支援的方式，無需額外驗證或 OAuth
- Embed 格式支援豐富的視覺呈現（標題、欄位、顏色、連結）
- 無速率限制問題（每秒 30 請求以內即可）

**Alternatives considered**:
- Discord Bot: 需要更複雜的設定和 OAuth，對此用例過於複雜
- Discord 互動式訊息: 功能強大但此用例不需要

**API 規格**:
```
POST {webhook_url}
Content-Type: application/json

{
  "embeds": [{
    "title": "...",
    "color": 0x00FF00,  // 綠色表示套利機會
    "fields": [...]
  }]
}
```

## Slack Webhook API

**Decision**: 使用 Slack Incoming Webhooks 搭配 Block Kit

**Rationale**:
- Incoming Webhooks 是最簡單的整合方式
- Block Kit 提供結構化的訊息格式
- 無需 Slack App 的複雜設定

**Alternatives considered**:
- Slack API (Web API): 需要 OAuth tokens，對簡單通知過於複雜
- Slack RTM: 已棄用，不推薦

**API 規格**:
```
POST {webhook_url}
Content-Type: application/json

{
  "blocks": [
    { "type": "header", "text": { "type": "plain_text", "text": "..." } },
    { "type": "section", "fields": [...] },
    { "type": "divider" }
  ]
}
```

## 重複過濾機制

**Decision**: 使用記憶體 Map 儲存最近推送的機會

**Rationale**:
- 5 分鐘內的重複過濾不需要持久化
- 記憶體儲存效能最佳
- 服務重啟後清空是可接受的行為

**Implementation**:
```typescript
private notifiedOpportunities: Map<string, number> = new Map();

// key: `${userId}-${symbol}-${longExchange}-${shortExchange}`
// value: lastNotifyTimestamp
```

## 通知觸發點

**Decision**: 在 RatesCache 更新時檢查是否需要發送通知

**Rationale**:
- RatesCache 是所有費率數據的單一來源
- 已有 `setAll()` 方法批次更新所有費率
- 可在更新後遍歷所有用戶的 Webhooks 進行閾值檢查

**Integration Point**:
```typescript
// src/services/monitor/RatesCache.ts
setAll(rates: FundingRatePair[]): void {
  // ... existing logic ...

  // 觸發通知檢查（非同步，不阻塞主流程）
  notificationService.checkAndNotifyAll(rates).catch(err => {
    logger.error({ err }, 'Failed to send notifications');
  });
}
```

## 交易所直連網址格式

**Decision**: 根據交易所和交易對動態生成 URL

**URL 格式**:
```
Binance: https://www.binance.com/en/futures/{symbol} (例: BTCUSDT)
OKX: https://www.okx.com/trade-swap/{symbol} (例: btc-usdt-swap)
MEXC: https://futures.mexc.com/exchange/{symbol} (例: BTC_USDT)
Gate.io: https://www.gate.io/futures_trade/USDT/{symbol} (例: BTC_USDT)
```

## 價差分析計算

**Decision**: 使用現有的 `bestPair.priceDiffPercent` 並添加方向判斷

**Implementation**:
```typescript
// 價差方向正確：做多交易所價格 < 做空交易所價格
// priceDiffPercent = ((shortPrice - longPrice) / avgPrice) * 100
// 正值 = 方向正確，負值 = 方向反向

// 打平所需次數 = |priceDiffPercent| / spreadPercent
```

## 回本週期計算

**Decision**: 使用標準化 8h 費率計算回本週期

**Formula**:
```typescript
// 回本週期（次）= 開倉成本 / 每次收益
// 開倉成本 ≈ 交易手續費 (taker fee * 2) + 價差損失（如果反向）
// 每次收益 = 費率差 * 持倉金額

// 簡化版（忽略手續費，僅考慮價差）:
paybackPeriods = Math.abs(priceDiffPercent) / spreadPercent
```

## 技術決策摘要

| 項目 | 決策 | 理由 |
|------|------|------|
| Discord 整合 | Webhook + Embed | 簡單、無需 OAuth、視覺效果好 |
| Slack 整合 | Incoming Webhook + Block Kit | 簡單、結構化訊息 |
| 重複過濾 | 記憶體 Map | 5 分鐘內不需持久化 |
| 觸發點 | RatesCache.setAll() | 單一數據來源 |
| HTTP Client | axios | 專案已使用，成熟穩定 |
