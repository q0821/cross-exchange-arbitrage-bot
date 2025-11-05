'use client';

import Link from 'next/link';
import { Decimal } from 'decimal.js';
import { TOTAL_COST_RATE } from '@/src/lib/cost-constants';

export interface OpportunityDTO {
  id: string;
  symbol: string;
  longExchange: string;
  shortExchange: string;
  longFundingRate: string;
  shortFundingRate: string;
  rateDifference: string;
  expectedReturnRate: string;
  status: string;
  detectedAt: string;
  durationMinutes: number;
  maxRateDifference?: string;
  notificationCount: number;
}

interface OpportunityCardProps {
  opportunity: OpportunityDTO;
}

/**
 * 套利機會卡片元件
 * 顯示單個套利機會的摘要資訊
 */
export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  // 計算淨收益率和淨年化收益率
  const rateDiff = new Decimal(opportunity.rateDifference);
  const netProfitRate = rateDiff.minus(TOTAL_COST_RATE);
  const netAnnualizedRate = netProfitRate.times(1095); // 3 settlements/day × 365 days

  // 格式化費率為百分比
  const formatRate = (rate: string): string => {
    const rateNum = parseFloat(rate) * 100;
    return rateNum.toFixed(4) + '%';
  };

  // 格式化百分比（Decimal）
  const formatRateDecimal = (rate: Decimal, decimals: number = 4): string => {
    const rateNum = rate.times(100);
    return rateNum.toFixed(decimals) + '%';
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

  // 根據淨年化收益率決定顏色
  const getReturnColor = (netRate: Decimal): string => {
    const rateNum = netRate.times(100).toNumber();
    if (rateNum >= 20) return 'text-green-600 font-bold';
    if (rateNum >= 10) return 'text-green-500';
    if (rateNum > 0) return 'text-gray-700';
    return 'text-red-600'; // 負收益
  };

  return (
    <Link href={`/opportunities/${opportunity.id}`}>
      <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-200 cursor-pointer">
        {/* 標題行 */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{opportunity.symbol}</h3>
            <p className="text-sm text-gray-500 mt-1">
              檢測於 {formatDuration(opportunity.durationMinutes)} 前
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              opportunity.status === 'ACTIVE'
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {opportunity.status === 'ACTIVE' ? '活躍' : opportunity.status}
          </span>
        </div>

        {/* 交易所資訊 */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-1">做多</p>
            <p className="text-sm font-semibold text-gray-900">
              {opportunity.longExchange.toUpperCase()}
            </p>
            <p className="text-xs text-gray-700 mt-1">
              費率: {formatRate(opportunity.longFundingRate)}
            </p>
          </div>
          <div className="bg-red-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-1">做空</p>
            <p className="text-sm font-semibold text-gray-900">
              {opportunity.shortExchange.toUpperCase()}
            </p>
            <p className="text-xs text-gray-700 mt-1">
              費率: {formatRate(opportunity.shortFundingRate)}
            </p>
          </div>
        </div>

        {/* 收益資訊 */}
        <div className="border-t border-gray-200 pt-4">
          {/* 費率差異（毛收益）*/}
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">費率差異</span>
            <span className="text-sm font-medium text-gray-900">
              {formatRate(opportunity.rateDifference)}
            </span>
          </div>

          {/* 成本明細 */}
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">
              總成本
              <span className="text-xs text-gray-500 ml-1">
                (手續費 + 滑點 + 價差 + 安全邊際)
              </span>
            </span>
            <span className="text-sm font-medium text-red-600">
              -{formatRateDecimal(new Decimal(TOTAL_COST_RATE))}
            </span>
          </div>

          {/* 淨收益率 */}
          <div className="flex justify-between items-center mb-3 pb-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-700">預期淨收益</span>
            <span
              className={`text-base font-bold ${
                netProfitRate.greaterThan(0) ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {formatRateDecimal(netProfitRate)}
            </span>
          </div>

          {/* 淨年化收益率 */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">預期淨年化收益</span>
            <span className={`text-lg font-bold ${getReturnColor(netAnnualizedRate)}`}>
              {formatRateDecimal(netAnnualizedRate, 2)}
            </span>
          </div>
        </div>

        {/* 額外資訊 */}
        {opportunity.maxRateDifference && (
          <div className="mt-3 text-xs text-gray-500">
            最大差異: {formatRate(opportunity.maxRateDifference)} • 通知次數:{' '}
            {opportunity.notificationCount}
          </div>
        )}
      </div>
    </Link>
  );
}
