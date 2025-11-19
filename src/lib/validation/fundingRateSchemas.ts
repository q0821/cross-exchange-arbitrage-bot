/**
 * Zod Validation Schemas for Funding Rate Normalization
 *
 * Provides validation schemas for funding rate inputs, net profit calculations,
 * and time basis preferences.
 */

import { z } from 'zod';

/**
 * Valid funding intervals in hours
 */
export const VALID_FUNDING_INTERVALS = [1, 4, 8, 24] as const;

/**
 * Valid time basis options for user preferences
 */
export const VALID_TIME_BASIS = [1, 4, 8, 24] as const;

/**
 * Funding Rate Input Schema
 *
 * Validates inputs for funding rate normalization
 */
export const FundingRateInputSchema = z.object({
  originalRate: z.string().refine((val) => !isNaN(parseFloat(val)), {
    message: 'Original rate must be a valid numeric string'
  }),
  originalFundingInterval: z.union([
    z.literal(1),
    z.literal(4),
    z.literal(8),
    z.literal(24)
  ]),
  targetTimeBasis: z.union([
    z.literal(1),
    z.literal(4),
    z.literal(8),
    z.literal(24)
  ])
});

export type FundingRateInput = z.infer<typeof FundingRateInputSchema>;

/**
 * Net Profit Input Schema
 *
 * Validates inputs for net profit calculation
 */
export const NetProfitInputSchema = z.object({
  longRate: z.string().refine((val) => !isNaN(parseFloat(val)), {
    message: 'Long rate must be a valid numeric string'
  }),
  shortRate: z.string().refine((val) => !isNaN(parseFloat(val)), {
    message: 'Short rate must be a valid numeric string'
  }),
  takerFeeRate: z.string()
    .refine((val) => !isNaN(parseFloat(val)), {
      message: 'Taker fee rate must be a valid numeric string'
    })
    .refine((val) => {
      const num = parseFloat(val);
      return num >= 0 && num <= 0.01; // Max 1%
    }, {
      message: 'Taker fee rate must be between 0 and 0.01 (1%)'
    })
    .optional()
    .default('0.0005') // Default: 0.05%
});

export type NetProfitInput = z.infer<typeof NetProfitInputSchema>;

/**
 * Time Basis Schema
 *
 * Validates user-selected time basis preference
 */
export const TimeBasisSchema = z.union([
  z.literal(1),
  z.literal(4),
  z.literal(8),
  z.literal(24)
]);

export type TimeBasis = z.infer<typeof TimeBasisSchema>;

/**
 * Normalized Funding Rate Schema
 *
 * Validates the complete normalized funding rate object
 */
export const NormalizedFundingRateSchema = z.object({
  exchange: z.string().min(1),
  symbol: z.string().min(1),
  originalRate: z.string(),
  originalFundingInterval: z.union([
    z.literal(1),
    z.literal(4),
    z.literal(8),
    z.literal(24)
  ]),
  targetTimeBasis: z.union([
    z.literal(1),
    z.literal(4),
    z.literal(8),
    z.literal(24)
  ]),
  normalizedRate: z.string(),
  timestamp: z.date()
});

export type NormalizedFundingRate = z.infer<typeof NormalizedFundingRateSchema>;

/**
 * Net Profit Calculation Schema
 *
 * Validates the complete net profit calculation object
 */
export const NetProfitCalculationSchema = z.object({
  symbol: z.string().min(1),
  longExchange: z.string().min(1),
  shortExchange: z.string().min(1),
  longRate: z.string(),
  shortRate: z.string(),
  rateDifference: z.string(),
  takerFeeRate: z.string(),
  totalFees: z.string(),
  netProfit: z.string(),
  timestamp: z.date()
});

export type NetProfitCalculation = z.infer<typeof NetProfitCalculationSchema>;

/**
 * WebSocket Set Time Basis Payload Schema
 */
export const SetTimeBasisPayloadSchema = z.object({
  timeBasis: TimeBasisSchema
});

export type SetTimeBasisPayload = z.infer<typeof SetTimeBasisPayloadSchema>;

/**
 * Validate funding rate input
 */
export function validateFundingRateInput(input: unknown): FundingRateInput {
  return FundingRateInputSchema.parse(input);
}

/**
 * Validate net profit input
 */
export function validateNetProfitInput(input: unknown): NetProfitInput {
  return NetProfitInputSchema.parse(input);
}

/**
 * Validate time basis
 */
export function validateTimeBasis(input: unknown): TimeBasis {
  return TimeBasisSchema.parse(input);
}
