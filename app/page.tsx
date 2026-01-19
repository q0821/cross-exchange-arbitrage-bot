import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PublicNav } from './(public)/components/PublicNav';
import { HeroSection } from './(public)/components/HeroSection';
import { OpportunityListClient } from './(public)/components/OpportunityListClient';

export const metadata: Metadata = {
  title: 'Cross-Exchange Arbitrage Bot - 跨交易所套利機會監測',
  description: '即時監測多交易所資金費率套利機會，自動計算年化報酬率，24/7 不間斷追蹤 Binance、OKX、Gate.io、MEXC、BingX 等交易所，幫助您發現最佳套利時機',
  keywords: ['套利', '資金費率', '跨交易所', '加密貨幣', 'arbitrage', 'funding rate', 'crypto trading'],
  openGraph: {
    title: 'Cross-Exchange Arbitrage Bot - 跨交易所套利機會監測',
    description: '即時監測多交易所資金費率套利機會，自動計算年化報酬率',
    type: 'website',
    locale: 'zh_TW',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cross-Exchange Arbitrage Bot - 跨交易所套利機會監測',
    description: '即時監測多交易所資金費率套利機會，自動計算年化報酬率',
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

  return (
    <div className="min-h-screen bg-background">
      {/* 公開導覽列 */}
      <PublicNav />

      {/* Hero Section - 品牌與 CTA */}
      <HeroSection />

      {/* 主要內容 */}
      <main className="container mx-auto px-4 py-8">
        {/* 套利機會列表（客戶端互動） */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-foreground mb-6">
            套利機會追蹤
          </h2>
          <OpportunityListClient />
        </div>
      </main>
    </div>
  );
}
