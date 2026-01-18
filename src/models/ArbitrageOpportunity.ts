/**
 * Domain Model: ArbitrageOpportunity
 *
 * Feature: 065-arbitrage-opportunity-tracking
 * Phase: 2 - Foundational
 * Task: T005 - Domain Model 定義
 */

import type { ArbitrageOpportunity as PrismaArbitrageOpportunity } from '@/generated/prisma';

/**
 * 建立套利機會的輸入資料
 */
export interface CreateOpportunityInput {
  symbol: string;
  longExchange: string;
  shortExchange: string;
  initialSpread: number;
  currentSpread: number;
  initialAPY: number;
  currentAPY: number;
  longIntervalHours: number;
  shortIntervalHours: number;
}

/**
 * 更新套利機會的輸入資料
 */
export interface UpdateOpportunityInput {
  currentSpread?: number;
  currentAPY?: number;
  maxSpread?: number;
  maxSpreadAt?: Date;
  maxAPY?: number;
}

/**
 * Upsert 套利機會的輸入資料
 */
export interface UpsertOpportunityInput {
  symbol: string;
  longExchange: string;
  shortExchange: string;
  spread: number;
  apy: number;
  longIntervalHours: number;
  shortIntervalHours: number;
}

/**
 * 查詢公開套利機會的選項
 */
export interface PublicOpportunitiesOptions {
  /** 查詢天數範圍（預設 7） */
  days?: number;
  /** 分頁頁碼（預設 1） */
  page?: number;
  /** 每頁筆數（預設 20） */
  limit?: number;
  /** 狀態篩選（預設顯示 ENDED） */
  status?: 'ACTIVE' | 'ENDED' | 'all';
}

/**
 * 公開 API 回傳的套利機會（簡化版）
 */
export interface PublicOpportunity {
  id: string;
  symbol: string;
  longExchange: string;
  shortExchange: string;
  status: 'ACTIVE' | 'ENDED';
  detectedAt: string; // ISO 8601
  endedAt: string | null; // ISO 8601 or null
  durationMs: number | null; // 毫秒
  durationFormatted: string | null; // "2h 15m" 格式
  initialSpread: number;
  maxSpread: number;
  currentSpread: number;
  initialAPY: number;
  maxAPY: number;
  currentAPY: number;
  longIntervalHours: number;
  shortIntervalHours: number;
}

/**
 * ArbitrageOpportunity Domain Model
 */
export type ArbitrageOpportunity = PrismaArbitrageOpportunity;
