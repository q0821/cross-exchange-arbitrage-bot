import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Pagination } from '@/app/(public)/components/Pagination';

describe('Pagination', () => {
  const defaultProps = {
    currentPage: 1,
    totalPages: 5,
    onPageChange: vi.fn(),
  };

  describe('頁碼顯示', () => {
    it('應正確顯示當前頁碼和總頁數', () => {
      render(<Pagination {...defaultProps} />);
      expect(screen.getByText(/1.*5/)).toBeInTheDocument();
    });

    it('應顯示所有頁碼（總頁數 <= 7）', () => {
      render(<Pagination {...defaultProps} totalPages={5} />);

      // 應顯示 1-5 所有頁碼
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('應使用省略號當頁數過多（> 7）', () => {
      render(<Pagination {...defaultProps} currentPage={5} totalPages={20} />);

      // 應該有省略號
      expect(screen.getByText('...')).toBeInTheDocument();
    });

    it('應高亮當前頁碼', () => {
      render(<Pagination {...defaultProps} currentPage={3} />);

      const currentPageButton = screen.getByRole('button', { name: /^3$/ });
      expect(currentPageButton).toHaveAttribute('aria-current', 'page');
    });
  });

  describe('上下頁按鈕狀態', () => {
    it('第一頁時，上一頁按鈕應停用', () => {
      render(<Pagination {...defaultProps} currentPage={1} />);

      const prevButton = screen.getByRole('button', { name: /上一頁|previous/i });
      expect(prevButton).toBeDisabled();
    });

    it('最後一頁時，下一頁按鈕應停用', () => {
      render(<Pagination {...defaultProps} currentPage={5} totalPages={5} />);

      const nextButton = screen.getByRole('button', { name: /下一頁|next/i });
      expect(nextButton).toBeDisabled();
    });

    it('中間頁時，上下頁按鈕都應啟用', () => {
      render(<Pagination {...defaultProps} currentPage={3} totalPages={5} />);

      const prevButton = screen.getByRole('button', { name: /上一頁|previous/i });
      const nextButton = screen.getByRole('button', { name: /下一頁|next/i });

      expect(prevButton).not.toBeDisabled();
      expect(nextButton).not.toBeDisabled();
    });
  });

  describe('點擊事件', () => {
    it('點擊上一頁應觸發 onPageChange(currentPage - 1)', async () => {
      const user = userEvent.setup();
      const onPageChange = vi.fn();

      render(<Pagination {...defaultProps} currentPage={3} onPageChange={onPageChange} />);

      const prevButton = screen.getByRole('button', { name: /上一頁|previous/i });
      await user.click(prevButton);

      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('點擊下一頁應觸發 onPageChange(currentPage + 1)', async () => {
      const user = userEvent.setup();
      const onPageChange = vi.fn();

      render(<Pagination {...defaultProps} currentPage={2} onPageChange={onPageChange} />);

      const nextButton = screen.getByRole('button', { name: /下一頁|next/i });
      await user.click(nextButton);

      expect(onPageChange).toHaveBeenCalledWith(3);
    });

    it('點擊特定頁碼應觸發 onPageChange(該頁碼)', async () => {
      const user = userEvent.setup();
      const onPageChange = vi.fn();

      render(<Pagination {...defaultProps} currentPage={1} onPageChange={onPageChange} />);

      const page4Button = screen.getByRole('button', { name: /^4$/ });
      await user.click(page4Button);

      expect(onPageChange).toHaveBeenCalledWith(4);
    });

    it('點擊當前頁碼不應觸發事件', async () => {
      const user = userEvent.setup();
      const onPageChange = vi.fn();

      render(<Pagination {...defaultProps} currentPage={3} onPageChange={onPageChange} />);

      const currentPageButton = screen.getByRole('button', { name: /^3$/ });
      await user.click(currentPageButton);

      expect(onPageChange).not.toHaveBeenCalled();
    });
  });

  describe('邊界案例', () => {
    it('只有 1 頁時，上下頁按鈕都應停用', () => {
      render(<Pagination {...defaultProps} currentPage={1} totalPages={1} />);

      const prevButton = screen.getByRole('button', { name: /上一頁|previous/i });
      const nextButton = screen.getByRole('button', { name: /下一頁|next/i });

      expect(prevButton).toBeDisabled();
      expect(nextButton).toBeDisabled();
    });

    it('totalPages 為 0 時應正確處理', () => {
      render(<Pagination {...defaultProps} currentPage={1} totalPages={0} />);

      // 不應崩潰，應顯示提示訊息或隱藏分頁
      expect(screen.queryByText(/1.*0/)).toBeInTheDocument();
    });
  });

  describe('無障礙性', () => {
    it('應使用 nav 元素包裹', () => {
      const { container } = render(<Pagination {...defaultProps} />);
      expect(container.querySelector('nav')).toBeInTheDocument();
    });

    it('按鈕應有正確的 aria-label', () => {
      render(<Pagination {...defaultProps} currentPage={2} />);

      expect(screen.getByRole('button', { name: /上一頁|previous/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /下一頁|next/i })).toBeInTheDocument();
    });
  });
});
