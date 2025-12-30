/**
 * 交易驗證腳本工具函數
 * Feature: 049-trading-validation-script
 */

import { PrismaClient } from '@/generated/prisma/client';
import { decrypt } from '../../lib/encryption';
import type { DecryptedApiKey, ExchangeName } from './types';

const prisma = new PrismaClient();

/**
 * 根據 email 查詢用戶 ID
 */
export async function getUserIdByEmail(email: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    throw new Error(`找不到 email 為 ${email} 的用戶`);
  }

  return user.id;
}

/**
 * 從資料庫讀取並解密用戶的 API Key
 */
export async function getApiKey(
  userId: string,
  exchange: ExchangeName,
): Promise<DecryptedApiKey> {
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      userId,
      exchange,
      isActive: true,
    },
  });

  if (!apiKey) {
    throw new Error(`找不到 ${exchange} 交易所的有效 API Key`);
  }

  const decryptedKey = decrypt(apiKey.encryptedKey);
  const secret = decrypt(apiKey.encryptedSecret);
  const passphrase = apiKey.encryptedPassphrase
    ? decrypt(apiKey.encryptedPassphrase)
    : undefined;

  return {
    apiKey: decryptedKey,
    secret,
    passphrase,
  };
}

/**
 * 從資料庫讀取持倉記錄
 */
export async function getPosition(positionId: string) {
  const position = await prisma.position.findUnique({
    where: { id: positionId },
  });

  if (!position) {
    throw new Error(`找不到持倉記錄: ${positionId}`);
  }

  return position;
}

/**
 * 將 symbol 轉換為 CCXT 格式
 * e.g., BTCUSDT -> BTC/USDT:USDT
 */
export function convertToCcxtSymbol(symbol: string): string {
  // 如果已經是 CCXT 格式，直接返回
  if (symbol.includes('/')) {
    return symbol;
  }

  // 處理純格式 BTCUSDT -> BTC/USDT:USDT
  const quoteAssets = ['USDT', 'USDC', 'BUSD', 'USD'];
  for (const quote of quoteAssets) {
    if (symbol.endsWith(quote)) {
      const base = symbol.slice(0, -quote.length);
      return `${base}/${quote}:${quote}`;
    }
  }

  // 預設加上 USDT
  return `${symbol}/USDT:USDT`;
}

/**
 * 格式化數字為可讀字串
 */
export function formatNumber(value: number, decimals: number = 8): string {
  return value.toFixed(decimals).replace(/\.?0+$/, '');
}

/**
 * 格式化價格為美元字串
 */
export function formatPrice(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * 驗證數量是否在容差範圍內
 */
export function isQuantityValid(
  expected: number,
  actual: number,
  tolerancePercent: number = 0.01,
): boolean {
  if (expected === 0) {
    return actual === 0;
  }
  const tolerance = Math.abs(expected * tolerancePercent / 100);
  return Math.abs(expected - actual) <= tolerance;
}

/**
 * 驗證價格是否在容差範圍內
 */
export function isPriceValid(
  expected: number,
  actual: number,
  tolerancePercent: number = 0.01,
): boolean {
  if (expected === 0) {
    return actual === 0;
  }
  const tolerance = Math.abs(expected * tolerancePercent / 100);
  return Math.abs(expected - actual) <= tolerance;
}

/**
 * 重試函數
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

/**
 * 關閉資料庫連線
 */
export async function cleanup(): Promise<void> {
  await prisma.$disconnect();
}
