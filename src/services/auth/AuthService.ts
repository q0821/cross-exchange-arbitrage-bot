import { PrismaClient } from '@prisma/client';
import { User, CreateUserData } from '@models/User';
import { UserRepository } from '../../repositories/UserRepository';
import { logger } from '@lib/logger';
import { AuthError, ValidationError } from '@lib/errors';

/**
 * AuthService
 * 處理用戶認證相關的業務邏輯
 */

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export class AuthService {
  private readonly userRepository: UserRepository;

  constructor(prisma: PrismaClient) {
    this.userRepository = new UserRepository(prisma);
  }

  /**
   * 用戶註冊
   */
  async register(request: RegisterRequest): Promise<User> {
    const { email, password } = request;

    // 1. 驗證 Email 格式
    const emailValidation = User.validateEmail(email);
    if (!emailValidation.valid) {
      logger.warn({ email }, 'Invalid email format during registration');
      throw new ValidationError(emailValidation.message || 'Invalid email format');
    }

    // 2. 驗證密碼強度
    const passwordValidation = User.validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      logger.warn({ email }, 'Weak password during registration');
      throw new ValidationError(passwordValidation.message || 'Weak password');
    }

    // 3. 檢查 Email 是否已存在
    const emailExists = await this.userRepository.emailExists(email);
    if (emailExists) {
      logger.warn({ email }, 'Email already exists during registration');
      throw new AuthError('Email already exists');
    }

    // 4. 雜湊密碼
    const passwordHash = await User.hashPassword(password);

    // 5. 建立用戶
    const userData: CreateUserData = { email, password };
    const user = await this.userRepository.create(userData, passwordHash);

    logger.info(
      {
        userId: user.id,
        email: user.email,
      },
      'User registered successfully',
    );

    return user;
  }

  /**
   * 用戶登入
   */
  async login(request: LoginRequest): Promise<User> {
    const { email, password } = request;

    // 1. 根據 Email 查詢用戶
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      logger.warn({ email }, 'User not found during login');
      throw new AuthError('Invalid email or password');
    }

    // 2. 驗證密碼
    const isPasswordValid = await user.verifyPassword(password);

    if (!isPasswordValid) {
      logger.warn(
        {
          userId: user.id,
          email,
        },
        'Invalid password during login',
      );
      throw new AuthError('Invalid email or password');
    }

    logger.info(
      {
        userId: user.id,
        email: user.email,
      },
      'User logged in successfully',
    );

    return user;
  }

  /**
   * 根據 ID 查詢用戶（用於驗證 JWT Token）
   */
  async getUserById(userId: string): Promise<User | null> {
    return this.userRepository.findById(userId);
  }

  /**
   * 根據 Email 查詢用戶
   */
  async getUserByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }
}
