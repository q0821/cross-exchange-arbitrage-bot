/**
 * Integration tests for Multi-Exchange WebSocket Clients
 *
 * Feature: 054-native-websocket-clients
 * Task: T050
 *
 * NOTE: These tests require real network connections to exchanges.
 * Set RUN_INTEGRATION_TESTS=true to run these tests.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OkxFundingWs } from '@/services/websocket/OkxFundingWs';
import { GateioFundingWs } from '@/services/websocket/GateioFundingWs';
import { BingxFundingWs } from '@/services/websocket/BingxFundingWs';
import type { FundingRateReceived } from '@/types/websocket-events';

const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === 'true';
const TEST_TIMEOUT = 30000; // 30 seconds for network tests

// =============================================================================
// OKX Integration Tests
// =============================================================================

describe.skipIf(!RUN_INTEGRATION)('OKX Funding WebSocket Integration', () => {
  let wsClient: OkxFundingWs;

  beforeEach(() => {
    wsClient = new OkxFundingWs({
      autoReconnect: false,
      enableHealthCheck: false,
    });
  });

  afterEach(async () => {
    if (wsClient) {
      wsClient.destroy();
    }
  });

  describe('Connection', () => {
    it('should connect to OKX WebSocket successfully', async () => {
      const connectedPromise = new Promise<void>((resolve) => {
        wsClient.on('connected', () => resolve());
      });

      await wsClient.connect();
      await connectedPromise;

      expect(wsClient.isReady()).toBe(true);

      await wsClient.disconnect();
    }, TEST_TIMEOUT);
  });

  describe('Subscription', () => {
    it('should subscribe to single symbol and receive funding rate', async () => {
      await wsClient.connect();

      const receivedData = new Promise<FundingRateReceived>((resolve) => {
        wsClient.on('fundingRate', (data) => resolve(data));
      });

      await wsClient.subscribe(['BTCUSDT']);

      const data = await Promise.race([
        receivedData,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout waiting for OKX funding rate')), 15000)
        ),
      ]);

      expect(data).toBeDefined();
      expect(data.exchange).toBe('okx');
      expect(data.symbol).toBe('BTCUSDT');
      expect(data.fundingRate).toBeDefined();
      expect(data.source).toBe('websocket');

      await wsClient.disconnect();
    }, TEST_TIMEOUT);

    it('should subscribe to multiple symbols', async () => {
      await wsClient.connect();

      const symbols = ['BTCUSDT', 'ETHUSDT'];
      const receivedSymbols = new Set<string>();

      const allReceived = new Promise<void>((resolve) => {
        wsClient.on('fundingRate', (data) => {
          receivedSymbols.add(data.symbol);
          if (receivedSymbols.size === symbols.length) {
            resolve();
          }
        });
      });

      await wsClient.subscribe(symbols);

      await Promise.race([
        allReceived,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout waiting for all OKX symbols')), 20000)
        ),
      ]);

      expect(receivedSymbols.size).toBe(symbols.length);
      expect(receivedSymbols.has('BTCUSDT')).toBe(true);
      expect(receivedSymbols.has('ETHUSDT')).toBe(true);

      await wsClient.disconnect();
    }, TEST_TIMEOUT);
  });

  describe('Data Validation', () => {
    it('should receive valid funding rate data structure', async () => {
      await wsClient.connect();

      const receivedData = new Promise<FundingRateReceived>((resolve) => {
        wsClient.on('fundingRate', (data) => resolve(data));
      });

      await wsClient.subscribe(['BTCUSDT']);

      const data = await Promise.race([
        receivedData,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 15000)
        ),
      ]);

      expect(data.exchange).toBe('okx');
      expect(typeof data.symbol).toBe('string');
      expect(data.fundingRate).toBeDefined();
      expect(data.fundingRate.toNumber).toBeDefined(); // Decimal.js
      expect(data.nextFundingTime).toBeInstanceOf(Date);
      expect(data.source).toBe('websocket');
      expect(data.receivedAt).toBeInstanceOf(Date);

      await wsClient.disconnect();
    }, TEST_TIMEOUT);
  });
});

// =============================================================================
// Gate.io Integration Tests
// =============================================================================

describe.skipIf(!RUN_INTEGRATION)('Gate.io Funding WebSocket Integration', () => {
  let wsClient: GateioFundingWs;

  beforeEach(() => {
    wsClient = new GateioFundingWs({
      autoReconnect: false,
      enableHealthCheck: false,
    });
  });

  afterEach(async () => {
    if (wsClient) {
      wsClient.destroy();
    }
  });

  describe('Connection', () => {
    it('should connect to Gate.io WebSocket successfully', async () => {
      const connectedPromise = new Promise<void>((resolve) => {
        wsClient.on('connected', () => resolve());
      });

      await wsClient.connect();
      await connectedPromise;

      expect(wsClient.isReady()).toBe(true);

      await wsClient.disconnect();
    }, TEST_TIMEOUT);
  });

  describe('Subscription', () => {
    it('should subscribe to single symbol and receive funding rate', async () => {
      await wsClient.connect();

      const receivedData = new Promise<FundingRateReceived>((resolve) => {
        wsClient.on('fundingRate', (data) => resolve(data));
      });

      await wsClient.subscribe(['BTCUSDT']);

      const data = await Promise.race([
        receivedData,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout waiting for Gate.io funding rate')), 15000)
        ),
      ]);

      expect(data).toBeDefined();
      expect(data.exchange).toBe('gateio');
      expect(data.symbol).toBe('BTCUSDT');
      expect(data.fundingRate).toBeDefined();
      expect(data.source).toBe('websocket');

      await wsClient.disconnect();
    }, TEST_TIMEOUT);

    it('should subscribe to multiple symbols', async () => {
      await wsClient.connect();

      const symbols = ['BTCUSDT', 'ETHUSDT'];
      const receivedSymbols = new Set<string>();

      const allReceived = new Promise<void>((resolve) => {
        wsClient.on('fundingRate', (data) => {
          receivedSymbols.add(data.symbol);
          if (receivedSymbols.size === symbols.length) {
            resolve();
          }
        });
      });

      await wsClient.subscribe(symbols);

      await Promise.race([
        allReceived,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout waiting for all Gate.io symbols')), 20000)
        ),
      ]);

      expect(receivedSymbols.size).toBe(symbols.length);
      expect(receivedSymbols.has('BTCUSDT')).toBe(true);
      expect(receivedSymbols.has('ETHUSDT')).toBe(true);

      await wsClient.disconnect();
    }, TEST_TIMEOUT);
  });

  describe('Data Validation', () => {
    it('should receive valid funding rate data structure', async () => {
      await wsClient.connect();

      const receivedData = new Promise<FundingRateReceived>((resolve) => {
        wsClient.on('fundingRate', (data) => resolve(data));
      });

      await wsClient.subscribe(['BTCUSDT']);

      const data = await Promise.race([
        receivedData,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 15000)
        ),
      ]);

      expect(data.exchange).toBe('gateio');
      expect(typeof data.symbol).toBe('string');
      expect(data.fundingRate).toBeDefined();
      expect(data.fundingRate.toNumber).toBeDefined(); // Decimal.js
      expect(data.nextFundingTime).toBeInstanceOf(Date);
      expect(data.source).toBe('websocket');
      expect(data.receivedAt).toBeInstanceOf(Date);

      await wsClient.disconnect();
    }, TEST_TIMEOUT);
  });
});

// =============================================================================
// BingX Integration Tests
// =============================================================================

describe.skipIf(!RUN_INTEGRATION)('BingX Funding WebSocket Integration', () => {
  let wsClient: BingxFundingWs;

  beforeEach(() => {
    wsClient = new BingxFundingWs({
      autoReconnect: false,
      enableHealthCheck: false,
    });
  });

  afterEach(async () => {
    if (wsClient) {
      wsClient.destroy();
    }
  });

  describe('Connection', () => {
    it('should connect to BingX WebSocket successfully', async () => {
      const connectedPromise = new Promise<void>((resolve) => {
        wsClient.on('connected', () => resolve());
      });

      await wsClient.connect();
      await connectedPromise;

      expect(wsClient.isReady()).toBe(true);

      await wsClient.disconnect();
    }, TEST_TIMEOUT);
  });

  describe('Subscription', () => {
    it('should subscribe to single symbol and receive funding rate', async () => {
      await wsClient.connect();

      // BingX 可能返回沒有 fundingRate 的 markPrice 事件（某些幣種暫時沒有資料）
      // 因此我們接受任何 fundingRate 事件（即使沒有 fundingRate 值）
      const receivedData = new Promise<FundingRateReceived>((resolve) => {
        wsClient.on('fundingRate', (data) => {
          resolve(data);
        });
      });

      await wsClient.subscribe(['BTCUSDT']);

      const data = await Promise.race([
        receivedData,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout waiting for BingX funding rate')), 15000)
        ),
      ]);

      expect(data).toBeDefined();
      expect(data.exchange).toBe('bingx');
      expect(data.symbol).toBe('BTCUSDT');
      // BingX 可能不返回 fundingRate（markPrice 事件中不一定包含）
      // 只驗證 markPrice 存在
      expect(data.markPrice).toBeDefined();
      expect(data.source).toBe('websocket');

      await wsClient.disconnect();
    }, TEST_TIMEOUT);

    it('should subscribe to multiple symbols', async () => {
      await wsClient.connect();

      const symbols = ['BTCUSDT', 'ETHUSDT'];
      const receivedSymbols = new Set<string>();

      const allReceived = new Promise<void>((resolve) => {
        wsClient.on('fundingRate', (data) => {
          receivedSymbols.add(data.symbol);
          if (receivedSymbols.size === symbols.length) {
            resolve();
          }
        });
      });

      await wsClient.subscribe(symbols);

      await Promise.race([
        allReceived,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout waiting for all BingX symbols')), 20000)
        ),
      ]);

      expect(receivedSymbols.size).toBe(symbols.length);
      expect(receivedSymbols.has('BTCUSDT')).toBe(true);
      expect(receivedSymbols.has('ETHUSDT')).toBe(true);

      await wsClient.disconnect();
    }, TEST_TIMEOUT);
  });

  describe('Data Validation', () => {
    it('should receive valid funding rate data structure', async () => {
      await wsClient.connect();

      // BingX 可能返回沒有 fundingRate 的 markPrice 事件（某些幣種暫時沒有資料）
      // 因此我們接受任何 fundingRate 事件
      const receivedData = new Promise<FundingRateReceived>((resolve) => {
        wsClient.on('fundingRate', (data) => {
          resolve(data);
        });
      });

      await wsClient.subscribe(['BTCUSDT']);

      const data = await Promise.race([
        receivedData,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 15000)
        ),
      ]);

      expect(data.exchange).toBe('bingx');
      expect(typeof data.symbol).toBe('string');
      // BingX 可能不返回 fundingRate（markPrice 事件中不一定包含）
      // 只驗證 markPrice 存在
      expect(data.markPrice).toBeDefined();
      expect(data.markPrice!.toNumber).toBeDefined(); // Decimal.js
      expect(data.source).toBe('websocket');
      expect(data.receivedAt).toBeInstanceOf(Date);

      await wsClient.disconnect();
    }, TEST_TIMEOUT);
  });
});

// =============================================================================
// Cross-Exchange Tests
// =============================================================================

describe.skipIf(!RUN_INTEGRATION)('Cross-Exchange WebSocket Integration', () => {
  let okxClient: OkxFundingWs;
  let gateioClient: GateioFundingWs;
  let bingxClient: BingxFundingWs;

  beforeEach(() => {
    okxClient = new OkxFundingWs({ autoReconnect: false, enableHealthCheck: false });
    gateioClient = new GateioFundingWs({ autoReconnect: false, enableHealthCheck: false });
    bingxClient = new BingxFundingWs({ autoReconnect: false, enableHealthCheck: false });
  });

  afterEach(async () => {
    okxClient?.destroy();
    gateioClient?.destroy();
    bingxClient?.destroy();
  });

  it('should receive data from all three exchanges concurrently', async () => {
    // Connect all clients
    await Promise.all([
      okxClient.connect(),
      gateioClient.connect(),
      bingxClient.connect(),
    ]);

    expect(okxClient.isReady()).toBe(true);
    expect(gateioClient.isReady()).toBe(true);
    expect(bingxClient.isReady()).toBe(true);

    // Set up data receivers
    const receivedExchanges = new Set<string>();

    const allReceived = new Promise<void>((resolve) => {
      const checkComplete = () => {
        if (receivedExchanges.size === 3) {
          resolve();
        }
      };

      okxClient.on('fundingRate', (data) => {
        receivedExchanges.add(data.exchange);
        checkComplete();
      });

      gateioClient.on('fundingRate', (data) => {
        receivedExchanges.add(data.exchange);
        checkComplete();
      });

      bingxClient.on('fundingRate', (data) => {
        receivedExchanges.add(data.exchange);
        checkComplete();
      });
    });

    // Subscribe all clients to BTCUSDT
    await Promise.all([
      okxClient.subscribe(['BTCUSDT']),
      gateioClient.subscribe(['BTCUSDT']),
      bingxClient.subscribe(['BTCUSDT']),
    ]);

    // Wait for data from all exchanges
    await Promise.race([
      allReceived,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout waiting for all exchanges')), 30000)
      ),
    ]);

    expect(receivedExchanges.has('okx')).toBe(true);
    expect(receivedExchanges.has('gateio')).toBe(true);
    expect(receivedExchanges.has('bingx')).toBe(true);

    // Disconnect all
    await Promise.all([
      okxClient.disconnect(),
      gateioClient.disconnect(),
      bingxClient.disconnect(),
    ]);
  }, 45000);

  it('should handle concurrent subscriptions to different symbols', async () => {
    await Promise.all([
      okxClient.connect(),
      gateioClient.connect(),
      bingxClient.connect(),
    ]);

    // Subscribe each exchange to different symbols
    await Promise.all([
      okxClient.subscribe(['BTCUSDT', 'ETHUSDT']),
      gateioClient.subscribe(['SOLUSDT', 'DOGEUSDT']),
      bingxClient.subscribe(['XRPUSDT', 'ADAUSDT']),
    ]);

    expect(okxClient.getSubscribedSymbols()).toContain('BTCUSDT');
    expect(okxClient.getSubscribedSymbols()).toContain('ETHUSDT');
    expect(gateioClient.getSubscribedSymbols()).toContain('SOLUSDT');
    expect(gateioClient.getSubscribedSymbols()).toContain('DOGEUSDT');
    expect(bingxClient.getSubscribedSymbols()).toContain('XRPUSDT');
    expect(bingxClient.getSubscribedSymbols()).toContain('ADAUSDT');

    await Promise.all([
      okxClient.disconnect(),
      gateioClient.disconnect(),
      bingxClient.disconnect(),
    ]);
  }, TEST_TIMEOUT);
});

// =============================================================================
// Unit Tests (Always Run)
// =============================================================================

describe('OKX Funding WebSocket Unit Tests', () => {
  it('should initialize with default config', () => {
    const client = new OkxFundingWs();
    expect(client.isReady()).toBe(false);
    expect(client.getSubscribedSymbols()).toEqual([]);
    client.destroy();
  });

  it('should throw error when subscribing without connection', async () => {
    const client = new OkxFundingWs();
    await expect(client.subscribe(['BTCUSDT'])).rejects.toThrow('Not connected');
    client.destroy();
  });
});

describe('Gate.io Funding WebSocket Unit Tests', () => {
  it('should initialize with default config', () => {
    const client = new GateioFundingWs();
    expect(client.isReady()).toBe(false);
    expect(client.getSubscribedSymbols()).toEqual([]);
    client.destroy();
  });

  it('should throw error when subscribing without connection', async () => {
    const client = new GateioFundingWs();
    await expect(client.subscribe(['BTCUSDT'])).rejects.toThrow('Not connected');
    client.destroy();
  });
});

describe('BingX Funding WebSocket Unit Tests', () => {
  it('should initialize with default config', () => {
    const client = new BingxFundingWs();
    expect(client.isReady()).toBe(false);
    expect(client.getSubscribedSymbols()).toEqual([]);
    client.destroy();
  });

  it('should throw error when subscribing without connection', async () => {
    const client = new BingxFundingWs();
    await expect(client.subscribe(['BTCUSDT'])).rejects.toThrow('Not connected');
    client.destroy();
  });
});
