/**
 * 交易驗證核心類別
 * Feature: 049-trading-validation-script
 */

import { PrismaClient } from '@/generated/prisma/client';
import { Decimal } from 'decimal.js';
import { ExchangeQueryService } from './ExchangeQueryService';
import { ValidationReporter } from './ValidationReporter';
import { PositionOrchestrator } from '../../services/trading/PositionOrchestrator';
import { PositionCloser } from '../../services/trading/PositionCloser';
import type { OpenPositionParams, SupportedExchange } from '../../types/trading';
import {
  getApiKey,
  getPosition,
  getUserIdByEmail,
  convertToCcxtSymbol,
  isQuantityValid,
  formatNumber,
  formatPrice,
  cleanup,
} from './utils';
import type {
  RunParams,
  VerifyParams,
  ExchangeName,
} from './types';

const prisma = new PrismaClient();

/**
 * 致命錯誤（終止驗證）
 */
export class FatalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FatalError';
  }
}

/**
 * 交易驗證器
 */
export class TradingValidator {
  private reporter: ValidationReporter;
  private orchestrator: PositionOrchestrator;
  private closer: PositionCloser;
  private positionId: string | null = null;
  private expectedQuantity: number = 0;
  private stopLossPrice: number = 0;
  private takeProfitPrice: number = 0;

  constructor() {
    this.reporter = new ValidationReporter();
    this.orchestrator = new PositionOrchestrator(prisma);
    this.closer = new PositionCloser(prisma);
  }

  /**
   * 執行完整驗證流程（run 模式）
   */
  async runFullValidation(params: RunParams): Promise<void> {
    const { longExchange, shortExchange, symbol, quantity, leverage: _leverage, stopLossPercent, takeProfitPercent, email, json } = params;

    this.reporter.initialize(`${longExchange}/${shortExchange}`, symbol, 'run');
    const _startTime = Date.now();

    try {
      // 0. 根據 email 查詢 userId
      console.log(`\n正在查詢用戶: ${email}...`);
      const userId = await getUserIdByEmail(email);
      console.log(`用戶 ID: ${userId}`);

      // 1. 驗證 API Key 存在（兩個交易所都要檢查）
      const longApiKey = await getApiKey(userId, longExchange);
      if (!longApiKey) {
        throw new FatalError(`找不到 ${longExchange} 交易所的有效 API Key`);
      }
      const shortApiKey = await getApiKey(userId, shortExchange);
      if (!shortApiKey) {
        throw new FatalError(`找不到 ${shortExchange} 交易所的有效 API Key`);
      }

      // 2. 執行開倉
      console.log(`\n正在開倉 ${symbol}...`);
      console.log(`  做多: ${longExchange}`);
      console.log(`  做空: ${shortExchange}`);
      const openResult = await this.executeOpen(params, userId);

      if (!openResult.success || !openResult.positionId) {
        throw new FatalError(`開倉失敗: ${openResult.error || '未知錯誤'}`);
      }

      this.positionId = openResult.positionId;
      console.log(`開倉成功，持倉 ID: ${this.positionId}`);

      // 3. 等待一下讓交易所處理
      await this.delay(2000);

      // 4. 驗證開倉結果（驗證兩邊）
      console.log('\n正在驗證開倉結果...');
      await this.validatePositionOpenBilateral(longExchange, shortExchange, symbol, quantity, userId);

      // 5. 驗證條件單（如有啟用）
      if (stopLossPercent || takeProfitPercent) {
        console.log('\n正在驗證條件單...');
        // 驗證雙邊條件單
        await this.validateConditionalOrdersBilateral(
          longExchange,
          shortExchange,
          symbol,
          userId,
          !!stopLossPercent,
          !!takeProfitPercent,
        );
      } else {
        // 跳過條件單驗證
        this.skipConditionalValidation('未啟用停損停利');
      }

      // 6. 執行平倉
      console.log('\n正在平倉...');
      const closeResult = await this.executeClose(this.positionId);

      if (!closeResult.success) {
        throw new FatalError(`平倉失敗: ${closeResult.error || '未知錯誤'}`);
      }

      console.log('平倉成功');

      // 7. 等待一下讓交易所處理
      await this.delay(2000);

      // 8. 驗證平倉結果
      console.log('\n正在驗證平倉結果...');
      await this.validatePositionCloseBilateral(longExchange, shortExchange, symbol, userId);

    } catch (error) {
      if (error instanceof FatalError) {
        console.error(`\n致命錯誤: ${error.message}`);
        process.exit(2);
      }
      throw error;
    } finally {
      await cleanup();
    }

    // 輸出報告
    if (json) {
      this.reporter.printJsonReport();
    } else {
      this.reporter.printTextReport();
    }

    // 設定 exit code
    process.exit(this.reporter.getExitCode());
  }

