/**
 * FundingRateValidation Model
 *
 * 資金費率驗證記錄模型
 * Feature: 004-fix-okx-add-price-display
 */

import {
  FundingRateValidationResult as IFundingRateValidationResult,
  ValidationStatus,
} from '../types/service-interfaces';

/**
 * 建立新的驗證結果物件
 */
export function createValidationResult(params: {
  symbol: string;
  okxRate: number;
  okxNextRate?: number;
  okxFundingTime?: Date;
  ccxtRate?: number;
  ccxtFundingTime?: Date;
}): IFundingRateValidationResult {
  const { okxRate, ccxtRate } = params;

  // 計算差異百分比
  let discrepancyPercent: number | undefined;
  let validationStatus: ValidationStatus = 'N/A';

  if (ccxtRate !== undefined) {
    // 有 CCXT 數據，進行驗證
    discrepancyPercent = Math.abs(okxRate - ccxtRate) / Math.abs(okxRate);

    // 判斷驗證狀態 (閾值 0.0001% = 0.000001)
    const ACCEPTABLE_DISCREPANCY = 0.000001;
    validationStatus = discrepancyPercent <= ACCEPTABLE_DISCREPANCY ? 'PASS' : 'FAIL';
  }

  return {
    symbol: params.symbol,
    timestamp: new Date(),
    okxRate,
    okxNextRate: params.okxNextRate,
    okxFundingTime: params.okxFundingTime,
    ccxtRate,
    ccxtFundingTime: params.ccxtFundingTime,
    discrepancyPercent,
    validationStatus,
  };
}

/**
 * 建立驗證錯誤結果
 */
export function createValidationError(
  symbol: string,
  errorMessage: string
): IFundingRateValidationResult {
  return {
    symbol,
    timestamp: new Date(),
    okxRate: 0,
    validationStatus: 'ERROR',
    errorMessage,
  };
}

/**
 * 檢查驗證是否通過
 */
export function isValidationPassed(result: IFundingRateValidationResult): boolean {
  return result.validationStatus === 'PASS';
}

/**
 * 檢查驗證是否失敗
 */
export function isValidationFailed(result: IFundingRateValidationResult): boolean {
  return result.validationStatus === 'FAIL';
}

/**
 * 格式化驗證狀態顯示
 */
export function formatValidationStatus(status: ValidationStatus): string {
  const statusMap: Record<ValidationStatus, string> = {
    PASS: '✅ 通過',
    FAIL: '❌ 失敗',
    ERROR: '⚠️ 錯誤',
    'N/A': '➖ 無數據',
  };
  return statusMap[status];
}

/**
 * 格式化差異百分比
 */
export function formatDiscrepancy(discrepancy: number | undefined): string {
  if (discrepancy === undefined) return 'N/A';
  return (discrepancy * 100).toFixed(4) + '%';
}
