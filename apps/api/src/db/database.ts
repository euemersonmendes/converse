import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { env } from '../config/env.js';

let dbInstance: DatabaseSync | null = null;

export function getDb(customPath?: string): DatabaseSync {
  if (dbInstance) return dbInstance;

  const targetPath = customPath ?? env.DB_PATH;
  if (targetPath !== ':memory:') {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  }

  dbInstance = new DatabaseSync(targetPath);
  dbInstance.exec('PRAGMA journal_mode = WAL;');
  dbInstance.exec('PRAGMA foreign_keys = ON;');
  return dbInstance;
}

export function resetDbForTest(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
