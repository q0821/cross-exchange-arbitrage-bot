/**
 * Migration 順序驗證測試
 *
 * 確保 Prisma migration 的時間戳順序正確，
 * 避免外鍵依賴的表在被依賴表之前執行。
 *
 * 背景：migration 20241129000000_add_notification_webhooks 依賴 users 表，
 * 但時間戳早於建立 users 表的 20250128000000_init_database_zeabur，
 * 導致新環境執行 db:migrate 時發生 P3006/P1014 錯誤。
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'prisma', 'migrations');

/**
 * 從 migration SQL 檔案中提取外鍵參考的表名
 * 例如：REFERENCES "users"("id") -> users
 */
function extractReferencedTables(sql: string): string[] {
  const regex = /REFERENCES\s+"(\w+)"\s*\(/gi;
  const tables: string[] = [];
  let match;

  while ((match = regex.exec(sql)) !== null) {
    tables.push(match[1]);
  }

  return [...new Set(tables)]; // 去重
}

/**
 * 從 migration SQL 檔案中提取建立的表名
 * 例如：CREATE TABLE "users" -> users
 */
function extractCreatedTables(sql: string): string[] {
  const regex = /CREATE\s+TABLE\s+"(\w+)"/gi;
  const tables: string[] = [];
  let match;

  while ((match = regex.exec(sql)) !== null) {
    tables.push(match[1]);
  }

  return [...new Set(tables)];
}

/**
 * 取得所有 migration 資料夾（按時間戳排序）
 */
function getMigrationFolders(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => {
      const fullPath = path.join(MIGRATIONS_DIR, name);
      return (
        fs.statSync(fullPath).isDirectory() &&
        /^\d{14}_/.test(name) // 時間戳格式：YYYYMMDDHHmmss_name
      );
    })
    .sort(); // 字母排序 = 時間戳排序
}

/**
 * 讀取 migration SQL 內容
 */
function readMigrationSql(folderName: string): string {
  const sqlPath = path.join(MIGRATIONS_DIR, folderName, 'migration.sql');
  if (!fs.existsSync(sqlPath)) {
    return '';
  }
  return fs.readFileSync(sqlPath, 'utf-8');
}

describe('Prisma Migration 順序驗證', () => {
  it('migration 資料夾應該存在', () => {
    expect(fs.existsSync(MIGRATIONS_DIR)).toBe(true);
  });

  it('應該有至少一個 migration', () => {
    const folders = getMigrationFolders();
    expect(folders.length).toBeGreaterThan(0);
  });

  it('所有外鍵參考的表應該在之前的 migration 中已建立', () => {
    const folders = getMigrationFolders();
    const createdTables = new Set<string>();
    const errors: string[] = [];

    for (const folder of folders) {
      const sql = readMigrationSql(folder);
      if (!sql) continue;

      // 先取得這個 migration 參考的表
      const referencedTables = extractReferencedTables(sql);

      // 檢查每個參考的表是否已經建立
      for (const table of referencedTables) {
        // 檢查是否在之前的 migration 中建立，或在同一個 migration 中建立
        const createdInSameMigration = extractCreatedTables(sql).includes(table);
        if (!createdTables.has(table) && !createdInSameMigration) {
          errors.push(
            `Migration "${folder}" 參考了表 "${table}"，但該表尚未在之前的 migration 中建立`
          );
        }
      }

      // 更新已建立的表清單
      const newTables = extractCreatedTables(sql);
      for (const table of newTables) {
        createdTables.add(table);
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `Migration 順序錯誤：\n${errors.join('\n')}\n\n` +
          `解決方案：重命名 migration 資料夾的時間戳，確保依賴的表先建立。`
      );
    }
  });

  it('migration 時間戳應該是有效的格式', () => {
    const folders = getMigrationFolders();
    const timestampRegex = /^(\d{14})_/;

    for (const folder of folders) {
      const match = folder.match(timestampRegex);
      expect(match).not.toBeNull();

      if (match) {
        const timestamp = match[1];
        // 驗證是合理的日期（2020-2030 年之間）
        const year = parseInt(timestamp.substring(0, 4));
        expect(year).toBeGreaterThanOrEqual(2020);
        expect(year).toBeLessThanOrEqual(2030);
      }
    }
  });

  it('add_notification_webhooks 應該在 init_database_zeabur 之後', () => {
    const folders = getMigrationFolders();

    const initDbIndex = folders.findIndex((f) => f.includes('init_database_zeabur'));
    const notificationIndex = folders.findIndex((f) => f.includes('add_notification_webhooks'));

    // 如果兩個 migration 都存在，確保順序正確
    if (initDbIndex !== -1 && notificationIndex !== -1) {
      expect(notificationIndex).toBeGreaterThan(initDbIndex);
    }
  });
});

describe('Migration SQL 解析工具', () => {
  it('extractReferencedTables 應該正確解析外鍵參考', () => {
    const sql = `
      ALTER TABLE "notification_webhooks" ADD CONSTRAINT "notification_webhooks_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

      ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    `;

    const tables = extractReferencedTables(sql);
    expect(tables).toContain('users');
    expect(tables.length).toBe(1); // 應該去重
  });

  it('extractCreatedTables 應該正確解析建立的表', () => {
    const sql = `
      CREATE TABLE "users" (
        "id" TEXT NOT NULL,
        "email" VARCHAR(255) NOT NULL
      );

      CREATE TABLE "api_keys" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL
      );
    `;

    const tables = extractCreatedTables(sql);
    expect(tables).toContain('users');
    expect(tables).toContain('api_keys');
    expect(tables.length).toBe(2);
  });

  it('extractReferencedTables 應該處理空字串', () => {
    expect(extractReferencedTables('')).toEqual([]);
  });

  it('extractCreatedTables 應該處理空字串', () => {
    expect(extractCreatedTables('')).toEqual([]);
  });
});
