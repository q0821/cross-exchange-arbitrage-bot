/**
 * Admin Dashboard Types (Feature 068)
 */

import type { UserRole, PositionWebStatus, TradeWebStatus } from '@/generated/prisma/client';

// ===== Dashboard Statistics =====

export interface DashboardStats {
  users: UserStats;
  positions: PositionStats;
  trades: TradeStats;
}

export interface UserStats {
  total: number;
  active: number;
  inactive: number;
  todayNew: number;
  weekActive: number; // 過去 7 天有登入的用戶數
  monthActive: number; // 過去 30 天有登入的用戶數
}

export interface PositionStats {
  activeCount: number;
  byExchange: Record<string, number>; // { binance: 10, okx: 5, ... }
}

export interface TradeStats {
  closedCount: number;
  totalPnL: string; // Decimal string
  averageROI: string; // Decimal string (%)
  todayCount: number;
  todayPnL: string; // Decimal string
}

// ===== User List & Detail =====

export interface AdminUserListItem {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt?: Date; // 從 AuditLog 查詢
  positionCount: number; // 活躍持倉數
  tradeCount: number; // 總交易數
}

export interface AdminUserDetail extends AdminUserListItem {
  failedLoginAttempts: number;
  lockedUntil?: Date;
  passwordChangedAt?: Date;
  timeBasisPreference: number;
  apiKeyCount: number;
  totalPnL: string; // 總損益
}

export interface AdminUserListQuery {
  page?: number; // 預設 1
  limit?: number; // 預設 20
  search?: string; // email 搜尋
  status?: 'all' | 'active' | 'inactive';
  sortBy?: 'createdAt' | 'email';
  sortOrder?: 'asc' | 'desc';
}

export interface AdminUserListResponse {
  items: AdminUserListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ===== User Management Operations =====

export interface CreateUserRequest {
  email: string;
  role?: UserRole; // 預設 USER
}

export interface CreateUserResponse {
  user: AdminUserListItem;
  initialPassword: string; // 自動產生的初始密碼
}

export interface UpdateUserRequest {
  email?: string;
}

export interface ResetPasswordResponse {
  newPassword: string; // 自動產生的新密碼
}

export interface SuspendUserRequest {
  confirm: boolean; // 必須明確確認
}

export interface SuspendUserResponse {
  id: string;
  isActive: boolean;
  warning?: string; // 有活躍持倉時的警告訊息
}

export interface DeleteUserRequest {
  confirmText: string; // 必須輸入 "DELETE"
}

// ===== Trade List =====

export interface AdminTradeListItem {
  id: string;
  userId: string;
  userEmail: string;
  symbol: string;
  longExchange: string;
  shortExchange: string;
  openedAt: Date;
  closedAt: Date;
  holdingDuration: number; // seconds
  priceDiffPnL: string;
  fundingRatePnL: string;
  totalPnL: string;
  roi: string;
  status: TradeWebStatus;
}

export interface AdminTradeListQuery {
  page?: number;
  limit?: number;
  userId?: string;
  symbol?: string;
  startDate?: Date;
  endDate?: Date;
  sortBy?: 'closedAt' | 'totalPnL';
  sortOrder?: 'asc' | 'desc';
}

export interface AdminTradeListResponse {
  items: AdminTradeListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ===== Position Detail (with open funding rates) =====

export interface AdminPositionDetail {
  id: string;
  userId: string;
  userEmail: string;
  symbol: string;
  status: PositionWebStatus;

  // 開倉資訊
  longExchange: string;
  longEntryPrice: string;
  longPositionSize: string;
  longLeverage: number;
  shortExchange: string;
  shortEntryPrice: string;
  shortPositionSize: string;
  shortLeverage: number;

  // 開倉時資金費率 (spec 明確要求)
  openFundingRateLong: string;
  openFundingRateShort: string;

  // 停損停利
  stopLossEnabled: boolean;
  stopLossPercent?: string;
  takeProfitEnabled: boolean;
  takeProfitPercent?: string;

  // 時間
  openedAt?: Date;
  closedAt?: Date;
  createdAt: Date;

  // 平倉資訊（如果已平倉）
  trade?: {
    longExitPrice: string;
    shortExitPrice: string;
    priceDiffPnL: string;
    fundingRatePnL: string;
    totalPnL: string;
    roi: string;
    holdingDuration: number;
  };
}

// ===== User Positions Query =====

export interface AdminUserPositionsQuery {
  page?: number;
  limit?: number;
  status?: 'all' | 'open' | 'closed';
  startDate?: Date;
  endDate?: Date;
}

export interface AdminUserPositionsResponse {
  positions: AdminPositionDetail[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ===== Audit Log Types =====

export type AdminAuditAction =
  | 'ADMIN_USER_CREATE'
  | 'ADMIN_USER_UPDATE'
  | 'ADMIN_USER_SUSPEND'
  | 'ADMIN_USER_ENABLE'
  | 'ADMIN_USER_DELETE'
  | 'ADMIN_USER_RESET_PASSWORD'
  | 'ADMIN_TRADE_EXPORT';

export interface AdminUserCreateDetails {
  targetUserId: string;
  targetEmail: string;
  role: UserRole;
}

export interface AdminUserUpdateDetails {
  targetUserId: string;
  changes: {
    email?: { from: string; to: string };
  };
}

export interface AdminUserSuspendDetails {
  targetUserId: string;
  targetEmail: string;
  hadActivePositions: boolean;
  confirmedWithWarning: boolean;
}

export interface AdminUserDeleteDetails {
  targetUserId: string;
  targetEmail: string;
  relatedDataDeleted: {
    positions: number;
    trades: number;
    apiKeys: number;
  };
}

export interface AdminUserResetPasswordDetails {
  targetUserId: string;
  targetEmail: string;
}

export interface AdminTradeExportDetails {
  filters: AdminTradeListQuery;
  exportedCount: number;
}

// ===== Admin Login =====

export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface AdminLoginResponse {
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
}