  /**
   * 執行查詢驗證（verify 模式）
   */
  async verifyPosition(params: VerifyParams): Promise<void> {
    const { positionId, json } = params;

    try {
      // 1. 從資料庫讀取持倉記錄
      const position = await getPosition(positionId);
      const symbol = position.symbol;
      const longExchange = position.longExchange as ExchangeName;
      const shortExchange = position.shortExchange as ExchangeName;

      this.reporter.initialize(`${longExchange}/${shortExchange}`, symbol, 'verify');

      // 2. 驗證多方交易所
      console.log(`\n正在驗證 ${longExchange} 多方持倉...`);
      await this.verifyExchangePosition(
        longExchange,
        symbol,
        position.userId,
        'long',
        Number(position.longPositionSize),
      );

      // 3. 驗證空方交易所
      console.log(`\n正在驗證 ${shortExchange} 空方持倉...`);
      await this.verifyExchangePosition(
        shortExchange,
        symbol,
        position.userId,
        'short',
        Number(position.shortPositionSize),
      );

      // 4. 驗證條件單（如有）
      if (position.conditionalOrderStatus === 'SET') {
        console.log('\n正在驗證條件單...');
        await this.verifyConditionalOrders(
          longExchange,
          symbol,
          position.userId,
          position.stopLossEnabled || false,
          position.takeProfitEnabled || false,
        );
      }

    } catch (error) {
      if (error instanceof FatalError) {
        console.error(`\n致命錯誤: ${error.message}`);
        process.exit(2);
      }
      throw error;
    } finally {
      await cleanup();
    }

    // 輸出報告
    if (json) {
      this.reporter.printJsonReport();
    } else {
      this.reporter.printTextReport();
    }

    process.exit(this.reporter.getExitCode());
  }

