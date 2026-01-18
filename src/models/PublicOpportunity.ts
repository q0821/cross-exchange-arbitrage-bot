import { z } from 'zod';

/**
 * 公開 API 查詢參數 Zod Schema
 * 用於驗證 /api/public/opportunities 的 query parameters
 */
export const PublicOpportunityQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .default('20')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(100)),
  days: z
    .string()
    .optional()
    .default('90')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().refine((val) => [7, 30, 90].includes(val), {
      message: 'days must be 7, 30, or 90',
    })),
});

export type PublicOpportunityQuery = z.infer<typeof PublicOpportunityQuerySchema>;
