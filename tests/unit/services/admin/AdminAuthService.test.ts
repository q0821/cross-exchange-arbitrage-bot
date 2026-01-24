/**
 * AdminAuthService Unit Tests (Feature 068)
 *
 * 測試管理員認證服務
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger first
vi.mock('@lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock bcrypt
const mockBcryptCompare = vi.fn();
vi.mock('bcrypt', () => ({
  default: {
    compare: (password: string, hash: string) => mockBcryptCompare(password, hash),
    hash: vi.fn().mockResolvedValue('$2b$10$hashedPassword'),
  },
  compare: (password: string, hash: string) => mockBcryptCompare(password, hash),
  hash: vi.fn().mockResolvedValue('$2b$10$hashedPassword'),
}));

// Mock generateToken
const mockGenerateToken = vi.fn();
vi.mock('@lib/jwt', () => ({
  generateToken: (payload: unknown) => mockGenerateToken(payload),
}));

// Mock prisma
const mockUserFindUnique = vi.fn();
const mockUserUpdate = vi.fn();
const mockAuditLogCreate = vi.fn();

vi.mock('@lib/db', () => ({
  prisma: {
    user: {
      findUnique: () => mockUserFindUnique(),
      update: (args: unknown) => mockUserUpdate(args),
    },
    auditLog: {
      create: (args: unknown) => mockAuditLogCreate(args),
    },
  },
}));

// Import after mocks
import {
  AdminAuthService,
  AdminLoginError,
  AdminAccountNotFoundError,
  AdminAccountLockedError,
  AdminAccountInactiveError,
} from '@services/admin/AdminAuthService';

describe('AdminAuthService (Feature 068)', () => {
  let service: AdminAuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminAuthService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // T008: Unit test for AdminAuthService
  // ===========================================================================

  describe('login', () => {
    const validAdminUser = {
      id: 'admin-123',
      email: 'admin@example.com',
      password: '$2b$10$hashedPassword',
      role: 'ADMIN' as const,
      isActive: true,
      tokenVersion: 1,
      failedLoginAttempts: 0,
      lockedUntil: null,
    };

    it('should throw AdminAccountNotFoundError when email not found', async () => {
      // Arrange
      mockUserFindUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.login('notfound@example.com', 'password123')
      ).rejects.toThrow(AdminAccountNotFoundError);
    });

    it('should throw AdminLoginError when account is not ADMIN role', async () => {
      // Arrange
      mockUserFindUnique.mockResolvedValue({
        ...validAdminUser,
        role: 'USER',
      });

      // Act & Assert
      await expect(
        service.login('user@example.com', 'password123')
      ).rejects.toThrow(AdminLoginError);
    });

    it('should throw AdminAccountInactiveError when account is suspended', async () => {
      // Arrange
      mockUserFindUnique.mockResolvedValue({
        ...validAdminUser,
        isActive: false,
      });

      // Act & Assert
      await expect(
        service.login('admin@example.com', 'password123')
      ).rejects.toThrow(AdminAccountInactiveError);
    });

    it('should throw AdminAccountLockedError when account is locked', async () => {
      // Arrange
      const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      mockUserFindUnique.mockResolvedValue({
        ...validAdminUser,
        lockedUntil: futureDate,
      });

      // Act & Assert
      await expect(
        service.login('admin@example.com', 'password123')
      ).rejects.toThrow(AdminAccountLockedError);
    });

    it('should unlock account when lockout period has expired', async () => {
      // Arrange
      const pastDate = new Date(Date.now() - 60 * 1000); // 1 minute ago
      mockUserFindUnique.mockResolvedValue({
        ...validAdminUser,
        lockedUntil: pastDate,
        failedLoginAttempts: 5,
      });
      mockBcryptCompare.mockResolvedValue(true);
      mockUserUpdate.mockResolvedValue(validAdminUser);
      mockGenerateToken.mockReturnValue('jwt-token-123');

      // Act
      const result = await service.login('admin@example.com', 'password123');

      // Assert
      expect(result.token).toBe('jwt-token-123');
      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginAttempts: 0,
            lockedUntil: null,
          }),
        })
      );
    });

    it('should throw AdminLoginError and increment failed attempts on wrong password', async () => {
      // Arrange
      mockUserFindUnique.mockResolvedValue({
        ...validAdminUser,
        failedLoginAttempts: 2,
      });
      mockBcryptCompare.mockResolvedValue(false);
      mockUserUpdate.mockResolvedValue({
        ...validAdminUser,
        failedLoginAttempts: 3,
      });

      // Act & Assert
      await expect(
        service.login('admin@example.com', 'wrongpassword')
      ).rejects.toThrow(AdminLoginError);

      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginAttempts: 3,
          }),
        })
      );
    });

    it('should lock account after MAX_FAILED_ATTEMPTS (5) failed logins', async () => {
      // Arrange
      mockUserFindUnique.mockResolvedValue({
        ...validAdminUser,
        failedLoginAttempts: 4, // 5th attempt will lock
      });
      mockBcryptCompare.mockResolvedValue(false);
      mockUserUpdate.mockResolvedValue({
        ...validAdminUser,
        failedLoginAttempts: 5,
        lockedUntil: new Date(),
      });

      // Act & Assert
      await expect(
        service.login('admin@example.com', 'wrongpassword')
      ).rejects.toThrow(AdminLoginError);

      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginAttempts: 5,
            lockedUntil: expect.any(Date),
          }),
        })
      );
    });

    it('should return token and user on successful login', async () => {
      // Arrange
      mockUserFindUnique.mockResolvedValue(validAdminUser);
      mockBcryptCompare.mockResolvedValue(true);
      mockUserUpdate.mockResolvedValue(validAdminUser);
      mockGenerateToken.mockReturnValue('jwt-token-success');

      // Act
      const result = await service.login('admin@example.com', 'correctpassword');

      // Assert
      expect(result.token).toBe('jwt-token-success');
      expect(result.user.id).toBe('admin-123');
      expect(result.user.email).toBe('admin@example.com');
      expect(result.user.role).toBe('ADMIN');
    });

    it('should reset failedLoginAttempts on successful login', async () => {
      // Arrange
      mockUserFindUnique.mockResolvedValue({
        ...validAdminUser,
        failedLoginAttempts: 3,
      });
      mockBcryptCompare.mockResolvedValue(true);
      mockUserUpdate.mockResolvedValue({
        ...validAdminUser,
        failedLoginAttempts: 0,
      });
      mockGenerateToken.mockReturnValue('jwt-token-success');

      // Act
      await service.login('admin@example.com', 'correctpassword');

      // Assert
      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginAttempts: 0,
            lockedUntil: null,
          }),
        })
      );
    });

    it('should create audit log on successful login', async () => {
      // Arrange
      mockUserFindUnique.mockResolvedValue(validAdminUser);
      mockBcryptCompare.mockResolvedValue(true);
      mockUserUpdate.mockResolvedValue(validAdminUser);
      mockGenerateToken.mockReturnValue('jwt-token-success');

      // Act
      await service.login('admin@example.com', 'correctpassword', '192.168.1.1');

      // Assert
      expect(mockAuditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'admin-123',
            action: 'ADMIN_LOGIN',
            ipAddress: '192.168.1.1',
          }),
        })
      );
    });

    it('should generate token with role in payload', async () => {
      // Arrange
      mockUserFindUnique.mockResolvedValue(validAdminUser);
      mockBcryptCompare.mockResolvedValue(true);
      mockUserUpdate.mockResolvedValue(validAdminUser);
      mockGenerateToken.mockReturnValue('jwt-token-with-role');

      // Act
      await service.login('admin@example.com', 'correctpassword');

      // Assert
      expect(mockGenerateToken).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-123',
          email: 'admin@example.com',
          tokenVersion: 1,
          role: 'ADMIN',
        })
      );
    });
  });

  describe('Error Classes', () => {
    it('AdminLoginError should have correct properties', () => {
      const error = new AdminLoginError('Test message');
      expect(error.code).toBe('ADMIN_LOGIN_ERROR');
      expect(error.statusCode).toBe(401);
    });

    it('AdminAccountNotFoundError should have correct properties', () => {
      const error = new AdminAccountNotFoundError();
      expect(error.code).toBe('ADMIN_ACCOUNT_NOT_FOUND');
      expect(error.statusCode).toBe(401);
    });

    it('AdminAccountLockedError should have correct properties', () => {
      const error = new AdminAccountLockedError(new Date(), 3600);
      expect(error.code).toBe('ADMIN_ACCOUNT_LOCKED');
      expect(error.statusCode).toBe(423);
    });

    it('AdminAccountInactiveError should have correct properties', () => {
      const error = new AdminAccountInactiveError();
      expect(error.code).toBe('ADMIN_ACCOUNT_INACTIVE');
      expect(error.statusCode).toBe(403);
    });
  });
});
