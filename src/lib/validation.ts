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

// ===== 強密碼驗證 (Feature 061) =====
// 密碼要求：至少 8 字元，包含大小寫字母和數字

export const strongPasswordSchema = z
  .string()
  .min(8, '密碼至少需要 8 個字元')
  .max(128, '密碼不能超過 128 個字元')
  .regex(/[a-z]/, '密碼必須包含至少一個小寫字母')
  .regex(/[A-Z]/, '密碼必須包含至少一個大寫字母')
  .regex(/[0-9]/, '密碼必須包含至少一個數字');

export const exchangeSchema = z.enum(['binance', 'okx', 'mexc', 'gateio', 'bingx'], {
  message: 'Exchange must be one of: binance, okx, mexc, gateio, bingx',
});

export const apiEnvironmentSchema = z.enum(['MAINNET', 'TESTNET'], {
  message: 'Environment must be either MAINNET or TESTNET',
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
    .pipe(z.number().int().positive()),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().int().positive().max(100)),
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

// ===== 密碼管理 (Feature 061) =====

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, '請輸入目前密碼'),
    newPassword: strongPasswordSchema,
    confirmPassword: z.string().min(1, '請確認新密碼'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: '新密碼與確認密碼不一致',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: '新密碼不能與目前密碼相同',
    path: ['newPassword'],
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, '重設 Token 為必填'),
    newPassword: strongPasswordSchema,
    confirmPassword: z.string().min(1, '請確認新密碼'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: '新密碼與確認密碼不一致',
    path: ['confirmPassword'],
  });

export const validateResetTokenSchema = z.object({
  token: z.string().min(1, '重設 Token 為必填'),
});

export const passwordStrengthSchema = z.object({
  password: z.string().min(1, '請輸入密碼'),
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
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ValidateResetTokenInput = z.infer<typeof validateResetTokenSchema>;
export type PasswordStrengthInput = z.infer<typeof passwordStrengthSchema>;
