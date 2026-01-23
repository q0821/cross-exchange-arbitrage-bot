import bcrypt from 'bcrypt';
import { User as PrismaUser, UserRole } from '@/generated/prisma/client';

/**
 * User 領域模型
 * 封裝用戶相關的業務邏輯
 */

export interface CreateUserData {
  email: string;
  password: string;
}

export interface UserDTO {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
  tokenVersion: number; // Feature 061
  role: UserRole; // Feature 068
  isActive: boolean; // Feature 068
}

/**
 * User 領域模型類別
 */
export class User {
  readonly id: string;
  readonly email: string;
  private readonly passwordHash: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  // Feature 061: 密碼管理
  readonly tokenVersion: number;
  readonly failedLoginAttempts: number;
  readonly lockedUntil: Date | null;
  readonly passwordChangedAt: Date | null;
  // Feature 068: Admin 角色管理
  readonly role: UserRole;
  readonly isActive: boolean;

  constructor(data: PrismaUser) {
    this.id = data.id;
    this.email = data.email;
    this.passwordHash = data.password;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    // Feature 061: 密碼管理
    this.tokenVersion = data.tokenVersion;
    this.failedLoginAttempts = data.failedLoginAttempts;
    this.lockedUntil = data.lockedUntil;
    this.passwordChangedAt = data.passwordChangedAt;
    // Feature 068: Admin 角色管理
    this.role = data.role;
    this.isActive = data.isActive;
  }

  /**
   * 驗證密碼是否正確
   */
  async verifyPassword(plainPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, this.passwordHash);
  }

  /**
   * 轉換為 DTO（不包含密碼）
   */
  toDTO(): UserDTO {
    return {
      id: this.id,
      email: this.email,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      tokenVersion: this.tokenVersion,
      role: this.role,
      isActive: this.isActive,
    };
  }

  /**
   * 檢查帳戶是否被鎖定 (Feature 061)
   */
  isLocked(): boolean {
    return this.lockedUntil !== null && this.lockedUntil > new Date();
  }

  /**
   * 取得鎖定剩餘時間（秒）(Feature 061)
   */
  getRemainingLockTime(): number {
    if (!this.lockedUntil) return 0;
    const remaining = Math.ceil((this.lockedUntil.getTime() - Date.now()) / 1000);
    return Math.max(0, remaining);
  }

  /**
   * 靜態方法：雜湊密碼
   */
  static async hashPassword(plainPassword: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(plainPassword, saltRounds);
  }

  /**
   * 靜態方法：驗證密碼強度
   * 至少 8 字元，包含英文和數字
   */
  static validatePasswordStrength(password: string): {
    valid: boolean;
    message?: string;
  } {
    if (password.length < 8) {
      return {
        valid: false,
        message: 'Password must be at least 8 characters long',
      };
    }

    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);

    if (!hasLetter || !hasNumber) {
      return {
        valid: false,
        message: 'Password must contain both letters and numbers',
      };
    }

    return { valid: true };
  }

  /**
   * 靜態方法：驗證 Email 格式
   */
  static validateEmail(email: string): { valid: boolean; message?: string } {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return {
        valid: false,
        message: 'Invalid email format',
      };
    }

    return { valid: true };
  }

  /**
   * 靜態方法：從 Prisma User 建立領域模型
   */
  static fromPrisma(data: PrismaUser): User {
    return new User(data);
  }
}
