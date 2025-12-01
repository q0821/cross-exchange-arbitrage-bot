import { z } from 'zod';

/**
 * OpportunityEndHistory Domain Model
 * Feature 027: 套利機會結束監測和通知
 */

/**
 * 結算記錄 Schema
 */
export const SettlementRecordSchema = z.object({
  side: z.enum(['long', 'short']),
  timestamp: z.string().datetime(),
  rate: z.number(),
});

/**
 * 機會歷史 Schema
 */
export const OpportunityEndHistorySchema = z.object({
  id: z.string().cuid(),
  symbol: z.string().min(1).max(20),
  longExchange: z.string().min(1).max(20),
  shortExchange: z.string().min(1).max(20),
  detectedAt: z.date(),
  disappearedAt: z.date(),
  durationMs: z.bigint(),
  initialSpread: z.number().min(0).max(1),
  maxSpread: z.number().min(0).max(1),
  maxSpreadAt: z.date(),
  finalSpread: z.number().min(0).max(1),
  longIntervalHours: z.number().int().refine((v) => [1, 4, 8].includes(v)),
  shortIntervalHours: z.number().int().refine((v) => [1, 4, 8].includes(v)),
  settlementRecords: z.array(SettlementRecordSchema),
  longSettlementCount: z.number().int().min(0),
  shortSettlementCount: z.number().int().min(0),
  totalFundingProfit: z.number(),
  totalCost: z.number(),
  netProfit: z.number(),
  realizedAPY: z.number(),
  notificationCount: z.number().int().min(1),
  userId: z.string(),
  createdAt: z.date(),
});

/**
 * 歷史查詢 Schema
 */
export const HistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
  symbol: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

/**
 * 歷史記錄建立請求
 */
export interface CreateOpportunityHistoryInput {
  symbol: string;
  longExchange: string;
  shortExchange: string;
  detectedAt: Date;
  disappearedAt: Date;
  durationMs: bigint;
  initialSpread: number;
  maxSpread: number;
  maxSpreadAt: Date;
  finalSpread: number;
  longIntervalHours: number;
  shortIntervalHours: number;
  settlementRecords: Array<{
    side: 'long' | 'short';
    timestamp: string;
    rate: number;
  }>;
  longSettlementCount: number;
  shortSettlementCount: number;
  totalFundingProfit: number;
  totalCost: number;
  netProfit: number;
  realizedAPY: number;
  notificationCount: number;
  userId: string;
}

export type OpportunityEndHistoryType = z.infer<typeof OpportunityEndHistorySchema>;
export type SettlementRecordType = z.infer<typeof SettlementRecordSchema>;
export type HistoryQueryType = z.infer<typeof HistoryQuerySchema>;
