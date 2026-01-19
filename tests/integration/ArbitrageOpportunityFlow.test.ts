/**
 * Integration Test: ArbitrageOpportunity Flow
 *
 * Feature: 065-arbitrage-opportunity-tracking
 * Phase: 7 - Polish
 * Task: T023 - 整合測試
 *
 * 測試完整的套利機會生命週期：create → update → markAsEnded
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import { ArbitrageOpportunityRepository } from '@/repositories/ArbitrageOpportunityRepository';

// 只在整合測試環境執行
const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === 'true';

describe.skipIf(!RUN_INTEGRATION)('ArbitrageOpportunity Integration Flow', () => {
  let repository: ArbitrageOpportunityRepository;

  beforeAll(async () => {
    repository = new ArbitrageOpportunityRepository();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // 清理測試資料
    await prisma.arbitrageOpportunity.deleteMany({
      where: {
        symbol: {
          startsWith: 'TEST',
        },
      },
    });
  });

  describe('完整生命週期', () => {
    it('應該正確追蹤機會從發現到結束', async () => {
      const symbol = 'TESTUSDT';
      const longExchange = 'binance';
      const shortExchange = 'okx';

      // 1. 建立新機會（模擬 opportunity-detected 事件）
      const created = await repository.upsert({
        symbol,
        longExchange,
        shortExchange,
        spread: 0.75,
        apy: 273.75,
        longIntervalHours: 8,
        shortIntervalHours: 8,
      });

      expect(created.id).toBeDefined();
      expect(created.status).toBe('ACTIVE');
      expect(Number(created.initialSpread)).toBeCloseTo(0.75, 4);
      expect(Number(created.currentSpread)).toBeCloseTo(0.75, 4);

      // 2. 更新機會（費差變大）
      const updated = await repository.upsert({
        symbol,
        longExchange,
        shortExchange,
        spread: 0.85,
        apy: 310.25,
        longIntervalHours: 8,
        shortIntervalHours: 8,
      });

      expect(updated.id).toBe(created.id); // 同一筆記錄
      expect(Number(updated.currentSpread)).toBeCloseTo(0.85, 4);
      expect(Number(updated.maxSpread)).toBeCloseTo(0.85, 4);

      // 3. 結束機會（模擬 opportunity-disappeared 事件）
      const ended = await repository.markAsEnded(
        symbol,
        longExchange,
        shortExchange,
        0.48,
        175.2
      );

      expect(ended).not.toBeNull();
      expect(ended!.status).toBe('ENDED');
      expect(ended!.endedAt).not.toBeNull();
      expect(ended!.durationMs).not.toBeNull();
      expect(Number(ended!.currentSpread)).toBeCloseTo(0.48, 4);
    });

    it('應該支援同一 symbol 的多個交易所組合', async () => {
      const symbol = 'TESTETH';

      // 建立兩個不同交易所組合的機會
      const opp1 = await repository.upsert({
        symbol,
        longExchange: 'binance',
        shortExchange: 'okx',
        spread: 0.75,
        apy: 273.75,
        longIntervalHours: 8,
        shortIntervalHours: 8,
      });

      const opp2 = await repository.upsert({
        symbol,
        longExchange: 'gateio',
        shortExchange: 'mexc',
        spread: 0.65,
        apy: 237.25,
        longIntervalHours: 8,
        shortIntervalHours: 4,
      });

      // 驗證是兩筆不同的記錄
      expect(opp1.id).not.toBe(opp2.id);

      // 查詢所有 ACTIVE 機會
      const activeList = await repository.findAllActiveBySymbol(symbol);
      expect(activeList).toHaveLength(2);
    });
  });

  describe('公開 API 回應格式', () => {
    it('應該回傳正確的 PublicOpportunityDTO 格式', async () => {
      // 建立並結束一個機會
      const symbol = 'TESTPUB';
      await repository.upsert({
        symbol,
        longExchange: 'binance',
        shortExchange: 'okx',
        spread: 0.75,
        apy: 273.75,
        longIntervalHours: 8,
        shortIntervalHours: 8,
      });

      await repository.markAsEnded(symbol, 'binance', 'okx', 0.48, 175.2);

      // 查詢公開 API
      const { data } = await repository.getPublicOpportunities({
        days: 7,
        page: 1,
        limit: 10,
        status: 'ENDED',
      });

      const found = data.find(d => d.symbol === symbol);
      expect(found).toBeDefined();

      // 驗證 PublicOpportunityDTO 欄位
      expect(found).toHaveProperty('id');
      expect(found).toHaveProperty('symbol', symbol);
      expect(found).toHaveProperty('longExchange', 'binance');
      expect(found).toHaveProperty('shortExchange', 'okx');
      expect(found).toHaveProperty('maxSpread');
      expect(found).toHaveProperty('finalSpread');
      expect(found).toHaveProperty('realizedAPY');
      expect(found).toHaveProperty('durationMs');
      expect(found).toHaveProperty('appearedAt');
      expect(found).toHaveProperty('disappearedAt');
    });

    it('應該支援時間篩選', async () => {
      // 建立並結束一個機會
      const symbol = 'TESTFILTER';
      await repository.upsert({
        symbol,
        longExchange: 'binance',
        shortExchange: 'okx',
        spread: 0.75,
        apy: 273.75,
        longIntervalHours: 8,
        shortIntervalHours: 8,
      });

      await repository.markAsEnded(symbol, 'binance', 'okx', 0.48, 175.2);

      // 7 天內應該找得到
      const result7 = await repository.getPublicOpportunities({
        days: 7,
        status: 'ENDED',
      });
      const found7 = result7.data.find(d => d.symbol === symbol);
      expect(found7).toBeDefined();

      // 30 天內也應該找得到
      const result30 = await repository.getPublicOpportunities({
        days: 30,
        status: 'ENDED',
      });
      const found30 = result30.data.find(d => d.symbol === symbol);
      expect(found30).toBeDefined();
    });

    it('應該支援狀態篩選', async () => {
      const symbol = 'TESTSTATUSFILTER';

      // 建立 ACTIVE 機會
      await repository.upsert({
        symbol,
        longExchange: 'binance',
        shortExchange: 'okx',
        spread: 0.75,
        apy: 273.75,
        longIntervalHours: 8,
        shortIntervalHours: 8,
      });

      // ACTIVE 篩選應該找得到
      const activeResult = await repository.getPublicOpportunities({
        days: 7,
        status: 'ACTIVE',
      });
      const foundActive = activeResult.data.find(d => d.symbol === symbol);
      expect(foundActive).toBeDefined();

      // ENDED 篩選應該找不到
      const endedResult = await repository.getPublicOpportunities({
        days: 7,
        status: 'ENDED',
      });
      const foundEnded = endedResult.data.find(d => d.symbol === symbol);
      expect(foundEnded).toBeUndefined();
    });
  });
});
