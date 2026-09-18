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
      image_path TEXT,
      image_sha256 TEXT,
      image_phash TEXT,
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
      primary_complaint_id TEXT,
      duplicate_cluster_id TEXT,
      resolution_action TEXT DEFAULT 'NONE',
      resolved_by_officer_id TEXT,
      resolved_at TEXT,
      FOREIGN KEY (citizen_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_officer_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (primary_complaint_id) REFERENCES complaints(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_complaints_citizen ON complaints(citizen_id);
    CREATE INDEX IF NOT EXISTS idx_complaints_token ON complaints(tracking_token);
    CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
    CREATE INDEX IF NOT EXISTS idx_complaints_area ON complaints(location_area);

    -- 3. Duplicate Resolution Audit Table
    CREATE TABLE IF NOT EXISTS complaint_resolution_audit (
      id TEXT PRIMARY KEY,
      cluster_id TEXT NOT NULL,
      primary_complaint_id TEXT NOT NULL,
      secondary_complaint_ids TEXT NOT NULL,
      action_type TEXT NOT NULL CHECK (action_type IN ('MARK_RELATED', 'MERGE_DUPLICATES', 'UNLINK', 'MARK_DISTINCT')),
      officer_id TEXT NOT NULL,
      officer_name TEXT NOT NULL,
      decision_notes TEXT NOT NULL,
      previous_states TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (officer_id) REFERENCES users(id),
      FOREIGN KEY (primary_complaint_id) REFERENCES complaints(id)
    );
    CREATE INDEX IF NOT EXISTS idx_audit_cluster ON complaint_resolution_audit(cluster_id);
    CREATE INDEX IF NOT EXISTS idx_audit_primary ON complaint_resolution_audit(primary_complaint_id);
  `);

  // Safe migration for image evidence and cluster columns on existing databases
  const extraCols = [
    { name: 'image_path', type: 'TEXT' },
    { name: 'image_sha256', type: 'TEXT' },
    { name: 'image_phash', type: 'TEXT' },
    { name: 'primary_complaint_id', type: 'TEXT' },
    { name: 'duplicate_cluster_id', type: 'TEXT' },
    { name: 'resolution_action', type: "TEXT DEFAULT 'NONE'" },
    { name: 'resolved_by_officer_id', type: 'TEXT' },
    { name: 'resolved_at', type: 'TEXT' },
  ];
  for (const col of extraCols) {
    try {
      db.exec(`ALTER TABLE complaints ADD COLUMN ${col.name} ${col.type};`);
    } catch {
      // Column already exists
    }
  }
  // Create column-dependent indexes safely after migration
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_complaints_cluster ON complaints(duplicate_cluster_id);'); } catch { /* ignore */ }
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_complaints_primary ON complaints(primary_complaint_id);'); } catch { /* ignore */ }
  db.exec('CREATE INDEX IF NOT EXISTS idx_complaints_image_sha256 ON complaints(image_sha256);');

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
