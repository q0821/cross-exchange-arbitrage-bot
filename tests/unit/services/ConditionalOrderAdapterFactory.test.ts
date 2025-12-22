/**
 * ConditionalOrderAdapterFactory Unit Tests
 *
 * 測試條件單適配器工廠，特別是 OKX 帳戶模式偵測
 * Feature: 040-fix-conditional-orders
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectOkxPositionMode } from '../../../src/services/trading/okx-position-mode';
import { logger } from '../../../src/lib/logger';

// Mock logger
vi.mock('../../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('ConditionalOrderAdapterFactory', () => {
  describe('detectOkxPositionMode', () => {
    let mockCcxtExchange: any;

    beforeEach(() => {
      mockCcxtExchange = {
        privateGetAccountConfig: vi.fn(),
      };
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should detect long_short_mode when posMode is long_short_mode', async () => {
      // Arrange
      mockCcxtExchange.privateGetAccountConfig.mockResolvedValue({
        code: '0',
        data: [{ posMode: 'long_short_mode' }],
      });

      // Act
      const result = await detectOkxPositionMode(mockCcxtExchange);

      // Assert
      expect(result).toBe('long_short_mode');
      expect(mockCcxtExchange.privateGetAccountConfig).toHaveBeenCalled();
    });

    it('should detect net_mode when posMode is net_mode', async () => {
      // Arrange
      mockCcxtExchange.privateGetAccountConfig.mockResolvedValue({
        code: '0',
        data: [{ posMode: 'net_mode' }],
      });

      // Act
      const result = await detectOkxPositionMode(mockCcxtExchange);

      // Assert
      expect(result).toBe('net_mode');
    });

    it('should default to long_short_mode on API error and log warning', async () => {
      // Arrange
      mockCcxtExchange.privateGetAccountConfig.mockRejectedValue(
        new Error('API timeout'),
      );

      // Act
      const result = await detectOkxPositionMode(mockCcxtExchange);

      // Assert
      expect(result).toBe('long_short_mode');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(Error) }),
        expect.stringContaining('Failed to detect OKX position mode'),
      );
    });
  });
});
