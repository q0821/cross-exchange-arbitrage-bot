/**
 * ExchangeLink Component
 *
 * Feature: 008-specify-scripts-bash
 * Purpose: Clickable icon that links to exchange contract page
 */

'use client';

import * as Tooltip from '@radix-ui/react-tooltip';
import { ExternalLink } from 'lucide-react';
import { getExchangeContractUrl } from '@/lib/exchanges';
import type { ExchangeLinkProps } from '@/types/exchange-links';
import { EXCHANGE_DISPLAY_NAMES } from '@/types/exchange-links';

/**
 * ExchangeLink Component
 *
 * Renders a clickable icon that opens the exchange's contract page in a new tab
 *
 * @param exchange - Exchange identifier (e.g., 'binance', 'okx')
 * @param symbol - Trading pair symbol in "BASE/QUOTE" format (e.g., "BTC/USDT")
 * @param isAvailable - Whether the link should be enabled (default: true)
 * @param className - Additional CSS classes
 * @param ariaLabel - Custom aria-label (auto-generated if not provided)
 * @param onClick - Callback when link is clicked (for analytics)
 */
export function ExchangeLink({
  exchange,
  symbol,
  isAvailable = true,
  className = '',
  ariaLabel,
  onClick,
}: ExchangeLinkProps) {
  // Generate URL
  const urlResult = getExchangeContractUrl(exchange, symbol);

  // Determine if link is disabled
  const isDisabled = !isAvailable || !urlResult.isValid;

  // Get exchange display name
  const exchangeName = EXCHANGE_DISPLAY_NAMES[exchange] || exchange;

  // Generate aria-label
  const accessibilityLabel =
    ariaLabel ||
    (isDisabled
      ? `此交易所不支援 ${symbol}`
      : `前往 ${exchangeName} 查看 ${symbol} 永續合約`);

  // Handle click for analytics
  const handleClick = () => {
    if (!isDisabled && onClick) {
      onClick(exchange, symbol);
    }
  };

  // Render disabled state
  if (isDisabled) {
    return (
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span
            className={`inline-flex items-center opacity-40 cursor-not-allowed ${className}`}
            aria-label={accessibilityLabel}
            tabIndex={-1}
          >
            <ExternalLink className="w-4 h-4 text-gray-400" />
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="bg-gray-900 text-white text-sm px-3 py-2 rounded shadow-lg z-50"
            sideOffset={5}
          >
            {isAvailable
              ? `無法生成 ${exchangeName} 連結`
              : `此交易所不支援 ${symbol}`}
            <Tooltip.Arrow className="fill-gray-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    );
  }

  // Render active link
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <a
          href={urlResult.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center text-gray-500 hover:text-blue-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded ${className}`}
          aria-label={accessibilityLabel}
          onClick={handleClick}
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className="bg-gray-900 text-white text-sm px-3 py-2 rounded shadow-lg z-50"
          sideOffset={5}
        >
          前往 {exchangeName} 查看 {symbol}
          <Tooltip.Arrow className="fill-gray-900" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
