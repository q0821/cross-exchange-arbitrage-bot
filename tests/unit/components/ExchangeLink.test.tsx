/**
 * ExchangeLink Component Tests
 *
 * Feature: 008-specify-scripts-bash
 * Purpose: Test ExchangeLink component rendering and behavior
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExchangeLink } from '@/components/market/ExchangeLink';

describe('ExchangeLink Component', () => {
  describe('Rendering - Available State', () => {
    it('should render link for Binance', () => {
      render(
        <ExchangeLink
          exchange="binance"
          symbol="BTC/USDT"
          isAvailable={true}
        />
      );

      const link = screen.getByRole('link');
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute(
        'href',
        'https://www.binance.com/zh-TC/futures/BTCUSDT'
      );
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should render link for OKX', () => {
      render(
        <ExchangeLink exchange="okx" symbol="ETH/USDT" isAvailable={true} />
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute(
        'href',
        'https://www.okx.com/zh-hant/trade-swap/ETH-USDT-SWAP'
      );
    });

    it('should render link for MEXC', () => {
      render(
        <ExchangeLink exchange="mexc" symbol="SOL/USDT" isAvailable={true} />
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute(
        'href',
        'https://futures.mexc.com/zh-TW/exchange/SOL_USDT'
      );
    });

    it('should render link for Gate.io', () => {
      render(
        <ExchangeLink exchange="gateio" symbol="BNB/USDT" isAvailable={true} />
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute(
        'href',
        'https://www.gate.io/zh-tw/futures_trade/USDT/BNB_USDT'
      );
    });

    it('should have correct aria-label', () => {
      render(
        <ExchangeLink
          exchange="binance"
          symbol="BTC/USDT"
          isAvailable={true}
        />
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute(
        'aria-label',
        '前往 Binance 查看 BTC/USDT 永續合約'
      );
    });

    it('should accept custom aria-label', () => {
      render(
        <ExchangeLink
          exchange="binance"
          symbol="BTC/USDT"
          isAvailable={true}
          ariaLabel="Custom label"
        />
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('aria-label', 'Custom label');
    });

    it('should accept custom className', () => {
      render(
        <ExchangeLink
          exchange="binance"
          symbol="BTC/USDT"
          isAvailable={true}
          className="custom-class"
        />
      );

      const link = screen.getByRole('link');
      expect(link.className).toContain('custom-class');
    });

    it('should call onClick callback when clicked', () => {
      const handleClick = vi.fn();
      render(
        <ExchangeLink
          exchange="binance"
          symbol="BTC/USDT"
          isAvailable={true}
          onClick={handleClick}
        />
      );

      const link = screen.getByRole('link');
      link.click();

      expect(handleClick).toHaveBeenCalledWith('binance', 'BTC/USDT');
    });
  });

  describe('Rendering - Disabled State', () => {
    it('should render disabled state when isAvailable is false', () => {
      render(
        <ExchangeLink
          exchange="binance"
          symbol="BTC/USDT"
          isAvailable={false}
        />
      );

      // Should not render as a link
      expect(screen.queryByRole('link')).not.toBeInTheDocument();

      // Should render as a span with disabled styling
      const span = screen.getByLabelText(/此交易所不支援/);
      expect(span).toBeInTheDocument();
      expect(span.className).toContain('opacity-40');
      expect(span.className).toContain('cursor-not-allowed');
    });

    it('should have tabIndex -1 when disabled', () => {
      render(
        <ExchangeLink
          exchange="binance"
          symbol="BTC/USDT"
          isAvailable={false}
        />
      );

      const span = screen.getByLabelText(/此交易所不支援/);
      expect(span).toHaveAttribute('tabIndex', '-1');
    });

    it('should render disabled state for invalid symbol', () => {
      render(
        <ExchangeLink
          exchange="binance"
          symbol="INVALID"
          isAvailable={true}
        />
      );

      // Should render disabled because URL generation fails
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('should not call onClick when disabled', () => {
      const handleClick = vi.fn();
      render(
        <ExchangeLink
          exchange="binance"
          symbol="BTC/USDT"
          isAvailable={false}
          onClick={handleClick}
        />
      );

      const span = screen.getByLabelText(/此交易所不支援/);
      span.click();

      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes for enabled state', () => {
      render(
        <ExchangeLink
          exchange="binance"
          symbol="BTC/USDT"
          isAvailable={true}
        />
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('aria-label');
      expect(link.getAttribute('aria-label')).toBeTruthy();
    });

    it('should have proper ARIA attributes for disabled state', () => {
      render(
        <ExchangeLink
          exchange="binance"
          symbol="BTC/USDT"
          isAvailable={false}
        />
      );

      const span = screen.getByLabelText(/此交易所不支援/);
      expect(span).toHaveAttribute('aria-label');
      expect(span).toHaveAttribute('tabIndex', '-1');
    });

    it('should be keyboard accessible when enabled', () => {
      render(
        <ExchangeLink
          exchange="binance"
          symbol="BTC/USDT"
          isAvailable={true}
        />
      );

      const link = screen.getByRole('link');
      expect(link).not.toHaveAttribute('tabIndex', '-1');
    });
  });

  describe('Edge Cases', () => {
    it('should handle symbol with numbers', () => {
      render(
        <ExchangeLink
          exchange="binance"
          symbol="1000PEPE/USDT"
          isAvailable={true}
        />
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute(
        'href',
        'https://www.binance.com/zh-TC/futures/1000PEPEUSDT'
      );
    });

    it('should default to isAvailable=true when not specified', () => {
      render(<ExchangeLink exchange="binance" symbol="BTC/USDT" />);

      const link = screen.getByRole('link');
      expect(link).toBeInTheDocument();
    });
  });
});
