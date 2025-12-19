/**
 * Trading Settings Repository
 *
 * 交易設定資料存取層
 * Feature: 038-specify-scripts-bash
 */

import { PrismaClient, TradingSettings } from '@prisma/client';
import type { TradingSettings as TradingSettingsType } from '../types/trading';

const prisma = new PrismaClient();

/**
 * 交易設定預設值
 */
const DEFAULT_TRADING_SETTINGS: Omit<TradingSettingsType, 'userId'> = {
  defaultStopLossEnabled: true,
  defaultStopLossPercent: 5.0,
  defaultTakeProfitEnabled: false,
  defaultTakeProfitPercent: 3.0,
  defaultLeverage: 1,
  maxPositionSizeUSD: 10000,
};

/**
 * 交易設定 Repository
 */
export class TradingSettingsRepository {
  /**
   * 獲取用戶的交易設定
   * 如果不存在則創建預設值
   */
  async getOrCreate(userId: string): Promise<TradingSettings> {
    let settings = await prisma.tradingSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await prisma.tradingSettings.create({
        data: {
          userId,
          ...DEFAULT_TRADING_SETTINGS,
        },
      });
    }

    return settings;
  }

  /**
   * 獲取用戶的交易設定
   * 如果不存在則返回 null
   */
  async findByUserId(userId: string): Promise<TradingSettings | null> {
    return prisma.tradingSettings.findUnique({
      where: { userId },
    });
  }

  /**
   * 更新用戶的交易設定
   */
  async update(
    userId: string,
    data: Partial<Omit<TradingSettingsType, 'userId'>>,
  ): Promise<TradingSettings> {
    // 確保設定存在
    await this.getOrCreate(userId);

    return prisma.tradingSettings.update({
      where: { userId },
      data,
    });
  }

  /**
   * 創建用戶的交易設定
   */
  async create(
    userId: string,
    data?: Partial<Omit<TradingSettingsType, 'userId'>>,
  ): Promise<TradingSettings> {
    return prisma.tradingSettings.create({
      data: {
        userId,
        ...DEFAULT_TRADING_SETTINGS,
        ...data,
      },
    });
  }

  /**
   * 刪除用戶的交易設定
   */
  async delete(userId: string): Promise<void> {
    await prisma.tradingSettings.delete({
      where: { userId },
    });
  }

  /**
   * 將 Prisma 模型轉換為 API 類型
   */
  toApiType(settings: TradingSettings): TradingSettingsType {
    return {
      defaultStopLossEnabled: settings.defaultStopLossEnabled,
      defaultStopLossPercent: Number(settings.defaultStopLossPercent),
      defaultTakeProfitEnabled: settings.defaultTakeProfitEnabled,
      defaultTakeProfitPercent: Number(settings.defaultTakeProfitPercent),
      defaultLeverage: settings.defaultLeverage,
      maxPositionSizeUSD: Number(settings.maxPositionSizeUSD),
    };
  }

  /**
   * 獲取預設交易設定值
   */
  getDefaults(): TradingSettingsType {
    return {
      ...DEFAULT_TRADING_SETTINGS,
    };
  }
}

// Export singleton instance
export const tradingSettingsRepository = new TradingSettingsRepository();
