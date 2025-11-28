import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let dbInstance: Database | null = null;

export async function getDb() {
  if (!dbInstance) {
    const dbPath = path.resolve('./data/nodes.db');
    dbInstance = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
  }
  return dbInstance;
}