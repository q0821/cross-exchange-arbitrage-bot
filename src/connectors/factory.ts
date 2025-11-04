import { IExchangeConnector, IExchangeFactory, ExchangeName } from './types.js';
import { BinanceConnector } from './binance.js';
import { OKXConnector } from './okx.js';
import { MexcConnector } from './mexc.js';
import { GateioConnector } from './gateio.js';
import { logger } from '../lib/logger.js';

export class ExchangeFactory implements IExchangeFactory {
  private connectors: Map<ExchangeName, IExchangeConnector> = new Map();

  createConnector(exchange: ExchangeName, isTestnet: boolean = false): IExchangeConnector {
    // 檢查是否已經建立過連接器
    const existingConnector = this.connectors.get(exchange);
    if (existingConnector && existingConnector.isTestnet === isTestnet) {
      logger.debug({ exchange, isTestnet }, 'Reusing existing connector');
      return existingConnector;
    }

    // 建立新的連接器
    let connector: IExchangeConnector;

    switch (exchange) {
      case 'binance':
        connector = new BinanceConnector(isTestnet);
        break;
      case 'okx':
        connector = new OKXConnector(isTestnet);
        break;
      case 'mexc':
        connector = new MexcConnector(isTestnet);
        break;
      case 'gateio':
        connector = new GateioConnector(isTestnet);
        break;
      default:
        throw new Error(`Unsupported exchange: ${exchange}`);
    }

    this.connectors.set(exchange, connector);
    logger.info({ exchange, isTestnet }, 'Exchange connector created');

    return connector;
  }

  getConnector(exchange: ExchangeName): IExchangeConnector | undefined {
    return this.connectors.get(exchange);
  }

  async connectAll(): Promise<void> {
    const promises = Array.from(this.connectors.values()).map((connector) =>
      connector.connect()
    );

    await Promise.all(promises);
    logger.info({
      exchanges: Array.from(this.connectors.keys()),
    }, 'All exchange connectors connected');
  }

  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.connectors.values()).map((connector) =>
      connector.disconnect()
    );

    await Promise.all(promises);
    logger.info({
      exchanges: Array.from(this.connectors.keys()),
    }, 'All exchange connectors disconnected');
  }

  getAllConnectors(): IExchangeConnector[] {
    return Array.from(this.connectors.values());
  }

  clear(): void {
    this.connectors.clear();
    logger.info('Exchange factory cleared');
  }
}

// 單例模式的工廠實例
let factoryInstance: ExchangeFactory | null = null;

export function getExchangeFactory(): ExchangeFactory {
  if (!factoryInstance) {
    factoryInstance = new ExchangeFactory();
  }
  return factoryInstance;
}

export function resetExchangeFactory(): void {
  factoryInstance = null;
}

// 便捷函式：直接建立交易所連接器
export function createExchange(exchange: ExchangeName, isTestnet: boolean = false): IExchangeConnector {
  const factory = getExchangeFactory();
  return factory.createConnector(exchange, isTestnet);
}
