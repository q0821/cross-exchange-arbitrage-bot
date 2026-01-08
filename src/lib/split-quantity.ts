/**
 * split-quantity.ts - 數量分配工具函式
 *
 * Feature 060: Split Position Open (分單開倉)
 *
 * 將總數量按指定組數分配，採用「大組優先」策略
 * 餘數分配給第一組，確保數量差異最小化
 */

/**
 * 將總數量分配到指定組數
 *
 * @param total - 總數量
 * @param count - 組數 (1-10)
 * @returns 每組數量的陣列
 *
 * @example
 * splitQuantity(600, 2) // [300, 300]
 * splitQuantity(100, 3) // [34, 33, 33]
 * splitQuantity(100, 1) // [100]
 */
export function splitQuantity(total: number, count: number): number[] {
  // 邊界條件：組數為 1 時直接返回原數量
  if (count <= 1) {
    return [total];
  }

  // 使用高精度計算避免浮點數誤差
  // 先放大 10000 倍計算，再縮小回來
  const PRECISION = 10000;
  const scaledTotal = Math.round(total * PRECISION);
  const base = Math.floor(scaledTotal / count);
  const remainder = scaledTotal - base * count;

  // 建立結果陣列：第一組加上餘數，其餘使用基本數量
  const result: number[] = [];

  for (let i = 0; i < count; i++) {
    if (i < remainder) {
      // 前 remainder 組多分配 1 單位（放大後的單位）
      result.push((base + 1) / PRECISION);
    } else {
      result.push(base / PRECISION);
    }
  }

  return result;
}

/**
 * 驗證分配結果的總和是否等於原始數量
 * 用於測試和除錯
 */
export function validateSplitQuantity(
  total: number,
  quantities: number[]
): boolean {
  const EPSILON = 1e-10;
  const sum = quantities.reduce((acc, q) => acc + q, 0);
  return Math.abs(sum - total) < EPSILON;
}
