/**
 * API Keys Management Routes
 *
 * GET /api/apikeys - List user's API keys (T033)
 * POST /api/apikeys - Add new API key (T034)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';
import { logger } from '@/src/lib/logger';
import { apiKeySchema } from '@/src/lib/zod-schemas';
import { encrypt } from '@/src/lib/encryption';
import { apiKeyValidator } from '@/src/services/apikey/ApiKeyValidator';
import { auditLogRepository } from '@/src/repositories/AuditLogRepository';

const prisma = new PrismaClient();

/**
 * GET /api/apikeys
 * List user's API keys (FR-013)
 */
export async function GET(request: NextRequest) {
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

    const apiKeys = await prisma.apiKey.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        exchange: true,
        environment: true,
        label: true,
        isActive: true,
        lastValidatedAt: true,
        createdAt: true,
        updatedAt: true,
        // Don't expose encrypted keys
      },
      orderBy: { createdAt: 'desc' },
    });

    logger.info(
      { userId: session.user.id, count: apiKeys.length },
      'User fetched API keys',
    );

    return NextResponse.json({
      success: true,
      data: { apiKeys },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch API keys');
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch API keys' },
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/apikeys
 * Add new API key (FR-008, FR-009, FR-010, FR-012)
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();

    // Validate input
    const validation = apiKeySchema.safeParse(body);
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

    const data = validation.data;

    // Validate API key with exchange (FR-010)
    let validationResult;

    if (data.exchange === 'binance') {
      validationResult = await apiKeyValidator.validateBinanceKey(
        data.apiKey,
        data.apiSecret,
        data.environment,
      );
    } else {
      // okx
      validationResult = await apiKeyValidator.validateOkxKey(
        data.apiKey,
        data.apiSecret,
        data.passphrase,
        data.environment,
      );
    }

    if (!validationResult.isValid) {
      logger.warn(
        { userId: session.user.id, exchange: data.exchange, error: validationResult.error },
        'API key validation failed',
      );

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_API_KEY',
            message: validationResult.error || 'Invalid API key',
          },
        },
        { status: 400 },
      );
    }

    // Check permissions (FR-012)
    if (!validationResult.hasTradePermission) {
      logger.warn(
        { userId: session.user.id, exchange: data.exchange },
        'API key lacks trade permission',
      );

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'API key must have read and trade permissions',
          },
        },
        { status: 400 },
      );
    }

    // Encrypt API credentials (FR-011)
    const encryptedKey = encrypt(data.apiKey);
    const encryptedSecret = encrypt(data.apiSecret);
    const encryptedPassphrase = data.exchange === 'okx' ? encrypt(data.passphrase) : null;

    // Save to database
    const apiKey = await prisma.apiKey.create({
      data: {
        userId: session.user.id,
        exchange: data.exchange,
        environment: data.environment,
        label: data.label,
        encryptedKey,
        encryptedSecret,
        encryptedPassphrase,
        isActive: true,
        lastValidatedAt: new Date(),
      },
      select: {
        id: true,
        exchange: true,
        environment: true,
        label: true,
        isActive: true,
        lastValidatedAt: true,
        createdAt: true,
      },
    });

    // Log to audit trail (FR-053)
    await auditLogRepository.logApiKeyAdd(
      session.user.id,
      apiKey.id,
      data.exchange,
      request.headers.get('x-forwarded-for') || request.ip || undefined,
    );

    logger.info(
      { userId: session.user.id, apiKeyId: apiKey.id, exchange: data.exchange },
      'API key added successfully',
    );

    return NextResponse.json(
      {
        success: true,
        data: { apiKey },
      },
      { status: 201 },
    );
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to add API key');

    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DUPLICATE_API_KEY',
            message: 'An API key with this label already exists for this exchange',
          },
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to add API key' },
      },
      { status: 500 },
    );
  }
}
