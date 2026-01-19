/**
 * 全域常數定義
 *
 * Feature 022: 年化收益門檻套利機會偵測
 */

// ============================================================================
// 套利機會偵測門檻
// ============================================================================

/**
 * 預設年化收益門檻（百分比）
 * 當年化收益 >= 此值時，判定為套利機會
 *
 * 預設值: 800% 年化收益
 */
export const DEFAULT_OPPORTUNITY_THRESHOLD_ANNUALIZED = 800;

/**
 * 「接近機會」門檻比例
 * approachingThreshold = mainThreshold × APPROACHING_THRESHOLD_RATIO
 *
 * 預設: 75%，即主門檻的 75%
 * 例如：主門檻 800% → 接近門檻 600%
 */
export const APPROACHING_THRESHOLD_RATIO = 0.75;

/**
 * 環境變數名稱：年化收益門檻
 */
export const ENV_OPPORTUNITY_THRESHOLD_ANNUALIZED = 'OPPORTUNITY_THRESHOLD_ANNUALIZED';

// ============================================================================
// Feature 065: ArbitrageOpportunityTracker 專用常數
// ============================================================================

/**
 * ArbitrageOpportunityTracker 機會發現門檻（百分比）
 *
 * Feature 065 獨立的生命週期邏輯，不依賴其他服務的閾值設定
 * 當年化收益 >= 此值時，判定為套利機會並記錄
 *
 * 預設值: 800% 年化收益
 */
export const TRACKER_OPPORTUNITY_THRESHOLD = 800;

/**
 * ArbitrageOpportunityTracker 機會結束門檻（百分比）
 *
 * Feature 065 獨立的生命週期邏輯
 * 當年化收益 < 此值時，判定機會結束
 *
 * 預設值: 0%（只有當 APY 變為負值時才結束）
 */
export const TRACKER_OPPORTUNITY_END_THRESHOLD = 0;

// ============================================================================
// 時間基準相關常數
// ============================================================================

/**
 * 支援的時間基準（小時）
 */
export const SUPPORTED_TIME_BASES = [1, 4, 8, 24] as const;

/**
 * 預設時間基準（小時）
 */
export const DEFAULT_TIME_BASIS = 8;

/**
 * 每年天數（用於年化收益計算）
 */
export const DAYS_PER_YEAR = 365;

/**
 * 每天小時數
 */
export const HOURS_PER_DAY = 24;
