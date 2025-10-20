// 交易所通用類型定義

export type ExchangeName = 'binance' | 'okx';

export type OrderSide = 'LONG' | 'SHORT';
export type OrderType = 'MARKET' | 'LIMIT';
export type OrderStatus = 'FILLED' | 'PARTIAL' | 'CANCELED' | 'FAILED' | 'PENDING';

// 資金費率資料
export interface FundingRateData {
  exchange: ExchangeName;
  symbol: string;
  fundingRate: number;
  nextFundingTime: Date;
  markPrice?: number;
  indexPrice?: number;
  recordedAt: Date;
}

// 價格資料
export interface PriceData {
  exchange: ExchangeName;
  symbol: string;
  price: number;
  timestamp: Date;
}

// 訂單資料
export interface OrderRequest {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number; // 限價單必填
  leverage?: number;
  clientOrderId?: string;
}

export interface OrderResponse {
  orderId: string;
  clientOrderId?: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  status: OrderStatus;
  quantity: number;
  filledQuantity: number;
  price?: number;
  averagePrice: number;
  fee: number;
  feeCurrency: string;
  timestamp: Date;
}

// 帳戶餘額
export interface Balance {
  asset: string;
  free: number; // 可用餘額
  locked: number; // 凍結餘額
  total: number; // 總餘額
}

export interface AccountBalance {
  exchange: ExchangeName;
  balances: Balance[];
  totalEquityUSD: number;
  timestamp: Date;
}

// 持倉資訊
export interface Position {
  symbol: string;
  side: OrderSide;
  quantity: number;
  entryPrice: number;
  markPrice: number;
  leverage: number;
  marginUsed: number;
  unrealizedPnl: number;
  liquidationPrice?: number;
  timestamp: Date;
}

export interface PositionInfo {
  exchange: ExchangeName;
  positions: Position[];
  timestamp: Date;
}

// 交易對資訊
export interface SymbolInfo {
  symbol: string;
  baseAsset: string; // 基礎貨幣 (如 BTC)
  quoteAsset: string; // 計價貨幣 (如 USDT)
  minQuantity: number; // 最小下單數量
  maxQuantity: number; // 最大下單數量
  minNotional: number; // 最小下單金額
  pricePrecision: number; // 價格精度
  quantityPrecision: number; // 數量精度
  tickSize: number; // 價格最小變動單位
  stepSize: number; // 數量最小變動單位
  isActive: boolean;
}

// WebSocket 訂閱類型
export type WSSubscriptionType =
  | 'ticker' // 價格更新
  | 'fundingRate' // 資金費率
  | 'orderUpdate' // 訂單更新
  | 'positionUpdate'; // 持倉更新

export interface WSSubscription {
  type: WSSubscriptionType;
  symbol?: string;
  callback: (data: unknown) => void;
}

// 交易所介面
export interface IExchangeConnector {
  readonly name: ExchangeName;
  readonly isTestnet: boolean;

  // 連線管理
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // 市場資料
  getFundingRate(symbol: string): Promise<FundingRateData>;
  getFundingRates(symbols: string[]): Promise<FundingRateData[]>;
  getPrice(symbol: string): Promise<PriceData>;
  getPrices(symbols: string[]): Promise<PriceData[]>;
  getSymbolInfo(symbol: string): Promise<SymbolInfo>;

  // 帳戶資訊
  getBalance(): Promise<AccountBalance>;
  getPositions(): Promise<PositionInfo>;
  getPosition(symbol: string): Promise<Position | null>;

  // 交易操作
  createOrder(order: OrderRequest): Promise<OrderResponse>;
  cancelOrder(symbol: string, orderId: string): Promise<void>;
  getOrder(symbol: string, orderId: string): Promise<OrderResponse>;

  // WebSocket 訂閱
  subscribeWS(subscription: WSSubscription): Promise<void>;
  unsubscribeWS(type: WSSubscriptionType, symbol?: string): Promise<void>;

  // 工具方法
  validateSymbol(symbol: string): Promise<boolean>;
  formatQuantity(symbol: string, quantity: number): Promise<number>;
  formatPrice(symbol: string, price: number): Promise<number>;
}

// 交易所工廠介面
export interface IExchangeFactory {
  createConnector(exchange: ExchangeName): IExchangeConnector;
}
