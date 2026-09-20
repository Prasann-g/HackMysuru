import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { requestCitizenOtp, verifyCitizenOtp, loginUser } from '../src/services/authService.js';
import { otpStore, otpProvider } from '../src/services/otpServiceInstance.js';
import { userStore } from '../src/db/userStore.js';
import { generateSecureOtp } from '../src/utils/otpUtils.js';

describe('Auth Service - Citizen OTP Integration', () => {
  // No global state resets to avoid cross-file test contamination in parallel runs.
  // We use uniquely generated identifiers instead.

  it('should successfully register a citizen with email OTP', async () => {
    const uniqueId = Date.now().toString(36);
    const identifier = `citizen_${uniqueId}@example.com`;
    const method = 'EMAIL';
    const purpose = 'REGISTER';

    // Request
    const { challengeId } = await requestCitizenOtp({ identifier, method, purpose });
    expect(challengeId).toBeDefined();

    const spy = vi.spyOn(otpProvider, 'sendChallenge');
    await requestCitizenOtp({ identifier: `test2_${uniqueId}@example.com`, method: 'EMAIL', purpose: 'REGISTER' });
    
    expect(spy).toHaveBeenCalled();
    const sentCode = spy.mock.calls[0][1];

    // Verify
    const authResponse = await verifyCitizenOtp({
      identifier: `test2_${uniqueId}@example.com`,
      method: 'EMAIL',
      purpose: 'REGISTER',
      code: sentCode,
      name: 'Test Citizen'
    });

    expect(authResponse.token).toBeDefined();
    expect(authResponse.user.email).toBe(`test2_${uniqueId}@example.com`);
    expect(authResponse.user.role).toBe('CITIZEN');

    spy.mockRestore();
  });

  it('should prevent duplicate citizen registration', async () => {
    const spy = vi.spyOn(otpProvider, 'sendChallenge');
    const uniqueDup = `dup_${Date.now().toString(36)}@example.com`;
    
    await requestCitizenOtp({ identifier: uniqueDup, method: 'EMAIL', purpose: 'REGISTER' });
    const code = spy.mock.calls[0][1];
    await verifyCitizenOtp({ identifier: uniqueDup, method: 'EMAIL', purpose: 'REGISTER', code, name: 'Dup 1' });

    // Requesting again for registration should fail immediately
    await expect(requestCitizenOtp({ identifier: uniqueDup, method: 'EMAIL', purpose: 'REGISTER' }))
      .rejects.toThrow('An account with this identifier already exists.');

    spy.mockRestore();
  });

  it('should allow login via Phone SMS OTP', async () => {
    const spy = vi.spyOn(otpProvider, 'sendChallenge');
    const uniquePhone = `+91999888${Math.floor(1000 + Math.random() * 9000)}`;
    
    // 1. Register with phone
    await requestCitizenOtp({ identifier: uniquePhone, method: 'SMS', purpose: 'REGISTER' });
    const regCode = spy.mock.calls[0][1];
    await verifyCitizenOtp({ identifier: uniquePhone, method: 'SMS', purpose: 'REGISTER', code: regCode, name: 'Phone User' });

    // 2. Request Login
    await requestCitizenOtp({ identifier: uniquePhone, method: 'SMS', purpose: 'LOGIN' }); // Testing normalization here
    const loginCode = spy.mock.calls[1][1];

    // 3. Verify Login
    const authResponse = await verifyCitizenOtp({
      identifier: uniquePhone,
      method: 'SMS',
      purpose: 'LOGIN',
      code: loginCode
    });

    expect(authResponse.token).toBeDefined();
    expect(authResponse.user.email).toBe(uniquePhone); // mapped successfully
    expect(authResponse.user.name).toBe('Phone User');

    spy.mockRestore();
  });

  it('should reject login for non-existent users', async () => {
    await expect(requestCitizenOtp({ identifier: 'ghost@example.com', method: 'EMAIL', purpose: 'LOGIN' }))
      .rejects.toThrow('No account found with this identifier. Please register.');
  });

  it('should leave officer password login perfectly intact', async () => {
    // Relying on default seeded officer: officer.ward48@mcc.gov.in / Officer@Mysuru48
    const authResponse = await loginUser({
      email: 'officer.ward48@mcc.gov.in',
      password: 'Officer@Mysuru48'
    });

    expect(authResponse.token).toBeDefined();
    expect(authResponse.user.role).toBe('OFFICER');
  });
});
