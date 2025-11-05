/**
 * GET /api/symbol-groups
 * 獲取可用的交易對群組配置
 *
 * Feature: 006-web-trading-platform (User Story 2.5)
 * 從 config/symbols.json 讀取預設的交易對群組
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { authenticate } from '@/src/middleware/authMiddleware';
import { handleError } from '@/src/middleware/errorHandler';
import { getCorrelationId } from '@/src/middleware/correlationIdMiddleware';
import { logger } from '@/src/lib/logger';

/**
 * 交易對群組配置結構
 */
interface SymbolsConfig {
  description: string;
  lastUpdate: string;
  groups: {
    [groupName: string]: {
      name: string;
      symbols: string[];
    };
  };
}

/**
 * 快取配置資料（避免每次請求都讀取檔案）
 */
let cachedConfig: SymbolsConfig | null = null;
let cacheTime: number = 0;
const CACHE_TTL = 60000; // 快取 60 秒

/**
 * 讀取交易對群組配置
 */
function loadSymbolsConfig(): SymbolsConfig {
  const now = Date.now();

  // 如果快取有效，直接返回
  if (cachedConfig && now - cacheTime < CACHE_TTL) {
    return cachedConfig;
  }

  // 讀取配置檔案
  const configPath = join(process.cwd(), 'config', 'symbols.json');
  const configContent = readFileSync(configPath, 'utf-8');
  const config = JSON.parse(configContent) as SymbolsConfig;

  // 更新快取
  cachedConfig = config;
  cacheTime = now;

  logger.debug({ configPath }, 'Symbols config loaded');

  return config;
}

/**
 * GET /api/symbol-groups
 * 返回所有可用的交易對群組
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    // 1. 驗證用戶身份
    const user = await authenticate(request);

    logger.info(
      {
        correlationId,
        userId: user.userId,
      },
      'Get symbol groups request received',
    );

    // 2. 讀取配置
    const config = loadSymbolsConfig();

    // 3. 轉換為 API 響應格式
    const groups = Object.entries(config.groups).map(([groupId, groupData]) => ({
      id: groupId,
      name: groupData.name,
      symbolCount: groupData.symbols.length,
      symbols: groupData.symbols,
    }));

    // 4. 返回結果
    const response = NextResponse.json(
      {
        success: true,
        data: {
          groups,
          total: groups.length,
          lastUpdate: config.lastUpdate,
        },
      },
      { status: 200 },
    );

    response.headers.set('X-Correlation-Id', correlationId);

    logger.info(
      {
        correlationId,
        userId: user.userId,
        groupCount: groups.length,
      },
      'Symbol groups retrieved successfully',
    );

    return response;
  } catch (error) {
    return handleError(error, correlationId);
  }
}
