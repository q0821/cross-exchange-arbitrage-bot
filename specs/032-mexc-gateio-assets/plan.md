# Implementation Plan: MEXC 和 Gate.io 資產追蹤

**Branch**: `032-mexc-gateio-assets` | **Date**: 2025-12-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/032-mexc-gateio-assets/spec.md`

## Summary

為 MEXC 和 Gate.io 交易所實作用戶資產追蹤功能，使這兩個交易所能與現有的 Binance 和 OKX 一樣，支援即時餘額查詢、每小時快照記錄和歷史曲線顯示。

**主要工作**: 在 `UserConnectorFactory.ts` 中新增 `MexcUserConnector` 和 `GateioUserConnector` 類別，並更新 `createConnector()` 方法。

## Technical Context

**Language/Version**: TypeScript 5.6 + Node.js 20.x LTS
**Primary Dependencies**: CCXT 4.x (多交易所抽象庫，已安裝)
**Storage**: PostgreSQL 15 + TimescaleDB (現有 AssetSnapshot 模型已有 mexcBalanceUSD 和 gateioBalanceUSD 欄位)
**Testing**: Vitest (現有測試框架)
**Target Platform**: Node.js CLI (server.ts) + Next.js 14 Web
**Project Type**: Web application (CLI + Web)
**Performance Goals**: 餘額查詢 < 5 秒
**Constraints**: 遵循現有連接器模式，與 BinanceUserConnector 和 OkxUserConnector 保持一致
**Scale/Scope**: 2 個新連接器類別，約 200 行程式碼

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Trading Safety First | ✅ PASS | 此功能僅讀取餘額和持倉，不涉及交易執行 |
| II. Complete Observability | ✅ PASS | 使用 Pino 結構化日誌記錄所有 API 呼叫 |
| III. Defensive Programming | ✅ PASS | 使用 CCXT 內建的 retry 和 rate limit 處理 |
| IV. Data Integrity | ✅ PASS | 使用 Decimal 類型儲存餘額，遵循現有模式 |
| V. Incremental Delivery | ✅ PASS | 此功能為 Feature 031 的擴展，可獨立測試 |
| VI. System Architecture | ✅ PASS | CLI 負責資料收集，Web 只讀取資料庫，遵循單一資料來源原則 |

## Project Structure

### Documentation (this feature)

```
specs/032-mexc-gateio-assets/
├── spec.md              # 功能規格
├── plan.md              # 本文件
├── research.md          # Phase 0 研究
├── quickstart.md        # 快速開始指南
└── checklists/
    └── requirements.md  # 規格品質檢查清單
```

### Source Code (repository root)

```
src/services/assets/
└── UserConnectorFactory.ts    # 擴展: 新增 MexcUserConnector, GateioUserConnector

tests/unit/services/
└── UserConnectorFactory.test.ts  # 新增: 單元測試
```

**Structure Decision**: 此功能為 Feature 031 的擴展，僅需修改單一檔案 `UserConnectorFactory.ts`，無需新增目錄結構。

## Complexity Tracking

*無違規事項需要記錄*

---

## Implementation Approach

### 現有程式碼分析

經檢視 `src/connectors/mexc.ts` 和 `src/connectors/gateio.ts`，這兩個連接器已經有完整的 `getBalance()` 和 `getPositions()` 方法實作：

**MexcConnector.getBalance()** (行 283-312):
- 使用 CCXT `fetchBalance()`
- 計算 `totalEquityUSD` 使用 USDT 餘額

**GateioConnector.getBalance()** (行 287-316):
- 使用 CCXT `fetchBalance()`
- 計算 `totalEquityUSD` 使用 USDT 餘額

### 實作策略

參考現有的 `OkxUserConnector` 實作模式，為 MEXC 和 Gate.io 建立輕量級的 UserConnector：

```typescript
// MexcUserConnector - 使用 CCXT 4.x
class MexcUserConnector implements IExchangeConnector {
  private ccxt: typeof import('ccxt') | null = null;
  private exchange: InstanceType<typeof import('ccxt').mexc> | null = null;

  async connect() {
    this.ccxt = await import('ccxt');
    this.exchange = new this.ccxt.mexc({
      apiKey: this.apiKey,
      secret: this.apiSecret,
      options: { defaultType: 'swap' }
    });
  }

  async getBalance(): Promise<AccountBalance> {
    const balance = await this.exchange.fetchBalance();
    // 換算 USD 總值...
  }

  async getPositions(): Promise<PositionInfo> {
    const positions = await this.exchange.fetchPositions();
    // 格式化持倉資料...
  }
}
```

### 主要修改

1. **UserConnectorFactory.ts** 行 115-120 的 TODO 區塊:
   ```typescript
   case 'mexc':
     return new MexcUserConnector(apiKey, apiSecret, isTestnet);
   case 'gateio':
   case 'gate':
     return new GateioUserConnector(apiKey, apiSecret, isTestnet);
   ```

2. **新增 MexcUserConnector 類別** (約 80 行):
   - 實作 `IExchangeConnector` 介面
   - 使用 CCXT 4.x 的 `mexc` 交易所類別
   - 實作 `getBalance()` 和 `getPositions()` 方法

3. **新增 GateioUserConnector 類別** (約 80 行):
   - 實作 `IExchangeConnector` 介面
   - 使用 CCXT 4.x 的 `gateio` 交易所類別
   - 實作 `getBalance()` 和 `getPositions()` 方法
