/**
 * Admin Dashboard API (Feature 068)
 *
 * GET /api/admin/dashboard - 獲取儀表板統計資料
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@lib/admin/middleware';
import { AdminDashboardService } from '@services/admin/AdminDashboardService';
import { logger } from '@lib/logger';

const dashboardService = new AdminDashboardService();

export const GET = withAdminAuth(async (_request: NextRequest) => {
  try {
    const stats = await dashboardService.getDashboardStats();

    return NextResponse.json(
      {
        success: true,
        data: stats,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error({ error }, 'Failed to fetch dashboard stats');

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch dashboard statistics',
        },
      },
      { status: 500 }
    );
  }
});
