'use client';

import { OpportunityThresholdSettings } from './components/OpportunityThresholdSettings';

/**
 * 交易設定頁面
 *
 * Feature 036: 可配置年化收益門檻
 */
export default function TradingSettingsPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">交易設定</h1>
        <p className="mt-1 text-sm text-gray-600">
          管理交易相關的偏好設定
        </p>
      </div>

      {/* 年化收益門檻設定 */}
      <OpportunityThresholdSettings />

      {/* 未來可在此新增其他交易設定 */}
    </div>
  );
}
