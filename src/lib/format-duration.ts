/**
 * 將毫秒轉換為人類可讀的時間格式
 * @param ms - 毫秒數
 * @returns 格式化字串，例如 "1 小時 30 分鐘"
 */
export function formatDuration(ms: number): string {
  // 處理負數和 0
  if (ms <= 0) {
    return '0 分鐘';
  }

  // 轉換為分鐘（四捨五入）
  const totalMinutes = Math.round(ms / 60000);

  // 計算小時和分鐘
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  // 格式化輸出
  if (hours > 0 && minutes > 0) {
    return `${hours} 小時 ${minutes} 分鐘`;
  } else if (hours > 0) {
    return `${hours} 小時`;
  } else {
    return `${minutes} 分鐘`;
  }
}
