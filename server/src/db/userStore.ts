import bcrypt from 'bcryptjs';
import type { UserRecord, UserRole } from '../types/auth.js';
import { getDb } from './sqlite.js';
import { CONFIG } from '../config.js';
import { AUTHENTIC_USER_IDS, type IUserStore } from './interfaces.js';
import { SupabaseUserStore } from './supabaseUserStore.js';

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

export class SqliteUserStore implements IUserStore {
  constructor() {
    // Users are not seeded automatically to respect empty database state
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

  public findByEmailSync(email: string): UserRecord | undefined {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const row = stmt.get(email.trim().toLowerCase()) as any;
    return row ? mapRowToUser(row) : undefined;
  }

  public async findByEmail(email: string): Promise<UserRecord | undefined> {
    return this.findByEmailSync(email);
  }

  public findByIdSync(id: string): UserRecord | undefined {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? mapRowToUser(row) : undefined;
  }

  public async findById(id: string): Promise<UserRecord | undefined> {
    return this.findByIdSync(id);
  }

  public saveSync(user: UserRecord): UserRecord {
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

  public async save(user: UserRecord): Promise<UserRecord> {
    return this.saveSync(user);
  }

  public listAllSync(): UserRecord[] {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM users ORDER BY created_at DESC');
    const rows = stmt.all() as any[];
    return rows.map(mapRowToUser);
  }

  public async listAll(): Promise<UserRecord[]> {
    return this.listAllSync();
  }

  public clearNonDefaultSync(): void {
    const db = getDb();
    const placeholders = AUTHENTIC_USER_IDS.map(() => '?').join(',');
    db.prepare(`
      DELETE FROM users 
      WHERE id NOT IN (${placeholders});
    `).run(...AUTHENTIC_USER_IDS);
  }

  public async clearNonDefault(): Promise<void> {
    this.clearNonDefaultSync();
  }

  public resetAllSync(): void {
    const db = getDb();
    db.exec('DELETE FROM users');
  }

  public async resetAll(): Promise<void> {
    this.resetAllSync();
  }
}

export class DualUserStore implements IUserStore {
  public readonly sqlite: SqliteUserStore;
  public readonly supabase: SupabaseUserStore;

  constructor(sqlite?: SqliteUserStore, supabase?: SupabaseUserStore) {
    this.sqlite = sqlite || new SqliteUserStore();
    this.supabase = supabase || new SupabaseUserStore();
  }

  public get active(): IUserStore {
    return CONFIG.DATA_STORE === 'supabase' ? this.supabase : this.sqlite;
  }

  public async findByEmail(email: string): Promise<UserRecord | undefined> {
    return this.active.findByEmail(email);
  }

  public async findById(id: string): Promise<UserRecord | undefined> {
    return this.active.findById(id);
  }

  public async save(user: UserRecord): Promise<UserRecord> {
    return this.active.save(user);
  }

  public async listAll(): Promise<UserRecord[]> {
    return this.active.listAll();
  }

  public async clearNonDefault(): Promise<void> {
    return this.active.clearNonDefault();
  }

  public async resetAll(): Promise<void> {
    return this.active.resetAll();
  }

  public seedDefaultUsers(): void {
    this.sqlite.seedDefaultUsers();
  }
}

export const sqliteUserStore = new SqliteUserStore();
export const supabaseUserStore = new SupabaseUserStore();
export const userStore = new DualUserStore(sqliteUserStore, supabaseUserStore);
export { SqliteUserStore as UserStore };
