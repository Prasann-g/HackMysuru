import crypto from 'node:crypto';
import type { UserRecord, PublicUser } from '../types/auth.js';
import type { IUserStore } from '../db/interfaces.js';
import { userStore } from '../db/userStore.js';
import { hashPassword, sanitizeUser } from './authService.js';

export interface ProvisionOfficerInput {
  email: string;
  name: string;
  ward: string;
  department: string;
  password?: string;
  targetUserStore?: IUserStore;
  dryRun?: boolean;
}

export interface ProvisionOfficerResult {
  status: 'PROVISIONED' | 'ALREADY_EXISTS';
  user: PublicUser;
  generatedPassword?: string;
  isDryRun?: boolean;
}

/**
 * Validates official email syntax.
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Secure, idempotent provisioning service for municipal officer accounts.
 *
 * Safety guarantees:
 * 1. Idempotent: If the officer account already exists, returns the existing record without
 *    overwriting the password hash or changing the user ID.
 * 2. Role collision protection: If the email is registered as a CITIZEN, rejects provisioning
 *    to prevent privilege collision or account hijacking.
 * 3. Secure password handling: If no password is provided, generates a cryptographically
 *    strong 16-character random password. Never stores plaintext passwords.
 * 4. Store agnostic: Persists via the active IUserStore (Supabase or SQLite).
 */
export async function provisionOfficerAccount(
  input: ProvisionOfficerInput
): Promise<ProvisionOfficerResult> {
  const store = input.targetUserStore || userStore;

  // 1. Input Validation
  if (!input.email || !isValidEmail(input.email.trim())) {
    throw new Error('A valid official email address is required.');
  }

  if (!input.name || input.name.trim().length === 0) {
    throw new Error('Officer full name is required.');
  }

  if (!input.ward || input.ward.trim().length === 0) {
    throw new Error('Assigned MCC Ward is required.');
  }

  if (!input.department || input.department.trim().length === 0) {
    throw new Error('Assigned Department is required.');
  }

  const normalizedEmail = input.email.trim().toLowerCase();

  // 2. Idempotency & Collision Inspection
  const existing = await store.findByEmail(normalizedEmail);
  if (existing) {
    if (existing.role === 'OFFICER') {
      return {
        status: 'ALREADY_EXISTS',
        user: sanitizeUser(existing),
      };
    }
    throw new Error(
      `Cannot provision officer: an account with email "${normalizedEmail}" already exists with role "${existing.role}".`
    );
  }

  // 3. Password Generation or Validation
  let rawPassword: string;
  let wasGenerated = false;

  if (input.password && input.password.length > 0) {
    if (input.password.length < 8) {
      throw new Error('Officer password must be at least 8 characters long.');
    }
    rawPassword = input.password;
  } else {
    // Generate secure 16-character random token (12 random bytes in base64url)
    rawPassword = crypto.randomBytes(12).toString('base64url');
    wasGenerated = true;
  }

  // 4. Salted Bcrypt Hash
  const passwordHash = await hashPassword(rawPassword);

  // 5. Deterministic Identifier for Official MCC accounts, or unique structured ID
  const id =
    normalizedEmail === 'officer.ward48@mcc.gov.in'
      ? 'USR-OFFICER-48'
      : normalizedEmail === 'officer.sanitation@mcc.gov.in'
      ? 'USR-OFFICER-SAN'
      : `USR-OFFICER-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

  const now = new Date().toISOString();
  const officerRecord: UserRecord = {
    id,
    email: normalizedEmail,
    passwordHash,
    name: input.name.trim(),
    role: 'OFFICER',
    ward: input.ward.trim(),
    department: input.department.trim(),
    isActive: true,
    createdAt: now,
  };

  // 6. Persistence to active store (skipped in dry-run mode)
  if (!input.dryRun) {
    await store.save(officerRecord);
  }

  return {
    status: 'PROVISIONED',
    user: sanitizeUser(officerRecord),
    generatedPassword: wasGenerated ? rawPassword : undefined,
    isDryRun: Boolean(input.dryRun),
  };
}
