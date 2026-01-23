/**
 * Admin Auth Middleware Unit Tests (Feature 068)
 *
 * 測試管理員認證中介軟體
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// Mock logger first
vi.mock('@lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock verifyToken
const mockVerifyToken = vi.fn();
vi.mock('@lib/jwt', () => ({
  verifyToken: (token: string) => mockVerifyToken(token),
}));

// Mock prisma
const mockPrismaUserFindUnique = vi.fn();
vi.mock('@lib/db', () => ({
  prisma: {
    user: {
      findUnique: () => mockPrismaUserFindUnique(),
    },
  },
}));

// Import after mocks
import { withAdminAuth, requireAdmin, AdminForbiddenError } from '@lib/admin/middleware';
import type { JwtPayload } from '@lib/jwt';

describe('Admin Auth Middleware (Feature 068)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Helper to create mock NextRequest
  function createMockRequest(token?: string): NextRequest {
    const headers = new Headers();
    if (token) {
      headers.set('Cookie', `token=${token}`);
    }
    return new NextRequest('http://localhost/api/admin/test', {
      method: 'GET',
      headers,
    });
  }

  // ===========================================================================
  // T007: Unit test for admin auth middleware
  // ===========================================================================

  describe('withAdminAuth', () => {
    it('should return 401 when no token provided', async () => {
      // Arrange
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ success: true }));
      const wrapped = withAdminAuth(handler);
      const request = createMockRequest(); // No token

      // Act
      const response = await wrapped(request);
      const body = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should return 401 when token is invalid', async () => {
      // Arrange
      mockVerifyToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ success: true }));
      const wrapped = withAdminAuth(handler);
      const request = createMockRequest('invalid-token');

      // Act
      const response = await wrapped(request);
      const body = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_TOKEN');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should return 403 when user role is USER (not ADMIN)', async () => {
      // Arrange
      const userPayload: JwtPayload = {
        userId: 'user-123',
        email: 'user@example.com',
        tokenVersion: 1,
        role: 'USER',
      };
      mockVerifyToken.mockReturnValue(userPayload);
      mockPrismaUserFindUnique.mockResolvedValue({
        id: 'user-123',
        role: 'USER',
        isActive: true,
        tokenVersion: 1,
      });

      const handler = vi.fn().mockResolvedValue(NextResponse.json({ success: true }));
      const wrapped = withAdminAuth(handler);
      const request = createMockRequest('valid-user-token');

      // Act
      const response = await wrapped(request);
      const body = await response.json();

      // Assert
      expect(response.status).toBe(403);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toContain('Admin');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should return 403 when admin account is inactive (isActive=false)', async () => {
      // Arrange
      const adminPayload: JwtPayload = {
        userId: 'admin-123',
        email: 'admin@example.com',
        tokenVersion: 1,
        role: 'ADMIN',
      };
      mockVerifyToken.mockReturnValue(adminPayload);
      mockPrismaUserFindUnique.mockResolvedValue({
        id: 'admin-123',
        role: 'ADMIN',
        isActive: false, // Account is suspended
        tokenVersion: 1,
      });

      const handler = vi.fn().mockResolvedValue(NextResponse.json({ success: true }));
      const wrapped = withAdminAuth(handler);
      const request = createMockRequest('valid-admin-token');

      // Act
      const response = await wrapped(request);
      const body = await response.json();

      // Assert
      expect(response.status).toBe(403);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('ACCOUNT_SUSPENDED');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should return 401 when tokenVersion mismatch (password changed)', async () => {
      // Arrange
      const adminPayload: JwtPayload = {
        userId: 'admin-123',
        email: 'admin@example.com',
        tokenVersion: 1, // Old token version
        role: 'ADMIN',
      };
      mockVerifyToken.mockReturnValue(adminPayload);
      mockPrismaUserFindUnique.mockResolvedValue({
        id: 'admin-123',
        role: 'ADMIN',
        isActive: true,
        tokenVersion: 2, // New token version (password was changed)
      });

      const handler = vi.fn().mockResolvedValue(NextResponse.json({ success: true }));
      const wrapped = withAdminAuth(handler);
      const request = createMockRequest('old-admin-token');

      // Act
      const response = await wrapped(request);
      const body = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('TOKEN_VERSION_MISMATCH');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should call handler when admin token is valid', async () => {
      // Arrange
      const adminPayload: JwtPayload = {
        userId: 'admin-123',
        email: 'admin@example.com',
        tokenVersion: 1,
        role: 'ADMIN',
      };
      mockVerifyToken.mockReturnValue(adminPayload);
      mockPrismaUserFindUnique.mockResolvedValue({
        id: 'admin-123',
        role: 'ADMIN',
        isActive: true,
        tokenVersion: 1,
      });

      const handler = vi.fn().mockResolvedValue(
        NextResponse.json({ success: true, data: 'admin-data' })
      );
      const wrapped = withAdminAuth(handler);
      const request = createMockRequest('valid-admin-token');

      // Act
      const response = await wrapped(request);
      const body = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toBe('admin-data');
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(request, adminPayload, undefined);
    });

    it('should return 404 when admin user not found in database', async () => {
      // Arrange
      const adminPayload: JwtPayload = {
        userId: 'deleted-admin',
        email: 'deleted@example.com',
        tokenVersion: 1,
        role: 'ADMIN',
      };
      mockVerifyToken.mockReturnValue(adminPayload);
      mockPrismaUserFindUnique.mockResolvedValue(null); // User deleted

      const handler = vi.fn().mockResolvedValue(NextResponse.json({ success: true }));
      const wrapped = withAdminAuth(handler);
      const request = createMockRequest('deleted-admin-token');

      // Act
      const response = await wrapped(request);
      const body = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_TOKEN');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('requireAdmin', () => {
    it('should throw AdminForbiddenError for USER role', () => {
      // Arrange
      const userPayload: JwtPayload = {
        userId: 'user-123',
        email: 'user@example.com',
        tokenVersion: 1,
        role: 'USER',
      };

      // Act & Assert
      expect(() => requireAdmin(userPayload)).toThrow(AdminForbiddenError);
    });

    it('should not throw for ADMIN role', () => {
      // Arrange
      const adminPayload: JwtPayload = {
        userId: 'admin-123',
        email: 'admin@example.com',
        tokenVersion: 1,
        role: 'ADMIN',
      };

      // Act & Assert
      expect(() => requireAdmin(adminPayload)).not.toThrow();
    });
  });

  describe('AdminForbiddenError', () => {
    it('should have correct properties', () => {
      // Act
      const error = new AdminForbiddenError();

      // Assert
      expect(error.code).toBe('FORBIDDEN');
      expect(error.statusCode).toBe(403);
      expect(error.message).toContain('Admin');
    });
  });
});
