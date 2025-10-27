import crypto from 'crypto';

/**
 * API Key 加密工具
 * 使用 AES-256-GCM 加密算法
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const ENCODING = 'hex';

/**
 * 獲取加密密鑰
 * 必須是 32 bytes (256 bits)
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  // 將 hex 字串轉換為 Buffer
  const keyBuffer = Buffer.from(key, 'hex');

  if (keyBuffer.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
  }

  return keyBuffer;
}

/**
 * 加密文字
 * @param plaintext 明文
 * @returns 加密後的文字（格式：iv:authTag:encrypted）
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', ENCODING);
  encrypted += cipher.final(ENCODING);

  const authTag = cipher.getAuthTag();

  // 格式：iv:authTag:encrypted
  return `${iv.toString(ENCODING)}:${authTag.toString(ENCODING)}:${encrypted}`;
}

/**
 * 解密文字
 * @param encryptedText 加密後的文字（格式：iv:authTag:encrypted）
 * @returns 明文
 */
export function decrypt(encryptedText: string): string {
  const key = getEncryptionKey();

  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format');
  }

  const iv = Buffer.from(parts[0]!, ENCODING);
  const authTag = Buffer.from(parts[1]!, ENCODING);
  const encrypted = parts[2]!;

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, ENCODING, 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * 生成隨機的加密密鑰（用於初始化）
 * @returns 32 bytes 的 hex 字串
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
