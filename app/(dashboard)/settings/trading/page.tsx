'use client';

import { OpportunityThresholdSettings } from './components/OpportunityThresholdSettings';
import { StopLossTakeProfitSettings } from './components/StopLossTakeProfitSettings';

/**
 * 交易設定頁面
 *
 * Feature 036: 可配置年化收益門檻
 * Feature 038: 停損停利預設值管理
 */
export default function TradingSettingsPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">交易設定</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          管理交易相關的偏好設定
        </p>
      </div>

      {/* 停損停利預設值設定 (Feature 038) */}
      <div className="mb-6">
        <StopLossTakeProfitSettings />
      </div>

      {/* 年化收益門檻設定 */}
      <OpportunityThresholdSettings />
    </div>
  );
}
