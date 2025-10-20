declare module 'ccxt' {
  export = ccxt;

  namespace ccxt {
    interface Dictionary<T> {
      [key: string]: T;
    }

    class Exchange {
      constructor(config?: ExchangeConfig);
      fetchTime(): Promise<number>;
      fetchFundingRate(symbol: string): Promise<FundingRate>;
      fetchFundingRates(symbols?: string[]): Promise<Dictionary<FundingRate>>;
      fetchTicker(symbol: string): Promise<Ticker>;
      fetchTickers(symbols?: string[]): Promise<Dictionary<Ticker>>;
      fetchBalance(): Promise<Balances>;
      fetchPositions(symbols?: string[]): Promise<Position[]>;
      loadMarkets(): Promise<Dictionary<Market>>;
      createOrder(symbol: string, type: string, side: string, amount: number, price?: number, params?: unknown): Promise<Order>;
      cancelOrder(id: string, symbol?: string, params?: unknown): Promise<void>;
      fetchOrder(id: string, symbol?: string, params?: unknown): Promise<Order>;
    }

    class okx extends Exchange {}

    interface ExchangeConfig {
      apiKey?: string;
      secret?: string;
      password?: string;
      enableRateLimit?: boolean;
      options?: unknown;
    }

    interface FundingRate {
      symbol: string;
      fundingRate?: number;
      fundingTimestamp?: number;
      markPrice?: number;
      indexPrice?: number;
    }

    interface Ticker {
      symbol: string;
      last?: number;
      timestamp?: number;
    }

    interface Position {
      symbol: string;
      side?: string;
      contracts?: number;
      entryPrice?: number;
      markPrice?: number;
      leverage?: number;
      initialMargin?: number;
      unrealizedPnl?: number;
      liquidationPrice?: number;
      timestamp?: number;
    }

    interface Balances {
      free: Dictionary<number>;
      used: Dictionary<number>;
      total: Dictionary<number>;
    }

    interface Market {
      symbol: string;
      base: string;
      quote: string;
      active: boolean;
      precision: {
        amount?: number;
        price?: number;
      };
      limits: {
        amount?: { min?: number; max?: number };
        cost?: { min?: number; max?: number };
      };
    }

    interface Order {
      id: string;
      clientOrderId?: string;
      symbol: string;
      type?: string;
      side?: string;
      status?: string;
      amount: number;
      filled?: number;
      price?: number;
      average?: number;
      timestamp?: number;
      fee?: {
        cost?: number;
        currency?: string;
      };
    }

    class NetworkError extends Error {}
    class ExchangeError extends Error {}
  }
}
