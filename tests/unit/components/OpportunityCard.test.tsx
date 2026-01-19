import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OpportunityCard } from '@/app/(public)/components/OpportunityCard';
import type { PublicOpportunityDTO } from '@/types/public-opportunity';

describe('OpportunityCard', () => {
  const mockOpportunity: PublicOpportunityDTO = {
    id: 'test-123',
    symbol: 'BTCUSDT',
    longExchange: 'binance',
    shortExchange: 'okx',
    status: 'ENDED',
    maxSpread: 0.0125, // 1.25%
    currentSpread: 0.0095, // 0.95%
    currentAPY: 45.67,
    disappearedAt: new Date('2024-01-15T10:30:00Z'),
    durationMs: 5400000, // 1.5 小時
    appearedAt: new Date('2024-01-15T09:00:00Z'),
  };

  describe('必要欄位顯示', () => {
    it('應顯示交易對（symbol）', () => {
      render(<OpportunityCard opportunity={mockOpportunity} />);
      expect(screen.getByText('BTCUSDT')).toBeInTheDocument();
    });

    it('應顯示多方交易所', () => {
      render(<OpportunityCard opportunity={mockOpportunity} />);
      expect(screen.getByText(/binance/i)).toBeInTheDocument();
    });

    it('應顯示空方交易所', () => {
      render(<OpportunityCard opportunity={mockOpportunity} />);
      expect(screen.getByText(/okx/i)).toBeInTheDocument();
    });

    it('應顯示最大費差（4 位小數）', () => {
      render(<OpportunityCard opportunity={mockOpportunity} />);
      // 1.25% → 1.2500%
      expect(screen.getByText(/1\.2500%/)).toBeInTheDocument();
    });

    it('應顯示結束費差（4 位小數）', () => {
      render(<OpportunityCard opportunity={mockOpportunity} />);
      // 0.95% → 0.9500%
      expect(screen.getByText(/0\.9500%/)).toBeInTheDocument();
    });

    it('應顯示年化報酬率（2 位小數 + %）', () => {
      render(<OpportunityCard opportunity={mockOpportunity} />);
      expect(screen.getByText(/45\.67%/)).toBeInTheDocument();
    });

    it('應顯示持續時間（人類可讀格式）', () => {
      render(<OpportunityCard opportunity={mockOpportunity} />);
      // 5400000 ms = 1 小時 30 分鐘
      expect(screen.getByText(/1 小時 30 分鐘/)).toBeInTheDocument();
    });

    it('應顯示機會消失時間', () => {
      render(<OpportunityCard opportunity={mockOpportunity} />);
      // 應包含日期時間資訊
      expect(screen.getByText(/2024.*01.*15/)).toBeInTheDocument();
    });
  });

  describe('完整欄位組合', () => {
    it('應同時顯示所有必要資訊', () => {
      const { container } = render(<OpportunityCard opportunity={mockOpportunity} />);

      // 驗證所有關鍵資訊都在同一個卡片中
      expect(screen.getByText('BTCUSDT')).toBeInTheDocument();
      expect(screen.getByText(/binance/i)).toBeInTheDocument();
      expect(screen.getByText(/okx/i)).toBeInTheDocument();
      expect(screen.getByText(/1\.2500%/)).toBeInTheDocument();
      expect(screen.getByText(/0\.9500%/)).toBeInTheDocument();
      expect(screen.getByText(/45\.67%/)).toBeInTheDocument();
      expect(screen.getByText(/1 小時 30 分鐘/)).toBeInTheDocument();

      // 確認是單一卡片元素
      expect(container.firstChild).toBeTruthy();
    });
  });

  describe('邊界案例', () => {
    it('應正確顯示小於 1% 的費差', () => {
      const smallSpread: PublicOpportunityDTO = {
        ...mockOpportunity,
        maxSpread: 0.0001, // 0.01%
        currentSpread: 0.00005, // 0.005%
      };

      render(<OpportunityCard opportunity={smallSpread} />);
      expect(screen.getByText(/0\.0100%/)).toBeInTheDocument();
      expect(screen.getByText(/0\.0050%/)).toBeInTheDocument();
    });

    it('應正確顯示負 APY', () => {
      const negativeAPY: PublicOpportunityDTO = {
        ...mockOpportunity,
        currentAPY: -5.25,
      };

      render(<OpportunityCard opportunity={negativeAPY} />);
      expect(screen.getByText(/-5\.25%/)).toBeInTheDocument();
    });

    it('應正確顯示短持續時間（< 1 小時）', () => {
      const shortDuration: PublicOpportunityDTO = {
        ...mockOpportunity,
        durationMs: 1800000, // 30 分鐘
      };

      render(<OpportunityCard opportunity={shortDuration} />);
      expect(screen.getByText(/30 分鐘/)).toBeInTheDocument();
    });

    it('應正確顯示長持續時間（> 24 小時）', () => {
      const longDuration: PublicOpportunityDTO = {
        ...mockOpportunity,
        durationMs: 91800000, // 25.5 小時
      };

      render(<OpportunityCard opportunity={longDuration} />);
      expect(screen.getByText(/25 小時 30 分鐘/)).toBeInTheDocument();
    });
  });

  describe('語意化標籤', () => {
    it('應使用正確的欄位標籤文字', () => {
      render(<OpportunityCard opportunity={mockOpportunity} />);

      // 檢查是否有清晰的欄位標籤（可能是 label 或 span）
      expect(screen.getByText(/交易對|Symbol/i)).toBeInTheDocument();
      expect(screen.getByText(/多方|Long/i)).toBeInTheDocument();
      expect(screen.getByText(/空方|Short/i)).toBeInTheDocument();
      expect(screen.getByText(/最大費差|Max Spread/i)).toBeInTheDocument();
      expect(screen.getByText(/結束費差|目前費差|Current Spread/i)).toBeInTheDocument();
      expect(screen.getByText(/年化報酬|APY/i)).toBeInTheDocument();
      expect(screen.getByText(/持續時間|Duration/i)).toBeInTheDocument();
      expect(screen.getByText(/結束時間|消失時間|Disappeared/i)).toBeInTheDocument();
    });
  });
});
