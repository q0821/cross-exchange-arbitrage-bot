/**
 * GET /api/auth/me
 *
 * Returns current authenticated user information (FR-005, T032)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../[...nextauth]/route';
import { PrismaClient } from '@prisma/client';
import { logger } from '@/src/lib/logger';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Get session
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Not authenticated',
          },
        },
        { status: 401 },
      );
    }

    // Fetch user details from database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        // Don't expose password
      },
    });

    if (!user) {
      logger.error(
        { userId: session.user.id },
        'Session user not found in database',
      );
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        },
        { status: 404 },
      );
    }

    logger.info({ userId: user.id }, 'User fetched current user info');

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch current user');
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch user information',
        },
      },
      { status: 500 },
    );
  }
}
