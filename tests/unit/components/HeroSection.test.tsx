import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeroSection } from '@/app/(public)/components/HeroSection';

describe('HeroSection', () => {
  describe('品牌資訊顯示', () => {
    it('應顯示系統名稱標題', () => {
      render(<HeroSection />);
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/套利|Arbitrage/i);
    });

    it('應顯示產品簡介文字', () => {
      render(<HeroSection />);
      // 簡介應該包含關鍵詞（使用更具體的片段）
      expect(screen.getByText(/即時監測多交易所資金費率套利機會/i)).toBeInTheDocument();
    });

    it('應有清楚的價值主張', () => {
      render(<HeroSection />);
      // 價值主張應該突出核心功能（使用更具體的文字匹配）
      const description = screen.getByText(/即時監測多交易所/i);
      expect(description).toBeInTheDocument();
    });
  });

  describe('行動呼籲按鈕 (CTA)', () => {
    it('應顯示主要 CTA 按鈕', () => {
      render(<HeroSection />);
      const primaryCTA = screen.getByRole('link', { name: /註冊|開始|免費試用|立即使用/i });
      expect(primaryCTA).toBeInTheDocument();
    });

    it('主要 CTA 應連結到註冊頁面', () => {
      render(<HeroSection />);
      const primaryCTA = screen.getByRole('link', { name: /註冊|開始|免費試用|立即使用/i });
      expect(primaryCTA).toHaveAttribute('href', '/register');
    });

    it('應顯示次要 CTA 按鈕（登入）', () => {
      render(<HeroSection />);
      const secondaryCTA = screen.getByRole('link', { name: /登入|sign in/i });
      expect(secondaryCTA).toBeInTheDocument();
    });

    it('次要 CTA 應連結到登入頁面', () => {
      render(<HeroSection />);
      const secondaryCTA = screen.getByRole('link', { name: /登入|sign in/i });
      expect(secondaryCTA).toHaveAttribute('href', '/login');
    });

    it('CTA 按鈕應有明確的視覺層級', () => {
      render(<HeroSection />);
      const primaryCTA = screen.getByRole('link', { name: /註冊|開始|免費試用|立即使用/i });
      const secondaryCTA = screen.getByRole('link', { name: /登入|sign in/i });

      // 主要 CTA 應有 primary 相關 class
      expect(primaryCTA.className).toContain('primary');

      // 次要 CTA 應與主要 CTA 不同（可能是 border、outline、secondary、ghost 等）
      expect(primaryCTA.className).not.toBe(secondaryCTA.className);
    });
  });

  describe('版面配置', () => {
    it('應使用居中對齊的版面', () => {
      const { container } = render(<HeroSection />);
      const hero = container.firstChild as HTMLElement;

      // 應該有居中相關的 class
      expect(hero.className).toMatch(/center|mx-auto/i);
    });

    it('標題應比簡介文字更顯著', () => {
      render(<HeroSection />);
      const title = screen.getByRole('heading', { level: 1 });
      const description = screen.getByText(/即時監測多交易所/i);

      // 標題字體應該更大（例如 text-4xl vs text-lg）
      expect(title.className).toMatch(/text-[3-6]xl|text-4xl|text-5xl/);
      expect(description.className).toMatch(/text-base|text-lg|text-xl/);
    });

    it('CTA 按鈕應在描述文字下方', () => {
      const { container } = render(<HeroSection />);

      // 檢查 DOM 順序
      const headings = container.querySelectorAll('h1');
      const links = container.querySelectorAll('a');

      expect(headings.length).toBeGreaterThan(0);
      expect(links.length).toBeGreaterThanOrEqual(2);

      // 標題應在按鈕之前
      const titlePosition = Array.from(container.querySelectorAll('*')).indexOf(
        headings[0] as Element,
      );
      const firstLinkPosition = Array.from(container.querySelectorAll('*')).indexOf(
        links[0] as Element,
      );

      expect(titlePosition).toBeLessThan(firstLinkPosition);
    });
  });

  describe('響應式設計', () => {
    it('應包含響應式間距 class', () => {
      const { container } = render(<HeroSection />);
      const hero = container.firstChild as HTMLElement;

      // 應該有 padding/margin 相關 class
      expect(hero.className).toMatch(/p-|py-|px-|m-|my-|mx-/);
    });
  });

  describe('語意化 HTML', () => {
    it('應使用 section 或 div 作為容器', () => {
      const { container } = render(<HeroSection />);
      const hero = container.firstChild as HTMLElement;

      expect(['SECTION', 'DIV'].includes(hero.tagName)).toBe(true);
    });

    it('應使用 h1 標籤作為主標題', () => {
      render(<HeroSection />);
      const title = screen.getByRole('heading', { level: 1 });
      expect(title.tagName).toBe('H1');
    });
  });
});
