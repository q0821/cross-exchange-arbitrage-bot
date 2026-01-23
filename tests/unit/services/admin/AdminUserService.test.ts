/**
 * AdminUserService Unit Tests (Feature 068)
 *
 * T030-T031: Unit tests for AdminUserService
 */

// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma
vi.mock('@lib/db', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    position: {
      count: vi.fn(),
    },
    trade: {
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    apiKey: {
      count: vi.fn(),
    },
    auditLog: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback({
      user: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      position: { count: vi.fn(), deleteMany: vi.fn() },
      trade: { count: vi.fn(), aggregate: vi.fn(), deleteMany: vi.fn() },
      apiKey: { count: vi.fn(), deleteMany: vi.fn() },
      auditLog: { findFirst: vi.fn(), create: vi.fn() },
    })),
  },
}));

import { prisma } from '@lib/db';
import { AdminUserService } from '@services/admin/AdminUserService';

// Type-safe mock references
const mockPrisma = prisma as unknown as {
  user: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  position: { count: ReturnType<typeof vi.fn> };
  trade: {
    count: ReturnType<typeof vi.fn>;
    aggregate: ReturnType<typeof vi.fn>;
  };
  apiKey: { count: ReturnType<typeof vi.fn> };
  auditLog: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

describe('AdminUserService (Feature 068)', () => {
  let service: AdminUserService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminUserService();
  });

  describe('listUsers (T030)', () => {
    const mockUsers = [
      {
        id: 'user-1',
        email: 'user1@example.com',
        role: 'USER',
        isActive: true,
        createdAt: new Date('2024-01-01'),
        _count: { positions: 2, trades: 5 },
      },
      {
        id: 'user-2',
        email: 'user2@example.com',
        role: 'USER',
        isActive: false,
        createdAt: new Date('2024-01-15'),
        _count: { positions: 0, trades: 10 },
      },
    ];

    it('should return paginated user list with default parameters', async () => {
      // Arrange
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);
      mockPrisma.user.count.mockResolvedValue(2);
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);

      // Act
      const result = await service.listUsers({});

      // Assert
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should filter users by search term (email)', async () => {
      // Arrange
      mockPrisma.user.findMany.mockResolvedValue([mockUsers[0]]);
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);

      // Act
      const result = await service.listUsers({ search: 'user1' });

      // Assert
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            email: expect.objectContaining({
              contains: 'user1',
            }),
          }),
        })
      );
      expect(result.items).toHaveLength(1);
    });

    it('should filter users by status (active only)', async () => {
      // Arrange
      mockPrisma.user.findMany.mockResolvedValue([mockUsers[0]]);
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);

      // Act
      const result = await service.listUsers({ status: 'active' });

      // Assert
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
          }),
        })
      );
      expect(result.items).toHaveLength(1);
    });

    it('should filter users by status (inactive only)', async () => {
      // Arrange
      mockPrisma.user.findMany.mockResolvedValue([mockUsers[1]]);
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);

      // Act
      await service.listUsers({ status: 'inactive' });

      // Assert
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: false,
          }),
        })
      );
    });

    it('should support pagination with page and limit', async () => {
      // Arrange
      mockPrisma.user.findMany.mockResolvedValue([mockUsers[1]]);
      mockPrisma.user.count.mockResolvedValue(50);
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);

      // Act
      const result = await service.listUsers({ page: 2, limit: 10 });

      // Assert
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10, // (page - 1) * limit
          take: 10,
        })
      );
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(5);
    });

    it('should support sorting by createdAt', async () => {
      // Arrange
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);
      mockPrisma.user.count.mockResolvedValue(2);
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);

      // Act
      await service.listUsers({ sortBy: 'createdAt', sortOrder: 'asc' });

      // Assert
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'asc' },
        })
      );
    });

    it('should include last login from audit log', async () => {
      // Arrange
      const lastLogin = new Date('2024-01-20');
      mockPrisma.user.findMany.mockResolvedValue([mockUsers[0]]);
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.auditLog.findFirst.mockResolvedValue({ createdAt: lastLogin });

      // Act
      const result = await service.listUsers({});

      // Assert
      expect(result.items[0].lastLoginAt).toEqual(lastLogin);
    });

    it('should return empty list when no users match', async () => {
      // Arrange
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      // Act
      const result = await service.listUsers({ search: 'nonexistent' });

      // Assert
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });

  describe('getUserDetail (T031)', () => {
    const mockUser = {
      id: 'user-1',
      email: 'user1@example.com',
      role: 'USER',
      isActive: true,
      createdAt: new Date('2024-01-01'),
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: new Date('2024-01-01'),
      timeBasisPreference: 8,
      _count: { positions: 2, trades: 5 },
    };

    it('should return user detail with all fields', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.apiKey.count.mockResolvedValue(3);
      mockPrisma.trade.aggregate.mockResolvedValue({
        _sum: { totalPnL: { toNumber: () => 1500.50 } },
      });
      mockPrisma.auditLog.findFirst.mockResolvedValue({ createdAt: new Date('2024-01-20') });

      // Act
      const result = await service.getUserDetail('user-1');

      // Assert
      expect(result).toMatchObject({
        id: 'user-1',
        email: 'user1@example.com',
        role: 'USER',
        isActive: true,
        positionCount: 2,
        tradeCount: 5,
        apiKeyCount: 3,
        totalPnL: '1500.50',
      });
    });

    it('should throw error when user not found', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getUserDetail('nonexistent')).rejects.toThrow('User not found');
    });

    it('should return zero totalPnL when no trades', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, _count: { positions: 0, trades: 0 } });
      mockPrisma.apiKey.count.mockResolvedValue(0);
      mockPrisma.trade.aggregate.mockResolvedValue({ _sum: { totalPnL: null } });
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);

      // Act
      const result = await service.getUserDetail('user-1');

      // Assert
      expect(result.totalPnL).toBe('0.00');
      expect(result.lastLoginAt).toBeUndefined();
    });
  });

  describe('createUser (T053)', () => {
    it('should create new user with generated password', async () => {
      // Arrange
      const mockCreatedUser = {
        id: 'new-user-1',
        email: 'newuser@example.com',
        role: 'USER',
        isActive: true,
        createdAt: new Date(),
        _count: { positions: 0, trades: 0 },
      };
      mockPrisma.user.findUnique.mockResolvedValue(null); // No existing user
      mockPrisma.user.create.mockResolvedValue(mockCreatedUser);
      mockPrisma.auditLog.create.mockResolvedValue({});

      // Act
      const result = await service.createUser({ email: 'newuser@example.com' }, 'admin-1');

      // Assert
      expect(result.user.email).toBe('newuser@example.com');
      expect(result.initialPassword).toBeDefined();
      expect(result.initialPassword.length).toBeGreaterThanOrEqual(12);
    });

    it('should throw error when email already exists', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      // Act & Assert
      await expect(
        service.createUser({ email: 'existing@example.com' }, 'admin-1')
      ).rejects.toThrow('Email already exists');
    });

    it('should throw error for invalid email format', async () => {
      // Act & Assert
      await expect(
        service.createUser({ email: 'invalid-email' }, 'admin-1')
      ).rejects.toThrow('Invalid email format');
    });
  });

  describe('updateUser (T062)', () => {
    it('should update user email', async () => {
      // Arrange
      const mockUser = {
        id: 'user-1',
        email: 'old@example.com',
        role: 'USER',
        isActive: true,
      };
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(mockUser) // Find user
        .mockResolvedValueOnce(null); // Check duplicate email
      mockPrisma.user.update.mockResolvedValue({
        ...mockUser,
        email: 'new@example.com',
        createdAt: new Date(),
        _count: { positions: 0, trades: 0 },
      });
      mockPrisma.auditLog.create.mockResolvedValue({});

      // Act
      const result = await service.updateUser('user-1', { email: 'new@example.com' }, 'admin-1');

      // Assert
      expect(result.email).toBe('new@example.com');
    });

    it('should throw error when updating to existing email', async () => {
      // Arrange
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: 'user-1', email: 'old@example.com' })
        .mockResolvedValueOnce({ id: 'user-2', email: 'existing@example.com' });

      // Act & Assert
      await expect(
        service.updateUser('user-1', { email: 'existing@example.com' }, 'admin-1')
      ).rejects.toThrow('Email already in use');
    });
  });

  describe('resetPassword (T063)', () => {
    it('should generate new password and increment tokenVersion', async () => {
      // Arrange
      const mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        tokenVersion: 1,
      };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, tokenVersion: 2 });
      mockPrisma.auditLog.create.mockResolvedValue({});

      // Act
      const result = await service.resetPassword('user-1', 'admin-1');

      // Assert
      expect(result.newPassword).toBeDefined();
      expect(result.newPassword.length).toBeGreaterThanOrEqual(12);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tokenVersion: { increment: 1 },
          }),
        })
      );
    });
  });

  describe('suspendUser (T073)', () => {
    it('should suspend user and increment tokenVersion', async () => {
      // Arrange
      const mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        isActive: true,
        tokenVersion: 1,
      };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.position.count.mockResolvedValue(0); // No active positions
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, isActive: false, tokenVersion: 2 });
      mockPrisma.auditLog.create.mockResolvedValue({});

      // Act
      const result = await service.suspendUser('user-1', { confirm: true }, 'admin-1');

      // Assert
      expect(result.isActive).toBe(false);
      expect(result.warning).toBeUndefined();
    });

    it('should return warning when user has active positions', async () => {
      // Arrange
      const mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        isActive: true,
        tokenVersion: 1,
      };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.position.count.mockResolvedValue(3); // Has active positions
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, isActive: false, tokenVersion: 2 });
      mockPrisma.auditLog.create.mockResolvedValue({});

      // Act
      const result = await service.suspendUser('user-1', { confirm: true }, 'admin-1');

      // Assert
      expect(result.isActive).toBe(false);
      expect(result.warning).toContain('3');
    });

    it('should throw error when confirm is false', async () => {
      // Act & Assert
      await expect(
        service.suspendUser('user-1', { confirm: false }, 'admin-1')
      ).rejects.toThrow('Confirmation required');
    });
  });

  describe('enableUser (T074)', () => {
    it('should enable suspended user', async () => {
      // Arrange
      const mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        isActive: false,
      };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, isActive: true });
      mockPrisma.auditLog.create.mockResolvedValue({});

      // Act
      const result = await service.enableUser('user-1', 'admin-1');

      // Assert
      expect(result.isActive).toBe(true);
    });
  });

  describe('deleteUser (T096)', () => {
    it('should delete user with no active positions', async () => {
      // Arrange
      const mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        role: 'USER',
      };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.position.count.mockResolvedValue(0); // No active positions

      // Act
      await service.deleteUser('user-1', { confirmText: 'DELETE' }, 'admin-1');

      // Assert
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1' } })
      );
    });

    it('should throw error when user has active positions', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'USER' });
      mockPrisma.position.count.mockResolvedValue(2);

      // Act & Assert
      await expect(
        service.deleteUser('user-1', { confirmText: 'DELETE' }, 'admin-1')
      ).rejects.toThrow('Cannot delete user with active positions');
    });

    it('should throw error when confirmText is incorrect', async () => {
      // Act & Assert
      await expect(
        service.deleteUser('user-1', { confirmText: 'delete' }, 'admin-1')
      ).rejects.toThrow('Invalid confirmation');
    });

    it('should prevent admin from deleting themselves', async () => {
      // Act & Assert
      await expect(
        service.deleteUser('admin-1', { confirmText: 'DELETE' }, 'admin-1')
      ).rejects.toThrow('Cannot delete yourself');
    });
  });
});
