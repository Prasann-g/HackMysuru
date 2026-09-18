import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config.js';

let dbInstance: DatabaseSync | null = null;

export function initDatabase(dbPath: string = CONFIG.DB_PATH): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA busy_timeout = 5000;');

  // Enable Pragmas for performance and referential integrity
  if (dbPath !== ':memory:') {
    try {
      db.exec('PRAGMA journal_mode = WAL;');
    } catch {
      // Ignore WAL mode if already active or single-connection
    }
  }
  db.exec('PRAGMA foreign_keys = ON;');

  // 1. Users Table (Persistent authentication)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('CITIZEN', 'OFFICER', 'ADMIN')),
      ward TEXT,
      department TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      last_login_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `);

  // 2. Complaints Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS complaints (
      id TEXT PRIMARY KEY,
      tracking_token TEXT UNIQUE NOT NULL,
      citizen_id TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN (
        'garbage_dumping', 'overflowing_bin', 'pothole',
        'broken_streetlight', 'unsegregated_waste',
        'construction_debris', 'other'
      )),
      custom_category TEXT,
      description TEXT NOT NULL,
      observed_date TEXT NOT NULL,
      location_area TEXT NOT NULL,
      address_text TEXT,
      latitude REAL,
      longitude REAL,
      has_image INTEGER NOT NULL DEFAULT 0,
      evidence_metadata TEXT,
      status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN (
        'SUBMITTED', 'UNDER_REVIEW', 'NEEDS_CLARIFICATION',
        'FORWARDED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'
      )),
      verification_result TEXT,
      assigned_officer_id TEXT,
      assigned_department TEXT,
      review_notes TEXT,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (citizen_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_officer_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_complaints_citizen ON complaints(citizen_id);
    CREATE INDEX IF NOT EXISTS idx_complaints_token ON complaints(tracking_token);
    CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
    CREATE INDEX IF NOT EXISTS idx_complaints_area ON complaints(location_area);
  `);

  dbInstance = db;
  return dbInstance;
}

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = initDatabase(CONFIG.DB_PATH);
  }
  return dbInstance;
}

export function setDbForTesting(customDb: DatabaseSync): void {
  dbInstance = customDb;
}

export function closeDatabase(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // Ignore if already closed
    }
    dbInstance = null;
  }
}