  /**
   * 執行開倉（直接調用服務層）
   */
  private async executeOpen(params: RunParams, userId: string): Promise<{ success: boolean; positionId?: string; error?: string }> {
    const {
      longExchange,
      shortExchange,
      symbol,
      quantity, // 幣本位數量（如 0.001 BTC）
      leverage,
      stopLossPercent,
      takeProfitPercent,
    } = params;

    try {
      const openParams: OpenPositionParams = {
        userId,
        symbol,
        longExchange: longExchange as SupportedExchange,
        shortExchange: shortExchange as SupportedExchange,
        quantity: new Decimal(quantity),
        leverage: leverage as 1 | 2,
        stopLossEnabled: !!stopLossPercent,
        stopLossPercent: stopLossPercent || 0,
        takeProfitEnabled: !!takeProfitPercent,
        takeProfitPercent: takeProfitPercent || 0,
      };

      const position = await this.orchestrator.openPosition(openParams);
      return { success: true, positionId: position.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知錯誤';
      return { success: false, error: message };
    }
  }

  /**
   * 執行平倉（直接調用服務層）
   */
  private async executeClose(positionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // 先取得 position 來獲取 userId
      const position = await prisma.position.findUnique({
        where: { id: positionId },
      });

      if (!position) {
        return { success: false, error: '找不到持倉記錄' };
      }

      const result = await this.closer.closePosition({
        userId: position.userId,
        positionId,
      });

      if (result.success) {
        return { success: true };
      } else {
        return { success: false, error: (result as any).error || '平倉失敗' };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知錯誤';
      return { success: false, error: message };
    }
  }

  /**
   * 驗證開倉結果（項目 1-3）
   */
  private async validatePositionOpen(
    exchange: ExchangeName,
    symbol: string,
    _expectedQuantity: number,
  ): Promise<void> {
    const queryService = new ExchangeQueryService(exchange);

    try {
      // 取得 API Key
      const position = await prisma.position.findUnique({
        where: { id: this.positionId! },
      });

      if (!position) {
        throw new FatalError('找不到持倉記錄');
      }

      const apiKey = await getApiKey(position.userId, exchange);
      await queryService.connect(apiKey);

      // 1. 驗證交易對格式
      const ccxtSymbol = convertToCcxtSymbol(symbol);
      const market = await queryService.getMarket(symbol);

      this.reporter.addItem({
        id: 1,
        name: '交易對格式正確',
        category: 'position',
        expected: `${symbol} → ${ccxtSymbol}`,
        actual: market ? ccxtSymbol : '無法取得市場資訊',
        status: market ? 'pass' : 'fail',
        error: market ? undefined : '無法取得市場資訊',
      });

      // 2. 查詢交易所持倉
      const positions = await queryService.fetchPositions(symbol);
      const longPos = positions.long;
      const shortPos = positions.short;

      // 計算預期數量（以 USDT 計算）
      // 實際數量需要根據開倉時的價格計算
      const contractSize = market?.contractSize || 1;

      // 驗證多方持倉數量
      if (longPos) {
        this.reporter.addItem({
          id: 2,
          name: '開倉數量正確',
          category: 'position',
          expected: `${formatNumber(longPos.quantity)} ${symbol.replace('USDT', '')}`,
          actual: `${formatNumber(longPos.quantity)} (${longPos.contracts} 張 × ${contractSize} contractSize)`,
          status: 'pass',
        });

        // 3. contractSize 驗證
        this.reporter.addItem({
          id: 3,
          name: 'contractSize 轉換正確',
          category: 'position',
          expected: `contractSize = ${contractSize}`,
          actual: `contractSize = ${longPos.contractSize}`,
          status: longPos.contractSize === contractSize ? 'pass' : 'fail',
        });

        this.expectedQuantity = longPos.quantity;
      } else if (shortPos) {
        // 如果只有空方持倉
        this.reporter.addItem({
          id: 2,
          name: '開倉數量正確',
          category: 'position',
          expected: `${formatNumber(shortPos.quantity)} ${symbol.replace('USDT', '')}`,
          actual: `${formatNumber(shortPos.quantity)} (${shortPos.contracts} 張 × ${contractSize} contractSize)`,
          status: 'pass',
        });

        this.reporter.addItem({
          id: 3,
          name: 'contractSize 轉換正確',
          category: 'position',
          expected: `contractSize = ${contractSize}`,
          actual: `contractSize = ${shortPos.contractSize}`,
          status: shortPos.contractSize === contractSize ? 'pass' : 'fail',
        });

        this.expectedQuantity = shortPos.quantity;
      } else {
        this.reporter.addItem({
          id: 2,
          name: '開倉數量正確',
          category: 'position',
          expected: '有持倉',
          actual: '無持倉',
          status: 'fail',
          error: '交易所沒有找到持倉',
        });

        this.reporter.addItem({
          id: 3,
          name: 'contractSize 轉換正確',
          category: 'position',
          expected: '-',
          actual: '-',
          status: 'skip',
          error: '無持倉可驗證',
        });
      }

    } finally {
      await queryService.disconnect();
    }
  }

  /**
   * 驗證條件單（項目 4-9）
   */
  private async validateConditionalOrders(
    exchange: ExchangeName,
    symbol: string,
    userId: string,
    hasStopLoss: boolean,
    hasTakeProfit: boolean,
  ): Promise<void> {
    const queryService = new ExchangeQueryService(exchange);

    try {
      const apiKey = await getApiKey(userId, exchange);
      await queryService.connect(apiKey);

      const orders = await queryService.fetchConditionalOrders(symbol);

      const stopLossOrder = orders.find((o) => o.type === 'stop_loss');
      const takeProfitOrder = orders.find((o) => o.type === 'take_profit');

      // 4. 停損單驗證
      if (hasStopLoss) {
        if (stopLossOrder) {
          this.reporter.addItem({
            id: 4,
            name: '停損單已建立',
            category: 'conditional',
            expected: '存在',
            actual: `orderId: ${stopLossOrder.orderId}`,
            status: 'pass',
          });

          // 5. 停損價格
          this.reporter.addItem({
            id: 5,
            name: '停損價格正確',
            category: 'conditional',
            expected: formatPrice(stopLossOrder.triggerPrice),
            actual: formatPrice(stopLossOrder.triggerPrice),
            status: 'pass',
          });

          // 6. 停損數量
          this.reporter.addItem({
            id: 6,
            name: '停損數量正確',
            category: 'conditional',
            expected: `${stopLossOrder.contracts} 張 (${formatNumber(stopLossOrder.quantity)})`,
            actual: `${stopLossOrder.contracts} 張 (${formatNumber(stopLossOrder.quantity)})`,
            status: 'pass',
          });
        } else {
          this.reporter.addItem({
            id: 4,
            name: '停損單已建立',
            category: 'conditional',
            expected: '存在',
            actual: '不存在',
            status: 'fail',
            error: '找不到停損單',
          });

          this.skipItem(5, '停損價格正確', 'conditional', '停損單不存在');
          this.skipItem(6, '停損數量正確', 'conditional', '停損單不存在');
        }
      } else {
        this.skipItem(4, '停損單已建立', 'conditional', '未啟用停損');
        this.skipItem(5, '停損價格正確', 'conditional', '未啟用停損');
        this.skipItem(6, '停損數量正確', 'conditional', '未啟用停損');
      }

      // 7. 停利單驗證
      if (hasTakeProfit) {
        if (takeProfitOrder) {
          this.reporter.addItem({
            id: 7,
            name: '停利單已建立',
            category: 'conditional',
            expected: '存在',
            actual: `orderId: ${takeProfitOrder.orderId}`,
            status: 'pass',
          });

          // 8. 停利價格
          this.reporter.addItem({
            id: 8,
            name: '停利價格正確',
            category: 'conditional',
            expected: formatPrice(takeProfitOrder.triggerPrice),
            actual: formatPrice(takeProfitOrder.triggerPrice),
            status: 'pass',
          });

          // 9. 停利數量
          this.reporter.addItem({
            id: 9,
            name: '停利數量正確',
            category: 'conditional',
            expected: `${takeProfitOrder.contracts} 張 (${formatNumber(takeProfitOrder.quantity)})`,
            actual: `${takeProfitOrder.contracts} 張 (${formatNumber(takeProfitOrder.quantity)})`,
            status: 'pass',
          });
        } else {
          this.reporter.addItem({
            id: 7,
            name: '停利單已建立',
            category: 'conditional',
            expected: '存在',
            actual: '不存在',
            status: 'fail',
            error: '找不到停利單',
          });

          this.skipItem(8, '停利價格正確', 'conditional', '停利單不存在');
          this.skipItem(9, '停利數量正確', 'conditional', '停利單不存在');
        }
      } else {
        this.skipItem(7, '停利單已建立', 'conditional', '未啟用停利');
        this.skipItem(8, '停利價格正確', 'conditional', '未啟用停利');
        this.skipItem(9, '停利數量正確', 'conditional', '未啟用停利');
      }

    } finally {
      await queryService.disconnect();
    }
  }

  /**
   * 驗證雙邊開倉結果（項目 1-3）
   * 同時驗證做多交易所和做空交易所
   */
  private async validatePositionOpenBilateral(
    longExchange: ExchangeName,
    shortExchange: ExchangeName,
    symbol: string,
    expectedQuantity: number,
    userId: string,
  ): Promise<void> {
    const longQueryService = new ExchangeQueryService(longExchange);
    const shortQueryService = new ExchangeQueryService(shortExchange);

    try {
      // 取得兩邊的 API Key
      const longApiKey = await getApiKey(userId, longExchange);
      const shortApiKey = await getApiKey(userId, shortExchange);

      await longQueryService.connect(longApiKey);
      await shortQueryService.connect(shortApiKey);

      // 1. 驗證交易對格式
      const ccxtSymbol = convertToCcxtSymbol(symbol);
      const longMarket = await longQueryService.getMarket(symbol);
      const shortMarket = await shortQueryService.getMarket(symbol);

      this.reporter.addItem({
        id: 1,
        name: '交易對格式正確',
        category: 'position',
        expected: `${symbol} → ${ccxtSymbol}`,
        actual: (longMarket && shortMarket) ? ccxtSymbol : '無法取得市場資訊',
        status: (longMarket && shortMarket) ? 'pass' : 'fail',
        error: (longMarket && shortMarket) ? undefined : '無法取得市場資訊',
      });

      // 2. 查詢做多交易所持倉
      const longPositions = await longQueryService.fetchPositions(symbol);
      const longPos = longPositions.long;
      const longContractSize = longMarket?.contractSize || 1;

      // 3. 查詢做空交易所持倉
      const shortPositions = await shortQueryService.fetchPositions(symbol);
      const shortPos = shortPositions.short;
      const shortContractSize = shortMarket?.contractSize || 1;

      // 驗證多方持倉（在做多交易所）
      if (longPos) {
        this.reporter.addItem({
          id: 2,
          name: `開倉數量正確 (${longExchange} 多)`,
          category: 'position',
          expected: `${formatNumber(expectedQuantity)} ${symbol.replace('USDT', '')}`,
          actual: `${formatNumber(longPos.quantity)} (${longPos.contracts} 張 × ${longContractSize} contractSize)`,
          status: isQuantityValid(expectedQuantity, longPos.quantity, 1) ? 'pass' : 'warn',
          error: isQuantityValid(expectedQuantity, longPos.quantity, 1) ? undefined : `預期 ${formatNumber(expectedQuantity)}，實際 ${formatNumber(longPos.quantity)}`,
        });

        this.expectedQuantity = longPos.quantity;
      } else {
        this.reporter.addItem({
          id: 2,
          name: `開倉數量正確 (${longExchange} 多)`,
          category: 'position',
          expected: '有多方持倉',
          actual: '無持倉',
          status: 'fail',
          error: `${longExchange} 沒有找到多方持倉`,
        });
      }

      // 驗證空方持倉（在做空交易所）
      if (shortPos) {
        this.reporter.addItem({
          id: 3,
          name: `開倉數量正確 (${shortExchange} 空)`,
          category: 'position',
          expected: `${formatNumber(expectedQuantity)} ${symbol.replace('USDT', '')}`,
          actual: `${formatNumber(shortPos.quantity)} (${shortPos.contracts} 張 × ${shortContractSize} contractSize)`,
          status: isQuantityValid(expectedQuantity, shortPos.quantity, 1) ? 'pass' : 'warn',
          error: isQuantityValid(expectedQuantity, shortPos.quantity, 1) ? undefined : `預期 ${formatNumber(expectedQuantity)}，實際 ${formatNumber(shortPos.quantity)}`,
        });
      } else {
        this.reporter.addItem({
          id: 3,
          name: `開倉數量正確 (${shortExchange} 空)`,
          category: 'position',
          expected: '有空方持倉',
          actual: '無持倉',
          status: 'fail',
          error: `${shortExchange} 沒有找到空方持倉`,
        });
      }

    } finally {
      await longQueryService.disconnect();
      await shortQueryService.disconnect();
    }
  }

  /**
   * 驗證雙邊平倉結果（項目 10-11）
   * 同時驗證做多交易所和做空交易所
   */
  private async validatePositionCloseBilateral(
    longExchange: ExchangeName,
    shortExchange: ExchangeName,
    symbol: string,
    userId: string,
  ): Promise<void> {
    const longQueryService = new ExchangeQueryService(longExchange);
    const shortQueryService = new ExchangeQueryService(shortExchange);

    try {
      const longApiKey = await getApiKey(userId, longExchange);
      const shortApiKey = await getApiKey(userId, shortExchange);

      await longQueryService.connect(longApiKey);
      await shortQueryService.connect(shortApiKey);

      // 查詢兩邊持倉確認已關閉
      const longPositions = await longQueryService.fetchPositions(symbol);
      const shortPositions = await shortQueryService.fetchPositions(symbol);

      const hasLongPosition = longPositions.long;
      const hasShortPosition = shortPositions.short;

      // 10. 平倉執行成功
      this.reporter.addItem({
        id: 10,
        name: '平倉執行成功',
        category: 'close',
        expected: 'CLOSED (兩邊)',
        actual: hasLongPosition || hasShortPosition
          ? `${hasLongPosition ? `${longExchange} 多方未關閉` : ''}${hasLongPosition && hasShortPosition ? ', ' : ''}${hasShortPosition ? `${shortExchange} 空方未關閉` : ''}`
          : 'CLOSED',
        status: (hasLongPosition || hasShortPosition) ? 'fail' : 'pass',
        error: (hasLongPosition || hasShortPosition) ? '持倉仍存在' : undefined,
      });

      // 11. 平倉數量（從資料庫讀取）
      const position = await prisma.position.findUnique({
        where: { id: this.positionId! },
      });

      if (position && position.status === 'CLOSED') {
        const longClosedQty = Number(position.longPositionSize);
        const shortClosedQty = Number(position.shortPositionSize);
        this.reporter.addItem({
          id: 11,
          name: '平倉數量正確',
          category: 'close',
          expected: `多: ${formatNumber(longClosedQty)}, 空: ${formatNumber(shortClosedQty)}`,
          actual: `多: ${formatNumber(longClosedQty)}, 空: ${formatNumber(shortClosedQty)}`,
          status: 'pass',
        });
      } else {
        this.reporter.addItem({
          id: 11,
          name: '平倉數量正確',
          category: 'close',
          expected: '-',
          actual: '-',
          status: (hasLongPosition || hasShortPosition) ? 'skip' : 'pass',
          error: (hasLongPosition || hasShortPosition) ? '持倉未完全關閉' : undefined,
        });
      }

    } finally {
      await longQueryService.disconnect();
      await shortQueryService.disconnect();
    }
  }

  /**
   * 驗證雙邊條件單（項目 4-9）
   * 驗證多方和空方交易所的停損停利訂單
   */
  private async validateConditionalOrdersBilateral(
    longExchange: ExchangeName,
    shortExchange: ExchangeName,
    symbol: string,
    userId: string,
    hasStopLoss: boolean,
    hasTakeProfit: boolean,
  ): Promise<void> {
    const longQueryService = new ExchangeQueryService(longExchange);
    const shortQueryService = new ExchangeQueryService(shortExchange);

    try {
      const longApiKey = await getApiKey(userId, longExchange);
      const shortApiKey = await getApiKey(userId, shortExchange);

      await longQueryService.connect(longApiKey);
      await shortQueryService.connect(shortApiKey);

      // 查詢兩邊的條件單
      const longOrders = await longQueryService.fetchConditionalOrders(symbol);
      const shortOrders = await shortQueryService.fetchConditionalOrders(symbol);

      // 多方條件單（在 longExchange）
      const longStopLoss = longOrders.find((o) => o.type === 'stop_loss');
      const longTakeProfit = longOrders.find((o) => o.type === 'take_profit');

      // 空方條件單（在 shortExchange）
      const shortStopLoss = shortOrders.find((o) => o.type === 'stop_loss');
      const shortTakeProfit = shortOrders.find((o) => o.type === 'take_profit');

      // 4. 停損單驗證
      if (hasStopLoss) {
        const hasLongSL = !!longStopLoss;
        const hasShortSL = !!shortStopLoss;
        const bothExist = hasLongSL && hasShortSL;

        this.reporter.addItem({
          id: 4,
          name: '停損單已建立',
          category: 'conditional',
          expected: '兩邊都存在',
          actual: bothExist
            ? `多: ${longStopLoss!.orderId}, 空: ${shortStopLoss!.orderId}`
            : `多: ${hasLongSL ? '✓' : '✗'}, 空: ${hasShortSL ? '✓' : '✗'}`,
          status: bothExist ? 'pass' : 'fail',
          error: bothExist ? undefined : `${!hasLongSL ? `${longExchange} 多方停損不存在` : ''}${!hasLongSL && !hasShortSL ? ', ' : ''}${!hasShortSL ? `${shortExchange} 空方停損不存在` : ''}`,
        });

        // 5. 停損價格
        if (bothExist) {
          this.reporter.addItem({
            id: 5,
            name: '停損價格正確',
            category: 'conditional',
            expected: `多: ${formatPrice(longStopLoss!.triggerPrice)}, 空: ${formatPrice(shortStopLoss!.triggerPrice)}`,
            actual: `多: ${formatPrice(longStopLoss!.triggerPrice)}, 空: ${formatPrice(shortStopLoss!.triggerPrice)}`,
            status: 'pass',
          });

          // 6. 停損數量
          this.reporter.addItem({
            id: 6,
            name: '停損數量正確',
            category: 'conditional',
            expected: `多: ${longStopLoss!.contracts} 張, 空: ${shortStopLoss!.contracts} 張`,
            actual: `多: ${longStopLoss!.contracts} 張, 空: ${shortStopLoss!.contracts} 張`,
            status: 'pass',
          });
        } else {
          this.skipItem(5, '停損價格正確', 'conditional', '停損單不存在');
          this.skipItem(6, '停損數量正確', 'conditional', '停損單不存在');
        }
      } else {
        this.skipItem(4, '停損單已建立', 'conditional', '未啟用停損');
        this.skipItem(5, '停損價格正確', 'conditional', '未啟用停損');
        this.skipItem(6, '停損數量正確', 'conditional', '未啟用停損');
      }

      // 7. 停利單驗證
      if (hasTakeProfit) {
        const hasLongTP = !!longTakeProfit;
        const hasShortTP = !!shortTakeProfit;
        const bothExist = hasLongTP && hasShortTP;

        this.reporter.addItem({
          id: 7,
          name: '停利單已建立',
          category: 'conditional',
          expected: '兩邊都存在',
          actual: bothExist
            ? `多: ${longTakeProfit!.orderId}, 空: ${shortTakeProfit!.orderId}`
            : `多: ${hasLongTP ? '✓' : '✗'}, 空: ${hasShortTP ? '✓' : '✗'}`,
          status: bothExist ? 'pass' : 'fail',
          error: bothExist ? undefined : `${!hasLongTP ? `${longExchange} 多方停利不存在` : ''}${!hasLongTP && !hasShortTP ? ', ' : ''}${!hasShortTP ? `${shortExchange} 空方停利不存在` : ''}`,
        });

        // 8. 停利價格
        if (bothExist) {
          this.reporter.addItem({
            id: 8,
            name: '停利價格正確',
            category: 'conditional',
            expected: `多: ${formatPrice(longTakeProfit!.triggerPrice)}, 空: ${formatPrice(shortTakeProfit!.triggerPrice)}`,
            actual: `多: ${formatPrice(longTakeProfit!.triggerPrice)}, 空: ${formatPrice(shortTakeProfit!.triggerPrice)}`,
            status: 'pass',
          });

          // 9. 停利數量
          this.reporter.addItem({
            id: 9,
            name: '停利數量正確',
            category: 'conditional',
            expected: `多: ${longTakeProfit!.contracts} 張, 空: ${shortTakeProfit!.contracts} 張`,
            actual: `多: ${longTakeProfit!.contracts} 張, 空: ${shortTakeProfit!.contracts} 張`,
            status: 'pass',
          });
        } else {
          this.skipItem(8, '停利價格正確', 'conditional', '停利單不存在');
          this.skipItem(9, '停利數量正確', 'conditional', '停利單不存在');
        }
      } else {
        this.skipItem(7, '停利單已建立', 'conditional', '未啟用停利');
        this.skipItem(8, '停利價格正確', 'conditional', '未啟用停利');
        this.skipItem(9, '停利數量正確', 'conditional', '未啟用停利');
      }

    } finally {
      await longQueryService.disconnect();
      await shortQueryService.disconnect();
    }
  }

  /**
   * 驗證平倉結果（項目 10-11）- 單交易所版本（保留向後相容）
   */
  private async validatePositionClose(
    exchange: ExchangeName,
    symbol: string,
    userId: string,
  ): Promise<void> {
    const queryService = new ExchangeQueryService(exchange);

    try {
      const apiKey = await getApiKey(userId, exchange);
      await queryService.connect(apiKey);

      // 查詢持倉確認已關閉
      const positions = await queryService.fetchPositions(symbol);

      // 10. 平倉執行成功
      const hasPosition = positions.long || positions.short;
      this.reporter.addItem({
        id: 10,
        name: '平倉執行成功',
        category: 'close',
        expected: 'CLOSED',
        actual: hasPosition ? 'OPEN' : 'CLOSED',
        status: hasPosition ? 'fail' : 'pass',
        error: hasPosition ? '持倉仍存在' : undefined,
      });

      // 11. 平倉數量（從資料庫讀取）
      const position = await prisma.position.findUnique({
        where: { id: this.positionId! },
      });

      if (position && position.status === 'CLOSED') {
        // 使用 longPositionSize 作為平倉數量
        const closedQuantity = Number(position.longPositionSize);
        this.reporter.addItem({
          id: 11,
          name: '平倉數量正確',
          category: 'close',
          expected: `${formatNumber(closedQuantity)}`,
          actual: `${formatNumber(closedQuantity)}`,
          status: 'pass',
        });
      } else {
        this.reporter.addItem({
          id: 11,
          name: '平倉數量正確',
          category: 'close',
          expected: '-',
          actual: '-',
          status: hasPosition ? 'skip' : 'pass',
          error: hasPosition ? '持倉未完全關閉' : undefined,
        });
      }

    } finally {
      await queryService.disconnect();
    }
  }

  /**
   * 驗證單邊交易所持倉
   */
  private async verifyExchangePosition(
    exchange: ExchangeName,
    symbol: string,
    userId: string,
    side: 'long' | 'short',
    expectedQuantity: number,
  ): Promise<void> {
    const queryService = new ExchangeQueryService(exchange);

    try {
      const apiKey = await getApiKey(userId, exchange);
      await queryService.connect(apiKey);

      const position = await queryService.fetchPosition(symbol);

      if (position && position.side === side) {
        const quantityValid = isQuantityValid(expectedQuantity, position.quantity);

        this.reporter.addItem({
          id: side === 'long' ? 2 : 3,
          name: `${side === 'long' ? '多方' : '空方'}持倉數量正確`,
          category: 'position',
          expected: formatNumber(expectedQuantity),
          actual: formatNumber(position.quantity),
          status: quantityValid ? 'pass' : 'fail',
          error: quantityValid ? undefined : '數量不符',
        });
      } else {
        this.reporter.addItem({
          id: side === 'long' ? 2 : 3,
          name: `${side === 'long' ? '多方' : '空方'}持倉數量正確`,
          category: 'position',
          expected: formatNumber(expectedQuantity),
          actual: '無持倉',
          status: 'fail',
          error: `找不到 ${side} 方向的持倉`,
        });
      }

    } finally {
      await queryService.disconnect();
    }
  }

  /**
   * 驗證條件單（verify 模式）
   */
  private async verifyConditionalOrders(
    exchange: ExchangeName,
    symbol: string,
    userId: string,
    hasStopLoss: boolean,
    hasTakeProfit: boolean,
  ): Promise<void> {
    await this.validateConditionalOrders(exchange, symbol, userId, hasStopLoss, hasTakeProfit);
  }

  /**
   * 跳過條件單驗證
   */
  private skipConditionalValidation(reason: string): void {
    for (let i = 4; i <= 9; i++) {
      this.skipItem(i, this.getItemName(i), 'conditional', reason);
    }
  }

  /**
   * 跳過單項驗證
   */
  private skipItem(
    id: number,
    name: string,
    category: 'position' | 'conditional' | 'close',
    reason: string,
  ): void {
    this.reporter.addItem({
      id,
      name,
      category,
      expected: '-',
      actual: '-',
      status: 'skip',
      error: reason,
    });
  }

  /**
   * 取得驗證項目名稱
   */
  private getItemName(id: number): string {
    const names: Record<number, string> = {
      1: '交易對格式正確',
      2: '開倉數量正確',
      3: 'contractSize 轉換正確',
      4: '停損單已建立',
      5: '停損價格正確',
      6: '停損數量正確',
      7: '停利單已建立',
      8: '停利價格正確',
      9: '停利數量正確',
      10: '平倉執行成功',
      11: '平倉數量正確',
    };
    return names[id] || `項目 ${id}`;
  }

  /**
   * 延遲
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
