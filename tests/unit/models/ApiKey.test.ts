/**
 * Test: ApiKey Model
 *
 * API Key 領域模型單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiKey } from '@/models/ApiKey';
import type { ApiKey as PrismaApiKey } from '@/generated/prisma/client';

describe('ApiKey Model', () => {
  const createMockPrismaApiKey = (overrides: Partial<PrismaApiKey> = {}): PrismaApiKey => ({
    id: 'api-key-123',
    userId: 'user-123',
    exchange: 'binance',
    environment: 'MAINNET',
    label: 'Main Account',
    encryptedKey: 'encrypted-key-abc',
    encryptedSecret: 'encrypted-secret-xyz',
    encryptedPassphrase: null,
    isActive: true,
    lastValidatedAt: new Date('2024-01-15T10:00:00Z'),
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
    ...overrides,
  });

  describe('constructor', () => {
    it('should create ApiKey from PrismaApiKey', () => {
      const prismaApiKey = createMockPrismaApiKey();
      const apiKey = new ApiKey(prismaApiKey);

      expect(apiKey.id).toBe('api-key-123');
      expect(apiKey.userId).toBe('user-123');
      expect(apiKey.exchange).toBe('binance');
      expect(apiKey.environment).toBe('MAINNET');
      expect(apiKey.label).toBe('Main Account');
      expect(apiKey.encryptedKey).toBe('encrypted-key-abc');
      expect(apiKey.encryptedSecret).toBe('encrypted-secret-xyz');
      expect(apiKey.encryptedPassphrase).toBeNull();
      expect(apiKey.isActive).toBe(true);
      expect(apiKey.lastValidatedAt).toEqual(new Date('2024-01-15T10:00:00Z'));
    });

    it('should handle passphrase', () => {
      const prismaApiKey = createMockPrismaApiKey({
        encryptedPassphrase: 'encrypted-passphrase',
      });
      const apiKey = new ApiKey(prismaApiKey);

      expect(apiKey.encryptedPassphrase).toBe('encrypted-passphrase');
    });
  });

  describe('getMaskedKey', () => {
    it('should mask key showing first 4 and last 4 characters', () => {
      const apiKey = new ApiKey(createMockPrismaApiKey());
      const decryptedKey = 'abcdefghij1234567890';

      const masked = apiKey.getMaskedKey(decryptedKey);

      expect(masked).toBe('abcd********7890');
    });

    it('should return **** for short keys (<=8 chars)', () => {
      const apiKey = new ApiKey(createMockPrismaApiKey());

      expect(apiKey.getMaskedKey('12345678')).toBe('****');
      expect(apiKey.getMaskedKey('1234567')).toBe('****');
      expect(apiKey.getMaskedKey('a')).toBe('****');
    });

    it('should handle keys slightly longer than 8 characters', () => {
      const apiKey = new ApiKey(createMockPrismaApiKey());

      // 9 characters: show 4 + 1 asterisk + 4
      expect(apiKey.getMaskedKey('123456789')).toBe('1234*6789');

      // 10 characters: show 4 + 2 asterisks + 4
      expect(apiKey.getMaskedKey('1234567890')).toBe('1234**7890');
    });

    it('should cap mask length at 8 asterisks', () => {
      const apiKey = new ApiKey(createMockPrismaApiKey());
      const longKey = 'a'.repeat(100);

      const masked = apiKey.getMaskedKey(longKey);

      // 4 + 8 asterisks + 4 = 16 characters
      expect(masked).toBe('aaaa********aaaa');
      expect(masked.length).toBe(16);
    });
  });

  describe('toDTO', () => {
    it('should convert to DTO with masked key', () => {
      const prismaApiKey = createMockPrismaApiKey();
      const apiKey = new ApiKey(prismaApiKey);
      const decryptedKey = 'my-api-key-12345';

      const dto = apiKey.toDTO(decryptedKey);

      expect(dto.id).toBe('api-key-123');
      expect(dto.userId).toBe('user-123');
      expect(dto.exchange).toBe('binance');
      expect(dto.environment).toBe('MAINNET');
      expect(dto.label).toBe('Main Account');
      expect(dto.maskedKey).toBe('my-a********2345');
      expect(dto.isActive).toBe(true);
      expect(dto.lastValidatedAt).toEqual(new Date('2024-01-15T10:00:00Z'));
      expect(dto.createdAt).toEqual(new Date('2024-01-01T00:00:00Z'));
    });

    it('should return **** if decrypted key not provided', () => {
      const apiKey = new ApiKey(createMockPrismaApiKey());

      const dto = apiKey.toDTO();

      expect(dto.maskedKey).toBe('****');
    });

    it('should not include encrypted fields in DTO', () => {
      const apiKey = new ApiKey(createMockPrismaApiKey());

      const dto = apiKey.toDTO();

      expect(dto).not.toHaveProperty('encryptedKey');
      expect(dto).not.toHaveProperty('encryptedSecret');
      expect(dto).not.toHaveProperty('encryptedPassphrase');
    });
  });

  describe('isUsable', () => {
    it('should return true when isActive is true', () => {
      const apiKey = new ApiKey(createMockPrismaApiKey({ isActive: true }));

      expect(apiKey.isUsable()).toBe(true);
    });

    it('should return false when isActive is false', () => {
      const apiKey = new ApiKey(createMockPrismaApiKey({ isActive: false }));

      expect(apiKey.isUsable()).toBe(false);
    });
  });

  describe('needsRevalidation', () => {
    it('should return true if never validated', () => {
      const apiKey = new ApiKey(createMockPrismaApiKey({ lastValidatedAt: null }));

      expect(apiKey.needsRevalidation()).toBe(true);
    });

    it('should return true if validated more than 24 hours ago', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const apiKey = new ApiKey(createMockPrismaApiKey({ lastValidatedAt: twoDaysAgo }));

      expect(apiKey.needsRevalidation()).toBe(true);
    });

    it('should return false if validated within 24 hours', () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const apiKey = new ApiKey(createMockPrismaApiKey({ lastValidatedAt: oneHourAgo }));

      expect(apiKey.needsRevalidation()).toBe(false);
    });

    it('should return true at exactly 24 hours (boundary)', () => {
      const exactly24HoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000 - 1);
      const apiKey = new ApiKey(createMockPrismaApiKey({ lastValidatedAt: exactly24HoursAgo }));

      expect(apiKey.needsRevalidation()).toBe(true);
    });
  });

  describe('validateExchange', () => {
    const supportedExchanges = ['binance', 'okx', 'bybit', 'mexc', 'gateio', 'bingx'];

    it('should return valid for supported exchanges', () => {
      supportedExchanges.forEach((exchange) => {
        const result = ApiKey.validateExchange(exchange);
        expect(result.valid).toBe(true);
        expect(result.message).toBeUndefined();
      });
    });

    it('should be case insensitive', () => {
      expect(ApiKey.validateExchange('BINANCE').valid).toBe(true);
      expect(ApiKey.validateExchange('Binance').valid).toBe(true);
      expect(ApiKey.validateExchange('OKX').valid).toBe(true);
    });

    it('should return invalid for unsupported exchanges', () => {
      const result = ApiKey.validateExchange('kraken');

      expect(result.valid).toBe(false);
      expect(result.message).toContain('Unsupported exchange');
      expect(result.message).toContain('binance');
    });

    it('should list all supported exchanges in error message', () => {
      const result = ApiKey.validateExchange('invalid');

      supportedExchanges.forEach((exchange) => {
        expect(result.message).toContain(exchange);
      });
    });
  });

  describe('validateLabel', () => {
    it('should return valid for labels between 1-100 characters', () => {
      expect(ApiKey.validateLabel('a').valid).toBe(true);
      expect(ApiKey.validateLabel('Main Trading Account').valid).toBe(true);
      expect(ApiKey.validateLabel('a'.repeat(100)).valid).toBe(true);
    });

    it('should return invalid for empty label', () => {
      const result = ApiKey.validateLabel('');

      expect(result.valid).toBe(false);
      expect(result.message).toContain('1 and 100 characters');
    });

    it('should return invalid for label exceeding 100 characters', () => {
      const result = ApiKey.validateLabel('a'.repeat(101));

      expect(result.valid).toBe(false);
      expect(result.message).toContain('1 and 100 characters');
    });
  });

  describe('fromPrisma', () => {
    it('should create ApiKey instance from Prisma data', () => {
      const prismaApiKey = createMockPrismaApiKey();

      const apiKey = ApiKey.fromPrisma(prismaApiKey);

      expect(apiKey).toBeInstanceOf(ApiKey);
      expect(apiKey.id).toBe(prismaApiKey.id);
      expect(apiKey.exchange).toBe(prismaApiKey.exchange);
    });
  });
});
