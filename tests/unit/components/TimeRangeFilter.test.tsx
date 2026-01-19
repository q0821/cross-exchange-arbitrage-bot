import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { TimeRangeFilter } from '@/app/(public)/components/TimeRangeFilter';

describe('TimeRangeFilter', () => {
  const defaultProps = {
    selectedDays: 90,
    onDaysChange: vi.fn(),
  };

  describe('選項顯示', () => {
    it('應顯示 7/30/90 天三個選項', () => {
      render(<TimeRangeFilter {...defaultProps} />);

      expect(screen.getByRole('button', { name: /7.*天/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /30.*天/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /90.*天/i })).toBeInTheDocument();
    });

    it('應高亮當前選中的選項', () => {
      render(<TimeRangeFilter {...defaultProps} selectedDays={30} />);

      const button30 = screen.getByRole('button', { name: /30.*天/i });
      expect(button30).toHaveAttribute('aria-pressed', 'true');
    });

    it('未選中的選項不應高亮', () => {
      render(<TimeRangeFilter {...defaultProps} selectedDays={30} />);

      const button7 = screen.getByRole('button', { name: /7.*天/i });
      const button90 = screen.getByRole('button', { name: /90.*天/i });

      expect(button7).toHaveAttribute('aria-pressed', 'false');
      expect(button90).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('預設行為', () => {
    it('預設應選中 90 天', () => {
      render(<TimeRangeFilter {...defaultProps} selectedDays={90} />);

      const button90 = screen.getByRole('button', { name: /90.*天/i });
      expect(button90).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('切換事件', () => {
    it('點擊 7 天應觸發 onDaysChange(7)', async () => {
      const user = userEvent.setup();
      const onDaysChange = vi.fn();

      render(<TimeRangeFilter {...defaultProps} onDaysChange={onDaysChange} />);

      const button7 = screen.getByRole('button', { name: /7.*天/i });
      await user.click(button7);

      expect(onDaysChange).toHaveBeenCalledWith(7);
    });

    it('點擊 30 天應觸發 onDaysChange(30)', async () => {
      const user = userEvent.setup();
      const onDaysChange = vi.fn();

      render(<TimeRangeFilter {...defaultProps} onDaysChange={onDaysChange} />);

      const button30 = screen.getByRole('button', { name: /30.*天/i });
      await user.click(button30);

      expect(onDaysChange).toHaveBeenCalledWith(30);
    });

    it('點擊 90 天應觸發 onDaysChange(90)', async () => {
      const user = userEvent.setup();
      const onDaysChange = vi.fn();

      render(<TimeRangeFilter {...defaultProps} selectedDays={30} onDaysChange={onDaysChange} />);

      const button90 = screen.getByRole('button', { name: /90.*天/i });
      await user.click(button90);

      expect(onDaysChange).toHaveBeenCalledWith(90);
    });

    it('點擊已選中的選項不應再次觸發事件', async () => {
      const user = userEvent.setup();
      const onDaysChange = vi.fn();

      render(<TimeRangeFilter {...defaultProps} selectedDays={90} onDaysChange={onDaysChange} />);

      const button90 = screen.getByRole('button', { name: /90.*天/i });
      await user.click(button90);

      // 應該不觸發（因為已經是選中狀態）
      expect(onDaysChange).not.toHaveBeenCalled();
    });
  });

  describe('樣式和佈局', () => {
    it('應使用按鈕組樣式排列', () => {
      const { container } = render(<TimeRangeFilter {...defaultProps} />);

      // 應該有包含三個按鈕的容器
      const buttons = container.querySelectorAll('button');
      expect(buttons).toHaveLength(3);
    });

    it('選中的按鈕應有不同的視覺樣式', () => {
      render(<TimeRangeFilter {...defaultProps} selectedDays={30} />);

      const button30 = screen.getByRole('button', { name: /30.*天/i });
      const button7 = screen.getByRole('button', { name: /7.*天/i });

      // 選中的按鈕應有特殊 class（例如 bg-primary, text-primary-foreground）
      expect(button30.className).toContain('primary');
      expect(button7.className).not.toContain('primary');
    });
  });

  describe('無障礙性', () => {
    it('按鈕應有正確的 aria-pressed 屬性', () => {
      render(<TimeRangeFilter {...defaultProps} selectedDays={30} />);

      const button7 = screen.getByRole('button', { name: /7.*天/i });
      const button30 = screen.getByRole('button', { name: /30.*天/i });
      const button90 = screen.getByRole('button', { name: /90.*天/i });

      expect(button7).toHaveAttribute('aria-pressed', 'false');
      expect(button30).toHaveAttribute('aria-pressed', 'true');
      expect(button90).toHaveAttribute('aria-pressed', 'false');
    });

    it('應有描述性的組標籤', () => {
      const { container } = render(<TimeRangeFilter {...defaultProps} />);

      // 可能使用 fieldset + legend 或 div + aria-label
      expect(
        container.querySelector('[role="group"]') || container.querySelector('fieldset'),
      ).toBeInTheDocument();
    });
  });
});
