/**
 * Heap Snapshot Capture and Analysis
 *
 * 當 heap 突然增長時自動抓取 V8 heap snapshot 並分析
 * 輸出佔用記憶體最多的物件類型到日誌
 *
 * Feature: memory-usage-improvement
 *
 * 支援大檔案分析（使用 streaming 方式處理超過 512MB 的檔案）
 */

import v8 from 'v8';
import fs from 'fs';
import path from 'path';
import { logger } from './logger';

/** Heap 分析報告 */
export interface HeapAnalysisReport {
  /** Snapshot 檔案路徑 */
  filepath: string;
  /** 捕獲時間 */
  capturedAt: Date;
  /** 總大小 (bytes) */
  totalSize: number;
  /** 前 N 大類型 */
  topTypes: HeapTypeStats[];
  /** 節點總數 */
  nodeCount?: number;
}

/** 物件類型統計 */
export interface HeapTypeStats {
  /** 類型名稱 */
  type: string;
  /** 物件數量 */
  count: number;
  /** 佔用大小 (MB) */
  sizeMB: number;
}

/** V8 Heapsnapshot Meta 格式 */
interface V8HeapSnapshotMeta {
  node_fields: string[];
  node_types: (string | string[])[];
}

// 配置常數
const HEAP_DIR = 'logs/heap';
const MAX_SNAPSHOTS = 10;
const COOLDOWN_MS = 5 * 60 * 1000; // 5 分鐘冷卻時間
const LARGE_FILE_THRESHOLD = 400 * 1024 * 1024; // 400MB，超過此大小使用 streaming

// 上次捕獲時間（用於冷卻控制）
let lastCaptureTime = 0;

/**
 * 檢查 heap snapshot 功能是否啟用
 * 預設關閉，避免影響 production 效能
 */
export function isHeapSnapshotEnabled(): boolean {
  return process.env.ENABLE_HEAP_SNAPSHOT === 'true';
}

/**
 * 取得 heap snapshot 觸發閾值（MB）
 * 預設 100MB
 */
export function getHeapSnapshotThresholdMB(): number {
  const threshold = parseInt(process.env.HEAP_SNAPSHOT_THRESHOLD_MB || '100', 10);
  return isNaN(threshold) ? 100 : threshold;
}

/**
 * 確保 heap 目錄存在
 */
function ensureHeapDir(): void {
  if (!fs.existsSync(HEAP_DIR)) {
    fs.mkdirSync(HEAP_DIR, { recursive: true });
  }
}

/**
 * 格式化時間戳記（用於檔名）
 */
