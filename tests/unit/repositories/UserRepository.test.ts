/**
 * Test: UserRepository
 *
 * 用戶 Repository 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRepository } from '@/repositories/UserRepository';
import { User } from '@models/User';
import { DatabaseError, NotFoundError } from '@lib/errors';

// Mock logger
vi.mock('@lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('UserRepository', () => {
  let repository: UserRepository;
  let mockPrisma: any;

  const mockUserData = {
    id: 'user-123',
    email: 'test@example.com',
    password: 'hashed-password',
    failedLoginAttempts: 0,
    lockedUntil: null,
    tokenVersion: 0,
    passwordChangedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      user: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
    };

    repository = new UserRepository(mockPrisma);
  });

  describe('findById', () => {
    it('should return User when found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUserData);

      const result = await repository.findById('user-123');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
      expect(result).toBeInstanceOf(User);
      expect(result?.id).toBe('user-123');
    });

    it('should return null when not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on database failure', async () => {
      mockPrisma.user.findUnique.mockRejectedValue(new Error('DB error'));

      await expect(repository.findById('user-123')).rejects.toThrow(DatabaseError);
    });
  });

  describe('findByEmail', () => {
    it('should return User when found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUserData);

      const result = await repository.findByEmail('TEST@EXAMPLE.COM');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' }, // Should be lowercased
      });
      expect(result).toBeInstanceOf(User);
    });

    it('should return null when not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await repository.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on database failure', async () => {
      mockPrisma.user.findUnique.mockRejectedValue(new Error('DB error'));

      await expect(repository.findByEmail('test@example.com')).rejects.toThrow(DatabaseError);
    });
  });

  describe('create', () => {
    it('should create User successfully', async () => {
      mockPrisma.user.create.mockResolvedValue(mockUserData);

      const result = await repository.create(
        { email: 'TEST@EXAMPLE.COM', password: 'plaintext' },
        'hashed-password',
      );

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com', // Should be lowercased
          password: 'hashed-password',
        },
      });
      expect(result).toBeInstanceOf(User);
    });

    it('should throw DatabaseError on unique constraint violation', async () => {
      mockPrisma.user.create.mockRejectedValue(new Error('Unique constraint failed'));

      await expect(
        repository.create({ email: 'existing@example.com', password: 'pass' }, 'hash'),
      ).rejects.toThrow(DatabaseError);
    });

    it('should throw DatabaseError on other errors', async () => {
      mockPrisma.user.create.mockRejectedValue(new Error('Connection failed'));

      await expect(
        repository.create({ email: 'test@example.com', password: 'pass' }, 'hash'),
      ).rejects.toThrow(DatabaseError);
    });
  });

  describe('update', () => {
    it('should update User successfully', async () => {
      const updatedData = { ...mockUserData, email: 'updated@example.com' };
      mockPrisma.user.update.mockResolvedValue(updatedData);

      const result = await repository.update('user-123', { email: 'updated@example.com' });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { email: 'updated@example.com' },
      });
      expect(result).toBeInstanceOf(User);
    });

    it('should throw NotFoundError when record not found', async () => {
      mockPrisma.user.update.mockRejectedValue(new Error('Record to update not found'));

      await expect(repository.update('nonexistent', { email: 'test@example.com' })).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should throw DatabaseError on other errors', async () => {
      mockPrisma.user.update.mockRejectedValue(new Error('DB error'));

      await expect(repository.update('user-123', { email: 'test@example.com' })).rejects.toThrow(
        DatabaseError,
      );
    });
  });

  describe('delete', () => {
    it('should delete User successfully', async () => {
      mockPrisma.user.delete.mockResolvedValue(mockUserData);

      await repository.delete('user-123');

      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
    });

    it('should throw NotFoundError when record not found', async () => {
      mockPrisma.user.delete.mockRejectedValue(new Error('Record to delete does not exist'));

      await expect(repository.delete('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw DatabaseError on other errors', async () => {
      mockPrisma.user.delete.mockRejectedValue(new Error('DB error'));

      await expect(repository.delete('user-123')).rejects.toThrow(DatabaseError);
    });
  });

  describe('emailExists', () => {
    it('should return true when email exists', async () => {
      mockPrisma.user.count.mockResolvedValue(1);

      const result = await repository.emailExists('TEST@EXAMPLE.COM');

      expect(mockPrisma.user.count).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(result).toBe(true);
    });

    it('should return false when email does not exist', async () => {
      mockPrisma.user.count.mockResolvedValue(0);

      const result = await repository.emailExists('nonexistent@example.com');

      expect(result).toBe(false);
    });

    it('should throw DatabaseError on database failure', async () => {
      mockPrisma.user.count.mockRejectedValue(new Error('DB error'));

      await expect(repository.emailExists('test@example.com')).rejects.toThrow(DatabaseError);
    });
  });

  describe('findAll', () => {
    it('should return array of Users with default pagination', async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockUserData, { ...mockUserData, id: 'user-456' }]);

      const result = await repository.findAll();

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        take: 100,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(2);
      result.forEach((user) => expect(user).toBeInstanceOf(User));
    });

    it('should return array of Users with custom pagination', async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockUserData]);

      const result = await repository.findAll(10, 20);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        take: 10,
        skip: 20,
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });

    it('should throw DatabaseError on database failure', async () => {
      mockPrisma.user.findMany.mockRejectedValue(new Error('DB error'));

      await expect(repository.findAll()).rejects.toThrow(DatabaseError);
    });
  });

  // Account locking methods (Feature 061)
  describe('incrementFailedAttempts', () => {
    it('should increment and return new count', async () => {
      mockPrisma.user.update.mockResolvedValue({ failedLoginAttempts: 3 });

      const result = await repository.incrementFailedAttempts('user-123');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { failedLoginAttempts: { increment: 1 } },
        select: { failedLoginAttempts: true },
      });
      expect(result).toBe(3);
    });

    it('should throw DatabaseError on failure', async () => {
      mockPrisma.user.update.mockRejectedValue(new Error('DB error'));

      await expect(repository.incrementFailedAttempts('user-123')).rejects.toThrow(DatabaseError);
    });
  });

  describe('resetFailedAttempts', () => {
    it('should reset failed attempts and clear lock', async () => {
      mockPrisma.user.update.mockResolvedValue(mockUserData);

      await repository.resetFailedAttempts('user-123');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    });

    it('should throw DatabaseError on failure', async () => {
      mockPrisma.user.update.mockRejectedValue(new Error('DB error'));

      await expect(repository.resetFailedAttempts('user-123')).rejects.toThrow(DatabaseError);
    });
  });

  describe('lockAccount', () => {
    it('should lock account until specified time', async () => {
      const lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      mockPrisma.user.update.mockResolvedValue({ ...mockUserData, lockedUntil });

      await repository.lockAccount('user-123', lockedUntil);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { lockedUntil },
      });
    });

    it('should throw DatabaseError on failure', async () => {
      mockPrisma.user.update.mockRejectedValue(new Error('DB error'));

      await expect(repository.lockAccount('user-123', new Date())).rejects.toThrow(DatabaseError);
    });
  });

  describe('unlockAccount', () => {
    it('should unlock account and reset failed attempts', async () => {
      mockPrisma.user.update.mockResolvedValue(mockUserData);

      await repository.unlockAccount('user-123');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          lockedUntil: null,
          failedLoginAttempts: 0,
        },
      });
    });

    it('should throw DatabaseError on failure', async () => {
      mockPrisma.user.update.mockRejectedValue(new Error('DB error'));

      await expect(repository.unlockAccount('user-123')).rejects.toThrow(DatabaseError);
    });
  });

  describe('isAccountLocked', () => {
    it('should return isLocked=false when lockedUntil is null', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ lockedUntil: null });

      const result = await repository.isAccountLocked('user-123');

      expect(result).toEqual({ isLocked: false, lockedUntil: null });
    });

    it('should return isLocked=false when lockedUntil is in the past', async () => {
      const pastDate = new Date(Date.now() - 1000);
      mockPrisma.user.findUnique.mockResolvedValue({ lockedUntil: pastDate });

      const result = await repository.isAccountLocked('user-123');

      expect(result).toEqual({ isLocked: false, lockedUntil: pastDate });
    });

    it('should return isLocked=true when lockedUntil is in the future', async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      mockPrisma.user.findUnique.mockResolvedValue({ lockedUntil: futureDate });

      const result = await repository.isAccountLocked('user-123');

      expect(result).toEqual({ isLocked: true, lockedUntil: futureDate });
    });

    it('should throw NotFoundError when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(repository.isAccountLocked('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw DatabaseError on database failure', async () => {
      mockPrisma.user.findUnique.mockRejectedValue(new Error('DB error'));

      await expect(repository.isAccountLocked('user-123')).rejects.toThrow(DatabaseError);
    });
  });

  describe('getLockStatus', () => {
    it('should return full lock status', async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      mockPrisma.user.findUnique.mockResolvedValue({
        lockedUntil: futureDate,
        failedLoginAttempts: 5,
      });

      const result = await repository.getLockStatus('user-123');

      expect(result).toEqual({
        isLocked: true,
        lockedUntil: futureDate,
        failedAttempts: 5,
      });
    });

    it('should return isLocked=false when not locked', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        lockedUntil: null,
        failedLoginAttempts: 2,
      });

      const result = await repository.getLockStatus('user-123');

      expect(result).toEqual({
        isLocked: false,
        lockedUntil: null,
        failedAttempts: 2,
      });
    });

    it('should throw NotFoundError when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(repository.getLockStatus('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // Password management methods (Feature 061)
  describe('updatePassword', () => {
    it('should update password and increment tokenVersion', async () => {
      mockPrisma.user.update.mockResolvedValue(mockUserData);

      await repository.updatePassword('user-123', 'new-hashed-password');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          password: 'new-hashed-password',
          tokenVersion: { increment: 1 },
          passwordChangedAt: expect.any(Date),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    });

    it('should throw DatabaseError on failure', async () => {
      mockPrisma.user.update.mockRejectedValue(new Error('DB error'));

      await expect(repository.updatePassword('user-123', 'new-hash')).rejects.toThrow(DatabaseError);
    });
  });

  describe('getTokenVersion', () => {
    it('should return tokenVersion', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ tokenVersion: 5 });

      const result = await repository.getTokenVersion('user-123');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: { tokenVersion: true },
      });
      expect(result).toBe(5);
    });

    it('should throw NotFoundError when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(repository.getTokenVersion('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw DatabaseError on database failure', async () => {
      mockPrisma.user.findUnique.mockRejectedValue(new Error('DB error'));

      await expect(repository.getTokenVersion('user-123')).rejects.toThrow(DatabaseError);
    });
  });
});
