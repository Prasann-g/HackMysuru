import bcrypt from 'bcryptjs';
import type { UserRecord, UserRole } from '../types/auth.js';
import { getDb } from './sqlite.js';

function mapRowToUser(row: any): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    name: row.name,
    role: row.role as UserRole,
    ward: row.ward || undefined,
    department: row.department || undefined,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at || undefined,
  };
}

export class UserStore {
  constructor() {
    this.seedDefaultUsers();
  }

  public seedDefaultUsers(): void {
    const db = getDb();
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO users (
        id, email, password_hash, name, role, ward, department, is_active, created_at, last_login_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);

    // 1. Pre-seeded Officer: Ward 48 Junior Engineer
    const officer1Hash = bcrypt.hashSync('Officer@Mysuru48', 10);
    insertStmt.run(
      'USR-OFFICER-48',
      'officer.ward48@mcc.gov.in'.toLowerCase(),
      officer1Hash,
      'Ward 48 Junior Engineer',
      'OFFICER',
      'Ward 48 - Kuvempunagar',
      'MCC Engineering Division',
      '2026-09-01T00:00:00.000Z',
      '2026-09-01T00:00:00.000Z'
    );

    // 2. Pre-seeded Officer: Health & Sanitation Inspector
    const officer2Hash = bcrypt.hashSync('CleanMysuru2026', 10);
    insertStmt.run(
      'USR-OFFICER-SAN',
      'officer.sanitation@mcc.gov.in'.toLowerCase(),
      officer2Hash,
      'Health & Sanitation Inspector',
      'OFFICER',
      'Ward 48 - Kuvempunagar',
      'MCC Health & Sanitation Department',
      '2026-09-01T00:00:00.000Z',
      '2026-09-01T00:00:00.000Z'
    );
  }

  public findByEmail(email: string): UserRecord | undefined {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const row = stmt.get(email.trim().toLowerCase()) as any;
    return row ? mapRowToUser(row) : undefined;
  }

  public findById(id: string): UserRecord | undefined {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? mapRowToUser(row) : undefined;
  }

  public save(user: UserRecord): UserRecord {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO users (
        id, email, password_hash, name, role, ward, department, is_active, created_at, last_login_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        password_hash = excluded.password_hash,
        name = excluded.name,
        role = excluded.role,
        ward = excluded.ward,
        department = excluded.department,
        is_active = excluded.is_active,
        last_login_at = excluded.last_login_at
    `);

    stmt.run(
      user.id,
      user.email.toLowerCase(),
      user.passwordHash,
      user.name,
      user.role,
      user.ward || null,
      user.department || null,
      user.isActive ? 1 : 0,
      user.createdAt,
      user.lastLoginAt || null
    );

    return user;
  }

  public listAll(): UserRecord[] {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM users ORDER BY created_at DESC');
    const rows = stmt.all() as any[];
    return rows.map(mapRowToUser);
  }

  public clearNonDefault(): void {
    const db = getDb();
    // Delete non-demo complaints first to guarantee referential integrity, then non-seeded users
    db.exec(`
      DELETE FROM complaints WHERE is_demo = 0;
      DELETE FROM users 
      WHERE id NOT IN ('USR-OFFICER-48', 'USR-OFFICER-SAN', 'USR-CITIZEN-DEMO');
    `);
  }

  public resetAll(): void {
    const db = getDb();
    db.exec('DELETE FROM users');
  }
}

export const userStore = new UserStore();
