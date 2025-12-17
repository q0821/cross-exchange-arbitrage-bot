/**
 * PartialCloseAlert - 部分平倉警告組件
 *
 * 當平倉只有一邊成功時，顯示警告訊息並提供手動處理指引
 * Feature: 035-close-position (T013)
 */

'use client';

import React from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import type { SupportedExchange, TradeSide } from '@/src/types/trading';

interface PartialCloseAlertProps {
  positionId: string;
  symbol: string;
  closedSide: {
    exchange: SupportedExchange;
    side: TradeSide;
    orderId: string;
    price: string;
    quantity: string;
    fee: string;
  };
  failedSide: {
    exchange: SupportedExchange;
    side: TradeSide;
    error: string;
    errorCode: string;
  };
  onDismiss?: () => void;
}

/**
 * 交易所鏈接
 */
const EXCHANGE_URLS: Record<SupportedExchange, string> = {
  binance: 'https://www.binance.com/en/futures',
  okx: 'https://www.okx.com/trade-swap',
  mexc: 'https://futures.mexc.com/',
  gateio: 'https://www.gate.io/futures_trade',
};

export function PartialCloseAlert({
  positionId,
  symbol,
  closedSide,
  failedSide,
  onDismiss,
}: PartialCloseAlertProps) {
  const exchangeUrl = EXCHANGE_URLS[failedSide.exchange];

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-base font-semibold text-orange-800 mb-2">
            需要手動處理
          </h3>

          <p className="text-sm text-orange-700 mb-3">
            {symbol} 持倉部分平倉成功。{closedSide.side === 'LONG' ? '多頭' : '空頭'}
            已在 {closedSide.exchange.toUpperCase()} 平倉，但
            {failedSide.side === 'LONG' ? '多頭' : '空頭'}
            在 {failedSide.exchange.toUpperCase()} 平倉失敗。
          </p>

          {/* 已平倉資訊 */}
          <div className="bg-white rounded-md p-3 mb-3 border border-orange-100">
            <h4 className="text-xs font-medium text-gray-500 mb-2">已平倉</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">交易所:</span>
                <span className="ml-1 font-medium text-gray-900 capitalize">
                  {closedSide.exchange}
                </span>
              </div>
              <div>
                <span className="text-gray-500">方向:</span>
                <span className="ml-1 font-medium text-gray-900">
                  {closedSide.side === 'LONG' ? '多頭' : '空頭'}
                </span>
              </div>
              <div>
                <span className="text-gray-500">成交價:</span>
                <span className="ml-1 font-medium text-gray-900">
                  ${parseFloat(closedSide.price).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-gray-500">數量:</span>
                <span className="ml-1 font-medium text-gray-900">
                  {parseFloat(closedSide.quantity).toFixed(4)}
                </span>
              </div>
            </div>
          </div>

          {/* 失敗資訊 */}
          <div className="bg-red-50 rounded-md p-3 mb-3 border border-red-100">
            <h4 className="text-xs font-medium text-red-600 mb-2">平倉失敗</h4>
            <div className="text-sm">
              <div className="mb-1">
                <span className="text-gray-500">交易所:</span>
                <span className="ml-1 font-medium text-gray-900 capitalize">
                  {failedSide.exchange}
                </span>
              </div>
              <div className="mb-1">
                <span className="text-gray-500">方向:</span>
                <span className="ml-1 font-medium text-gray-900">
                  {failedSide.side === 'LONG' ? '多頭' : '空頭'}
                </span>
              </div>
              <div>
                <span className="text-gray-500">錯誤:</span>
                <span className="ml-1 text-red-600">{failedSide.error}</span>
              </div>
            </div>
          </div>

          {/* 操作指引 */}
          <div className="bg-blue-50 rounded-md p-3 mb-3 border border-blue-100">
            <h4 className="text-xs font-medium text-blue-600 mb-2">處理步驟</h4>
            <ol className="text-sm text-blue-700 list-decimal list-inside space-y-1">
              <li>
                登入 {failedSide.exchange.toUpperCase()} 交易所
              </li>
              <li>
                前往合約交易頁面，找到 {symbol} 持倉
              </li>
              <li>
                手動平倉{failedSide.side === 'LONG' ? '多頭' : '空頭'}倉位
              </li>
              <li>
                完成後返回此頁面刷新狀態
              </li>
            </ol>
          </div>

          {/* 操作按鈕 */}
          <div className="flex items-center gap-3">
            <a
              href={exchangeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 transition-colors"
            >
              前往 {failedSide.exchange.toUpperCase()}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="px-3 py-1.5 text-sm font-medium text-orange-700 hover:text-orange-800"
              >
                我知道了
              </button>
            )}
          </div>

          {/* 持倉 ID */}
          <p className="mt-3 text-xs text-gray-400">
            持倉 ID: {positionId}
          </p>
        </div>
      </div>
    </div>
  );
}

export default PartialCloseAlert;
