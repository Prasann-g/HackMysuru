import bcrypt from 'bcryptjs';
import type { UserRecord } from '../types/auth.js';

class UserStore {
  private usersByEmail = new Map<string, UserRecord>();
  private usersById = new Map<string, UserRecord>();

  constructor() {
    this.seedDefaultUsers();
  }

  public seedDefaultUsers(): void {
    // 1. Pre-seeded Officer: Ward 48 Junior Engineer
    const officer1Email = 'officer.ward48@mcc.gov.in'.toLowerCase();
    if (!this.usersByEmail.has(officer1Email)) {
      const officer1: UserRecord = {
        id: 'USR-OFFICER-48',
        email: officer1Email,
        passwordHash: bcrypt.hashSync('Officer@Mysuru48', 10),
        name: 'Ward 48 Junior Engineer',
        role: 'OFFICER',
        ward: 'Ward 48 - Kuvempunagar',
        department: 'MCC Engineering Division',
        isActive: true,
        createdAt: '2026-09-01T00:00:00.000Z',
      };
      this.save(officer1);
    }

    // 2. Pre-seeded Officer: Health & Sanitation Inspector
    const officer2Email = 'officer.sanitation@mcc.gov.in'.toLowerCase();
    if (!this.usersByEmail.has(officer2Email)) {
      const officer2: UserRecord = {
        id: 'USR-OFFICER-SAN',
        email: officer2Email,
        passwordHash: bcrypt.hashSync('CleanMysuru2026', 10),
        name: 'Health & Sanitation Inspector',
        role: 'OFFICER',
        ward: 'Ward 48 - Kuvempunagar',
        department: 'MCC Health & Sanitation Department',
        isActive: true,
        createdAt: '2026-09-01T00:00:00.000Z',
      };
      this.save(officer2);
    }
  }

  public findByEmail(email: string): UserRecord | undefined {
    return this.usersByEmail.get(email.trim().toLowerCase());
  }

  public findById(id: string): UserRecord | undefined {
    return this.usersById.get(id);
  }

  public save(user: UserRecord): UserRecord {
    this.usersByEmail.set(user.email.toLowerCase(), user);
    this.usersById.set(user.id, user);
    return user;
  }

  public listAll(): UserRecord[] {
    return Array.from(this.usersById.values());
  }

  public clearNonDefault(): void {
    this.usersByEmail.clear();
    this.usersById.clear();
    this.seedDefaultUsers();
  }

  public resetAll(): void {
    this.usersByEmail.clear();
    this.usersById.clear();
  }
}

export const userStore = new UserStore();
