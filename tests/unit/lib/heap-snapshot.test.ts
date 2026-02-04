/**
 * Heap Snapshot 單元測試
 *
 * 測試 heap snapshot 捕獲和分析功能
 *
 * 注意：這些測試進行實際的 heap snapshot 操作，需要較長時間
 * 在 CI 環境下跳過這些測試，因為 CI 資源有限容易超時
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  captureAndAnalyzeHeap,
  manualHeapCapture,
  resetCooldown,
  getHeapSnapshotDir,
  analyzeExistingSnapshot,
} from '@/lib/heap-snapshot';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// CI 環境下跳過這些資源密集型測試
const isCI = process.env.CI === 'true';

describe.skipIf(isCI)('heap-snapshot', () => {
  const heapDir = getHeapSnapshotDir();

  beforeEach(() => {
    // 每個測試前重置冷卻
    resetCooldown();

    // 清理測試產生的檔案
    if (fs.existsSync(heapDir)) {
      const files = fs.readdirSync(heapDir);
      for (const file of files) {
        if (file.startsWith('heap-') && file.includes('-test-')) {
          fs.unlinkSync(path.join(heapDir, file));
        }
      }
    }
  });

  afterEach(() => {
    // 清理測試產生的檔案
    if (fs.existsSync(heapDir)) {
      const files = fs.readdirSync(heapDir);
      for (const file of files) {
        if (file.startsWith('heap-') && file.includes('-test-')) {
          fs.unlinkSync(path.join(heapDir, file));
        }
      }
    }
  });

  describe('captureAndAnalyzeHeap', () => {
    it('應該成功捕獲並分析 heap snapshot', async () => {
      const report = await captureAndAnalyzeHeap('test-capture');

      expect(report).not.toBeNull();
      expect(report!.filepath).toContain('heap-');
      expect(report!.filepath).toContain('test-capture');
      expect(report!.capturedAt).toBeInstanceOf(Date);
      expect(report!.totalSize).toBeGreaterThan(0);
      expect(report!.topTypes).toBeInstanceOf(Array);
      expect(report!.topTypes.length).toBeGreaterThan(0);
    });

    it('分析報告應包含有效的類型統計', async () => {
      const report = await captureAndAnalyzeHeap('test-types');

      expect(report).not.toBeNull();
      const topTypes = report!.topTypes;

      // 應該有多個類型
      expect(topTypes.length).toBeGreaterThan(0);

      // 每個類型應有有效的統計
      for (const typeStats of topTypes) {
        expect(typeStats.type).toBeDefined();
        expect(typeof typeStats.type).toBe('string');
        expect(typeStats.count).toBeGreaterThanOrEqual(0);
        expect(typeStats.sizeMB).toBeGreaterThanOrEqual(0);
      }
    });

    it('分析報告應包含節點總數', async () => {
      const report = await captureAndAnalyzeHeap('test-nodecount');

      expect(report).not.toBeNull();
      expect(report!.nodeCount).toBeDefined();
      expect(report!.nodeCount).toBeGreaterThan(0);
    });

    it('冷卻期間應跳過捕獲', async () => {
      // 第一次捕獲
      const first = await captureAndAnalyzeHeap('test-cooldown-1');
      expect(first).not.toBeNull();

      // 第二次應被冷卻阻擋
      const second = await captureAndAnalyzeHeap('test-cooldown-2');
      expect(second).toBeNull();
    });

    it('重置冷卻後應可再次捕獲', async () => {
      // 第一次捕獲
      const first = await captureAndAnalyzeHeap('test-reset-1');
      expect(first).not.toBeNull();

      // 重置冷卻
      resetCooldown();

      // 第二次應成功
      const second = await captureAndAnalyzeHeap('test-reset-2');
      expect(second).not.toBeNull();
    });
  });

  describe('manualHeapCapture', () => {
    it('應該跳過冷卻並立即捕獲', async () => {
      // 先觸發一次正常捕獲
      const first = await captureAndAnalyzeHeap('test-manual-1');
      expect(first).not.toBeNull();

      // 手動觸發應跳過冷卻
      const manual = await manualHeapCapture();
      expect(manual).not.toBeNull();
      expect(manual!.filepath).toContain('manual');
    });
  });

  describe('HeapAnalysisReport 格式', () => {
    it('topTypes 應按大小降序排列', async () => {
      const report = await captureAndAnalyzeHeap('test-order');

      expect(report).not.toBeNull();
      const topTypes = report!.topTypes;

      // 驗證降序排列
      for (let i = 1; i < topTypes.length; i++) {
        expect(topTypes[i - 1]!.sizeMB).toBeGreaterThanOrEqual(topTypes[i]!.sizeMB);
      }
    });

    it('topTypes 最多 20 個', async () => {
      const report = await captureAndAnalyzeHeap('test-limit');

      expect(report).not.toBeNull();
      expect(report!.topTypes.length).toBeLessThanOrEqual(20);
    });
  });

  describe('檔案管理', () => {
    it('應該創建 heap 目錄', async () => {
      await captureAndAnalyzeHeap('test-dir');

      expect(fs.existsSync(heapDir)).toBe(true);
    });

    it('snapshot 檔案應存在且可讀', async () => {
      const report = await captureAndAnalyzeHeap('test-file');

      expect(report).not.toBeNull();
      expect(fs.existsSync(report!.filepath)).toBe(true);

      // 檔案應該是有效的 JSON（至少開頭部分）
      const fd = fs.openSync(report!.filepath, 'r');
      const buffer = Buffer.alloc(1000);
      fs.readSync(fd, buffer, 0, 1000, 0);
      fs.closeSync(fd);
      const header = buffer.toString('utf8');
      expect(header).toContain('"snapshot"');
      expect(header).toContain('"meta"');
    });
  });

  describe('analyzeExistingSnapshot', () => {
    it('應該能分析現有的 snapshot 檔案', async () => {
      // 先捕獲一個 snapshot
      const captured = await captureAndAnalyzeHeap('test-existing');
      expect(captured).not.toBeNull();

      resetCooldown();

      // 用 analyzeExistingSnapshot 重新分析
      const reanalyzed = await analyzeExistingSnapshot(captured!.filepath);

      expect(reanalyzed.filepath).toBe(captured!.filepath);
      expect(reanalyzed.topTypes.length).toBeGreaterThan(0);
      expect(reanalyzed.nodeCount).toBeGreaterThan(0);
    });
  });
});
