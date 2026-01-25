---
name: analyze-log
description: "分析專案 log 檔案。支援讀取 logs/（完整）、logs/warning/（警告）、logs/critical/（錯誤）目錄。功能：統計分析、錯誤追蹤、模式識別、時間範圍過濾、context 過濾。關鍵字：log, 日誌, 錯誤, error, warning, 警告, critical, 分析, analyze, 統計。"
---

# Analyze Log - 日誌分析工具

分析專案的 log 檔案，提供統計摘要、錯誤追蹤和模式識別。

## Log 目錄結構

```
logs/
├── YYYY-MM-DD.log      # 完整日誌（所有 level）
├── warning/
│   └── YYYY-MM-DD.log  # 警告日誌（warn only）
└── critical/
    └── YYYY-MM-DD.log  # 嚴重錯誤（error, fatal）
```

## Log 格式

每行 log 是一個 JSON 物件：
```json
{"level":"error","time":"2026-01-25T14:58:12.929Z","pid":34183,"hostname":"Mac.lan","context":"trading","msg":"Order failed"}
```

欄位說明：
- `level`: trace, debug, info, warn, error, fatal
- `time`: ISO 8601 時間戳
- `context`: 日誌來源（trading, exchange, websocket, database 等）
- `msg`: 日誌訊息
- 其他欄位：視情況包含額外資訊

## 使用方式

### 1. 快速檢視今日錯誤

```bash
# 檢視今日 critical logs
cat logs/critical/$(date +%Y-%m-%d).log | jq -r '.msg' | sort | uniq -c | sort -rn

# 檢視今日 warning logs
cat logs/warning/$(date +%Y-%m-%d).log | jq -r '.msg' | sort | uniq -c | sort -rn
```

### 2. 依 context 過濾

```bash
# 過濾特定 context 的錯誤
cat logs/critical/$(date +%Y-%m-%d).log | jq -r 'select(.context == "trading")'

# 統計各 context 的錯誤數量
cat logs/critical/$(date +%Y-%m-%d).log | jq -r '.context' | sort | uniq -c | sort -rn
```

### 3. 時間範圍過濾

```bash
# 過濾最近 1 小時的 log
cat logs/$(date +%Y-%m-%d).log | jq -r --arg since "$(date -v-1H +%Y-%m-%dT%H:%M:%S)" 'select(.time > $since)'
```

### 4. 錯誤詳情分析

```bash
# 顯示完整錯誤資訊（含 stack trace）
cat logs/critical/$(date +%Y-%m-%d).log | jq '.'

# 顯示最近 10 筆錯誤
tail -10 logs/critical/$(date +%Y-%m-%d).log | jq '.'
```

---

## 分析工作流程

當使用者要求分析 log 時，依以下步驟執行：

### Step 1: 確認分析範圍

詢問或推斷：
- **日期範圍**：今天、昨天、最近 N 天、特定日期
- **Level 過濾**：all, warning, critical
- **Context 過濾**：trading, exchange, websocket, database, arbitrage 等
- **關注重點**：錯誤統計、模式識別、特定錯誤追蹤

### Step 2: 讀取 Log 檔案

根據分析範圍選擇適當的 log 目錄：

| 需求 | 目錄 |
|:-----|:-----|
| 完整分析 | `logs/YYYY-MM-DD.log` |
| 只看警告 | `logs/warning/YYYY-MM-DD.log` |
| 只看錯誤 | `logs/critical/YYYY-MM-DD.log` |

### Step 3: 執行分析

使用 Bash 工具執行分析命令：

```bash
# 統計 log 總數
wc -l logs/$(date +%Y-%m-%d).log

# 統計各 level 數量
cat logs/$(date +%Y-%m-%d).log | jq -r '.level' | sort | uniq -c

# 統計各 context 數量
cat logs/$(date +%Y-%m-%d).log | jq -r '.context' | sort | uniq -c | sort -rn

# 錯誤訊息分類
cat logs/critical/$(date +%Y-%m-%d).log | jq -r '.msg' | sort | uniq -c | sort -rn | head -20
```

### Step 4: 輸出分析報告

提供結構化的分析報告，包含：

1. **摘要統計**
   - 總 log 數量
   - 各 level 分布
   - 各 context 分布

2. **錯誤分析**（如有）
   - 錯誤類型統計
   - 最常見的錯誤訊息
   - 錯誤發生時間分布

3. **警告分析**（如有）
   - 警告類型統計
   - 潛在問題識別

4. **建議**
   - 需要關注的問題
   - 可能的根因
   - 建議的後續行動

---

## 常見分析場景

### 場景 1：今日錯誤總覽

```bash
echo "=== 今日錯誤統計 ==="
echo "錯誤總數: $(wc -l < logs/critical/$(date +%Y-%m-%d).log 2>/dev/null || echo 0)"
echo ""
echo "=== 依 Context 分類 ==="
cat logs/critical/$(date +%Y-%m-%d).log 2>/dev/null | jq -r '.context' | sort | uniq -c | sort -rn
echo ""
echo "=== 錯誤訊息統計 ==="
cat logs/critical/$(date +%Y-%m-%d).log 2>/dev/null | jq -r '.msg' | sort | uniq -c | sort -rn | head -10
```

### 場景 2：交易相關錯誤

```bash
echo "=== Trading Context 錯誤 ==="
cat logs/critical/$(date +%Y-%m-%d).log 2>/dev/null | jq 'select(.context == "trading")' | jq -r '.msg' | sort | uniq -c | sort -rn
```

### 場景 3：WebSocket 連線問題

```bash
echo "=== WebSocket 相關 Log ==="
cat logs/$(date +%Y-%m-%d).log 2>/dev/null | jq 'select(.context == "websocket")' | jq -r '[.level, .msg] | @tsv' | sort | uniq -c | sort -rn
```

### 場景 4：最近 N 筆錯誤詳情

```bash
echo "=== 最近 5 筆錯誤 ==="
tail -5 logs/critical/$(date +%Y-%m-%d).log 2>/dev/null | jq '.'
```

---

## 注意事項

1. **Log 檔案可能很大**：使用 `head`、`tail` 限制輸出
2. **JSON 格式**：使用 `jq` 解析，確保系統已安裝
3. **日期格式**：檔名為 `YYYY-MM-DD.log`
4. **時區**：log 時間為 UTC（ISO 8601）
