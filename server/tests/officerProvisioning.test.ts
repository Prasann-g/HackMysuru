import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import { provisionOfficerAccount } from '../src/services/officerProvisioningService.js';
import { loginUser, verifyToken } from '../src/services/authService.js';
import type { UserRecord } from '../src/types/auth.js';
import type { IUserStore } from '../src/db/interfaces.js';
import { userStore } from '../src/db/userStore.js';
import { complaintStore } from '../src/db/complaintStore.js';
import { CONFIG } from '../src/config.js';

/**
 * Isolated in-memory user store for deterministic, side-effect-free testing.
 */
class InMemoryTestUserStore implements IUserStore {
  private users = new Map<string, UserRecord>();

  async findByEmail(email: string): Promise<UserRecord | undefined> {
    const normalized = email.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === normalized) {
        return { ...user };
      }
    }
    return undefined;
  }

  async findById(id: string): Promise<UserRecord | undefined> {
    const user = this.users.get(id);
    return user ? { ...user } : undefined;
  }

  async save(user: UserRecord): Promise<UserRecord> {
    this.users.set(user.id, { ...user });
    return { ...user };
  }

  async listAll(): Promise<UserRecord[]> {
    return Array.from(this.users.values()).map((u) => ({ ...u }));
  }

  async clearNonDefault(): Promise<void> {}
  async resetAll(): Promise<void> {
    this.users.clear();
  }
}

