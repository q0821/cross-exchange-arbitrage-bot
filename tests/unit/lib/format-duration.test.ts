import { describe, it, expect } from 'vitest';
import { formatDuration } from '@/lib/format-duration';

describe('formatDuration', () => {
  describe('基本轉換', () => {
    it('應將毫秒轉換為「X 小時 Y 分鐘」格式', () => {
      // 1 小時 30 分鐘 = 5400000 毫秒
      expect(formatDuration(5400000)).toBe('1 小時 30 分鐘');

      // 2 小時 45 分鐘 = 9900000 毫秒
      expect(formatDuration(9900000)).toBe('2 小時 45 分鐘');

      // 只有小時
      expect(formatDuration(7200000)).toBe('2 小時');

      // 只有分鐘
      expect(formatDuration(1800000)).toBe('30 分鐘');
    });

    it('應正確處理單位為 1 的情況', () => {
      // 1 小時 1 分鐘
      expect(formatDuration(3660000)).toBe('1 小時 1 分鐘');

      // 1 小時
      expect(formatDuration(3600000)).toBe('1 小時');

      // 1 分鐘
      expect(formatDuration(60000)).toBe('1 分鐘');
    });
  });

  describe('邊界案例', () => {
    it('應處理 0 毫秒', () => {
      expect(formatDuration(0)).toBe('0 分鐘');
    });

    it('應處理小於 1 分鐘的時間（四捨五入到最近的分鐘）', () => {
      // 30 秒 → 1 分鐘
      expect(formatDuration(30000)).toBe('1 分鐘');

      // 10 秒 → 0 分鐘
      expect(formatDuration(10000)).toBe('0 分鐘');

      // 45 秒 → 1 分鐘
      expect(formatDuration(45000)).toBe('1 分鐘');
    });

    it('應處理超過 24 小時的時間', () => {
      // 25 小時 30 分鐘
      expect(formatDuration(91800000)).toBe('25 小時 30 分鐘');

      // 48 小時
      expect(formatDuration(172800000)).toBe('48 小時');

      // 100 小時 15 分鐘
      expect(formatDuration(360900000)).toBe('100 小時 15 分鐘');
    });

    it('應處理負數（回傳空字串或 0）', () => {
      expect(formatDuration(-1000)).toBe('0 分鐘');
    });
  });

  describe('精度處理', () => {
    it('應忽略秒數以下的精度', () => {
      // 1 小時 30 分鐘 45.678 秒 → 1 小時 31 分鐘（四捨五入）
      expect(formatDuration(5445678)).toBe('1 小時 31 分鐘');

      // 2 小時 0 分鐘 10 秒 → 2 小時（四捨五入後為整點）
      expect(formatDuration(7210000)).toBe('2 小時');
    });

    it('應正確四捨五入分鐘', () => {
      // 1 小時 29 分 59 秒 → 1 小時 30 分鐘
      expect(formatDuration(5399000)).toBe('1 小時 30 分鐘');

      // 1 小時 29 分 29 秒 → 1 小時 29 分鐘
      expect(formatDuration(5369000)).toBe('1 小時 29 分鐘');
    });
  });
});
