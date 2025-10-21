# Quick Start: 修正 OKX 資金費率與增強價格顯示

**Feature**: 004-fix-okx-add-price-display
**Branch**: `004-fix-okx-add-price-display`
**Date**: 2025-01-21

本文件提供開發者快速上手指南，包含環境設定、開發流程和測試方法。

---

## 📋 前置需求

### 1. 必要工具

- **Node.js**: 20.x LTS ([下載](https://nodejs.org/))
- **pnpm**: 8.x+ (`npm install -g pnpm`)
- **Docker**: 最新版本 ([下載](https://www.docker.com/))
- **Git**: 最新版本

### 2. IDE 建議

- **VS Code** + Extensions:
  - Prisma
  - ESLint
  - Prettier
  - TypeScript + JavaScript

### 3. 帳號需求

- **Binance 測試網帳號**: [註冊](https://testnet.binance.vision/)
- **OKX 測試網帳號**: [註冊](https://www.okx.com/demo-trading)

---

## 🚀 快速開始

### Step 1: Clone 專案並切換分支

```bash
# Clone 專案（如果尚未 clone）
git clone https://github.com/your-org/cross-exchange-arbitrage-bot.git
cd cross-exchange-arbitrage-bot

# 切換到功能分支
git checkout 004-fix-okx-add-price-display

# 安裝依賴
pnpm install
```

### Step 2: 啟動 Docker 服務

```bash
# 啟動 PostgreSQL + TimescaleDB + Redis
docker-compose up -d

# 驗證服務運行
docker-compose ps
```

預期輸出：
```
NAME                IMAGE               STATUS
postgres            postgres:15         Up
redis               redis:7             Up
```

### Step 3: 配置環境變數

```bash
# 複製範例環境檔案
cp .env.example .env

# 編輯 .env
nano .env
```

**必填欄位**:
```bash
# 資料庫連線
DATABASE_URL="postgresql://arbitrage:password@localhost:5432/arbitrage_bot?schema=public"

# Binance API (測試網)
BINANCE_API_KEY="your_testnet_api_key"
BINANCE_SECRET_KEY="your_testnet_secret_key"
BINANCE_BASE_URL="https://testnet.binance.vision"

# OKX API (測試網)
OKX_API_KEY="your_testnet_api_key"
OKX_SECRET_KEY="your_testnet_secret_key"
OKX_PASSPHRASE="your_testnet_passphrase"
OKX_BASE_URL="https://www.okx.com"

# 套利評估配置（可選）
ARBITRAGE_MAKER_FEE=0.001  # 0.1%
ARBITRAGE_TAKER_FEE=0.001  # 0.1%
EXTREME_SPREAD_THRESHOLD=0.05  # 5%
```

### Step 4: 執行資料庫遷移

```bash
# 生成 Prisma Client
npx prisma generate

# 執行遷移
npx prisma migrate dev --name add_funding_rate_validations

# 驗證 TimescaleDB hypertable
npx prisma db execute --stdin <<SQL
SELECT * FROM timescaledb_information.hypertables WHERE hypertable_name = 'funding_rate_validations';
SQL
```

預期輸出：應顯示 `funding_rate_validations` 的 hypertable 資訊。

### Step 5: 編譯專案

```bash
# TypeScript 編譯
pnpm build

# 驗證編譯成功
ls dist/
```

預期輸出：
```
cli/
models/
services/
lib/
```

### Step 6: 執行監控服務

```bash
# 啟動監控（測試網模式）
node dist/cli/index.js monitor start \
  --symbols BTCUSDT,ETHUSDT \
  --interval 5000 \
  --testnet

# 或使用 pnpm script
pnpm monitor:testnet
```

預期輸出：
```
[10:30:45] Uptime: 0s | Updates: 0 | Errors: 0 | Opportunities: 0
─────────────────────────────────────────────────────────────────

┌──────────┬──────────────┬──────────────┬──────────┬──────────────┬──────────────┬──────────┬──────────┬──────────────┐
│ 交易對   │ Binance 費率 │ OKX 費率     │ 費率差異 │ Binance 價格 │ OKX 價格     │ 價差     │ 淨收益   │ 套利可行性   │
├──────────┼──────────────┼──────────────┼──────────┼──────────────┼──────────────┼──────────┼──────────┼──────────────┤
│ BTCUSDT  │ 0.0100%      │ 0.0050%      │ 0.0050%  │ $43,250.50   │ $43,248.00   │ 0.006%   │ +0.099%  │ ✅ 可行      │
│ ETHUSDT  │ -0.0020%     │ 0.0030%      │ 0.0050%  │ $2,280.15    │ $2,281.00    │ 0.037%   │ -0.182%  │ ❌ 不可行    │
└──────────┴──────────────┴──────────────┴──────────┴──────────────┴──────────────┴──────────┴──────────┴──────────────┘
```

---

## 🔧 開發流程

### 1. 建立新服務

以 `PriceMonitor` 為例：

```bash
# 建立服務檔案
mkdir -p src/services/monitor
touch src/services/monitor/PriceMonitor.ts

# 建立測試檔案
mkdir -p tests/unit/services
touch tests/unit/services/PriceMonitor.test.ts
```

**服務實作**:
```typescript
// src/services/monitor/PriceMonitor.ts
import { EventEmitter } from 'events';
import { IPriceMonitor, PriceData, Exchange } from '../../../specs/004-fix-okx-add-price-display/contracts/service-interfaces';

export class PriceMonitor extends EventEmitter implements IPriceMonitor {
  async start(symbols: string[]): Promise<void> {
    // 實作邏輯
  }

  async stop(): Promise<void> {
    // 實作邏輯
  }

  getLatestPrice(symbol: string, exchange: Exchange): PriceData | null {
    // 實作邏輯
    return null;
  }

  getAllPricePairs(): PriceDataPair[] {
    // 實作邏輯
    return [];
  }
}
```

**測試實作**:
```typescript
// tests/unit/services/PriceMonitor.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { PriceMonitor } from '../../../src/services/monitor/PriceMonitor';

describe('PriceMonitor', () => {
  let monitor: PriceMonitor;

  beforeEach(() => {
    monitor = new PriceMonitor();
  });

  it('should start monitoring', async () => {
    await expect(monitor.start(['BTCUSDT'])).resolves.toBeUndefined();
  });

  it('should emit price event', (done) => {
    monitor.on('price', (data) => {
      expect(data).toHaveProperty('symbol');
      done();
    });

    // 觸發事件邏輯
  });
});
```

### 2. 執行測試

```bash
# 執行所有測試
pnpm test

# 執行特定測試檔案
pnpm test PriceMonitor

# Watch 模式
pnpm test:watch

# 生成測試覆蓋率報告
pnpm test:coverage
```

### 3. 程式碼檢查

```bash
# ESLint 檢查
pnpm lint

# 自動修復
pnpm lint:fix

# TypeScript 型別檢查
pnpm type-check
```

### 4. 資料庫操作

```bash
# Prisma Studio（GUI）
npx prisma studio

# 查詢資料庫
npx prisma db execute --stdin <<SQL
SELECT * FROM funding_rate_validations LIMIT 10;
SQL

# 重置資料庫（開發環境）
npx prisma migrate reset
```

---

## 🧪 測試指南

### 1. 單元測試

測試獨立的類別和函數：

```typescript
// tests/unit/services/ArbitrageAssessor.test.ts
import { describe, it, expect } from 'vitest';
import { ArbitrageAssessor } from '../../../src/services/monitor/ArbitrageAssessor';

describe('ArbitrageAssessor', () => {
  const assessor = new ArbitrageAssessor({
    makerFee: 0.001,
    takerFee: 0.001,
    extremeSpreadThreshold: 0.05
  });

  it('should assess viable arbitrage opportunity', () => {
    const result = assessor.assess(
      'BTCUSDT',
      0.0100,  // Binance funding rate: 1%
      0.0050,  // OKX funding rate: 0.5%
      43250,   // Binance price
      43248    // OKX price
    );

    expect(result.feasibility).toBe('VIABLE');
    expect(result.netProfit).toBeGreaterThan(0);
  });

  it('should detect extreme spread', () => {
    const result = assessor.assess(
      'BTCUSDT',
      0.0100,
      0.0050,
      43250,
      40000  // 極端價差 >5%
    );

    expect(result.feasibility).toBe('HIGH_RISK');
    expect(result.extremeSpreadDetected).toBe(true);
  });
});
```

### 2. 整合測試

測試服務之間的整合：

```typescript
// tests/integration/okx-funding-rate-validation.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FundingRateValidator } from '../../src/services/validation/FundingRateValidator';
import { prisma } from '../../src/lib/prisma';

describe('OKX Funding Rate Validation Integration', () => {
  let validator: FundingRateValidator;

  beforeAll(() => {
    validator = new FundingRateValidator();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should validate BTC-USDT-SWAP funding rate', async () => {
    const result = await validator.validate('BTC-USDT-SWAP');

    expect(result.validationStatus).toBeDefined();
    expect(result.okxRate).toBeTypeOf('number');

    if (result.ccxtRate) {
      expect(result.discrepancyPercent).toBeLessThan(0.0001);
    }
  });

  it('should save validation result to database', async () => {
    await validator.validate('ETH-USDT-SWAP');

    const saved = await prisma.fundingRateValidation.findFirst({
      where: { symbol: 'ETH-USDT-SWAP' },
      orderBy: { timestamp: 'desc' }
    });

    expect(saved).toBeDefined();
    expect(saved?.symbol).toBe('ETH-USDT-SWAP');
  });
});
```

### 3. E2E 測試

測試完整的監控流程：

```typescript
// tests/e2e/monitor-with-prices.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';

describe('Monitor with Prices E2E', () => {
  let monitorProcess: ChildProcess;

  beforeAll(() => {
    // 啟動監控服務
    monitorProcess = spawn('node', [
      'dist/cli/index.js',
      'monitor',
      'start',
      '--symbols', 'BTCUSDT',
      '--interval', '5000',
      '--testnet'
    ]);
  });

  afterAll(() => {
    monitorProcess.kill();
  });

  it('should display price and funding rate data', (done) => {
    let output = '';

    monitorProcess.stdout?.on('data', (data) => {
      output += data.toString();

      // 檢查是否包含價格和費率
      if (output.includes('Binance 價格') && output.includes('OKX 價格')) {
        expect(output).toContain('套利可行性');
        done();
      }
    });
  }, 30000); // 30 秒 timeout
});
```

---

## 📊 除錯技巧

### 1. 啟用 Debug 日誌

```bash
# 設定日誌級別
export LOG_LEVEL=debug

# 啟動監控
node dist/cli/index.js monitor start --symbols BTCUSDT
```

### 2. 使用 Prisma Studio

```bash
# 啟動 Prisma Studio
npx prisma studio

# 瀏覽器開啟 http://localhost:5555
# 可視化查看資料庫內容
```

### 3. 查看 WebSocket 流量

```typescript
// 在 WebSocket 客戶端啟用詳細日誌
class BinanceWsClient {
  connect() {
    this.ws.on('message', (data) => {
      console.log('[DEBUG] Received:', data.toString());
      // 處理邏輯
    });
  }
}
```

### 4. TimescaleDB 查詢優化

```sql
-- 查看 chunk 狀態
SELECT * FROM timescaledb_information.chunks
WHERE hypertable_name = 'funding_rate_validations';

-- 查看壓縮狀態
SELECT * FROM timescaledb_information.compression_settings
WHERE hypertable_name = 'funding_rate_validations';

-- 手動壓縮（測試）
SELECT compress_chunk(i)
FROM show_chunks('funding_rate_validations') i
WHERE NOT is_compressed(i);
```

---

## 🐛 常見問題

### Q1: WebSocket 連線失敗

**錯誤**: `WebSocketError: Connection refused`

**解決方案**:
1. 檢查測試網 URL 是否正確
2. 確認 API key 已啟用測試網模式
3. 檢查防火牆設定

```bash
# 測試連線
curl -I https://testnet.binance.vision
curl -I https://wspap.okx.com:8443
```

### Q2: 資料庫連線錯誤

**錯誤**: `Error: Can't reach database server at localhost:5432`

**解決方案**:
```bash
# 檢查 Docker 服務
docker-compose ps

# 重啟 Docker
docker-compose restart postgres

# 檢查連線
psql postgresql://arbitrage:password@localhost:5432/arbitrage_bot
```

### Q3: Prisma 遷移失敗

**錯誤**: `Error: P1012: Introspection operation failed with errors`

**解決方案**:
```bash
# 重置資料庫
docker-compose down -v
docker-compose up -d

# 重新執行遷移
npx prisma migrate dev
```

### Q4: TypeScript 編譯錯誤

**錯誤**: `Cannot find module` 或 `Type error`

**解決方案**:
```bash
# 清理 build
rm -rf dist/

# 重新安裝依賴
rm -rf node_modules pnpm-lock.yaml
pnpm install

# 重新編譯
pnpm build
```

---

## 📚 相關文件

- [Feature Specification](./spec.md) - 功能規格
- [Research](./research.md) - 技術研究與決策
- [Data Model](./data-model.md) - 資料模型定義
- [API Contracts](./contracts/) - 服務介面契約
- [Implementation Plan](./plan.md) - 實作規劃

---

## 🔗 有用的連結

### 官方文件
- [Binance API Docs](https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams)
- [OKX API Docs](https://www.okx.com/docs-v5/en/)
- [Prisma Docs](https://www.prisma.io/docs)
- [TimescaleDB Docs](https://docs.timescale.com/)
- [Vitest Docs](https://vitest.dev/)

### 工具
- [Binance Testnet](https://testnet.binance.vision/)
- [OKX Demo Trading](https://www.okx.com/demo-trading)
- [Prisma Studio](https://www.prisma.io/studio)

---

## 📝 Checklist

開發前確認：

- [ ] Docker 服務已啟動
- [ ] 環境變數已配置
- [ ] 資料庫遷移已執行
- [ ] 專案編譯成功
- [ ] 測試網 API keys 已設定
- [ ] 單元測試通過

開發完成前確認：

- [ ] 所有測試通過（單元 + 整合）
- [ ] 程式碼檢查通過（ESLint + TypeScript）
- [ ] 測試覆蓋率 >85%
- [ ] 文件已更新
- [ ] Constitution Check 通過
- [ ] 手動測試通過（測試網）

---

**Happy Coding!** 🎉

如有問題，請參考 [Implementation Plan](./plan.md) 或聯繫團隊成員。
