import type { PublicOpportunityDTO } from '@/src/types/public-opportunity';
import { OpportunityCard } from './OpportunityCard';

interface OpportunityListProps {
  data: PublicOpportunityDTO[];
}

/**
 * 套利機會列表元件
 *
 * 顯示套利機會列表或空狀態
 */
export function OpportunityList({ data }: OpportunityListProps) {
  // 空狀態
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="rounded-full bg-muted p-6 mb-4">
          <svg
            className="w-12 h-12 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">目前暫無套利機會記錄</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          系統尚未記錄到任何套利機會，或是您選擇的時間範圍內沒有資料。
        </p>
      </div>
    );
  }

  // 列表顯示
  return (
    <div className="space-y-4">
      {data.map((opportunity) => (
        <OpportunityCard key={opportunity.id} opportunity={opportunity} />
      ))}
    </div>
  );
}
