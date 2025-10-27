'use client';

import { OpportunityList } from '@/components/opportunities/OpportunityList';

/**
 * 套利機會列表頁面
 */
export default function OpportunitiesPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <OpportunityList />
    </div>
  );
}
