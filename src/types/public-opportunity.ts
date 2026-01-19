/**
 * 套利機會狀態
 */
export type OpportunityStatus = 'ACTIVE' | 'ENDED';

/**
 * 公開套利機會 DTO (去識別化)
 * 用於公開首頁展示，不包含用戶相關資訊
 */
export interface PublicOpportunityDTO {
  /** 套利機會 ID */
  id: string;
  /** 交易對 (如 BTCUSDT) */
  symbol: string;
  /** 多方交易所 */
  longExchange: string;
  /** 空方交易所 */
  shortExchange: string;
  /** 機會狀態 */
  status: OpportunityStatus;
  /** 最大費差 (4 位小數) */
  maxSpread: number;
  /** 當前/最終費差 (4 位小數) */
  currentSpread: number;
  /** 當前/實現年化報酬率 (%) */
  currentAPY: number;
  /** 持續時間 (毫秒) - ACTIVE 時為 null */
  durationMs: number | null;
  /** 機會發現時間 */
  appearedAt: Date;
  /** 機會消失時間 - ACTIVE 時為 null */
  disappearedAt: Date | null;
}

/**
 * 公開 API 分頁回應
 */
export interface PublicOpportunitiesResponse {
  /** 套利機會列表 */
  data: PublicOpportunityDTO[];
  /** 分頁資訊 */
  pagination: {
    /** 當前頁碼 */
    page: number;
    /** 每頁筆數 */
    limit: number;
    /** 總筆數 */
    total: number;
    /** 總頁數 */
    totalPages: number;
  };
  /** 篩選條件 */
  filter: {
    /** 時間範圍（天數） */
    days: number;
  };
}

/**
 * 公開 API 查詢參數
 */
export interface PublicOpportunityQueryParams {
  /** 頁碼 (預設: 1) */
  page?: number;
  /** 每頁筆數 (預設: 20, 最大: 100) */
  limit?: number;
  /** 時間範圍：7/30/90 天 (預設: 90) */
  days?: 7 | 30 | 90;
}
