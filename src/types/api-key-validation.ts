/**
 * API Key Validation Types
 *
 * Feature: 042-api-key-connection-test
 * Purpose: Types for API key connection testing functionality
 */

/**
 * 驗證錯誤碼
 */
export type ValidationErrorCode =
  | 'INVALID_API_KEY'
  | 'INVALID_SECRET'
  | 'INVALID_PASSPHRASE'
  | 'IP_NOT_WHITELISTED'
  | 'INSUFFICIENT_PERMISSION'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'EXCHANGE_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * 驗證詳情
 *
 * Note: 使用寬鬆的類型以支持不同交易所返回的不同格式
 * - Binance: totalWalletBalance, availableBalance, permissions
 * - OKX: totalBalance, freeBalance
 * - Gate.io/MEXC: balance { total, available, currency }
 */
export interface ValidationDetails {
  exchange?: string;
  environment?: 'MAINNET' | 'TESTNET';
  balance?: {
    total: number;
    available: number;
    currency: string;
  };
  permissions?: string[];
  responseTime?: number; // ms
  // Binance 特定欄位
  totalWalletBalance?: string | number;
  availableBalance?: string | number;
  // OKX 特定欄位
  totalBalance?: number;
  freeBalance?: number;
  // 允許額外欄位
  [key: string]: unknown;
}

/**
 * 新增 API Key 時的連線測試請求
 */
export interface ConnectionTestRequest {
  exchange: 'binance' | 'okx' | 'gateio' | 'mexc';
  environment: 'MAINNET' | 'TESTNET';
  apiKey: string;
  apiSecret: string;
  passphrase?: string; // OKX only
}

/**
 * 重新測試已儲存 API Key 的請求
 */
export interface RevalidateRequest {
  apiKeyId: string;
}

/**
 * 連線測試回應
 */
export interface ConnectionTestResponse {
  success: boolean;
  data?: {
    isValid: boolean;
    hasReadPermission: boolean;
    hasTradePermission: boolean;
    details?: {
      balance?: {
        total: number;
        available: number;
        currency: string;
      };
      permissions?: string[];
      responseTime: number;
    };
  };
  error?: {
    code: ValidationErrorCode;
    message: string;
  };
}
