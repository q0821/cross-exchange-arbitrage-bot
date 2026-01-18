import { prisma } from './db';
import { OpportunityEndHistoryRepository } from '../repositories/OpportunityEndHistoryRepository';
import type { PublicOpportunityQueryParams } from '../types/public-opportunity';

/**
 * Server-Side 獲取公開套利機會資料
 *
 * 用於 SSR（Server Component）直接調用
 */
export async function getPublicOpportunities(params?: PublicOpportunityQueryParams) {
  const repository = new OpportunityEndHistoryRepository(prisma);

  const page = params?.page || 1;
  const limit = params?.limit || 20;
  const days = params?.days || 90;

  const { data, total } = await repository.findAllPublic({
    page,
    limit,
    days,
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
