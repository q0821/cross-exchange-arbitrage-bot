import bcrypt from 'bcrypt';
import { User as PrismaUser } from '@prisma/client';

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

  constructor(data: PrismaUser) {
    this.id = data.id;
    this.email = data.email;
    this.passwordHash = data.password;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
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
    };
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
