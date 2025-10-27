'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { OpportunityCard, OpportunityDTO } from './OpportunityCard';

/**
 * 套利機會列表元件
 * 顯示機會列表並監聽 WebSocket 更新
 */
export function OpportunityList() {
  const [opportunities, setOpportunities] = useState<OpportunityDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // WebSocket 連線
  const { isConnected, on, off, emit } = useWebSocket({
    onConnect: () => {
      console.log('[OpportunityList] WebSocket connected, subscribing to opportunities');
      // 訂閱套利機會更新
      emit('subscribe:opportunities');
    },
    onError: (err) => {
      console.error('[OpportunityList] WebSocket error:', err);
    },
  });

  // 載入初始資料
  const loadOpportunities = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/opportunities');

      if (!response.ok) {
        throw new Error('Failed to load opportunities');
      }

      const data = await response.json();
      setOpportunities(data.data.opportunities);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 處理新機會
  const handleNewOpportunity = useCallback((opportunity: OpportunityDTO) => {
    console.log('[OpportunityList] New opportunity:', opportunity);
    setOpportunities((prev) => {
      // 檢查是否已存在
      const exists = prev.some((opp) => opp.id === opportunity.id);
      if (exists) {
        return prev;
      }
      // 新增到列表最前面
      return [opportunity, ...prev];
    });
  }, []);

  // 處理機會更新
  const handleOpportunityUpdate = useCallback((opportunity: OpportunityDTO) => {
    console.log('[OpportunityList] Opportunity update:', opportunity);
    setOpportunities((prev) =>
      prev.map((opp) => (opp.id === opportunity.id ? opportunity : opp)),
    );
  }, []);

  // 處理機會過期
  const handleOpportunityExpired = useCallback((data: { id: string }) => {
    console.log('[OpportunityList] Opportunity expired:', data.id);
    setOpportunities((prev) => prev.filter((opp) => opp.id !== data.id));
  }, []);

  // 初始載入
  useEffect(() => {
    loadOpportunities();
  }, [loadOpportunities]);

  // 註冊 WebSocket 事件監聽器
  useEffect(() => {
    on('opportunity:new', handleNewOpportunity);
    on('opportunity:update', handleOpportunityUpdate);
    on('opportunity:expired', handleOpportunityExpired);

    return () => {
      off('opportunity:new', handleNewOpportunity);
      off('opportunity:update', handleOpportunityUpdate);
      off('opportunity:expired', handleOpportunityExpired);
    };
  }, [on, off, handleNewOpportunity, handleOpportunityUpdate, handleOpportunityExpired]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-gray-600">載入中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  return (
    <div>
      {/* WebSocket 連線狀態指示器 */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">活躍套利機會</h2>
        <div className="flex items-center space-x-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-gray-400'
            }`}
          />
          <span className="text-sm text-gray-600">
            {isConnected ? '即時更新' : '已斷線'}
          </span>
        </div>
      </div>

      {/* 機會列表 */}
      {opportunities.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">目前沒有活躍的套利機會</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {opportunities.map((opportunity) => (
            <OpportunityCard key={opportunity.id} opportunity={opportunity} />
          ))}
        </div>
      )}
    </div>
  );
}
