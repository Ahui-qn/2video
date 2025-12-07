
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db;

export async function initDB() {
  db = await open({
    filename: path.join(__dirname, 'database.sqlite'),
    driver: sqlite3.Database
  });

  // Users Table (Added password_hash)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at INTEGER
    );
  `);

  // Projects Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      creator_id TEXT,
      description TEXT,
      cover_image TEXT,
      data TEXT, -- JSON string of project content
      episodes TEXT, -- JSON string
      created_at INTEGER,
      updated_at INTEGER,
      FOREIGN KEY (creator_id) REFERENCES users(id)
    );
  `);

  // Members Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS project_members (
      project_id TEXT,
      user_id TEXT,
      role TEXT, -- 'admin', 'editor', 'viewer'
      joined_at INTEGER,
      PRIMARY KEY (project_id, user_id),
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Audit Logs Table (New)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT,
      user_id TEXT,
      action TEXT, -- e.g. 'update_role', 'update_content'
      details TEXT, -- JSON details
      created_at INTEGER,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  console.log('Database initialized with strict schema');
  return db;
}

export function getDB() {
  if (!db) throw new Error('Database not initialized');
  return db;
}
