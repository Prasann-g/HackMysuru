import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Server } from 'http';
import { app } from '../src/index.js';
import { userStore } from '../src/db/userStore.js';
import { CONFIG } from '../src/config.js';

describe('Civic Trust Authentication & Role Architecture (Step 4.3A)', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://localhost:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  beforeEach(() => {
    // Reset test user state while keeping pre-seeded officer accounts intact
    userStore.clearNonDefault();
  });

  // 1. Citizen Registration
  it('registers a new citizen with hashed password and role CITIZEN', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register/citizen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ravi Kumar',
        email: 'ravi.kumar@example.com',
        password: 'securePassword123',
        ward: 'Ward 48 - Kuvempunagar',
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.token).toBeDefined();
    expect(data.user.name).toBe('Ravi Kumar');
    expect(data.user.email).toBe('ravi.kumar@example.com');
    expect(data.user.role).toBe('CITIZEN');
    expect(data.user.ward).toBe('Ward 48 - Kuvempunagar');
    // Ensure passwordHash is NEVER exposed to public user
    expect((data.user as any).passwordHash).toBeUndefined();

    // Verify stored password in store is actually hashed
    const stored = userStore.findByEmail('ravi.kumar@example.com');
    expect(stored).toBeDefined();
    expect(stored?.passwordHash).not.toBe('securePassword123');
    expect(stored?.passwordHash.startsWith('$2')).toBe(true);
  });

  // 2. Anti-Escalation: Public Registration strictly forces CITIZEN
  it('strictly forces role to CITIZEN even if client passes role OFFICER or ADMIN', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register/citizen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Attacker Attempting Escalation',
        email: 'attacker@example.com',
        password: 'password123',
        role: 'OFFICER', // Attempted role escalation
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.user.role).toBe('CITIZEN');

    const stored = userStore.findByEmail('attacker@example.com');
    expect(stored?.role).toBe('CITIZEN');
  });

  // 3. Duplicate Registration Rejection
  it('rejects registration if email already exists', async () => {
    await fetch(`${baseUrl}/api/auth/register/citizen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'First User',
        email: 'duplicate.test@example.com',
        password: 'password123',
      }),
    });

    const res = await fetch(`${baseUrl}/api/auth/register/citizen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Second User with same email',
        email: 'duplicate.test@example.com',
        password: 'anotherPassword123',
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('already exists');
  });

  // 4. Password validation on registration
  it('rejects registration if password is too short', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register/citizen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Short Pass User',
        email: 'shortpass@example.com',
        password: '123',
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('at least 6 characters');
  });

  // 5. Citizen Login: Success
  it('authenticates valid credentials and returns signed JWT', async () => {
    // Register first
    await fetch(`${baseUrl}/api/auth/register/citizen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ananya Sharma',
        email: 'ananya@example.com',
        password: 'correctPassword2026',
      }),
    });

    // Login
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ananya@example.com',
        password: 'correctPassword2026',
      }),
    });

    expect(loginRes.status).toBe(200);
    const data = await loginRes.json();
    expect(data.token).toBeDefined();
    expect(data.user.email).toBe('ananya@example.com');
    expect(data.user.role).toBe('CITIZEN');
  });

  // 6. Citizen Login: Wrong Password
  it('rejects login with incorrect password with 401', async () => {
    await fetch(`${baseUrl}/api/auth/register/citizen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Citizen',
        email: 'testcitizen@example.com',
        password: 'realPassword',
      }),
    });

    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'testcitizen@example.com',
        password: 'wrongPassword',
      }),
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('Invalid email or password');
  });

  // 7. Citizen Login: Non-existent Email
  it('rejects login for unknown email with 401', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent.user@example.com',
        password: 'anyPassword',
      }),
    });

    expect(res.status).toBe(401);
  });

  // 8. Session Endpoint (/api/auth/me) with Token
  it('returns authenticated user profile when provided valid JWT', async () => {
    const regRes = await fetch(`${baseUrl}/api/auth/register/citizen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Sunil Rao',
        email: 'sunil.rao@example.com',
        password: 'password1234',
        ward: 'Ward 25 - Gokulam',
      }),
    });
    const { token } = await regRes.json();

    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(meRes.status).toBe(200);
    const data = await meRes.json();
    expect(data.user.email).toBe('sunil.rao@example.com');
    expect(data.user.role).toBe('CITIZEN');
    expect(data.user.ward).toBe('Ward 25 - Gokulam');
  });

  // 9. Session Endpoint (/api/auth/me) without Token
  it('rejects /api/auth/me when Authorization header is missing', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);
    expect(res.status).toBe(401);
  });

  // 10. Session Endpoint with Forged/Tampered Token
  it('rejects forged or corrupted JWT tokens with 401', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Authorization: 'Bearer invalid.tampered.token',
      },
    });
    expect(res.status).toBe(401);
  });

  // 11. Pre-seeded Officer Login
  it('allows pre-seeded MCC Ward 48 officer to log in with role OFFICER', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'officer.ward48@mcc.gov.in',
        password: 'Officer@Mysuru48',
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.token).toBeDefined();
    expect(data.user.role).toBe('OFFICER');
    expect(data.user.name).toBe('Ward 48 Junior Engineer');
    expect(data.user.ward).toBe('Ward 48 - Kuvempunagar');
    expect(data.user.department).toBe('MCC Engineering Division');
  });

  // 12. Controlled Officer Registration: Invalid Invite Code Rejection
  it('rejects officer registration if inviteCode is invalid with 403', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register/officer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Fake Officer',
        email: 'fake.officer@mcc.gov.in',
        password: 'officialPassword123',
        ward: 'Ward 10 - Vijayanagar',
        department: 'MCC Engineering',
        inviteCode: 'WRONG-INVITE-CODE',
      }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('Invalid officer invite authorization code');
  });

  // 13. Controlled Officer Registration: Valid Invite Code
  it('registers a new officer with role OFFICER when valid invite code is provided', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register/officer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Vijayalakshmi Patil',
        email: 'v.patil@mcc.gov.in',
        password: 'officialPassword123',
        ward: 'Ward 10 - Vijayanagar',
        department: 'MCC Health & Sanitation',
        inviteCode: CONFIG.OFFICER_INVITE_SECRET,
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.user.role).toBe('OFFICER');
    expect(data.user.department).toBe('MCC Health & Sanitation');
  });

  // 14. RBAC Protection: Citizen CANNOT access Officer Queue
  it('prevents citizen from accessing officer-only route (returns 403 Forbidden)', async () => {
    // 1. Citizen registers and gets token
    const citizenRes = await fetch(`${baseUrl}/api/auth/register/citizen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Citizen Trying Officer Access',
        email: 'curious.citizen@example.com',
        password: 'password123',
      }),
    });
    const { token: citizenToken } = await citizenRes.json();

    // 2. Citizen tries accessing /api/auth/officer-queue
    const attemptRes = await fetch(`${baseUrl}/api/auth/officer-queue`, {
      headers: {
        Authorization: `Bearer ${citizenToken}`,
      },
    });

    expect(attemptRes.status).toBe(403);
    const data = await attemptRes.json();
    expect(data.error).toContain('Access denied');
  });

  // 15. RBAC Protection: Officer CAN access Officer Queue
  it('allows verified officer to access officer-only route (returns 200 OK)', async () => {
    // Login as Ward 48 officer
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'officer.ward48@mcc.gov.in',
        password: 'Officer@Mysuru48',
      }),
    });
    const { token: officerToken } = await loginRes.json();

    // Access /api/auth/officer-queue
    const officerRes = await fetch(`${baseUrl}/api/auth/officer-queue`, {
      headers: {
        Authorization: `Bearer ${officerToken}`,
      },
    });

    expect(officerRes.status).toBe(200);
    const data = await officerRes.json();
    expect(data.authorized).toBe(true);
    expect(data.user.role).toBe('OFFICER');
  });
});