describe('CivicBridge — Secure Officer Provisioning Service (Isolated Verification)', () => {
  // 1. Provisioning logic works using an isolated test store/mock
  it('provisions a new officer account with valid attributes in an isolated store', async () => {
    const isolatedStore = new InMemoryTestUserStore();

    const result = await provisionOfficerAccount({
      email: 'officer.test1@mcc.gov.in',
      name: 'Test Officer One',
      ward: 'Ward 48 - Kuvempunagar',
      department: 'MCC Engineering Division',
      targetUserStore: isolatedStore,
    });

    expect(result.status).toBe('PROVISIONED');
    expect(result.user.email).toBe('officer.test1@mcc.gov.in');
    expect(result.user.name).toBe('Test Officer One');
    expect(result.user.role).toBe('OFFICER');
    expect(result.user.ward).toBe('Ward 48 - Kuvempunagar');
    expect(result.user.department).toBe('MCC Engineering Division');
    expect(result.generatedPassword).toBeDefined();
    expect(result.generatedPassword!.length).toBeGreaterThanOrEqual(16);

    const stored = await isolatedStore.findByEmail('officer.test1@mcc.gov.in');
    expect(stored).toBeDefined();
    expect(stored?.role).toBe('OFFICER');
    expect(stored?.isActive).toBe(true);
  });

  // 2. Existing officer email is handled idempotently
  it('handles existing officer email idempotently without altering password or user ID', async () => {
    const isolatedStore = new InMemoryTestUserStore();

    // Initial provision with a test password
    const testPassword = 'Initial@TestPassword2026';
    const firstResult = await provisionOfficerAccount({
      email: 'officer.ward48@mcc.gov.in',
      name: 'Ward 48 Junior Engineer',
      ward: 'Ward 48 - Kuvempunagar',
      department: 'MCC Engineering Division',
      password: testPassword,
      targetUserStore: isolatedStore,
    });

    expect(firstResult.status).toBe('PROVISIONED');
    const firstStored = await isolatedStore.findByEmail('officer.ward48@mcc.gov.in');
    const initialHash = firstStored?.passwordHash;
    const initialId = firstStored?.id;
    expect(initialId).toBe('USR-OFFICER-48');

    // Repeated provision attempt with different name / password
    const secondResult = await provisionOfficerAccount({
      email: 'officer.ward48@mcc.gov.in',
      name: 'Altered Officer Name Attempt',
      ward: 'Ward 48 - Kuvempunagar',
      department: 'MCC Engineering Division',
      password: 'AttemptedNewPassword2026',
      targetUserStore: isolatedStore,
    });

    expect(secondResult.status).toBe('ALREADY_EXISTS');
    expect(secondResult.user.id).toBe(initialId);
    expect(secondResult.generatedPassword).toBeUndefined();

    // Verify record in store was NOT modified
    const afterSecondStored = await isolatedStore.findByEmail('officer.ward48@mcc.gov.in');
    expect(afterSecondStored?.id).toBe(initialId);
    expect(afterSecondStored?.passwordHash).toBe(initialHash);
    expect(afterSecondStored?.name).toBe('Ward 48 Junior Engineer');
  });

  // 3. Citizen-email collision is rejected
  it('rejects officer provisioning when the email belongs to an existing citizen', async () => {
    const isolatedStore = new InMemoryTestUserStore();

    // Seed a citizen account
    await isolatedStore.save({
      id: 'USR-CITIZEN-EXISTING',
      email: 'citizen.resident@example.com',
      passwordHash: '$2a$10$mockedBcryptHashForTestingOnly',
      name: 'Citizen Resident',
      role: 'CITIZEN',
      ward: 'Ward 48 - Kuvempunagar',
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    // Attempt to provision officer with the citizen's email
    await expect(
      provisionOfficerAccount({
        email: 'citizen.resident@example.com',
        name: 'Attempted Officer Hijack',
        ward: 'Ward 48 - Kuvempunagar',
        department: 'MCC Health Department',
        targetUserStore: isolatedStore,
      })
    ).rejects.toThrow(/already exists with role "CITIZEN"/);

    // Verify citizen record remains unchanged
    const citizen = await isolatedStore.findByEmail('citizen.resident@example.com');
    expect(citizen?.role).toBe('CITIZEN');
    expect(citizen?.name).toBe('Citizen Resident');
  });

  // 4. Passwords are bcrypt-hashed
  it('verifies that passwords are securely hashed using bcrypt and never stored in plaintext', async () => {
    const isolatedStore = new InMemoryTestUserStore();
    const ephemeralTestPassword = 'Secure@TestPassphrase2026';

    await provisionOfficerAccount({
      email: 'officer.security@mcc.gov.in',
      name: 'Security Test Officer',
      ward: 'Ward 48 - Kuvempunagar',
      department: 'MCC IT Security',
      password: ephemeralTestPassword,
      targetUserStore: isolatedStore,
    });

    const stored = await isolatedStore.findByEmail('officer.security@mcc.gov.in');
    expect(stored).toBeDefined();
    // Must NOT be stored as plaintext
    expect(stored?.passwordHash).not.toBe(ephemeralTestPassword);
    // Must be a valid bcrypt hash
    expect(stored?.passwordHash.startsWith('$2')).toBe(true);

    // Verify bcrypt compare succeeds with the test password
    const matches = await bcrypt.compare(ephemeralTestPassword, stored!.passwordHash);
    expect(matches).toBe(true);

    // Verify bcrypt compare fails with wrong password
    const wrongMatches = await bcrypt.compare('WrongPassword123', stored!.passwordHash);
    expect(wrongMatches).toBe(false);
  });

  // 5. Officer login produces the expected OFFICER JWT role
  it('authenticates provisioned officer credentials and issues valid JWT with OFFICER role', async () => {
    const isolatedStore = new InMemoryTestUserStore();
    const testAuthPass = 'OfficerAuth@TestPass2026';

    await provisionOfficerAccount({
      email: 'officer.auth@mcc.gov.in',
      name: 'Auth Verification Officer',
      ward: 'Ward 48 - Kuvempunagar',
      department: 'MCC Engineering Division',
      password: testAuthPass,
      targetUserStore: isolatedStore,
    });

    // Execute login against isolated store
    const authResult = await loginUser(
      {
        email: 'officer.auth@mcc.gov.in',
        password: testAuthPass,
      },
      isolatedStore
    );

    expect(authResult.token).toBeDefined();
    expect(authResult.user.role).toBe('OFFICER');
    expect(authResult.user.email).toBe('officer.auth@mcc.gov.in');

    // Verify JWT payload claims
    const decoded = verifyToken(authResult.token);
    expect(decoded.role).toBe('OFFICER');
    expect(decoded.email).toBe('officer.auth@mcc.gov.in');
    expect(decoded.ward).toBe('Ward 48 - Kuvempunagar');
    expect(decoded.userId).toBe(authResult.user.id);
  });

  // 6. Existing authentic citizen record remains unchanged
  it('confirms existing authentic citizen record USR-CITIZEN-MU81FLSR-A5XD is preserved and intact', async () => {
    if (CONFIG.DATA_STORE === 'supabase') {
      const citizen = await userStore.findById('USR-CITIZEN-MU81FLSR-A5XD');
      expect(citizen).toBeDefined();
      expect(citizen?.id).toBe('USR-CITIZEN-MU81FLSR-A5XD');
      expect(citizen?.email).toBe('gallikattip@gmail.com');
      expect(citizen?.role).toBe('CITIZEN');
      expect(citizen?.name).toBe('Prasann Gallikatti');
      expect(citizen?.isActive).toBe(true);
    } else {
      // In SQLite mode, verify that isolated provisioning does not touch active userStore
      const usersBefore = await userStore.listAll();
      const isolatedStore = new InMemoryTestUserStore();
      await provisionOfficerAccount({
        email: 'isolated.officer@mcc.gov.in',
        name: 'Isolated Officer',
        ward: 'Ward 48',
        department: 'MCC',
        targetUserStore: isolatedStore,
      });
      const usersAfter = await userStore.listAll();
      expect(usersAfter.length).toBe(usersBefore.length);
    }
  });

  // 7. Existing source complaint remains untouched
  it('confirms existing source complaint MCC-2026-SRC-307753 is preserved and untouched', async () => {
    if (CONFIG.DATA_STORE === 'supabase') {
      const complaint = await complaintStore.findById('MCC-2026-SRC-307753');
      expect(complaint).toBeDefined();
      expect(complaint?.id).toBe('MCC-2026-SRC-307753');
      expect(complaint?.citizenId).toBe('USR-CITIZEN-MU81FLSR-A5XD');
      expect(complaint?.category).toBe('pothole');
      expect(complaint?.status).toBeDefined();
    } else {
      // Non-Supabase mode: verify complaintStore is untouched by provisioning
      const complaintsBefore = await complaintStore.listForOfficer();
      const isolatedStore = new InMemoryTestUserStore();
      await provisionOfficerAccount({
        email: 'isolated.officer2@mcc.gov.in',
        name: 'Isolated Officer 2',
        ward: 'Ward 48',
        department: 'MCC',
        targetUserStore: isolatedStore,
      });
      const complaintsAfter = await complaintStore.listForOfficer();
      expect(complaintsAfter.length).toBe(complaintsBefore.length);
    }
  });

  // 8. Dry-run mode produces full validation result without persisting any records
  it('validates dryRun mode without persisting any records to the target store', async () => {
    const isolatedStore = new InMemoryTestUserStore();

    const dryRunResult = await provisionOfficerAccount({
      email: 'officer.ward48@mcc.gov.in',
      name: 'Ward 48 Officer',
      ward: 'Ward 48 - Kuvempunagar',
      department: 'MCC Engineering Division',
      dryRun: true,
      targetUserStore: isolatedStore,
    });

    expect(dryRunResult.status).toBe('PROVISIONED');
    expect(dryRunResult.isDryRun).toBe(true);
    expect(dryRunResult.user.email).toBe('officer.ward48@mcc.gov.in');
    expect(dryRunResult.user.name).toBe('Ward 48 Officer');
    expect(dryRunResult.user.role).toBe('OFFICER');

    // Confirm that isolatedStore is completely empty
    const stored = await isolatedStore.findByEmail('officer.ward48@mcc.gov.in');
    expect(stored).toBeUndefined();
    const allUsers = await isolatedStore.listAll();
    expect(allUsers.length).toBe(0);
  });
});
