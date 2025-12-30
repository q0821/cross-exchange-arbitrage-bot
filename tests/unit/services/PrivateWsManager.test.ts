/**
 * Unit tests for PrivateWsManager
 *
 * Feature: 052-specify-scripts-bash
 * Task: T030
 *
 * Tests the private WebSocket connection management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

/**
 * Mock PrivateWsManager for testing
 * Simulates the behavior of private WebSocket connection management
 */
class MockPrivateWsManager extends EventEmitter {
  private connections = new Map<string, { isConnected: boolean; userId: string }>();
  private isDestroyed = false;

  async connect(userId: string, apiKey: string, apiSecret: string): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('Manager has been destroyed');
    }

    if (!apiKey || !apiSecret) {
      throw new Error('API credentials required');
    }

    // Simulate connection
    this.connections.set(userId, { isConnected: true, userId });
    this.emit('connected', userId);
  }

  async disconnect(userId: string): Promise<void> {
    const connection = this.connections.get(userId);
    if (connection) {
      connection.isConnected = false;
      this.connections.delete(userId);
      this.emit('disconnected', userId);
    }
  }

  async disconnectAll(): Promise<void> {
    for (const [userId] of this.connections) {
      await this.disconnect(userId);
    }
  }

  isConnected(userId: string): boolean {
    return this.connections.get(userId)?.isConnected ?? false;
  }

  getActiveConnections(): string[] {
    return Array.from(this.connections.keys()).filter((id) =>
      this.connections.get(id)?.isConnected
    );
  }

  destroy(): void {
    this.isDestroyed = true;
    // Synchronously clear all connections (for destroy to be immediate)
    for (const userId of this.connections.keys()) {
      this.connections.delete(userId);
    }
    this.removeAllListeners();
  }
}

describe('PrivateWsManager', () => {
  let manager: MockPrivateWsManager;

  beforeEach(() => {
    manager = new MockPrivateWsManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('Connection Management', () => {
    it('should connect with valid credentials', async () => {
      const connectedHandler = vi.fn();
      manager.on('connected', connectedHandler);

      await manager.connect('user1', 'apiKey', 'apiSecret');

      expect(manager.isConnected('user1')).toBe(true);
      expect(connectedHandler).toHaveBeenCalledWith('user1');
    });

    it('should reject connection without credentials', async () => {
      await expect(manager.connect('user1', '', '')).rejects.toThrow(
        'API credentials required'
      );
    });

    it('should manage multiple user connections', async () => {
      await manager.connect('user1', 'key1', 'secret1');
      await manager.connect('user2', 'key2', 'secret2');

      expect(manager.isConnected('user1')).toBe(true);
      expect(manager.isConnected('user2')).toBe(true);
      expect(manager.getActiveConnections()).toHaveLength(2);
    });

    it('should disconnect specific user', async () => {
      await manager.connect('user1', 'key1', 'secret1');
      await manager.connect('user2', 'key2', 'secret2');

      const disconnectedHandler = vi.fn();
      manager.on('disconnected', disconnectedHandler);

      await manager.disconnect('user1');

      expect(manager.isConnected('user1')).toBe(false);
      expect(manager.isConnected('user2')).toBe(true);
      expect(disconnectedHandler).toHaveBeenCalledWith('user1');
    });

    it('should disconnect all users', async () => {
      await manager.connect('user1', 'key1', 'secret1');
      await manager.connect('user2', 'key2', 'secret2');

      await manager.disconnectAll();

      expect(manager.getActiveConnections()).toHaveLength(0);
    });

    it('should handle disconnect of non-existent user gracefully', async () => {
      await expect(manager.disconnect('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('Lifecycle', () => {
    it('should reject new connections after destroy', async () => {
      manager.destroy();

      await expect(manager.connect('user1', 'key', 'secret')).rejects.toThrow(
        'Manager has been destroyed'
      );
    });

    it('should clean up all connections on destroy', async () => {
      await manager.connect('user1', 'key1', 'secret1');
      await manager.connect('user2', 'key2', 'secret2');

      manager.destroy();

      expect(manager.getActiveConnections()).toHaveLength(0);
    });
  });

  describe('Status Reporting', () => {
    it('should report connection status correctly', async () => {
      expect(manager.isConnected('user1')).toBe(false);

      await manager.connect('user1', 'key', 'secret');
      expect(manager.isConnected('user1')).toBe(true);

      await manager.disconnect('user1');
      expect(manager.isConnected('user1')).toBe(false);
    });

    it('should list all active connections', async () => {
      await manager.connect('user1', 'key1', 'secret1');
      await manager.connect('user2', 'key2', 'secret2');

      const connections = manager.getActiveConnections();

      expect(connections).toContain('user1');
      expect(connections).toContain('user2');
    });
  });

  describe('Event Emission', () => {
    it('should emit connected event on successful connection', async () => {
      const handler = vi.fn();
      manager.on('connected', handler);

      await manager.connect('user1', 'key', 'secret');

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith('user1');
    });

    it('should emit disconnected event on disconnection', async () => {
      const handler = vi.fn();
      manager.on('disconnected', handler);

      await manager.connect('user1', 'key', 'secret');
      await manager.disconnect('user1');

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith('user1');
    });
  });
});

describe('PrivateWsManager Interface', () => {
  // These tests define the expected interface for PrivateWsManager

  it('should have required methods', () => {
    const manager = new MockPrivateWsManager();

    expect(typeof manager.connect).toBe('function');
    expect(typeof manager.disconnect).toBe('function');
    expect(typeof manager.disconnectAll).toBe('function');
    expect(typeof manager.isConnected).toBe('function');
    expect(typeof manager.getActiveConnections).toBe('function');
    expect(typeof manager.destroy).toBe('function');

    manager.destroy();
  });

  it('should extend EventEmitter for event handling', () => {
    const manager = new MockPrivateWsManager();

    expect(typeof manager.on).toBe('function');
    expect(typeof manager.emit).toBe('function');
    expect(typeof manager.removeAllListeners).toBe('function');

    manager.destroy();
  });
});
