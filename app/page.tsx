import { Metadata } from 'next/headers';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PublicNav } from './(public)/components/PublicNav';
import { OpportunityList } from './(public)/components/OpportunityList';
import { getPublicOpportunities } from '@/src/lib/get-public-opportunities';

export const metadata: Metadata = {
  title: 'Cross-Exchange Arbitrage Bot - 跨交易所套利機會監測',
  description: '即時監測多交易所資金費率套利機會，提供歷史套利機會記錄與年化報酬率分析',
  openGraph: {
    title: 'Cross-Exchange Arbitrage Bot - 跨交易所套利機會監測',
    description: '即時監測多交易所資金費率套利機會',
    type: 'website',
  },
};

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // 檢查登入狀態
  const cookieStore = await cookies();
  const token = cookieStore.get('token');

  // 已登入則重導向到市場監控頁面
  if (token) {
    redirect('/market-monitor');
  }

  // 獲取公開套利機會資料（SSR）
  const opportunities = await getPublicOpportunities({
    days: 90,
    page: 1,
    limit: 20,
  });

  return (
    <div className="min-h-screen bg-background">
      {/* 公開導覽列 */}
      <PublicNav />

      {/* 主要內容 */}
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            跨交易所套利機會監測
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            即時監測多交易所資金費率套利機會，自動計算年化報酬率，幫助您發現最佳套利時機
          </p>
        </div>

        {/* 套利機會列表 */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-foreground mb-6">
            歷史套利機會記錄
          </h2>
          <OpportunityList data={opportunities.data} />
        </div>
      </main>
    </div>
  );
}
