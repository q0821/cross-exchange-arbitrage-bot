import { z } from 'zod';

/**
 * Zod 驗證 Schema
 */

// ===== 通用驗證 =====

export const emailSchema = z
  .string()
  .email('Invalid email format')
  .min(5, 'Email must be at least 5 characters')
  .max(255, 'Email must not exceed 255 characters');

export const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .max(100, 'Password must not exceed 100 characters');

export const exchangeSchema = z.enum(['binance', 'okx', 'mexc', 'gateio', 'bingx'], {
  errorMap: () => ({ message: 'Exchange must be one of: binance, okx, mexc, gateio, bingx' }),
});

export const apiEnvironmentSchema = z.enum(['MAINNET', 'TESTNET'], {
  errorMap: () => ({ message: 'Environment must be either MAINNET or TESTNET' }),
});

export const symbolSchema = z
  .string()
  .regex(/^[A-Z0-9]+USDT$/, 'Symbol must be in format: BTCUSDT, ETHUSDT, etc.')
  .min(4, 'Symbol must be at least 4 characters')
  .max(20, 'Symbol must not exceed 20 characters');

// ===== 用戶認證 =====

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

// ===== API Key 管理 =====

export const createApiKeySchema = z.object({
  exchange: exchangeSchema,
  environment: apiEnvironmentSchema,
  label: z
    .string()
    .min(1, 'Label is required')
    .max(100, 'Label must not exceed 100 characters'),
  apiKey: z.string().min(1, 'API Key is required'),
  apiSecret: z.string().min(1, 'API Secret is required'),
  passphrase: z.string().optional(), // OKX only
});

export const updateApiKeySchema = z.object({
  label: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

// ===== 持倉管理 =====

export const createPositionSchema = z.object({
  opportunityId: z.string().cuid('Invalid opportunity ID'),
  positionSize: z
    .number()
    .positive('Position size must be positive')
    .max(100000, 'Position size must not exceed 100,000 USDT'),
  leverage: z
    .number()
    .int('Leverage must be an integer')
    .min(1, 'Leverage must be at least 1')
    .max(10, 'Leverage must not exceed 10')
    .default(3),
});

export const closePositionSchema = z.object({
  positionId: z.string().cuid('Invalid position ID'),
});

// ===== 查詢參數 =====

export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().positive().default(1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().int().positive().max(100).default(20)),
});

export const opportunityQuerySchema = paginationSchema.extend({
  symbol: symbolSchema.optional(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'CLOSED']).optional(),
});

export const positionQuerySchema = paginationSchema.extend({
  symbol: symbolSchema.optional(),
  status: z
    .enum(['PENDING', 'OPENING', 'OPEN', 'CLOSING', 'CLOSED', 'FAILED', 'PARTIAL'])
    .optional(),
});

export const tradeQuerySchema = paginationSchema.extend({
  symbol: symbolSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// ===== 統計查詢 =====

export const statsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
});

// ===== 型別導出 =====

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type UpdateApiKeyInput = z.infer<typeof updateApiKeySchema>;
export type CreatePositionInput = z.infer<typeof createPositionSchema>;
export type ClosePositionInput = z.infer<typeof closePositionSchema>;
export type PaginationQuery = z.infer<typeof paginationSchema>;
export type OpportunityQuery = z.infer<typeof opportunityQuerySchema>;
export type PositionQuery = z.infer<typeof positionQuerySchema>;
export type TradeQuery = z.infer<typeof tradeQuerySchema>;
export type StatsQuery = z.infer<typeof statsQuerySchema>;
