/**
 * Zod Validation Schemas
 *
 * Centralized validation schemas for all API inputs and user data
 * Based on data-model.md specifications and Functional Requirements
 */

import { z } from 'zod';

// ==================== User Management ====================

/**
 * User Registration Schema (FR-001, FR-002, FR-003)
 */
export const userRegistrationSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .max(255, 'Email must not exceed 255 characters'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[0-9]/, 'Password must contain at least one digit')
    .regex(/[a-zA-Z]/, 'Password must contain at least one letter'),
});

export type UserRegistration = z.infer<typeof userRegistrationSchema>;

/**
 * User Login Schema (FR-005)
 */
export const userLoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export type UserLogin = z.infer<typeof userLoginSchema>;

// ==================== API Key Management ====================

/**
 * Binance API Key Schema (FR-008)
 */
export const binanceApiKeySchema = z.object({
  exchange: z.literal('binance'),
  environment: z.enum(['MAINNET', 'TESTNET']).default('MAINNET'),
  label: z
    .string()
    .min(1, 'Label is required')
    .max(100, 'Label must not exceed 100 characters'),
  apiKey: z.string().min(1, 'API Key is required'),
  apiSecret: z.string().min(1, 'API Secret is required'),
});

export type BinanceApiKey = z.infer<typeof binanceApiKeySchema>;

/**
 * OKX API Key Schema (FR-009)
 */
export const okxApiKeySchema = z.object({
  exchange: z.literal('okx'),
  environment: z.enum(['MAINNET', 'TESTNET']).default('MAINNET'),
  label: z
    .string()
    .min(1, 'Label is required')
    .max(100, 'Label must not exceed 100 characters'),
  apiKey: z.string().min(1, 'API Key is required'),
  apiSecret: z.string().min(1, 'API Secret is required'),
  passphrase: z.string().min(1, 'Passphrase is required for OKX'),
});

export type OkxApiKey = z.infer<typeof okxApiKeySchema>;

/**
 * Combined API Key Schema (FR-008, FR-009)
 */
export const apiKeySchema = z.discriminatedUnion('exchange', [
  binanceApiKeySchema,
  okxApiKeySchema,
]);

export type ApiKeyInput = z.infer<typeof apiKeySchema>;

/**
 * API Key Update Schema (FR-015)
 */
export const apiKeyUpdateSchema = z.object({
  isActive: z.boolean(),
});

export type ApiKeyUpdate = z.infer<typeof apiKeyUpdateSchema>;

// ==================== Position Management ====================

/**
 * Open Position Schema (FR-026, FR-027, FR-028)
 */
export const openPositionSchema = z.object({
  opportunityId: z.string().cuid('Invalid opportunity ID'),
  symbol: z.string().min(1).max(20),
  longExchange: z.enum(['binance', 'okx']),
  shortExchange: z.enum(['binance', 'okx']),
  positionSize: z
    .number()
    .positive('Position size must be positive')
    .max(10000, 'Position size cannot exceed 10,000 USDT (FR-028)'), // Default risk param
  leverage: z.number().int().min(1).max(10).default(3), // MVP: Fixed 3x
});

export type OpenPositionInput = z.infer<typeof openPositionSchema>;

/**
 * Close Position Schema (FR-038)
 */
export const closePositionSchema = z.object({
  positionId: z.string().cuid('Invalid position ID'),
});

export type ClosePositionInput = z.infer<typeof closePositionSchema>;

// ==================== Query Parameters ====================

/**
 * Pagination Schema
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

/**
 * Trade History Filters (FR-049, FR-050)
 */
export const tradeHistoryFiltersSchema = paginationSchema.extend({
  symbol: z.string().max(20).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortBy: z.enum(['createdAt', 'totalPnL', 'roi']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type TradeHistoryFilters = z.infer<typeof tradeHistoryFiltersSchema>;

/**
 * Opportunity Filters (FR-017, FR-020)
 */
export const opportunityFiltersSchema = z.object({
  symbol: z.string().max(20).optional(),
  minRateDifference: z
    .number()
    .positive()
    .optional()
    .default(0.0005), // 0.05%
  status: z.enum(['ACTIVE', 'EXPIRED', 'CLOSED']).optional(),
});

export type OpportunityFilters = z.infer<typeof opportunityFiltersSchema>;

// ==================== Response Schemas ====================

/**
 * Standard API Response Wrapper
 */
export const apiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z
      .object({
        code: z.string(),
        message: z.string(),
        details: z.any().optional(),
      })
      .optional(),
  });

/**
 * Paginated Response Schema
 */
export const paginatedResponseSchema = <T extends z.ZodTypeAny>(
  itemSchema: T,
) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
  });

// ==================== WebSocket Event Schemas ====================

/**
 * WebSocket Opportunity Event (FR-022)
 */
export const wsOpportunityEventSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  longExchange: z.string(),
  shortExchange: z.string(),
  longFundingRate: z.number(),
  shortFundingRate: z.number(),
  rateDifference: z.number(),
  expectedReturnRate: z.number(),
  timestamp: z.string().datetime(),
});

export type WsOpportunityEvent = z.infer<typeof wsOpportunityEventSchema>;

/**
 * WebSocket Position Update Event
 */
export const wsPositionUpdateEventSchema = z.object({
  positionId: z.string(),
  status: z.enum([
    'PENDING',
    'OPENING',
    'OPEN',
    'CLOSING',
    'CLOSED',
    'FAILED',
    'PARTIAL',
  ]),
  unrealizedPnL: z.number().optional(),
  timestamp: z.string().datetime(),
});

export type WsPositionUpdateEvent = z.infer<
  typeof wsPositionUpdateEventSchema
>;

/**
 * WebSocket Trade Complete Event
 */
export const wsTradeCompleteEventSchema = z.object({
  tradeId: z.string(),
  positionId: z.string(),
  totalPnL: z.number(),
  roi: z.number(),
  timestamp: z.string().datetime(),
});

export type WsTradeCompleteEvent = z.infer<typeof wsTradeCompleteEventSchema>;

// ==================== Environment Variables Schema ====================

/**
 * Environment Variables Schema (Startup Validation)
 */
export const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Authentication
  NEXTAUTH_SECRET: z
    .string()
    .min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),
  NEXTAUTH_URL: z.string().url().optional(),

  // Encryption
  ENCRYPTION_MASTER_KEY: z
    .string()
    .length(64, 'ENCRYPTION_MASTER_KEY must be exactly 64 hex characters (32 bytes)'),

  // Redis
  REDIS_URL: z.string().url().optional(),
  REDIS_HOST: z.string().optional().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().optional().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().int().nonnegative().optional().default(0),

  // Node Environment
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // Port
  PORT: z.coerce.number().int().positive().optional().default(3000),
});

export type EnvVariables = z.infer<typeof envSchema>;

/**
 * Validate environment variables at startup
 * Throws error if validation fails (fail-fast)
 */
export function validateEnv(): EnvVariables {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment variable validation failed:');
      error.issues.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      throw new Error('Invalid environment configuration');
    }
    throw error;
  }
}

// ==================== Helper Functions ====================

/**
 * Safe parse with error handling
 */
export function safeParse<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
): { success: true; data: z.infer<T> } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return {
      success: false,
      errors: result.error.issues.map(
        (err) => `${err.path.join('.')}: ${err.message}`,
      ),
    };
  }
}
