/**
 * RollbackFailedAlert - 回滾失敗警告組件
 * 當自動回滾失敗時，提示用戶需要手動處理
 *
 * Feature 033: Manual Open Position (T025)
 */

'use client';

import React from 'react';
import {
  AlertTriangle,
  ExternalLink,
  Copy,
  CheckCircle,
} from 'lucide-react';

interface RollbackFailedAlertProps {
  /** 持倉 ID (用於日誌追蹤) */
  positionId: string;
  exchange: string;
  orderId: string;
  side: 'LONG' | 'SHORT';
  quantity: string;
  symbol?: string;
  onDismiss?: () => void;
}

const EXCHANGE_URLS: Record<string, string> = {
  binance: 'https://www.binance.com/zh-TW/futures',
  okx: 'https://www.okx.com/zh-hant/trade-futures',
  mexc: 'https://futures.mexc.com/exchange',
  gateio: 'https://www.gate.io/futures/USDT',
};

export function RollbackFailedAlert({
  positionId: _positionId,
  exchange,
  orderId,
  side,
  quantity,
  symbol,
  onDismiss,
}: RollbackFailedAlertProps) {
  const [copied, setCopied] = React.useState(false);

  const exchangeUrl = EXCHANGE_URLS[exchange.toLowerCase()] || '#';
  const sideText = side === 'LONG' ? '做多' : '做空';
  const closeSideText = side === 'LONG' ? '平多（賣出）' : '平空（買入）';

  const handleCopyOrderId = async () => {
    try {
      await navigator.clipboard.writeText(orderId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-orange-50 border border-orange-300 rounded-lg shadow-lg z-50">
      {/* Header */}
      <div className="p-4 border-b border-orange-200">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-600" />
          <h3 className="font-semibold text-orange-800">需要手動處理</h3>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <p className="text-sm text-orange-700">
          自動回滾失敗，您有一個單邊倉位需要手動平倉：
        </p>

        <div className="bg-white rounded-md p-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">交易所</span>
            <span className="font-medium capitalize">{exchange}</span>
          </div>
          {symbol && (
            <div className="flex justify-between">
              <span className="text-gray-500">交易對</span>
              <span className="font-medium">{symbol}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">方向</span>
            <span className={`font-medium ${side === 'LONG' ? 'text-green-600' : 'text-red-600'}`}>
              {sideText}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">數量</span>
            <span className="font-medium">{quantity}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">訂單 ID</span>
            <div className="flex items-center gap-1">
              <span className="font-mono text-xs">{orderId.slice(0, 12)}...</span>
              <button
                onClick={handleCopyOrderId}
                className="p-1 hover:bg-gray-100 rounded"
                title="複製訂單 ID"
              >
                {copied ? (
                  <CheckCircle className="w-3 h-3 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3 text-gray-400" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-orange-100 rounded-md p-2">
          <p className="text-xs text-orange-800">
            <strong>操作步驟：</strong>
            <br />
            1. 前往 {exchange} 交易所
            <br />
            2. 找到上述持倉
            <br />
            3. 執行 <strong>{closeSideText}</strong> 平倉
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-orange-200 flex gap-2">
        <a
          href={exchangeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700"
        >
          <ExternalLink className="w-4 h-4" />
          前往 {exchange}
        </a>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="px-3 py-2 text-sm font-medium text-orange-700 bg-orange-100 rounded-md hover:bg-orange-200"
          >
            我知道了
          </button>
        )}
      </div>
    </div>
  );
}
