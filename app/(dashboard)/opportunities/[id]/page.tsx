'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { OpportunityDTO } from '@/components/opportunities/OpportunityCard';

/**
 * 套利機會詳情頁面
 */
export default function OpportunityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const opportunityId = params.id as string;

  const [opportunity, setOpportunity] = useState<OpportunityDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // 格式化費率為百分比
  const formatRate = (rate: string): string => {
    const rateNum = parseFloat(rate) * 100;
    return rateNum.toFixed(4) + '%';
  };

  // 格式化年化收益率為百分比
  const formatAnnualReturn = (rate: string): string => {
    const rateNum = parseFloat(rate) * 100;
    return rateNum.toFixed(2) + '%';
  };

  // 格式化時間
  const formatDateTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // 格式化持續時間
  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} 分鐘`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours} 小時 ${remainingMinutes} 分鐘`;
  };

  // 載入機會詳情（從列表 API 取得，然後篩選）
  useEffect(() => {
    const loadOpportunity = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/opportunities');

        if (!response.ok) {
          throw new Error('Failed to load opportunity');
        }

        const data = await response.json();
        const opp = data.data.opportunities.find((o: OpportunityDTO) => o.id === opportunityId);

        if (!opp) {
          setError('Opportunity not found');
          return;
        }

        setOpportunity(opp);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    loadOpportunity();
  }, [opportunityId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">載入中...</div>
      </div>
    );
  }

  if (error || !opportunity) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error || 'Opportunity not found'}
        </div>
        <button
          onClick={() => router.push('/opportunities')}
          className="text-blue-600 hover:text-blue-800"
        >
          ← 返回列表
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* 返回按鈕 */}
      <button
        onClick={() => router.push('/opportunities')}
        className="mb-6 text-blue-600 hover:text-blue-800 flex items-center"
      >
        ← 返回列表
      </button>

      {/* 主要資訊卡片 */}
      <div className="bg-white rounded-lg shadow-md p-8 mb-6">
        {/* 標題 */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{opportunity.symbol}</h1>
            <p className="text-sm text-gray-500">
              檢測於 {formatDateTime(opportunity.detectedAt)} •{' '}
              {formatDuration(opportunity.durationMinutes)} 前
            </p>
          </div>
          <span
            className={`px-4 py-2 rounded-full text-sm font-medium ${
              opportunity.status === 'ACTIVE'
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {opportunity.status === 'ACTIVE' ? '活躍' : opportunity.status}
          </span>
        </div>

        {/* 收益資訊 */}
        <div className="bg-blue-50 rounded-lg p-6 mb-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">費率差異</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatRate(opportunity.rateDifference)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">預期年化收益</p>
              <p className="text-2xl font-bold text-green-600">
                {formatAnnualReturn(opportunity.expectedReturnRate)}
              </p>
            </div>
          </div>
        </div>

        {/* 交易所資訊 */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* 做多交易所 */}
          <div className="border border-blue-200 rounded-lg p-6 bg-blue-50">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">做多交易所</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">交易所</p>
                <p className="text-xl font-bold text-gray-900">
                  {opportunity.longExchange.toUpperCase()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">資金費率</p>
                <p className="text-lg font-medium text-gray-900">
                  {formatRate(opportunity.longFundingRate)}
                </p>
              </div>
            </div>
          </div>

          {/* 做空交易所 */}
          <div className="border border-red-200 rounded-lg p-6 bg-red-50">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">做空交易所</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">交易所</p>
                <p className="text-xl font-bold text-gray-900">
                  {opportunity.shortExchange.toUpperCase()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">資金費率</p>
                <p className="text-lg font-medium text-gray-900">
                  {formatRate(opportunity.shortFundingRate)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 額外資訊 */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">詳細資訊</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">最大費率差異</p>
              <p className="font-medium text-gray-900">
                {opportunity.maxRateDifference
                  ? formatRate(opportunity.maxRateDifference)
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-gray-600">通知次數</p>
              <p className="font-medium text-gray-900">{opportunity.notificationCount}</p>
            </div>
            <div>
              <p className="text-gray-600">機會 ID</p>
              <p className="font-mono text-xs text-gray-700">{opportunity.id}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 操作按鈕區域（預留給 Phase 5 開倉功能）*/}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">操作</h3>
        <p className="text-sm text-gray-600 mb-4">
          開倉功能將在後續階段實作（Phase 5: 手動開倉執行）
        </p>
        <button
          disabled
          className="px-6 py-3 bg-gray-300 text-gray-500 rounded-md cursor-not-allowed"
        >
          開倉（即將推出）
        </button>
      </div>
    </div>
  );
}
