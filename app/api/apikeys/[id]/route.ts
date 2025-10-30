/**
 * API Key Management - Individual Key Operations
 *
 * DELETE /api/apikeys/[id] - Delete API key (T035)
 * PATCH /api/apikeys/[id] - Update API key status (T036)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';
import { logger } from '@/src/lib/logger';
import { apiKeyUpdateSchema } from '@/src/lib/zod-schemas';
import { auditLogRepository } from '@/src/repositories/AuditLogRepository';

const prisma = new PrismaClient();

/**
 * DELETE /api/apikeys/[id]
 * Delete API key (FR-014)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        },
        { status: 401 },
      );
    }

    const { id } = params;

    // Verify ownership
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'API key not found' },
        },
        { status: 404 },
      );
    }

    // Delete API key
    await prisma.apiKey.delete({
      where: { id },
    });

    // Log to audit trail (FR-053)
    await auditLogRepository.logApiKeyDelete(
      session.user.id,
      id,
      apiKey.exchange,
      request.headers.get('x-forwarded-for') || request.ip || undefined,
    );

    logger.info(
      { userId: session.user.id, apiKeyId: id, exchange: apiKey.exchange },
      'API key deleted',
    );

    return NextResponse.json({
      success: true,
      data: { message: 'API key deleted successfully' },
    });
  } catch (error) {
    logger.error({ error, apiKeyId: params.id }, 'Failed to delete API key');
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to delete API key' },
      },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/apikeys/[id]
 * Update API key status (FR-015)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        },
        { status: 401 },
      );
    }

    const { id } = params;
    const body = await request.json();

    // Validate input
    const validation = apiKeyUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: validation.error.errors,
          },
        },
        { status: 400 },
      );
    }

    // Verify ownership
    const existingKey = await prisma.apiKey.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existingKey) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'API key not found' },
        },
        { status: 404 },
      );
    }

    // Update API key status
    const apiKey = await prisma.apiKey.update({
      where: { id },
      data: {
        isActive: validation.data.isActive,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        exchange: true,
        environment: true,
        label: true,
        isActive: true,
        lastValidatedAt: true,
        updatedAt: true,
      },
    });

    // Log to audit trail (FR-053)
    await auditLogRepository.logApiKeyStatusChange(
      session.user.id,
      id,
      validation.data.isActive,
      request.headers.get('x-forwarded-for') || request.ip || undefined,
    );

    logger.info(
      {
        userId: session.user.id,
        apiKeyId: id,
        isActive: validation.data.isActive,
      },
      'API key status updated',
    );

    return NextResponse.json({
      success: true,
      data: { apiKey },
    });
  } catch (error) {
    logger.error({ error, apiKeyId: params.id }, 'Failed to update API key');
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update API key' },
      },
      { status: 500 },
    );
  }
}
