/**
 * Test: Encryption Library
 *
 * 測試 API Key 加密工具：AES-256-GCM 加密/解密
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock env module with a valid 64-character hex key
vi.mock('@/lib/env', () => ({
  env: {
    // Valid 32-byte (64 hex chars) encryption key for testing
    ENCRYPTION_KEY: 'a'.repeat(64),
  },
}));

// Import after mocks
import { encrypt, decrypt, generateEncryptionKey } from '@/lib/encryption';

describe('Encryption Library', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('encrypt', () => {
    it('should encrypt plaintext and return formatted string', () => {
      const plaintext = 'my-secret-api-key';

      const encrypted = encrypt(plaintext);

      // Should be in format: iv:authTag:encrypted
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);
    });

    it('should produce different output for same input (due to random IV)', () => {
      const plaintext = 'same-secret';

      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      // IVs should be different (first part)
      const iv1 = encrypted1.split(':')[0];
      const iv2 = encrypted2.split(':')[0];
      expect(iv1).not.toBe(iv2);
    });

    it('should return hex-encoded values', () => {
      const plaintext = 'test-key';

      const encrypted = encrypt(plaintext);
      const parts = encrypted.split(':');

      // All parts should be valid hex strings
      parts.forEach((part) => {
        expect(part).toMatch(/^[0-9a-f]+$/i);
      });
    });

    it('should encrypt empty string', () => {
      const plaintext = '';

      const encrypted = encrypt(plaintext);

      expect(encrypted).toBeDefined();
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);
    });

    it('should encrypt special characters', () => {
      const plaintext = '特殊字符!@#$%^&*()_+-=[]{}|;:,.<>?/~`';

      const encrypted = encrypt(plaintext);

      expect(encrypted).toBeDefined();
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);
    });

    it('should encrypt long strings', () => {
      const plaintext = 'a'.repeat(10000);

      const encrypted = encrypt(plaintext);

      expect(encrypted).toBeDefined();
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);
    });

    it('should encrypt JSON strings', () => {
      const plaintext = JSON.stringify({ apiKey: 'key123', apiSecret: 'secret456' });

      const encrypted = encrypt(plaintext);

      expect(encrypted).toBeDefined();
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);
    });
  });

  describe('decrypt', () => {
    it('should decrypt encrypted text correctly', () => {
      const plaintext = 'my-secret-api-key';

      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should decrypt empty string', () => {
      const plaintext = '';

      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should decrypt special characters', () => {
      const plaintext = '特殊字符!@#$%^&*()_+-=[]{}|;:,.<>?/~`';

      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should decrypt long strings', () => {
      const plaintext = 'a'.repeat(10000);

      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should decrypt JSON strings', () => {
      const plaintext = JSON.stringify({ apiKey: 'key123', apiSecret: 'secret456' });

      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error for invalid format (missing parts)', () => {
      const invalidEncrypted = 'invalid-format';

      expect(() => decrypt(invalidEncrypted)).toThrow('Invalid encrypted text format');
    });

    it('should throw error for invalid format (only two parts)', () => {
      const invalidEncrypted = 'part1:part2';

      expect(() => decrypt(invalidEncrypted)).toThrow('Invalid encrypted text format');
    });

    it('should throw error for invalid format (too many parts)', () => {
      const invalidEncrypted = 'part1:part2:part3:part4';

      expect(() => decrypt(invalidEncrypted)).toThrow('Invalid encrypted text format');
    });

    it('should throw error for tampered ciphertext', () => {
      const plaintext = 'my-secret';
      const encrypted = encrypt(plaintext);
      const parts = encrypted.split(':');

      // Tamper with the encrypted data
      const tamperedEncrypted = `${parts[0]}:${parts[1]}:${parts[2]?.slice(0, -2)}00`;

      expect(() => decrypt(tamperedEncrypted)).toThrow();
    });

    it('should throw error for tampered auth tag', () => {
      const plaintext = 'my-secret';
      const encrypted = encrypt(plaintext);
      const parts = encrypted.split(':');

      // Tamper with the auth tag
      const tamperedAuthTag = '00'.repeat(16);
      const tamperedEncrypted = `${parts[0]}:${tamperedAuthTag}:${parts[2]}`;

      expect(() => decrypt(tamperedEncrypted)).toThrow();
    });

    it('should throw error for tampered IV', () => {
      const plaintext = 'my-secret';
      const encrypted = encrypt(plaintext);
      const parts = encrypted.split(':');

      // Tamper with the IV
      const tamperedIV = '00'.repeat(16);
      const tamperedEncrypted = `${tamperedIV}:${parts[1]}:${parts[2]}`;

      expect(() => decrypt(tamperedEncrypted)).toThrow();
    });
  });

  describe('encrypt + decrypt roundtrip', () => {
    it('should roundtrip simple string', () => {
      const original = 'simple-test';

      const result = decrypt(encrypt(original));

      expect(result).toBe(original);
    });

    it('should roundtrip multiple times', () => {
      const original = 'multi-roundtrip-test';

      // Encrypt and decrypt multiple times
      let result = original;
      for (let i = 0; i < 5; i++) {
        const encrypted = encrypt(result);
        result = decrypt(encrypted);
      }

      expect(result).toBe(original);
    });

    it('should roundtrip Unicode strings', () => {
      const original = '你好世界 🌍 こんにちは';

      const result = decrypt(encrypt(original));

      expect(result).toBe(original);
    });

    it('should roundtrip newlines and whitespace', () => {
      const original = 'line1\nline2\r\nline3\ttab';

      const result = decrypt(encrypt(original));

      expect(result).toBe(original);
    });

    it('should roundtrip API key format strings', () => {
      const original = 'ABCD1234efgh5678IJKL9012mnop3456';

      const result = decrypt(encrypt(original));

      expect(result).toBe(original);
    });
  });

  describe('generateEncryptionKey', () => {
    it('should generate 64-character hex string', () => {
      const key = generateEncryptionKey();

      expect(key).toHaveLength(64);
      expect(key).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should generate unique keys', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();

      expect(key1).not.toBe(key2);
    });

    it('should generate valid hex characters only', () => {
      const key = generateEncryptionKey();

      // Should only contain hex characters
      expect(key).toMatch(/^[0-9a-f]+$/);
    });

    it('should generate 32-byte key (256 bits)', () => {
      const key = generateEncryptionKey();
      const buffer = Buffer.from(key, 'hex');

      expect(buffer.length).toBe(32);
    });

    it('should generate multiple unique keys', () => {
      const keys = new Set<string>();

      for (let i = 0; i < 100; i++) {
        keys.add(generateEncryptionKey());
      }

      // All 100 keys should be unique
      expect(keys.size).toBe(100);
    });
  });

  describe('Security Properties', () => {
    it('should produce different ciphertext for different plaintexts', () => {
      const plaintext1 = 'secret1';
      const plaintext2 = 'secret2';

      const encrypted1 = encrypt(plaintext1);
      const encrypted2 = encrypt(plaintext2);

      // The encrypted data parts should be different
      const data1 = encrypted1.split(':')[2];
      const data2 = encrypted2.split(':')[2];
      expect(data1).not.toBe(data2);
    });

    it('should have 16-byte IV', () => {
      const plaintext = 'test';

      const encrypted = encrypt(plaintext);
      const iv = encrypted.split(':')[0];

      // IV should be 16 bytes = 32 hex chars
      expect(iv).toHaveLength(32);
    });

    it('should have 16-byte auth tag', () => {
      const plaintext = 'test';

      const encrypted = encrypt(plaintext);
      const authTag = encrypted.split(':')[1];

      // Auth tag should be 16 bytes = 32 hex chars
      expect(authTag).toHaveLength(32);
    });
  });
});
