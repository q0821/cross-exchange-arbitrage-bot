import { z } from 'zod';

// ===== Enums =====
export const TrackingStatusEnum = z.enum(['ACTIVE', 'STOPPED', 'EXPIRED']);
export type TrackingStatus = z.infer<typeof TrackingStatusEnum>;

export const SnapshotTypeEnum = z.enum(['SETTLEMENT', 'PERIODIC']);
export type SnapshotType = z.infer<typeof SnapshotTypeEnum>;

export const SettlementSideEnum = z.enum(['LONG', 'SHORT', 'BOTH']);
export type SettlementSide = z.infer<typeof SettlementSideEnum>;

export const ExchangeEnum = z.enum(['binance', 'okx', 'mexc', 'gateio']);
export type ExchangeName = z.infer<typeof ExchangeEnum>;

// ===== Create Tracking Schema =====
export const CreateTrackingSchema = z
  .object({
    symbol: z.string().min(1).max(20).toUpperCase(),
    longExchange: ExchangeEnum,
    shortExchange: ExchangeEnum,
    simulatedCapital: z.number().min(100).max(1000000),
    autoStopOnExpire: z.boolean().default(true),
    // Initial state (populated by service)
    initialSpread: z.number().optional(),
    initialAPY: z.number().optional(),
    initialLongRate: z.number().optional(),
    initialShortRate: z.number().optional(),
    longIntervalHours: z.number().int().min(1).max(24).optional(),
    shortIntervalHours: z.number().int().min(1).max(24).optional(),
    // 開倉價格和倉位數量（固定顆數模式）
    initialLongPrice: z.number().optional(),
    initialShortPrice: z.number().optional(),
    positionQuantity: z.number().optional(),
  })
  .refine((data) => data.longExchange !== data.shortExchange, {
    message: 'Long and short exchanges must be different',
    path: ['shortExchange'],
  });

export type CreateTrackingInput = z.infer<typeof CreateTrackingSchema>;

// ===== Tracking Query Schema =====
export const TrackingQuerySchema = z.object({
  status: z
    .enum(['ACTIVE', 'STOPPED', 'EXPIRED', 'all'])
    .optional()
    .default('all'),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type TrackingQueryInput = z.infer<typeof TrackingQuerySchema>;

// ===== Snapshot Query Schema =====
export const SnapshotQuerySchema = z.object({
  type: z.enum(['SETTLEMENT', 'PERIODIC', 'all']).optional().default('all'),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type SnapshotQueryInput = z.infer<typeof SnapshotQuerySchema>;

// ===== Response Types =====
export interface TrackingResponse {
  id: string;
  symbol: string;
  longExchange: string;
  shortExchange: string;
  simulatedCapital: number;
  autoStopOnExpire: boolean;
  initialSpread: number;
  initialAPY: number;
  initialLongRate: number;
  initialShortRate: number;
  // 開倉價格和倉位數量（固定顆數模式）
  initialLongPrice: number | null;
  initialShortPrice: number | null;
  positionQuantity: number | null;
  // 平倉價格和損益（停止追蹤時記錄）
  exitLongPrice: number | null;
  exitShortPrice: number | null;
  pricePnl: number | null;
  fundingPnl: number | null;
  totalPnl: number | null;
  longIntervalHours: number;
  shortIntervalHours: number;
  status: TrackingStatus;
  startedAt: string;
  stoppedAt: string | null;
  totalFundingProfit: number;
  totalSettlements: number;
  maxSpread: number;
  minSpread: number;
  durationFormatted?: string;
  currentAPY?: number;
}

export interface SnapshotResponse {
  id: string;
  snapshotType: SnapshotType;
  longRate: number;
  shortRate: number;
  spread: number;
  annualizedReturn: number;
  longPrice: number | null;
  shortPrice: number | null;
  priceDiffPercent: number | null;
  settlementSide: SettlementSide | null;
  fundingProfit: number | null;
  cumulativeProfit: number;
  recordedAt: string;
}

export interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ===== Internal Types =====
export interface CreateSnapshotInput {
  trackingId: string;
  snapshotType: SnapshotType;
  longRate: number;
  shortRate: number;
  spread: number;
  annualizedReturn: number;
  longPrice?: number;
  shortPrice?: number;
  priceDiffPercent?: number;
  settlementSide?: SettlementSide;
  fundingProfit?: number;
  cumulativeProfit: number;
}

export interface TrackingWithUser {
  id: string;
  userId: string;
  symbol: string;
  longExchange: string;
  shortExchange: string;
  simulatedCapital: number;
  autoStopOnExpire: boolean;
  initialSpread: number;
  initialAPY: number;
  initialLongRate: number;
  initialShortRate: number;
  // 開倉價格和倉位數量（固定顆數模式）
  initialLongPrice: number | null;
  initialShortPrice: number | null;
  positionQuantity: number | null;
  // 平倉價格和損益（停止追蹤時記錄）
  exitLongPrice: number | null;
  exitShortPrice: number | null;
  pricePnl: number | null;
  fundingPnl: number | null;
  totalPnl: number | null;
  longIntervalHours: number;
  shortIntervalHours: number;
  status: TrackingStatus;
  startedAt: Date;
  stoppedAt: Date | null;
  totalFundingProfit: number;
  totalSettlements: number;
  maxSpread: number;
  minSpread: number;
}

// ===== Constants =====
export const MAX_ACTIVE_TRACKINGS = 5;
export const DATA_RETENTION_DAYS = 30;
export const MIN_SIMULATED_CAPITAL = 100;
export const MAX_SIMULATED_CAPITAL = 1000000;
