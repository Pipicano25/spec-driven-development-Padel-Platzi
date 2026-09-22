import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Db = Database.Database;

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const schemaPath = resolve(rootDir, 'db/schema.sql');
const defaultDbPath = resolve(rootDir, 'db/padel.db');

export const openDb = (path: string = process.env.DB_PATH ?? defaultDbPath): Db => {
  const db = new Database(path);
  db.pragma('foreign_keys = ON');
  if (path !== ':memory:') db.pragma('journal_mode = WAL');
  db.exec(readFileSync(schemaPath, 'utf8'));
  return db;
};
