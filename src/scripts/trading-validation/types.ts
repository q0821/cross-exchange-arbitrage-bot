/**
 * 交易操作驗證腳本類型定義
 * Feature: 049-trading-validation-script
 */

/** 支援的交易所 */
export type ExchangeName = 'binance' | 'okx' | 'gateio' | 'bingx';

/** 驗證項目狀態 */
export type ValidationStatus = 'pass' | 'fail' | 'skip' | 'warn';

/** 驗證類別 */
export type ValidationCategory = 'position' | 'conditional' | 'close';

/** 單項驗證結果 */
export interface ValidationItem {
  /** 驗證項目編號 (1-11) */
  id: number;

  /** 驗證項目名稱 */
  name: string;

  /** 驗證類別 */
  category: ValidationCategory;

  /** 預期值（字串化） */
  expected: string;

  /** 實際值（字串化） */
  actual: string;

  /** 驗證結果 */
  status: ValidationStatus;

  /** 錯誤訊息（僅 fail/warn 時） */
  error?: string;
}

/** 驗證報告總結 */
export interface ValidationSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  warned: number;
}

/** 完整驗證報告 */
export interface ValidationReport {
  /** 驗證時間 */
  timestamp: Date;

  /** 交易所名稱 */
  exchange: string;

  /** 交易對 */
  symbol: string;

  /** 驗證模式 */
  mode: 'run' | 'verify';

  /** 所有驗證項目 */
  items: ValidationItem[];

  /** 總結 */
  summary: ValidationSummary;

  /** 執行時間（毫秒） */
  duration: number;
}

/** 交易所持倉資訊 */
export interface ExchangePosition {
  /** CCXT symbol 格式 (e.g., BTC/USDT:USDT) */
  symbol: string;

  /** 持倉方向 */
  side: 'long' | 'short';

  /** 合約張數 */
  contracts: number;

  /** 合約大小 */
  contractSize: number;

  /** 幣本位數量 (contracts * contractSize) */
  quantity: number;

  /** 入場價格 */
  entryPrice: number;

  /** 未實現盈虧 */
  unrealizedPnl: number;
}

/** 交易所條件單資訊 */
export interface ExchangeConditionalOrder {
  /** 訂單 ID */
  orderId: string;

  /** 訂單類型 */
  type: 'stop_loss' | 'take_profit';

  /** CCXT symbol 格式 */
  symbol: string;

  /** 觸發價格 */
  triggerPrice: number;

  /** 合約張數 */
  contracts: number;

  /** 合約大小 */
  contractSize: number;

  /** 幣本位數量 */
  quantity: number;

  /** 訂單狀態 */
  status: 'open' | 'triggered' | 'cancelled';
}

/** run 模式執行參數 */
export interface RunParams {
  /** 做多交易所 */
  longExchange: ExchangeName;

  /** 做空交易所 */
  shortExchange: ExchangeName;

  /** 交易對 (e.g., BTCUSDT) */
  symbol: string;

  /** 開倉數量（幣本位，如 0.001 BTC） */
  quantity: number;

  /** 槓桿倍數 */
  leverage: number;

  /** 停損百分比 (0-100) */
  stopLossPercent?: number;

  /** 停利百分比 (0-100) */
  takeProfitPercent?: number;

  /** 用戶 Email */
  email: string;

  /** 輸出 JSON 格式 */
  json?: boolean;
}

/** verify 模式查詢驗證參數 */
export interface VerifyParams {
  /** 持倉 ID */
  positionId: string;

  /** 輸出 JSON 格式 */
  json?: boolean;
}

/** 開倉 API 請求 */
export interface OpenPositionRequest {
  userId: string;
  symbol: string;
  longExchange: string;
  shortExchange: string;
  quantity: number;
  leverage: number;
  stopLossEnabled?: boolean;
  stopLossPercent?: number;
  takeProfitEnabled?: boolean;
  takeProfitPercent?: number;
}

/** 開倉 API 回應 */
export interface OpenPositionResponse {
  success: boolean;
  positionId?: string;
  error?: string;
  longResult?: {
    success: boolean;
    orderId?: string;
    avgPrice?: number;
    filledQuantity?: number;
  };
  shortResult?: {
    success: boolean;
    orderId?: string;
    avgPrice?: number;
    filledQuantity?: number;
  };
}

/** 平倉 API 回應 */
export interface ClosePositionResponse {
  success: boolean;
  error?: string;
  longResult?: {
    success: boolean;
    avgPrice?: number;
    filledQuantity?: number;
  };
  shortResult?: {
    success: boolean;
    avgPrice?: number;
    filledQuantity?: number;
  };
}

/** 解密後的 API Key */
export interface DecryptedApiKey {
  apiKey: string;
  secret: string;
  passphrase?: string;
}

/** 11 項驗證項目定義 */
export const VALIDATION_ITEMS = {
  SYMBOL_FORMAT: { id: 1, name: '交易對格式正確', category: 'position' as const },
  POSITION_QUANTITY: { id: 2, name: '開倉數量正確', category: 'position' as const },
  CONTRACT_SIZE: { id: 3, name: 'contractSize 轉換正確', category: 'position' as const },
  STOP_LOSS_EXISTS: { id: 4, name: '停損單已建立', category: 'conditional' as const },
  STOP_LOSS_PRICE: { id: 5, name: '停損價格正確', category: 'conditional' as const },
  STOP_LOSS_QUANTITY: { id: 6, name: '停損數量正確', category: 'conditional' as const },
  TAKE_PROFIT_EXISTS: { id: 7, name: '停利單已建立', category: 'conditional' as const },
  TAKE_PROFIT_PRICE: { id: 8, name: '停利價格正確', category: 'conditional' as const },
  TAKE_PROFIT_QUANTITY: { id: 9, name: '停利數量正確', category: 'conditional' as const },
  CLOSE_SUCCESS: { id: 10, name: '平倉執行成功', category: 'close' as const },
  CLOSE_QUANTITY: { id: 11, name: '平倉數量正確', category: 'close' as const },
} as const;

/** 支援的交易所列表 */
export const SUPPORTED_EXCHANGES: ExchangeName[] = ['binance', 'okx', 'gateio', 'bingx'];