function formatTime(): string {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/**
 * 清理舊的 snapshot 檔案（保留最新的 MAX_SNAPSHOTS 個）
 */
function cleanupOldSnapshots(): void {
  try {
    if (!fs.existsSync(HEAP_DIR)) {
      return;
    }

    const files = fs.readdirSync(HEAP_DIR)
      .filter((f) => f.endsWith('.heapsnapshot'))
      .map((f) => ({
        name: f,
        path: path.join(HEAP_DIR, f),
        mtime: fs.statSync(path.join(HEAP_DIR, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.mtime - a.mtime); // 最新的在前

    // 刪除超過限制的舊檔案
    for (let i = MAX_SNAPSHOTS; i < files.length; i++) {
      const file = files[i];
      if (file) {
        fs.unlinkSync(file.path);
        logger.debug({ file: file.name }, 'Deleted old heap snapshot');
      }
    }
  } catch (error) {
    logger.warn({ error }, 'Failed to cleanup old heap snapshots');
  }
}

/**
 * 從檔案開頭讀取 meta 資訊
 *
 * V8 heapsnapshot 格式：{"snapshot":{"meta":{...},"node_count":N},"nodes":[...
 * meta 資訊通常在前 10KB 內
 */
function readMetaFromFile(filepath: string): {
  meta: V8HeapSnapshotMeta;
  nodeCount: number;
  nodesStartOffset: number;
} {
  const fd = fs.openSync(filepath, 'r');
  try {
    // 讀取前 64KB 來獲取 meta（通常綽綽有餘）
    const headerSize = 64 * 1024;
    const buffer = Buffer.alloc(headerSize);
    fs.readSync(fd, buffer, 0, headerSize, 0);
    const headerStr = buffer.toString('utf8');

    // 解析 snapshot.meta
    const metaMatch = headerStr.match(/"meta"\s*:\s*(\{[^}]+\}[^}]+\})/);
    if (!metaMatch) {
      throw new Error('Cannot find meta in heapsnapshot');
    }

    // 修復可能被截斷的 JSON（找到最後一個完整的 }）
    let metaJson = metaMatch[1] ?? '';
    // 確保 JSON 完整
    let braceCount = 0;
    let endIndex = 0;
    for (let i = 0; i < metaJson.length; i++) {
      const char = metaJson[i];
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
      if (braceCount === 0) {
        endIndex = i + 1;
        break;
      }
    }
    metaJson = metaJson.slice(0, endIndex);
    const meta: V8HeapSnapshotMeta = JSON.parse(metaJson);

    // 解析 node_count
    const nodeCountMatch = headerStr.match(/"node_count"\s*:\s*(\d+)/);
    const nodeCount = nodeCountMatch?.[1] ? parseInt(nodeCountMatch[1], 10) : 0;

    // 找到 "nodes":[ 的位置
    const nodesMatch = headerStr.match(/"nodes"\s*:\s*\[/);
    const nodesStartOffset = nodesMatch ? headerStr.indexOf(nodesMatch[0]) + nodesMatch[0].length : -1;

    return { meta, nodeCount, nodesStartOffset };
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * 使用 streaming 方式分析大型 heap snapshot
 *
 * 逐塊讀取 nodes 陣列，統計各類型物件
 */
async function analyzeSnapshotStreaming(filepath: string): Promise<HeapAnalysisReport> {
  const { meta, nodesStartOffset } = readMetaFromFile(filepath);

  // 取得欄位索引
  const nodeFields = meta.node_fields;
  const typeFieldIndex = nodeFields.indexOf('type');
  const selfSizeFieldIndex = nodeFields.indexOf('self_size');
  const nodeFieldCount = nodeFields.length;

  // 取得類型名稱陣列
  const nodeTypes = meta.node_types[typeFieldIndex];
  const typeNames = Array.isArray(nodeTypes) ? nodeTypes : [];

  // 統計各類型物件
  const typeStats = new Map<string, { count: number; size: number }>();

  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filepath, {
      start: nodesStartOffset,
      encoding: 'utf8',
      highWaterMark: 1024 * 1024, // 1MB chunks
    });

    let buffer = '';
    let currentFieldIndex = 0;
    let currentTypeIndex = 0;
    let currentSelfSize = 0;
    let processedNodes = 0;
    let inNodes = true;

    const processNumber = (numStr: string) => {
      if (!inNodes) return;

      const num = parseInt(numStr, 10);
      if (isNaN(num)) return;

      const fieldIndex = currentFieldIndex % nodeFieldCount;

      if (fieldIndex === typeFieldIndex) {
        currentTypeIndex = num;
      } else if (fieldIndex === selfSizeFieldIndex) {
        currentSelfSize = num;
      }

      currentFieldIndex++;

      // 完成一個節點的解析
      if (currentFieldIndex % nodeFieldCount === 0) {
        const typeName = typeNames[currentTypeIndex] ?? 'unknown';
        const existing = typeStats.get(typeName) || { count: 0, size: 0 };
        existing.count++;
        existing.size += currentSelfSize;
        typeStats.set(typeName, existing);
        processedNodes++;
        currentTypeIndex = 0;
        currentSelfSize = 0;
      }
    };

    stream.on('data', (chunk: Buffer | string) => {
      buffer += chunk.toString();

      // 檢查是否遇到 nodes 陣列結束
      const endBracketIndex = buffer.indexOf(']');
      if (endBracketIndex !== -1) {
        // 只處理到結束括號
        buffer = buffer.slice(0, endBracketIndex);
        inNodes = false;
      }

      // 解析數字（以逗號分隔）
      const parts = buffer.split(',');

      // 保留最後一個可能不完整的部分
      buffer = parts.pop() || '';

      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed && /^-?\d+$/.test(trimmed)) {
          processNumber(trimmed);
        }
      }
    });

    stream.on('end', () => {
      // 處理剩餘的 buffer
      if (buffer.trim() && /^-?\d+$/.test(buffer.trim())) {
        processNumber(buffer.trim());
      }

      // 排序並取 Top 20
      const sorted = Array.from(typeStats.entries())
        .sort((a, b) => b[1].size - a[1].size)
        .slice(0, 20);

      const totalSize = sorted.reduce((sum, [, v]) => sum + v.size, 0);

      resolve({
        filepath,
        capturedAt: new Date(),
        totalSize,
        nodeCount: processedNodes,
        topTypes: sorted.map(([type, stats]) => ({
          type,
          count: stats.count,
          sizeMB: Math.round((stats.size / 1024 / 1024) * 100) / 100,
        })),
      });
    });

    stream.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * 解析 V8 heapsnapshot 並統計各類型物件（小檔案版本）
 *
 * V8 heapsnapshot 格式說明：
 * - nodes 陣列為扁平化結構，每 N 個元素代表一個節點
 * - 欄位順序由 snapshot.meta.node_fields 定義
 * - 類型名稱儲存在 node_types 陣列中
 */
function analyzeSnapshotSmall(filepath: string): HeapAnalysisReport {
  const content = fs.readFileSync(filepath, 'utf8');
  const snapshot = JSON.parse(content) as {
    snapshot: { meta: V8HeapSnapshotMeta };
    nodes: number[];
  };

  // 取得欄位索引
  const nodeFields = snapshot.snapshot.meta.node_fields;
  const typeFieldIndex = nodeFields.indexOf('type');
  const selfSizeFieldIndex = nodeFields.indexOf('self_size');
  const nodeFieldCount = nodeFields.length;

  // 取得類型名稱陣列
  const nodeTypes = snapshot.snapshot.meta.node_types[typeFieldIndex];
  const typeNames = Array.isArray(nodeTypes) ? nodeTypes : [];

  // 統計各類型物件
  const typeStats = new Map<string, { count: number; size: number }>();
  const nodes = snapshot.nodes;
  const totalNodes = nodes.length / nodeFieldCount;

  for (let i = 0; i < totalNodes; i++) {
    const offset = i * nodeFieldCount;
    const typeIndex = nodes[offset + typeFieldIndex] ?? 0;
    const selfSize = nodes[offset + selfSizeFieldIndex] ?? 0;

    // 從 node_types 取得類型名稱
    const typeName = typeNames[typeIndex] ?? 'unknown';

    const existing = typeStats.get(typeName) || { count: 0, size: 0 };
    existing.count++;
    existing.size += selfSize;
    typeStats.set(typeName, existing);
  }

  // 排序並取 Top 20
  const sorted = Array.from(typeStats.entries())
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 20);

  const totalSize = sorted.reduce((sum, [, v]) => sum + v.size, 0);

  return {
    filepath,
    capturedAt: new Date(),
    totalSize,
    nodeCount: totalNodes,
    topTypes: sorted.map(([type, stats]) => ({
      type,
      count: stats.count,
      sizeMB: Math.round((stats.size / 1024 / 1024) * 100) / 100,
    })),
  };
}

/**
 * 分析 heap snapshot（自動選擇小檔案或大檔案模式）
 */
async function analyzeSnapshot(filepath: string): Promise<HeapAnalysisReport> {
  const stats = fs.statSync(filepath);
  const fileSizeMB = Math.round(stats.size / 1024 / 1024);

  if (stats.size > LARGE_FILE_THRESHOLD) {
    logger.info(
      { filepath, fileSizeMB, mode: 'streaming' },
      'Using streaming mode for large heap snapshot'
    );
    return analyzeSnapshotStreaming(filepath);
  } else {
    logger.debug(
      { filepath, fileSizeMB, mode: 'standard' },
      'Using standard mode for heap snapshot'
    );
    return analyzeSnapshotSmall(filepath);
  }
}

/**
 * 輸出分析報告到日誌
 */
function logAnalysisReport(report: HeapAnalysisReport, reason: string): void {
  const topTypes = report.topTypes.slice(0, 10);
  const totalMB = Math.round((report.totalSize / 1024 / 1024) * 100) / 100;

  logger.warn(
    {
      reason,
      snapshotFile: report.filepath,
      totalMB,
      nodeCount: report.nodeCount,
      topTypes,
    },
    'Heap snapshot captured and analyzed'
  );

  // 額外輸出人類可讀的摘要
  logger.info(
    {
      top5: topTypes.slice(0, 5).map((t) => `${t.type}: ${t.sizeMB}MB (${t.count})`),
    },
    'Heap snapshot top 5 types'
  );
}

/**
 * 抓取 heap snapshot 並自動分析
 *
 * @param reason - 觸發原因（用於檔名和日誌）
 * @returns 分析報告，失敗或冷卻中返回 null
 */
export async function captureAndAnalyzeHeap(reason: string): Promise<HeapAnalysisReport | null> {
  // 冷卻檢查
  const now = Date.now();
  if (now - lastCaptureTime < COOLDOWN_MS) {
    logger.debug(
      { remainingCooldown: Math.round((COOLDOWN_MS - (now - lastCaptureTime)) / 1000) },
      'Heap snapshot skipped due to cooldown'
    );
    return null;
  }

  try {
    // 確保目錄存在
    ensureHeapDir();

    // 清理舊檔案
    cleanupOldSnapshots();

    // 抓取 snapshot
    const sanitizedReason = reason.replace(/[^a-zA-Z0-9-]/g, '-');
    const filename = `heap-${formatTime()}-${sanitizedReason}.heapsnapshot`;
    const filepath = path.join(HEAP_DIR, filename);

    logger.info({ filepath }, 'Capturing heap snapshot...');
    const startTime = Date.now();

    v8.writeHeapSnapshot(filepath);

    const captureTime = Date.now() - startTime;
    lastCaptureTime = Date.now();

    const fileSizeMB = Math.round(fs.statSync(filepath).size / 1024 / 1024);
    logger.info({ filepath, captureTimeMs: captureTime, fileSizeMB }, 'Heap snapshot captured');

    // 分析 snapshot
    const analyzeStartTime = Date.now();
    const report = await analyzeSnapshot(filepath);
    const analyzeTime = Date.now() - analyzeStartTime;

    logger.info({ analyzeTimeMs: analyzeTime }, 'Heap snapshot analyzed');

    // 輸出分析報告
    logAnalysisReport(report, reason);

    return report;
  } catch (error) {
    logger.error({ error, reason }, 'Failed to capture or analyze heap snapshot');
    return null;
  }
}

/**
 * 手動觸發 heap snapshot（用於診斷）
 */
export async function manualHeapCapture(): Promise<HeapAnalysisReport | null> {
  // 手動觸發時跳過冷卻
  lastCaptureTime = 0;
  return captureAndAnalyzeHeap('manual');
}

/**
 * 取得 heap snapshot 目錄路徑
 */
export function getHeapSnapshotDir(): string {
  return HEAP_DIR;
}

/**
 * 重設冷卻時間（用於測試）
 */
export function resetCooldown(): void {
  lastCaptureTime = 0;
}

/**
 * 分析現有的 heap snapshot 檔案（用於診斷）
 */
export async function analyzeExistingSnapshot(filepath: string): Promise<HeapAnalysisReport> {
  return analyzeSnapshot(filepath);
}
