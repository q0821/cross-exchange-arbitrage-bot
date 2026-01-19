import { ArbitrageOpportunityRepository } from '../repositories/ArbitrageOpportunityRepository';
import type { PublicOpportunityQueryParams } from '../types/public-opportunity';

/**
 * Server-Side 獲取公開套利機會資料
 *
 * 用於 SSR（Server Component）直接調用
 */
export async function getPublicOpportunities(params?: PublicOpportunityQueryParams) {
  const repository = new ArbitrageOpportunityRepository();

  const page = params?.page || 1;
  const limit = params?.limit || 20;
  const days = params?.days || 90;

  const { data, total } = await repository.getPublicOpportunities({
    page,
    limit,
    days,
    status: 'ENDED',
  });

  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
    filter: {
      days,
    },
  };
}
