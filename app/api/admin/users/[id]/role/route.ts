/**
 * Admin Change User Role API (Feature 068)
 *
 * PATCH /api/admin/users/[id]/role - 變更用戶角色
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@lib/admin/middleware';
import { prisma } from '@lib/db';
import { logger } from '@lib/logger';
import type { JwtPayload } from '@lib/jwt';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const PATCH = withAdminAuth(async (request: NextRequest, admin: JwtPayload, context?: RouteContext) => {
  try {
    const params = await context!.params;
    const userId = params.id;
    const body = await request.json();
    const { role } = body;

    // 驗證角色值
    if (!role || !['USER', 'ADMIN'].includes(role)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_ROLE',
            message: 'Role must be USER or ADMIN',
          },
        },
        { status: 400 }
      );
    }

    // 查詢目標用戶
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        },
        { status: 404 }
      );
    }

    // 防止管理員降級自己
    if (userId === admin.userId && role === 'USER') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CANNOT_DEMOTE_SELF',
            message: 'Cannot demote your own account',
          },
        },
        { status: 400 }
      );
    }

    // 更新用戶角色
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    logger.info(
      { adminId: admin.userId, targetUserId: userId, newRole: role },
      'User role changed'
    );

    return NextResponse.json(
      {
        success: true,
        data: updatedUser,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error({ error }, 'Failed to change user role');

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to change user role',
        },
      },
      { status: 500 }
    );
  }
});
